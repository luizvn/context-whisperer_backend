import { artifactDispatcher } from '../../../src/workflows/agents/nodes/artifact-dispatcher.node';
import {
  GraphStateType,
  ArtifactType,
  SseEventType,
  TemplateNotFoundException,
} from '@context-whisperer/core';
import { RunnableConfig } from '@langchain/core/runnables';
import type IORedis from 'ioredis';

const mockProposalFindUnique = jest.fn();
const mockProposalFindFirst = jest.fn();
const mockRequisitionUpdate = jest.fn();
const mockTemplateFindUnique = jest.fn();
const mockArtifactFindFirst = jest.fn();
const mockArtifactCreate = jest.fn();
const mockArtifactUpdate = jest.fn();
const mockEvaluationFindUnique = jest.fn();
const mockEvaluationFindFirst = jest.fn();

jest.mock('@context-whisperer/database', () => ({
  prisma: {
    scopeProposal: {
      findUnique: (...args: unknown[]) =>
        Promise.resolve(mockProposalFindUnique(...args)),
      findFirst: (...args: unknown[]) =>
        Promise.resolve(mockProposalFindFirst(...args)),
    },
    requisition: {
      update: (...args: unknown[]) =>
        Promise.resolve(mockRequisitionUpdate(...args)),
    },
    template: {
      findUnique: (...args: unknown[]) =>
        Promise.resolve(mockTemplateFindUnique(...args)),
    },
    artifact: {
      findFirst: (...args: unknown[]) =>
        Promise.resolve(mockArtifactFindFirst(...args)),
      create: (...args: unknown[]) =>
        Promise.resolve(mockArtifactCreate(...args)),
      update: (...args: unknown[]) =>
        Promise.resolve(mockArtifactUpdate(...args)),
    },
    artifactEvaluation: {
      findUnique: (...args: unknown[]) =>
        Promise.resolve(mockEvaluationFindUnique(...args)),
      findFirst: (...args: unknown[]) =>
        Promise.resolve(mockEvaluationFindFirst(...args)),
    },
  },
}));

