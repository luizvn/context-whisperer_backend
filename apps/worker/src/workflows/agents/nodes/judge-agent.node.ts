import { RunnableConfig } from "@langchain/core/runnables";
import { AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  GraphStateType,
  ArtifactType,
  CausalEvaluationSchema,
  CausalEvaluation,
  TemplateNotFoundException,
  SseEventType,
  SseEventMessage,
} from "@context-whisperer/core";
import { prisma } from "@context-whisperer/database";
import type IORedis from "ioredis";
import { logger } from "../../../utils/logger";

export const judgeAgent = async (
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> => {
  const configurable = config?.configurable;
  const redis = configurable?.redis as IORedis | undefined;
  const threadId = configurable?.thread_id as string | undefined;

  logger.info(
    { requisitionId: state.requisitionId, threadId },
    "Executing judge agent (causal evaluation)",
  );

  // 1. Localiza o artefato de requisitos gerado
  const artifact = await prisma.artifact.findFirst({
    where: {
      requisitionId: state.requisitionId,
      artifactType: ArtifactType.REQUIREMENTS,
    },
  });

  if (!artifact || !artifact.generatedContent) {
    logger.warn(
      { requisitionId: state.requisitionId },
      "No requirements artifact content found for evaluation",
    );
    return {
      evaluationStatus: {
        [ArtifactType.REQUIREMENTS]: "FAILED",
      },
      evaluationFeedback: {
        [ArtifactType.REQUIREMENTS]:
          "Artefato de requisitos não encontrado ou sem conteúdo gerado para avaliação.",
      },
    };
  }

  // 2. Busca o template de prompt do juiz
  const judgePromptTemplate = await prisma.template.findUnique({
    where: { name: "judge_requirements_prompt" },
  });

  if (!judgePromptTemplate) {
    throw new TemplateNotFoundException("judge_requirements_prompt");
  }

  // 3. Busca as QualityConstraints ativas para REQUIREMENTS
  const constraints = await prisma.qualityConstraint.findMany({
    where: {
      artifactType: ArtifactType.REQUIREMENTS,
      isActive: true,
    },
    orderBy: { severity: "asc" },
  });

  const constraintsText = constraints
    .map(
      (c) =>
        `- [${c.code}] (${c.severity}) ${c.title}:\n  Descrição: ${c.description}\n  Remédio esperado: ${c.remedyHint || "Corrija o requisito conforme as boas práticas."}`,
    )
    .join("\n\n");

  // 4. Monta o prompt de avaliação causal
  const evaluationPrompt = `${judgePromptTemplate.content}

=== RESTRIÇÕES FORMAIS DE QUALIDADE (CATÁLOGO) ===
${constraintsText}

=== DADOS DO PROJETO ===
Projeto: ${state.projectRequest?.name ?? "Projeto"}
Prompt Original do Usuário:
${state.projectRequest?.prompt ?? ""}

Escopo Aprovado:
${state.approvedScopeContent || "Escopo aprovado conforme acordado."}

=== ESPECIFICAÇÃO DE REQUISITOS GERADA PARA AVALIAÇÃO ===
${artifact.generatedContent}
`;

  const modelName = process.env.OPENAI_MODEL || "gpt-4o";
  const model = new ChatOpenAI({
    modelName,
    temperature: 0.0,
    apiKey: process.env.OPENAI_API_KEY,
  });

  const structuredJudge = model.withStructuredOutput(CausalEvaluationSchema, {
    includeRaw: true,
  });

  const startTime = performance.now();
  const rawResult = (await structuredJudge.invoke(evaluationPrompt)) as {
    parsed: CausalEvaluation;
    raw: AIMessage;
  };
  const latencyMs = Math.round(performance.now() - startTime);

  const parsed = rawResult.parsed ?? rawResult;
  const rawMessage = rawResult.raw;

  // Extração de métricas de tokens e modelo
  const promptTokens =
    rawMessage?.usage_metadata?.input_tokens ??
    (rawMessage?.response_metadata?.token_usage as { prompt_tokens?: number })
      ?.prompt_tokens ??
    null;

  const completionTokens =
    rawMessage?.usage_metadata?.output_tokens ??
    (
      rawMessage?.response_metadata?.token_usage as {
        completion_tokens?: number;
      }
    )?.completion_tokens ??
    null;

  const totalTokens =
    rawMessage?.usage_metadata?.total_tokens ??
    (rawMessage?.response_metadata?.token_usage as { total_tokens?: number })
      ?.total_tokens ??
    (promptTokens && completionTokens ? promptTokens + completionTokens : null);

  const resolvedModel =
    (rawMessage?.response_metadata?.model_name as string) ?? modelName;

  // 5. Política de Decisão Causal Híbrida (Veto Portão + Nota de Corte via Env)
  const minPassingScore = Number(process.env.JUDGE_MIN_PASSING_SCORE ?? 8.0);
  const hasCritical = parsed.violations?.some((v) => v.severity === "CRITICAL");
  const isApproved = !hasCritical && parsed.score >= minPassingScore;
  const finalStatus: "PASSED" | "FAILED" = isApproved ? "PASSED" : "FAILED";

  logger.info(
    {
      requisitionId: state.requisitionId,
      finalStatus,
      score: parsed.score,
      minPassingScore,
      hasCritical,
      violationsCount: parsed.violations?.length ?? 0,
      latencyMs,
      totalTokens,
    },
    "Judge causal evaluation completed",
  );

  // 6. Persistência de ArtifactEvaluation no MongoDB
  const currentIteration = (artifact.iterationCount ?? 0) + 1;

  const evaluation = await prisma.artifactEvaluation.create({
    data: {
      artifactId: artifact.id,
      requisitionId: state.requisitionId,
      iteration: currentIteration,
      status: finalStatus,
      score: parsed.score,
      summary: parsed.summary,
      rootCauses: parsed.rootCauses,
      violations: parsed.violations,
      counterfactualFeedback: parsed.counterfactualFeedback,
      model: resolvedModel,
      promptTokens: promptTokens ?? undefined,
      completionTokens: completionTokens ?? undefined,
      totalTokens: totalTokens ?? undefined,
      latencyMs,
    },
  });

  // 7. Atualização de estado e emissão de eventos
  if (isApproved) {
    // Marca Artifact como COMPLETED
    await prisma.artifact.update({
      where: { id: artifact.id },
      data: { status: "COMPLETED" },
    });

    if (redis && state.userId) {
      const artifactCompletedEvent: SseEventMessage = {
        type: SseEventType.ARTIFACT_COMPLETED,
        userId: state.userId,
        requisitionId: state.requisitionId,
        threadId: threadId ?? undefined,
        timestamp: new Date().toISOString(),
        data: {
          artifactType: ArtifactType.REQUIREMENTS,
          fileName: artifact.fileName,
          contentMd: artifact.generatedContent,
        },
      };
      await redis.publish(
        `USER_EVENTS_${state.userId}`,
        JSON.stringify(artifactCompletedEvent),
      );
    }

    // Marca Requisition como COMPLETED
    await prisma.requisition.update({
      where: { id: state.requisitionId },
      data: { status: "COMPLETED" },
    });

    if (redis && state.userId) {
      const completedEvent: SseEventMessage = {
        type: SseEventType.REQUISITION_STATUS_CHANGED,
        userId: state.userId,
        requisitionId: state.requisitionId,
        threadId: threadId ?? undefined,
        timestamp: new Date().toISOString(),
        data: { status: "COMPLETED" },
      };
      await redis.publish(
        `USER_EVENTS_${state.userId}`,
        JSON.stringify(completedEvent),
      );
    }
  } else {
    // Marca Artifact como NEEDS_REVISION
    await prisma.artifact.update({
      where: { id: artifact.id },
      data: { status: "NEEDS_REVISION" },
    });
  }

  return {
    currentEvaluationId: evaluation.id,
    evaluationStatus: {
      [ArtifactType.REQUIREMENTS]: finalStatus,
    },
    evaluationFeedback: isApproved
      ? undefined
      : {
          [ArtifactType.REQUIREMENTS]: parsed.counterfactualFeedback,
        },
    messages: [
      new AIMessage(
        `[JudgeAgent] Evaluated ${ArtifactType.REQUIREMENTS} (Iteration ${currentIteration}): Status=${finalStatus}, Score=${parsed.score}.`,
      ),
    ],
  };
};
