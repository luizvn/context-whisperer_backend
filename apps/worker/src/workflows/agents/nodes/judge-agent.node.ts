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

  // 3. Busca e seleção contextual de QualityConstraints para REQUIREMENTS
  const allActiveConstraints = await prisma.qualityConstraint.findMany({
    where: {
      artifactType: ArtifactType.REQUIREMENTS,
      isActive: true,
    },
    orderBy: { severity: "asc" },
  });

  const textToScan = [
    state.projectRequest?.name ?? "",
    state.projectRequest?.prompt ?? "",
    state.approvedScopeContent ?? "",
    artifact.generatedContent ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const selectedConstraints = allActiveConstraints.filter((constraint) => {
    // Regras Core (universais) são mandatórias e sempre incluídas
    const isCore =
      constraint.isCore === true ||
      (constraint.isCore === undefined &&
        (!constraint.contextKeywords ||
          constraint.contextKeywords.length === 0));

    if (isCore) {
      return true;
    }

    // Regras contextuais: ativadas se pelo menos uma keyword der match no texto do projeto
    if (constraint.contextKeywords && constraint.contextKeywords.length > 0) {
      return constraint.contextKeywords.some((kw) =>
        textToScan.includes(kw.toLowerCase().trim()),
      );
    }

    return false;
  });

  logger.info(
    {
      requisitionId: state.requisitionId,
      totalAvailable: allActiveConstraints.length,
      selectedCount: selectedConstraints.length,
      coreCount: selectedConstraints.filter((c) => c.isCore !== false).length,
      contextualCount: selectedConstraints.filter((c) => c.isCore === false)
        .length,
    },
    "Curated quality constraints selected for causal evaluation",
  );

  const constraintsText = selectedConstraints
    .map((c) => {
      const sourceInfo = c.sourceReference
        ? ` [Fonte: ${c.sourceReference}]`
        : "";
      const categoryInfo = c.category ? ` [Categoria: ${c.category}]` : "";
      return `- [${c.code}] (${c.severity})${categoryInfo}${sourceInfo} ${c.title}:\n  Descrição: ${c.description}\n  Remédio esperado: ${c.remedyHint || "Corrija o requisito conforme as boas práticas."}`;
    })
    .join("\n\n");

  // 4. Monta o prompt de avaliação causal com consciência de iteração e contexto de revisão
  const currentIteration = (artifact.iterationCount ?? 0) + 1;
  let revisionContext = "";

  if (currentIteration > 1) {
    const previousEvaluation = await prisma.artifactEvaluation.findFirst({
      where: {
        artifactId: artifact.id,
        iteration: currentIteration - 1,
      },
      orderBy: { createdAt: "desc" },
    });

    if (previousEvaluation) {
      const previousViolationsList =
        (previousEvaluation.violations as Array<{
          ruleCode?: string;
          severity?: string;
          remedy?: string;
        }>) || [];
      const criticalPoints = previousViolationsList
        .map(
          (v) =>
            `- [${v.severity ?? "VIOLAÇÃO"}] ${v.ruleCode ?? "REGRA"}: ${v.remedy || "Correção requerida"}`,
        )
        .join("\n");

      revisionContext = `
=== CONTEXTO DE ITERAÇÃO SUBSEQUENTE (REVISÃO EM CICLO DE REWORK) ===
Esta é a Iteração ${currentIteration} de refinamento do artefato.
Na iteração anterior (Iteração ${currentIteration - 1}), foram identificados os seguintes apontamentos:
${criticalPoints || "- Nenhum apontamento individual estruturado registrado."}

Feedback contrafactual fornecido ao especialista:
"${previousEvaluation.counterfactualFeedback || "Ajustar especificações conforme apontamentos."}"

DIRETRIZ DE AVALIAÇÃO DE REVISÃO:
1. Avalie prioritariamente se os apontamentos e causas-raiz da iteração anterior foram sanados nesta nova versão.
2. Não desloque critérios ou exija novos escopos arbitrários que não constavam nas deficiências apontadas, exceto se a alteração introduziu uma nova violação crítica manifesta.
3. Se os problemas reportados anteriormente foram adequadamente corrigidos e os requisitos atendem ao escopo com critérios de teste e segurança essencial, valide a conformidade e reconheça o mérito do refinamento.
`;
    }
  }

  const evaluationPrompt = `${judgePromptTemplate.content}

=== RESTRIÇÕES FORMAIS DE QUALIDADE (CATÁLOGO) ===
${constraintsText}

=== DADOS DO PROJETO ===
Projeto: ${state.projectRequest?.name ?? "Projeto"}
Prompt Original do Usuário:
${state.projectRequest?.prompt ?? ""}

Escopo Aprovado:
${state.approvedScopeContent || "Escopo aprovado conforme acordado."}
${revisionContext}
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
        projectName: state.projectRequest.name,
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