describe('artifactDispatcher node', () => {
  const originalEnv = process.env;
  const mockRedisPublish = jest.fn();
  const mockRedis = {
    publish: mockRedisPublish,
  } as unknown as IORedis;

  const mockState: GraphStateType = {
    projectRequest: {
      name: 'E-commerce Platform',
      prompt: 'Build a store with checkout',
      artifacts: [ArtifactType.REQUIREMENTS],
    },
    requisitionId: 'req-123',
    userId: 'user-456',
    scopeProposalId: 'prop-789',
    messages: [],
  };

  const mockConfig: RunnableConfig = {
    configurable: {
      thread_id: 'thread-789',
      redis: mockRedis,
    },
  };

  const mockApprovedProposal = {
    id: 'prop-789',
    requisitionId: 'req-123',
    templateId: 'tmpl-1',
    contentMd: '# Approved Scope Content',
    status: 'APPROVED',
  };

  const mockReqTemplate = {
    id: 'tmpl-req-response',
    name: 'default_requirements_response',
    content: 'template',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.JUDGE_MAX_RETRIES;

    mockProposalFindUnique.mockResolvedValue(mockApprovedProposal);
    mockProposalFindFirst.mockResolvedValue(mockApprovedProposal);
    mockRequisitionUpdate.mockResolvedValue({
      id: 'req-123',
      status: 'GENERATING_ARTIFACTS',
    });
    mockTemplateFindUnique.mockResolvedValue(mockReqTemplate);
    mockArtifactFindFirst.mockResolvedValue(null);
    mockArtifactCreate.mockResolvedValue({
      id: 'art-001',
      artifactType: ArtifactType.REQUIREMENTS,
    });
    mockArtifactUpdate.mockResolvedValue({
      id: 'art-001',
      status: 'REVISING',
    });
    mockRedisPublish.mockResolvedValue(1);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should update requisition to GENERATING_ARTIFACTS, create draft artifact and emit SSE events', async () => {
    const result = await artifactDispatcher(mockState, mockConfig);

    expect(mockRequisitionUpdate).toHaveBeenCalledWith({
      where: { id: 'req-123' },
      data: { status: 'GENERATING_ARTIFACTS' },
    });
    expect(mockArtifactCreate).toHaveBeenCalledWith({
      data: {
        requisitionId: 'req-123',
        templateId: 'tmpl-req-response',
        artifactType: ArtifactType.REQUIREMENTS,
        fileName: 'requirements.md',
        status: 'DRAFT',
      },
    });
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'USER_EVENTS_user-456',
      expect.stringContaining(SseEventType.REQUISITION_STATUS_CHANGED),
    );
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'USER_EVENTS_user-456',
      expect.stringContaining(SseEventType.ARTIFACT_GENERATING),
    );
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'USER_EVENTS_user-456',
      expect.stringContaining('"projectName":"E-commerce Platform"'),
    );
    expect(result.approvedScopeContent).toBe('# Approved Scope Content');
    expect(result.generatedArtifactIds).toEqual(['art-001']);
  });

  it('should reuse existing artifact if already created', async () => {
    mockArtifactFindFirst.mockResolvedValue({ id: 'art-existing' });

    const result = await artifactDispatcher(mockState, mockConfig);

    expect(mockArtifactCreate).not.toHaveBeenCalled();
    expect(result.generatedArtifactIds).toEqual(['art-existing']);
  });

  it('should throw error without fallback if requirements template is missing in database', async () => {
    mockTemplateFindUnique.mockResolvedValue(null);

    await expect(artifactDispatcher(mockState, mockConfig)).rejects.toThrow(
      TemplateNotFoundException,
    );
  });

  it('should handle rework loop when REQUIREMENTS evaluation failed and iterationCount < maxRetries', async () => {
    const reworkState: GraphStateType = {
      ...mockState,
      evaluationStatus: {
        [ArtifactType.REQUIREMENTS]: 'FAILED',
      },
      evaluationFeedback: {
        [ArtifactType.REQUIREMENTS]: 'Add missing RF-02',
      },
    };

    mockArtifactFindFirst.mockResolvedValue({
      id: 'art-001',
      fileName: 'requirements.md',
      iterationCount: 0,
      status: 'NEEDS_REVISION',
      generatedContent: '# Previous Requirements Content\n### RF-01 - Login',
    });

    mockEvaluationFindFirst.mockResolvedValue({
      id: 'eval-001',
      score: 6.0,
      status: 'FAILED',
      summary: 'Faltam critérios de aceite no RF-01',
      rootCauses: ['Critérios de aceite ausentes'],
      violations: [
        {
          ruleCode: 'REQ_ISO29148_TESTABILITY',
          severity: 'CRITICAL',
          location: 'RF-01',
          cause: 'Critérios de teste não especificados',
          remedy: 'Adicione critérios de aceitação verificáveis.',
        },
      ],
      counterfactualFeedback: 'Corrija o RF-01 incluindo critérios verificáveis.',
    });

    const result = await artifactDispatcher(reworkState, mockConfig);

    expect(mockArtifactUpdate).toHaveBeenCalledWith({
      where: { id: 'art-001' },
      data: {
        iterationCount: 1,
        status: 'REVISING',
      },
    });
    expect(result.artifactIterations?.[ArtifactType.REQUIREMENTS]).toBe(1);
    expect(result.retryExhausted).toBeUndefined();
    expect(result.evaluationFeedback?.[ArtifactType.REQUIREMENTS]).toContain(
      'Diagnóstico Causal da Avaliação Anterior (Tentativa 1)',
    );
    expect(result.evaluationFeedback?.[ArtifactType.REQUIREMENTS]).toContain(
      'REQ_ISO29148_TESTABILITY',
    );
    expect(result.previousArtifactsContent?.[ArtifactType.REQUIREMENTS]).toBe(
      '# Previous Requirements Content\n### RF-01 - Login',
    );
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'USER_EVENTS_user-456',
      expect.stringContaining(SseEventType.ARTIFACT_REWORKING),
    );
  });

  it('should trigger circuit breaker when iterationCount reaches maxRetries (default: 2)', async () => {
    const reworkState: GraphStateType = {
      ...mockState,
      evaluationStatus: {
        [ArtifactType.REQUIREMENTS]: 'FAILED',
      },
    };

    mockArtifactFindFirst.mockResolvedValue({
      id: 'art-001',
      iterationCount: 2,
      status: 'NEEDS_REVISION',
    });

    const result = await artifactDispatcher(reworkState, mockConfig);

    expect(mockArtifactUpdate).toHaveBeenCalledWith({
      where: { id: 'art-001' },
      data: { status: 'FAILED_WITH_WARNINGS' },
    });
    expect(mockRequisitionUpdate).toHaveBeenCalledWith({
      where: { id: 'req-123' },
      data: { status: 'COMPLETED_WITH_WARNINGS' },
    });
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'USER_EVENTS_user-456',
      expect.stringContaining('COMPLETED_WITH_WARNINGS'),
    );
    expect(result.retryExhausted).toBe(true);
  });

  it('should respect custom JUDGE_MAX_RETRIES environment variable', async () => {
    process.env.JUDGE_MAX_RETRIES = '1';

    const reworkState: GraphStateType = {
      ...mockState,
      evaluationStatus: {
        [ArtifactType.REQUIREMENTS]: 'FAILED',
      },
    };

    mockArtifactFindFirst.mockResolvedValue({
      id: 'art-001',
      iterationCount: 1,
      status: 'NEEDS_REVISION',
    });

    const result = await artifactDispatcher(reworkState, mockConfig);

    expect(result.retryExhausted).toBe(true);
    expect(mockArtifactUpdate).toHaveBeenCalledWith({
      where: { id: 'art-001' },
      data: { status: 'FAILED_WITH_WARNINGS' },
    });
  });
});
