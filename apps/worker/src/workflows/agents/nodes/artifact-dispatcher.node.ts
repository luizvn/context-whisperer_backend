import { RunnableConfig } from "@langchain/core/runnables";
import {
  GraphStateType,
  SseEventType,
  SseEventMessage,
  ArtifactType,
  TemplateNotFoundException,
  UnsupportedArtifactTypeException,
} from "@context-whisperer/core";
import {
  prisma,
  ScopeProposal,
  ArtifactEvaluation,
} from "@context-whisperer/database";
import type IORedis from "ioredis";
import { logger } from "../../../utils/logger";

interface CausalViolationItem {
  ruleCode?: string;
  severity?: string;
  location?: string;
  cause?: string;
  remedy?: string;
}

function formatStructuredFeedback(
  evaluation: {
    score?: number;
    status?: string;
    summary?: string;
    rootCauses?: string[];
    violations?: unknown;
    counterfactualFeedback?: string | null;
  } | null,
  iteration: number,
  fallbackFeedback?: string,
): string {
  if (!evaluation) {
    return (
      fallbackFeedback ||
      "Artefato reprovado em avaliação técnica anterior. Aplique as correções necessárias com base no escopo aprovado."
    );
  }

  const violations = Array.isArray(evaluation.violations)
    ? (evaluation.violations as CausalViolationItem[])
    : [];

  const violationsList =
    violations.length > 0
      ? violations
          .map(
            (v, idx) =>
              `${idx + 1}. [${v.severity ?? "CRITICAL"}] Regra ${v.ruleCode ?? "N/A"} em "${v.location ?? "Geral"}":\n   - Causa-Raiz: ${v.cause ?? "Não detalhada"}\n   - Remédio Contrafactual: ${v.remedy ?? "Corrija conforme as especificações"}`,
          )
          .join("\n")
      : "_Nenhuma violação formal específica listada._";

  const rootCausesList =
    evaluation.rootCauses && evaluation.rootCauses.length > 0
      ? evaluation.rootCauses.map((c) => `- ${c}`).join("\n")
      : "_Não informadas._";

  return `### 📊 Diagnóstico Causal da Avaliação Anterior (Tentativa ${iteration})
- **Status:** ${evaluation.status ?? "FAILED"} | **Nota Obtida:** ${evaluation.score ?? "N/A"}/10.0
- **Resumo Executivo:** ${evaluation.summary ?? "Necessita revisão técnica."}

### 🔍 Principais Fatores de Causa-Raiz:
${rootCausesList}

### ⚠️ Violações Formais Identificadas (Pontos de Atenção Imediata):
${violationsList}

### 🛠️ Diretrizes Contrafactuais para Auto-Correção:
${evaluation.counterfactualFeedback ?? fallbackFeedback ?? "Ajuste os requisitos para sanar todas as violações acima."}`;
}

