import { recommendedPromptAgent } from '../../../src/workflows/agents/nodes/recommended-prompt-agent.node';
import {
  GraphStateType,
  ArtifactType,
  RecommendedPromptResponse,
  SseEventType,
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
const mockArtifactFindMany = jest.fn();
const mockArtifactCreate = jest.fn();
const mockRequisitionUpdate = jest.fn();

jest.mock('@context-whisperer/database', () => ({
  prisma: {
    template: {
      findUnique: (...args: unknown[]) =>
        Promise.resolve(mockTemplateFindUnique(...args)),
    },
    artifact: {
      findMany: (...args: unknown[]) =>
        Promise.resolve(mockArtifactFindMany(...args)),
      create: (...args: unknown[]) =>
        Promise.resolve(mockArtifactCreate(...args)),
    },
    requisition: {
      update: (...args: unknown[]) =>
        Promise.resolve(mockRequisitionUpdate(...args)),
    },
  },
}));

describe('recommendedPromptAgent node', () => {
  const mockRedisPublish = jest.fn();
  const mockRedis = {
    publish: mockRedisPublish,
  } as unknown as IORedis;

  const mockState: GraphStateType = {
    projectRequest: {
      name: 'MedConnect',
      prompt: 'Build a telemedicine platform',
      artifacts: [ArtifactType.REQUIREMENTS],
    },
    requisitionId: 'req-123',
    userId: 'user-456',
    scopeProposalId: 'prop-789',
    approvedScopeContent: '# Approved Scope Content for MedConnect',
    messages: [],
  };

  const mockConfig: RunnableConfig = {
    configurable: {
      thread_id: 'thread-789',
      redis: mockRedis,
    },
  };

  const mockLlmResponse: RecommendedPromptResponse = {
    projectOverview: 'Plataforma de telemedicina para consultas remotas e prontuário.',
    recommendedStack: 'Next.js 14, NestJS Fastify, Prisma, PostgreSQL e TailwindCSS.',
    implementationRoadmap: [
      'Fase 1: Setup do banco de dados e autenticação 2FA.',
      'Fase 2: Gestão de prontuário e anotações clínicas com histórico imutável.',
      'Fase 3: Sala de teleconsulta com WebRTC e emissão de receitas.',
    ],
    masterPrompt: '# Você é um Engenheiro Fullstack Sênior\nConstrua o MVP da MedConnect...',
    usageInstructions: 'Copie o bloco acima e cole no chat do Cursor ou no arquivo .cursorrules.',
  };

  const mockPromptTemplate = {
    id: 'tmpl-prompt-001',
    name: 'default_recommended_prompt',
    content: 'Você é um Especialista em Engenharia de Prompt para AI Coding.',
  };

  const mockResponseTemplate = {
    id: 'tmpl-resp-001',
    name: 'default_recommended_prompt_response',
    content: `# 🚀 Prompt Recomendado para Geração do MVP\n{{projectOverview}}\n{{recommendedStack}}\n{{implementationRoadmap}}\n{{masterPrompt}}\n{{usageInstructions}}`,
  };

  const mockRequirementsArtifact = {
    id: 'art-req-001',
    requisitionId: 'req-123',
    artifactType: ArtifactType.REQUIREMENTS,
    fileName: 'requirements.md',
    generatedContent: '# Requisitos\nRF-01: Login\nRF-02: Consulta',
    status: 'COMPLETED',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTemplateFindUnique.mockImplementation(
      ({ where }: { where: { name: string } }) => {
        if (where.name === 'default_recommended_prompt')
          return Promise.resolve(mockPromptTemplate);
        if (where.name === 'default_recommended_prompt_response')
          return Promise.resolve(mockResponseTemplate);
        return Promise.resolve(null);
      },
    );

    mockArtifactFindMany.mockResolvedValue([mockRequirementsArtifact]);
    mockArtifactCreate.mockImplementation(({ data }: { data: unknown }) =>
      Promise.resolve({ id: 'art-prompt-999', ...(data as object) }),
    );
    mockRequisitionUpdate.mockResolvedValue({ id: 'req-123', status: 'COMPLETED' });
    mockInvoke.mockResolvedValue(mockLlmResponse);
    mockRedisPublish.mockResolvedValue(1);
  });

  it('should synthesize master prompt, persist RECOMMENDED_PROMPT artifact and complete requisition', async () => {
    const result = await recommendedPromptAgent(mockState, mockConfig);

    expect(mockTemplateFindUnique).toHaveBeenCalledWith({
      where: { name: 'default_recommended_prompt' },
    });
    expect(mockTemplateFindUnique).toHaveBeenCalledWith({
      where: { name: 'default_recommended_prompt_response' },
    });

    expect(mockArtifactFindMany).toHaveBeenCalledWith({
      where: {
        requisitionId: 'req-123',
        status: 'COMPLETED',
      },
      select: {
        fileName: true,
        artifactType: true,
        generatedContent: true,
      },
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('- docs/requirements.md (FONTE PRIMÁRIA DA VERDADE TÉCNICA'),
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('# Requisitos\nRF-01: Login\nRF-02: Consulta'),
    );

    expect(mockArtifactCreate).toHaveBeenCalledWith({
      data: {
        requisitionId: 'req-123',
        templateId: 'tmpl-resp-001',
        artifactType: ArtifactType.RECOMMENDED_PROMPT,
        fileName: 'recommended_mvp_prompt.md',
        generatedContent: expect.stringContaining(
          '# Você é um Engenheiro Fullstack Sênior',
        ),
        status: 'COMPLETED',
        iterationCount: 1,
      },
    });

    expect(mockRequisitionUpdate).toHaveBeenCalledWith({
      where: { id: 'req-123' },
      data: { status: 'COMPLETED' },
    });

    // Eventos SSE via Redis
    expect(mockRedisPublish).toHaveBeenCalledTimes(2);
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'USER_EVENTS_user-456',
      expect.stringContaining(SseEventType.ARTIFACT_COMPLETED),
    );
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'USER_EVENTS_user-456',
      expect.stringContaining(SseEventType.REQUISITION_STATUS_CHANGED),
    );
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'USER_EVENTS_user-456',
      expect.stringContaining('"projectName":"MedConnect"'),
    );

    expect(result.generatedArtifactIds).toEqual(['art-prompt-999']);
    expect(result.messages?.[0].content).toContain(
      '[RecommendedPromptAgent] Generated AI-ready master prompt for MVP',
    );
  });

  it('should throw TemplateNotFoundException if default_recommended_prompt is missing', async () => {
    mockTemplateFindUnique.mockImplementation(
      ({ where }: { where: { name: string } }) => {
        if (where.name === 'default_recommended_prompt')
          return Promise.resolve(null);
        return Promise.resolve(mockResponseTemplate);
      },
    );

    await expect(
      recommendedPromptAgent(mockState, mockConfig),
    ).rejects.toThrow(TemplateNotFoundException);
  });

  it('should throw TemplateNotFoundException if default_recommended_prompt_response is missing', async () => {
    mockTemplateFindUnique.mockImplementation(
      ({ where }: { where: { name: string } }) => {
        if (where.name === 'default_recommended_prompt')
          return Promise.resolve(mockPromptTemplate);
        return Promise.resolve(null);
      },
    );

    await expect(
      recommendedPromptAgent(mockState, mockConfig),
    ).rejects.toThrow(TemplateNotFoundException);
  });

  it('should sanitize and strip outer markdown fences from masterPrompt to prevent double fence bug', async () => {
    mockInvoke.mockResolvedValueOnce({
      ...mockLlmResponse,
      masterPrompt: '```markdown\n# Master Prompt Sem Fences Externas\nConteudo limpo\n```',
    });

    await recommendedPromptAgent(mockState, mockConfig);

    expect(mockArtifactCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        generatedContent: expect.not.stringContaining('```markdown\n```markdown'),
      }),
    });
  });
});
