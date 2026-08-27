import { processGenerationJob, GenerationJobData, GraphRunner } from '../../../src/processors/generation.processor';
import { ArtifactType } from '@context-whisperer/core';
import type IORedis from 'ioredis';

const mockRequisitionUpdate = jest.fn();

jest.mock('@context-whisperer/database', () => ({
  prisma: {
    requisition: {
      update: (...args: unknown[]) => Promise.resolve(mockRequisitionUpdate(...args)),
    },
  },
}));

describe('generation.processor', () => {
  const mockRedis = {} as IORedis;

  const mockJobData: GenerationJobData = {
    projectRequest: {
      name: 'E-commerce Microservices',
      prompt: 'Design a microservices architecture for e-commerce',
      artifacts: [ArtifactType.ARCHITECTURE_DOC, ArtifactType.API_SPEC],
    },
    requisitionId: 'req-proc-123',
    userId: 'user-proc-456',
    threadId: 'thread-proc-789',
  };

  const mockJob = {
    id: 'job-123',
    data: mockJobData,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should transition requisition status to GENERATING, invoke graph and return result', async () => {
    mockRequisitionUpdate.mockResolvedValue({ id: 'req-proc-123', status: 'GENERATING' });

    const mockGraphResult = {
      scopeProposalId: 'prop-abc',
      messages: [],
    };

    const mockGraph: GraphRunner = {
      invoke: jest.fn().mockResolvedValue(mockGraphResult),
    };

    const result = await processGenerationJob(mockJob, mockGraph, mockRedis);

    expect(mockRequisitionUpdate).toHaveBeenCalledWith({
      where: { id: 'req-proc-123' },
      data: { status: 'GENERATING' },
    });

    expect(mockGraph.invoke).toHaveBeenCalledWith(
      {
        projectRequest: mockJobData.projectRequest,
        messages: [],
        requisitionId: 'req-proc-123',
        userId: 'user-proc-456',
        scopeProposalId: '',
      },
      {
        configurable: {
          thread_id: 'thread-proc-789',
          redis: mockRedis,
        },
      },
    );

    expect(result).toEqual(mockGraphResult);
  });

  it('should mark requisition as FAILED and rethrow error when graph invocation fails', async () => {
    mockRequisitionUpdate.mockResolvedValue({ id: 'req-proc-123' });

    const mockGraph: GraphRunner = {
      invoke: jest.fn().mockRejectedValue(new Error('OpenAI RateLimit / Network Error')),
    };

    await expect(processGenerationJob(mockJob, mockGraph, mockRedis)).rejects.toThrow(
      'OpenAI RateLimit / Network Error',
    );

    expect(mockRequisitionUpdate).toHaveBeenCalledWith({
      where: { id: 'req-proc-123' },
      data: { status: 'GENERATING' },
    });

    expect(mockRequisitionUpdate).toHaveBeenCalledWith({
      where: { id: 'req-proc-123' },
      data: { status: 'FAILED' },
    });
  });
});
