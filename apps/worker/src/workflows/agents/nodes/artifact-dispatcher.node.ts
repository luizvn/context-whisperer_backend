import { RunnableConfig } from "@langchain/core/runnables";
import {
  GraphStateType,
  SseEventType,
  SseEventMessage,
  ArtifactType,
  TemplateNotFoundException,
  UnsupportedArtifactTypeException,
} from "@context-whisperer/core";
import { prisma, ScopeProposal } from "@context-whisperer/database";
import type IORedis from "ioredis";
import { logger } from "../../../utils/logger";

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

    return {
      artifactIterations: {
        [ArtifactType.REQUIREMENTS]: nextIteration,
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
