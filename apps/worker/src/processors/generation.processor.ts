import { prisma } from '@context-whisperer/database';
import { CreateProjectInput } from '@context-whisperer/core';
import type IORedis from 'ioredis';

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
    data: { status: 'GENERATING' },
  });

  const initialState = {
    projectRequest,
    messages: [],
    requisitionId,
    userId,
    scopeProposalId: '',
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
      data: { status: 'FAILED' },
    });

    throw err;
  }
}
