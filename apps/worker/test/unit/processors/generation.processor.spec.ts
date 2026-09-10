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
  const mockPublish = jest.fn();
  const mockRedis = {
    publish: mockPublish,
  } as unknown as IORedis;

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

    expect(mockRedis.publish).toHaveBeenCalledWith(
      'USER_EVENTS_user-proc-456',
      expect.stringContaining('"type":"WORKFLOW_FAILED"'),
    );
  });

  it('should handle action APPROVE by updating graph state and resuming graph invocation', async () => {
    const approveJob = {
      id: 'job-approve-1',
      data: {
        requisitionId: 'req-proc-123',
        userId: 'user-proc-456',
        threadId: 'thread-proc-789',
        action: 'APPROVE' as const,
      },
    };

    const mockUpdateState = jest.fn().mockResolvedValue(undefined);
    const mockInvoke = jest.fn().mockResolvedValue({ status: 'COMPLETED' });

    const mockGraph: GraphRunner = {
      invoke: mockInvoke,
      updateState: mockUpdateState,
    };

    const result = await processGenerationJob(approveJob, mockGraph, mockRedis);

    expect(mockUpdateState).toHaveBeenCalledWith(
      { configurable: { thread_id: 'thread-proc-789' } },
      { scopeApproved: true },
    );
    expect(mockInvoke).toHaveBeenCalledWith(null, {
      configurable: {
        thread_id: 'thread-proc-789',
        redis: mockRedis,
      },
    });
    expect(result).toEqual({ status: 'COMPLETED' });
  });

  it('should handle action REJECT by updating requisition to GENERATING, updating state with feedback and resuming graph', async () => {
    mockRequisitionUpdate.mockResolvedValue({ id: 'req-proc-123', status: 'GENERATING' });

    const rejectJob = {
      id: 'job-reject-1',
      data: {
        requisitionId: 'req-proc-123',
        userId: 'user-proc-456',
        threadId: 'thread-proc-789',
        action: 'REJECT' as const,
        feedback: 'Please simplify the scope to MVP only',
      },
    };

    const mockUpdateState = jest.fn().mockResolvedValue(undefined);
    const mockInvoke = jest.fn().mockResolvedValue({ scopeProposalId: 'prop-new' });

    const mockGraph: GraphRunner = {
      invoke: mockInvoke,
      updateState: mockUpdateState,
    };

    const result = await processGenerationJob(rejectJob, mockGraph, mockRedis);

    expect(mockRequisitionUpdate).toHaveBeenCalledWith({
      where: { id: 'req-proc-123' },
      data: { status: 'GENERATING' },
    });
    expect(mockPublish).toHaveBeenCalledWith(
      'USER_EVENTS_user-proc-456',
      expect.stringContaining('"type":"REQUISITION_STATUS_CHANGED"'),
    );
    expect(mockUpdateState).toHaveBeenCalledWith(
      { configurable: { thread_id: 'thread-proc-789' } },
      { scopeApproved: false, userFeedback: 'Please simplify the scope to MVP only' },
    );
    expect(mockInvoke).toHaveBeenCalledWith(null, {
      configurable: {
        thread_id: 'thread-proc-789',
        redis: mockRedis,
      },
    });
    expect(result).toEqual({ scopeProposalId: 'prop-new' });
  });
});