export const artifactDispatcher = async (
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> => {
  const configurable = config?.configurable;
  const redis = configurable?.redis as IORedis | undefined;
  const threadId = configurable?.thread_id as string | undefined;

  logger.info(
    { requisitionId: state.requisitionId, threadId },
    "Executing artifact dispatcher node",
  );

  // 1. Localiza a proposta aprovada correspondente
  let proposal: ScopeProposal | null = null;
  if (state.scopeProposalId) {
    proposal = await prisma.scopeProposal.findUnique({
      where: { id: state.scopeProposalId },
    });
  }

  if (!proposal) {
    proposal = await prisma.scopeProposal.findFirst({
      where: {
        requisitionId: state.requisitionId,
        status: "APPROVED",
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // 2. Verifica se é um ciclo de retrabalho originado de reprovação do Agente Juiz
  const isRequirementsFailed =
    state.evaluationStatus?.[ArtifactType.REQUIREMENTS] === "FAILED";

  if (isRequirementsFailed) {
    const maxRetries = Number(process.env.JUDGE_MAX_RETRIES ?? 2);
    const existingArtifact = await prisma.artifact.findFirst({
      where: {
        requisitionId: state.requisitionId,
        artifactType: ArtifactType.REQUIREMENTS,
      },
    });

    const currentIteration = existingArtifact?.iterationCount ?? 0;

    if (currentIteration >= maxRetries) {
      logger.warn(
        {
          requisitionId: state.requisitionId,
          currentIteration,
          maxRetries,
        },
        "Circuit breaker triggered: max rework attempts reached for REQUIREMENTS artifact",
      );

      if (existingArtifact) {
        await prisma.artifact.update({
          where: { id: existingArtifact.id },
          data: { status: "FAILED_WITH_WARNINGS" },
        });
      }

      await prisma.requisition.update({
        where: { id: state.requisitionId },
        data: { status: "COMPLETED_WITH_WARNINGS" },
      });

      if (redis && state.userId) {
        const statusEvent: SseEventMessage = {
          type: SseEventType.REQUISITION_STATUS_CHANGED,
          userId: state.userId,
          requisitionId: state.requisitionId,
          projectName: state.projectRequest.name,
          threadId: threadId ?? undefined,
          timestamp: new Date().toISOString(),
          data: { status: "COMPLETED_WITH_WARNINGS" },
        };
        await redis.publish(
          `USER_EVENTS_${state.userId}`,
          JSON.stringify(statusEvent),
        );
      }

      return {
        retryExhausted: true,
      };
    }

    const nextIteration = currentIteration + 1;
    logger.info(
      {
        requisitionId: state.requisitionId,
        nextIteration,
        maxRetries,
      },
      "Dispatching REQUIREMENTS artifact for rework with judge feedback",
    );

    if (existingArtifact) {
      await prisma.artifact.update({
        where: { id: existingArtifact.id },
        data: {
          iterationCount: nextIteration,
          status: "REVISING",
        },
      });
    }

    // Busca a avaliação técnica correspondente para estruturar o feedback
    let latestEvaluation: ArtifactEvaluation | null = null;
    if (existingArtifact) {
      if (state.currentEvaluationId) {
        latestEvaluation = await prisma.artifactEvaluation.findUnique({
          where: { id: state.currentEvaluationId },
        });
      }
      if (!latestEvaluation) {
        latestEvaluation = await prisma.artifactEvaluation.findFirst({
          where: { artifactId: existingArtifact.id },
          orderBy: { createdAt: "desc" },
        });
      }
    }

    const structuredFeedback = formatStructuredFeedback(
      latestEvaluation,
      nextIteration,
      state.evaluationFeedback?.[ArtifactType.REQUIREMENTS],
    );

    const previousContent = existingArtifact?.generatedContent ?? "";

    if (redis && state.userId) {
      const reworkEvent: SseEventMessage = {
        type: SseEventType.ARTIFACT_REWORKING,
        userId: state.userId,
        requisitionId: state.requisitionId,
        projectName: state.projectRequest.name,
        threadId: threadId ?? undefined,
        timestamp: new Date().toISOString(),
        data: {
          artifactType: ArtifactType.REQUIREMENTS,
          fileName: existingArtifact?.fileName ?? "requirements.md",
          artifactId: existingArtifact?.id,
          iterationCount: nextIteration,
          score: latestEvaluation?.score,
          summary: latestEvaluation?.summary,
          rootCauses: latestEvaluation?.rootCauses ?? [],
        },
      };
      await redis.publish(
        `USER_EVENTS_${state.userId}`,
        JSON.stringify(reworkEvent),
      );
    }

    return {
      artifactIterations: {
        [ArtifactType.REQUIREMENTS]: nextIteration,
      },
      evaluationFeedback: {
        [ArtifactType.REQUIREMENTS]: structuredFeedback,
      },
      previousArtifactsContent: {
        [ArtifactType.REQUIREMENTS]: previousContent,
      },
    };
  }

  // 3. Modo Inicial: Atualiza status da requisição para GENERATING_ARTIFACTS
  await prisma.requisition.update({
    where: { id: state.requisitionId },
    data: { status: "GENERATING_ARTIFACTS" },
  });

  if (redis && state.userId) {
    const statusEvent: SseEventMessage = {
      type: SseEventType.REQUISITION_STATUS_CHANGED,
      userId: state.userId,
      requisitionId: state.requisitionId,
      projectName: state.projectRequest.name,
      threadId: threadId ?? undefined,
      timestamp: new Date().toISOString(),
      data: { status: "GENERATING_ARTIFACTS" },
    };
    await redis.publish(
      `USER_EVENTS_${state.userId}`,
      JSON.stringify(statusEvent),
    );
  }

  // 4. Inicializa registros em Artifact e emite ARTIFACT_GENERATING
  const generatedArtifactIds: string[] = [];
  const requestedArtifacts = state.projectRequest?.artifacts ?? [];

  for (const artifactType of requestedArtifacts) {
    if (!Object.values(ArtifactType).includes(artifactType)) {
      throw new UnsupportedArtifactTypeException(String(artifactType));
    }
  }

  if (requestedArtifacts.includes(ArtifactType.REQUIREMENTS)) {
    const reqTemplate = await prisma.template.findUnique({
      where: { name: "default_requirements_response" },
    });

    if (!reqTemplate) {
      throw new TemplateNotFoundException("default_requirements_response");
    }

    const existingArtifact = await prisma.artifact.findFirst({
      where: {
        requisitionId: state.requisitionId,
        artifactType: ArtifactType.REQUIREMENTS,
      },
    });

    let artifactId = existingArtifact?.id;
    if (!existingArtifact) {
      const created = await prisma.artifact.create({
        data: {
          requisitionId: state.requisitionId,
          templateId: reqTemplate.id,
          artifactType: ArtifactType.REQUIREMENTS,
          fileName: "requirements.md",
          status: "DRAFT",
        },
      });
      artifactId = created.id;
    }

    if (artifactId) {
      generatedArtifactIds.push(artifactId);
    }

    if (redis && state.userId) {
      const genEvent: SseEventMessage = {
        type: SseEventType.ARTIFACT_GENERATING,
        userId: state.userId,
        requisitionId: state.requisitionId,
        projectName: state.projectRequest.name,
        threadId: threadId ?? undefined,
        timestamp: new Date().toISOString(),
        data: {
          artifactType: ArtifactType.REQUIREMENTS,
          fileName: "requirements.md",
          artifactId,
        },
      };
      await redis.publish(
        `USER_EVENTS_${state.userId}`,
        JSON.stringify(genEvent),
      );
    }
  }

  return {
    approvedScopeContent: proposal?.contentMd ?? "",
    generatedArtifactIds,
  };
};
