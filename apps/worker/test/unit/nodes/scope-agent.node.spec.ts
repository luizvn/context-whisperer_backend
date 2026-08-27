import { scopeAgent } from '../../../src/workflows/agents/nodes/scope-agent.node';
import { GraphStateType, ArtifactType, ProposedScopeResponse } from '@context-whisperer/core';
import { RunnableConfig } from '@langchain/core/runnables';
import type IORedis from 'ioredis';

const mockInvoke = jest.fn();
const mockWithStructuredOutput = jest.fn().mockReturnValue({
  invoke: (...args: unknown[]) => Promise.resolve(mockInvoke(...args)),
});

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: mockWithStructuredOutput,
  })),
}));

const mockScopeProposalCreate = jest.fn();
const mockRequisitionUpdate = jest.fn();

jest.mock('@context-whisperer/database', () => ({
  prisma: {
    scopeProposal: {
      create: (...args: unknown[]) => Promise.resolve(mockScopeProposalCreate(...args)),
    },
    requisition: {
      update: (...args: unknown[]) => Promise.resolve(mockRequisitionUpdate(...args)),
    },
  },
}));

describe('scopeAgent node', () => {
  const mockRedisPublish = jest.fn();
  const mockRedis = {
    publish: mockRedisPublish,
  } as unknown as IORedis;

  const mockState: GraphStateType = {
    projectRequest: {
      name: 'Smart Task Manager',
      prompt: 'I want a task management app with AI priorities',
      artifacts: [ArtifactType.REQUIREMENTS, ArtifactType.API_SPEC],
    },
    requisitionId: 'req-123',
    userId: 'user-456',
    scopeProposalId: '',
    messages: [],
  };

  const mockConfig: RunnableConfig = {
    configurable: {
      thread_id: 'thread-789',
      redis: mockRedis,
    },
  };

  const mockLlmResponse: ProposedScopeResponse = {
    projectGoal: 'Build an AI-powered Task Manager',
    mustHave: ['Task CRUD', 'AI Prioritization'],
    shouldHave: ['Kanban Board View'],
    couldHave: ['Dark Theme'],
    wontHave: ['WearOS companion app'],
    businessConstraints: ['Budget under $50/mo for OpenAI', 'Max 2s response time'],
  };

  const mockCreatedProposal = {
    id: 'prop-999',
    requisitionId: 'req-123',
    templateId: 'default',
    contentMd: '# Proposta de Escopo',
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call structured LLM, persist proposal, update requisition and publish to Redis', async () => {
    mockInvoke.mockResolvedValue(mockLlmResponse);
    mockScopeProposalCreate.mockResolvedValue(mockCreatedProposal);
    mockRequisitionUpdate.mockResolvedValue({ id: 'req-123', status: 'AWAITING_SCOPE' });
    mockRedisPublish.mockResolvedValue(1);

    const result = await scopeAgent(mockState, mockConfig);

    expect(mockInvoke).toHaveBeenCalled();
    expect(mockScopeProposalCreate).toHaveBeenCalledWith({
      data: {
        requisitionId: 'req-123',
        templateId: 'default',
        contentMd: expect.stringContaining('## 🎯 Objetivo do Projeto\nBuild an AI-powered Task Manager'),
        status: 'PENDING',
      },
    });
    expect(mockRequisitionUpdate).toHaveBeenCalledWith({
      where: { id: 'req-123' },
      data: { status: 'AWAITING_SCOPE' },
    });
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'USER_EVENTS_user-456',
      expect.stringContaining('"type":"SCOPE_GENERATED"'),
    );
    expect(result.scopeProposalId).toBe('prop-999');
    expect(result.messages).toHaveLength(1);
    expect(result.messages?.[0].content).toContain('Escopo gerado com sucesso');
  });

  it('should work cleanly even when redis publisher is not passed in config', async () => {
    mockInvoke.mockResolvedValue(mockLlmResponse);
    mockScopeProposalCreate.mockResolvedValue(mockCreatedProposal);
    mockRequisitionUpdate.mockResolvedValue({ id: 'req-123', status: 'AWAITING_SCOPE' });

    const configWithoutRedis: RunnableConfig = {
      configurable: {
        thread_id: 'thread-789',
      },
    };

    const result = await scopeAgent(mockState, configWithoutRedis);

    expect(mockScopeProposalCreate).toHaveBeenCalled();
    expect(mockRequisitionUpdate).toHaveBeenCalled();
    expect(mockRedisPublish).not.toHaveBeenCalled();
    expect(result.scopeProposalId).toBe('prop-999');
  });
});
