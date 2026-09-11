import { requirementsAgent } from '../../../src/workflows/agents/nodes/requirements-agent.node';
import {
  GraphStateType,
  ArtifactType,
  RequirementsResponse,
  TemplateNotFoundException,
} from '@context-whisperer/core';
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
const mockArtifactUpdateMany = jest.fn();
const mockRequisitionUpdate = jest.fn();

jest.mock('@context-whisperer/database', () => ({
  prisma: {
    template: {
      findUnique: (...args: unknown[]) =>
        Promise.resolve(mockTemplateFindUnique(...args)),
    },
    artifact: {
      updateMany: (...args: unknown[]) =>
        Promise.resolve(mockArtifactUpdateMany(...args)),
    },
    requisition: {
      update: (...args: unknown[]) =>
        Promise.resolve(mockRequisitionUpdate(...args)),
    },
  },
}));

describe('requirementsAgent node', () => {
  const mockRedisPublish = jest.fn();
  const mockRedis = {
    publish: mockRedisPublish,
  } as unknown as IORedis;

  const mockState: GraphStateType = {
    projectRequest: {
      name: 'Super App',
      prompt: 'Build a fintech super app',
      artifacts: [ArtifactType.REQUIREMENTS],
    },
    requisitionId: 'req-123',
    userId: 'user-456',
    scopeProposalId: 'prop-789',
    approvedScopeContent: '# Approved Scope Content for Super App',
    messages: [],
  };

  const mockConfig: RunnableConfig = {
    configurable: {
      thread_id: 'thread-789',
      redis: mockRedis,
    },
  };

  const mockLlmResponse: RequirementsResponse = {
    summary: 'Executive summary of Super App requirements',
    functionalRequirements: [
      {
        id: 'RF-01',
        title: 'User Authentication',
        description: 'System must allow users to authenticate via JWT',
        priority: 'HIGH',
      },
    ],
    nonFunctionalRequirements: [
      {
        id: 'RNF-01',
        category: 'Performance',
        description: 'Response time must be below 200ms for 95% of queries',
      },
    ],
    businessRules: [
      {
        id: 'RN-01',
        description: 'Users cannot withdraw more than $5000 per day',
      },
    ],
  };

  const mockPromptTemplate = {
    id: 'tmpl-req-prompt',
    name: 'default_requirements',
    content: 'Você é um Engenheiro de Requisitos de Software Sênior.',
  };

  const mockResponseTemplate = {
    id: 'tmpl-req-resp',
    name: 'default_requirements_response',
    content: `# Requisitos\n{{summary}}\n{{functionalRequirements}}\n{{nonFunctionalRequirements}}\n{{businessRules}}`,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTemplateFindUnique.mockImplementation(
      ({ where }: { where: { name: string } }) => {
        if (where.name === 'default_requirements')
          return Promise.resolve(mockPromptTemplate);
        if (where.name === 'default_requirements_response')
          return Promise.resolve(mockResponseTemplate);
        return Promise.resolve(null);
      },
    );
    mockInvoke.mockResolvedValue(mockLlmResponse);
    mockArtifactUpdateMany.mockResolvedValue({ count: 1 });
    mockRequisitionUpdate.mockResolvedValue({
      id: 'req-123',
      status: 'COMPLETED',
    });
    mockRedisPublish.mockResolvedValue(1);
  });

  it('should generate requirements, save to artifact as EVALUATING, and leave completion/SSE to judgeAgent', async () => {
    const result = await requirementsAgent(mockState, mockConfig);

    expect(mockTemplateFindUnique).toHaveBeenCalledWith({
      where: { name: 'default_requirements' },
    });
    expect(mockTemplateFindUnique).toHaveBeenCalledWith({
      where: { name: 'default_requirements_response' },
    });
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('# Approved Scope Content for Super App'),
    );
    expect(mockArtifactUpdateMany).toHaveBeenCalledWith({
      where: {
        requisitionId: 'req-123',
        artifactType: ArtifactType.REQUIREMENTS,
      },
      data: {
        status: 'EVALUATING',
        generatedContent: expect.stringContaining(
          'RF-01 - User Authentication',
        ),
      },
    });
    expect(mockRequisitionUpdate).not.toHaveBeenCalled();
    expect(mockRedisPublish).not.toHaveBeenCalled();
    expect(result.messages?.[0].content).toContain(
      'aguardando avaliação técnica',
    );
  });

  it('should include counterfactual feedback in prompt when refining artifact', async () => {
    const stateWithFeedback: GraphStateType = {
      ...mockState,
      evaluationFeedback: {
        [ArtifactType.REQUIREMENTS]:
          'Corrija RF-01 para detalhar expiração de tokens e RNF-01 para quantificar limites de concorrência.',
      },
    };

    const result = await requirementsAgent(stateWithFeedback, mockConfig);

    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining(
        'AVALIAÇÃO TÉCNICA ANTERIOR E INSTRUÇÕES DE CORREÇÃO (FEEDBACK CONTRAFACTUAL)',
      ),
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining(
        'Corrija RF-01 para detalhar expiração de tokens',
      ),
    );
    expect(result.messages?.[0].content).toContain(
      'refinada com base no feedback contrafactual',
    );
  });

  it('should throw error without fallback if default_requirements prompt template is missing', async () => {
    mockTemplateFindUnique.mockImplementation(
      ({ where }: { where: { name: string } }) => {
        if (where.name === 'default_requirements') return Promise.resolve(null);
        return Promise.resolve(mockResponseTemplate);
      },
    );

    await expect(requirementsAgent(mockState, mockConfig)).rejects.toThrow(
      TemplateNotFoundException,
    );
  });

  it('should throw error without fallback if default_requirements_response template is missing', async () => {
    mockTemplateFindUnique.mockImplementation(
      ({ where }: { where: { name: string } }) => {
        if (where.name === 'default_requirements')
          return Promise.resolve(mockPromptTemplate);
        return Promise.resolve(null);
      },
    );

    await expect(requirementsAgent(mockState, mockConfig)).rejects.toThrow(
      TemplateNotFoundException,
    );
  });
});
