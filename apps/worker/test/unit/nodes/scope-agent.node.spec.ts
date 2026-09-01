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

const mockTemplateFindUnique = jest.fn();
const mockScopeProposalCreate = jest.fn();
const mockRequisitionUpdate = jest.fn();

jest.mock('@context-whisperer/database', () => ({
  prisma: {
    template: {
      findUnique: (...args: unknown[]) => Promise.resolve(mockTemplateFindUnique(...args)),
    },
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

  const mockPromptTemplate = {
    id: 'tmpl-prompt-001',
    name: 'default_scope',
    description: 'Template de Prompt MoSCoW',
    content: 'Você é um Engenheiro de Requisitos Sênior rigoroso.',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockResponseTemplate = {
    id: 'tmpl-response-002',
    name: 'default_scope_response',
    description: 'Template de Resposta MoSCoW',
    content: `# Proposta de Escopo\n\n## 🎯 Objetivo do Projeto\n{{projectGoal}}\n\n## ✅ Must Have (Indispensável)\n{{mustHave}}\n\n## 🚀 Should Have (Importante)\n{{shouldHave}}\n\n## ✨ Could Have (Desejável)\n{{couldHave}}\n\n## 🚫 Won't Have (Fora de Escopo)\n{{wontHave}}\n\n{{businessConstraints}}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreatedProposal = {
    id: 'prop-999',
    requisitionId: 'req-123',
    templateId: 'tmpl-response-002',
    contentMd: '# Proposta de Escopo',
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTemplateFindUnique.mockImplementation(({ where }: { where: { name: string } }) => {
      if (where.name === 'default_scope') return Promise.resolve(mockPromptTemplate);
      if (where.name === 'default_scope_response') return Promise.resolve(mockResponseTemplate);
      return Promise.resolve(null);
    });
  });

  it('should fetch prompt and response templates from DB, invoke LLM, format markdown with response template and persist proposal', async () => {
    mockInvoke.mockResolvedValue(mockLlmResponse);
    mockScopeProposalCreate.mockResolvedValue(mockCreatedProposal);
    mockRequisitionUpdate.mockResolvedValue({ id: 'req-123', status: 'AWAITING_SCOPE' });
    mockRedisPublish.mockResolvedValue(1);

    const result = await scopeAgent(mockState, mockConfig);

    expect(mockTemplateFindUnique).toHaveBeenCalledWith({ where: { name: 'default_scope' } });
    expect(mockTemplateFindUnique).toHaveBeenCalledWith({ where: { name: 'default_scope_response' } });
    expect(mockInvoke).toHaveBeenCalledWith(expect.stringContaining('Você é um Engenheiro de Requisitos Sênior rigoroso.'));
    expect(mockScopeProposalCreate).toHaveBeenCalledWith({
      data: {
        requisitionId: 'req-123',
        templateId: 'tmpl-response-002',
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
      expect.stringContaining('"type":"SCOPE_READY"'),
    );
    expect(result.scopeProposalId).toBe('prop-999');
    expect(result.messages).toHaveLength(1);
    expect(result.messages?.[0].content).toContain('Escopo gerado com sucesso');
  });

  it('should throw error without fallback if prompt template default_scope is not found in database', async () => {
    mockTemplateFindUnique.mockImplementation(({ where }: { where: { name: string } }) => {
      if (where.name === 'default_scope') return Promise.resolve(null);
      return Promise.resolve(mockResponseTemplate);
    });

    await expect(scopeAgent(mockState, mockConfig)).rejects.toThrow(
      "Template 'default_scope' não encontrado no banco de dados.",
    );
    expect(mockScopeProposalCreate).not.toHaveBeenCalled();
  });

  it('should throw error without fallback if response template default_scope_response is not found in database', async () => {
    mockTemplateFindUnique.mockImplementation(({ where }: { where: { name: string } }) => {
      if (where.name === 'default_scope') return Promise.resolve(mockPromptTemplate);
      return Promise.resolve(null);
    });

    await expect(scopeAgent(mockState, mockConfig)).rejects.toThrow(
      "Template 'default_scope_response' não encontrado no banco de dados.",
    );
    expect(mockScopeProposalCreate).not.toHaveBeenCalled();
  });
});
