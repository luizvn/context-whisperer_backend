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

jest.mock('@context-whisperer/database', () => ({
  prisma: {
    scopeProposal: {
      findUnique: (...args: unknown[]) => Promise.resolve(mockProposalFindUnique(...args)),
      findFirst: (...args: unknown[]) => Promise.resolve(mockProposalFindFirst(...args)),
    },
    requisition: {
      update: (...args: unknown[]) => Promise.resolve(mockRequisitionUpdate(...args)),
    },
    template: {
      findUnique: (...args: unknown[]) => Promise.resolve(mockTemplateFindUnique(...args)),
    },
    artifact: {
      findFirst: (...args: unknown[]) => Promise.resolve(mockArtifactFindFirst(...args)),
      create: (...args: unknown[]) => Promise.resolve(mockArtifactCreate(...args)),
    },
  },
}));

describe('artifactDispatcher node', () => {
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
    mockProposalFindUnique.mockResolvedValue(mockApprovedProposal);
    mockProposalFindFirst.mockResolvedValue(mockApprovedProposal);
    mockRequisitionUpdate.mockResolvedValue({ id: 'req-123', status: 'GENERATING_ARTIFACTS' });
    mockTemplateFindUnique.mockResolvedValue(mockReqTemplate);
    mockArtifactFindFirst.mockResolvedValue(null);
    mockArtifactCreate.mockResolvedValue({ id: 'art-001', artifactType: ArtifactType.REQUIREMENTS });
    mockRedisPublish.mockResolvedValue(1);
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
});
