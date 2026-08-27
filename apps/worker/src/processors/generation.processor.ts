import { prisma } from "@context-whisperer/database";
import {
  CreateProjectInput,
  SseEventType,
  SseEventMessage,
} from "@context-whisperer/core";
import type IORedis from "ioredis";

export interface GenerationJobData {
  projectRequest: CreateProjectInput;
  requisitionId: string;
  userId: string;
  threadId: string;
}

export interface GraphRunner {
  invoke: (state: unknown, config: unknown) => Promise<unknown>;
}

export async function processGenerationJob(
  job: { id?: string; data: GenerationJobData },
  graph: GraphRunner,
  redisPublisher?: IORedis,
) {
  const { projectRequest, requisitionId, userId, threadId } = job.data;

  // 1. Marca requisição como em geração
  await prisma.requisition.update({
    where: { id: requisitionId },
    data: { status: "GENERATING" },
  });

  if (redisPublisher && userId) {
    const startEvent: SseEventMessage = {
      type: SseEventType.REQUISITION_STATUS_CHANGED,
      userId,
      requisitionId,
      threadId,
      timestamp: new Date().toISOString(),
      data: { status: "GENERATING" },
    };
    await redisPublisher.publish(
      `USER_EVENTS_${userId}`,
      JSON.stringify(startEvent),
    );
  }

  const initialState = {
    projectRequest,
    messages: [],
    requisitionId,
    userId,
    scopeProposalId: "",
  };

  try {
    const result = await graph.invoke(initialState, {
      configurable: {
        thread_id: threadId,
        redis: redisPublisher,
      },
    });
    return result;
  } catch (err) {
    // Marca requisição como falha se der erro
    await prisma.requisition.update({
      where: { id: requisitionId },
      data: { status: "FAILED" },
    });

    if (redisPublisher && userId) {
      const failEvent: SseEventMessage = {
        type: SseEventType.WORKFLOW_FAILED,
        userId,
        requisitionId,
        threadId,
        timestamp: new Date().toISOString(),
        data: { error: err instanceof Error ? err.message : "Unknown error" },
      };
      await redisPublisher.publish(
        `USER_EVENTS_${userId}`,
        JSON.stringify(failEvent),
      );
    }

    throw err;
  }
}
