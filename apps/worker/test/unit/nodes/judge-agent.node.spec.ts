import { judgeAgent } from '../../../src/workflows/agents/nodes/judge-agent.node';
import {
  GraphStateType,
  ArtifactType,
  SseEventType,
  TemplateNotFoundException,
  CausalEvaluation,
} from '@context-whisperer/core';
import { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage } from '@langchain/core/messages';
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

const mockArtifactFindFirst = jest.fn();
const mockArtifactUpdate = jest.fn();
const mockTemplateFindUnique = jest.fn();
const mockConstraintFindMany = jest.fn();
const mockEvaluationCreate = jest.fn();
const mockEvaluationFindFirst = jest.fn();
const mockRequisitionUpdate = jest.fn();

jest.mock('@context-whisperer/database', () => ({
  prisma: {
    artifact: {
      findFirst: (...args: unknown[]) =>
        Promise.resolve(mockArtifactFindFirst(...args)),
      update: (...args: unknown[]) =>
        Promise.resolve(mockArtifactUpdate(...args)),
    },
    template: {
      findUnique: (...args: unknown[]) =>
        Promise.resolve(mockTemplateFindUnique(...args)),
    },
    qualityConstraint: {
      findMany: (...args: unknown[]) =>
        Promise.resolve(mockConstraintFindMany(...args)),
    },
    artifactEvaluation: {
      create: (...args: unknown[]) =>
        Promise.resolve(mockEvaluationCreate(...args)),
      findFirst: (...args: unknown[]) =>
        Promise.resolve(mockEvaluationFindFirst(...args)),
    },
    requisition: {
      update: (...args: unknown[]) =>
        Promise.resolve(mockRequisitionUpdate(...args)),
    },
  },
}));

describe('judgeAgent node (causal evaluation)', () => {
  const originalEnv = process.env;
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

  const mockArtifact = {
    id: 'art-001',
    requisitionId: 'req-123',
    artifactType: ArtifactType.REQUIREMENTS,
    fileName: 'requirements.md',
    generatedContent: '# Especificação Técnica de Requisitos\nRF-01: Login',
    status: 'EVALUATING',
    iterationCount: 0,
  };

  const mockJudgePromptTemplate = {
    id: 'tmpl-judge',
    name: 'judge_requirements_prompt',
    content: 'Você é um Avaliador Causal de Arquitetura e Requisitos.',
  };

  const mockConstraints = [
    {
      id: 'qc-1',
      code: 'REQ_MOSCOW_COVERAGE',
      artifactType: 'REQUIREMENTS',
      title: 'Cobertura Integral do MoSCoW',
      description: 'Todos os Must Haves devem ter RF correspondente.',
      type: 'INVARIANT',
      severity: 'CRITICAL',
      remedyHint: 'Formule um novo RF.',
      isActive: true,
    },
    {
      id: 'qc-2',
      code: 'REQ_NO_PREMATURE_TECH_STACK',
      artifactType: 'REQUIREMENTS',
      title: 'Não Prescrição Prematura de Stack',
      description: 'Não especifique bibliotecas internas.',
      type: 'NEGATIVE_CONSTRAINT',
      severity: 'WARNING',
      remedyHint: 'Foque nas regras de negócio.',
      isActive: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.JUDGE_MIN_PASSING_SCORE;
    delete process.env.JUDGE_MAX_RETRIES;

    mockArtifactFindFirst.mockResolvedValue(mockArtifact);
    mockTemplateFindUnique.mockResolvedValue(mockJudgePromptTemplate);
    mockConstraintFindMany.mockResolvedValue(mockConstraints);
    mockArtifactUpdate.mockResolvedValue({ ...mockArtifact, status: 'COMPLETED' });
    mockRequisitionUpdate.mockResolvedValue({ id: 'req-123', status: 'COMPLETED' });
    mockEvaluationCreate.mockResolvedValue({ id: 'eval-001' });
    mockEvaluationFindFirst.mockResolvedValue(null);
    mockRedisPublish.mockResolvedValue(1);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should approve artifact when score >= 8.0 and no critical violations exist (PASSED)', async () => {
    const passedEvaluation: CausalEvaluation = {
      score: 8.8,
      summary: 'Requisitos consistentes e em total conformidade com o escopo.',
      rootCauses: [],
      violations: [
        {
          ruleCode: 'REQ_NO_PREMATURE_TECH_STACK',
          severity: 'WARNING',
          location: 'RF-02',
          cause: 'Menção discreta de PostgreSQL',
          remedy: 'Substitua por persistência relacional genérica.',
        },
      ],
      counterfactualFeedback:
        'Artefato robusto. Apenas remova a menção direta ao PostgreSQL em iterações futuras.',
    };

    const mockRawMessage = new AIMessage({
      content: JSON.stringify(passedEvaluation),
    });
    (mockRawMessage as any).usage_metadata = {
      input_tokens: 1500,
      output_tokens: 300,
      total_tokens: 1800,
    };
    (mockRawMessage as any).response_metadata = {
      model_name: 'gpt-4o-2024-08-06',
    };

    mockInvoke.mockResolvedValue({
      parsed: passedEvaluation,
      raw: mockRawMessage,
    });

    const result = await judgeAgent(mockState, mockConfig);

    // Verificações determinísticas
    expect(result.evaluationStatus?.[ArtifactType.REQUIREMENTS]).toBe('PASSED');
    expect(result.evaluationFeedback).toBeUndefined();
    expect(result.currentEvaluationId).toBe('eval-001');

    // Verificação de persistência
    expect(mockEvaluationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        artifactId: 'art-001',
        requisitionId: 'req-123',
        iteration: 1,
        status: 'PASSED',
        score: 8.8,
        promptTokens: 1500,
        completionTokens: 300,
        totalTokens: 1800,
        model: 'gpt-4o-2024-08-06',
      }),
    });

    // Verificação de atualização e eventos SSE
    expect(mockArtifactUpdate).toHaveBeenCalledWith({
      where: { id: 'art-001' },
      data: { status: 'COMPLETED' },
    });
    expect(mockRequisitionUpdate).toHaveBeenCalledWith({
      where: { id: 'req-123' },
      data: { status: 'COMPLETED' },
    });
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'USER_EVENTS_user-456',
      expect.stringContaining(SseEventType.ARTIFACT_COMPLETED),
    );
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'USER_EVENTS_user-456',
      expect.stringContaining(SseEventType.REQUISITION_STATUS_CHANGED),
    );
  });

  it('should reject artifact if critical violation exists even if score >= 8.0 (Critical Veto Portão)', async () => {
    const criticalEvaluation: CausalEvaluation = {
      score: 8.5, // Score alto, mas com violação crítica!
      summary: 'Artefato bem escrito, mas omitiu um Must Have crítico.',
      rootCauses: ['Omissão do módulo de pagamentos obrigatório'],
      violations: [
        {
          ruleCode: 'REQ_MOSCOW_COVERAGE',
          severity: 'CRITICAL',
          location: 'Seção RF',
          cause: 'O Must Have de Checkout Pix não gerou nenhum RF.',
          remedy: 'Adicione RF-03 descrevendo o fluxo de checkout Pix.',
        },
      ],
      counterfactualFeedback:
        'Se você formular o RF-03 com o fluxo de checkout Pix, a regra REQ_MOSCOW_COVERAGE será satisfeita.',
    };

    const mockRawMessage = new AIMessage({
      content: JSON.stringify(criticalEvaluation),
    });

    mockInvoke.mockResolvedValue({
      parsed: criticalEvaluation,
      raw: mockRawMessage,
    });

    const result = await judgeAgent(mockState, mockConfig);

    expect(result.evaluationStatus?.[ArtifactType.REQUIREMENTS]).toBe('FAILED');
    expect(result.evaluationFeedback?.[ArtifactType.REQUIREMENTS]).toBe(
      criticalEvaluation.counterfactualFeedback,
    );

    expect(mockEvaluationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'FAILED',
        score: 8.5,
      }),
    });

    expect(mockArtifactUpdate).toHaveBeenCalledWith({
      where: { id: 'art-001' },
      data: { status: 'NEEDS_REVISION' },
    });
    expect(mockRequisitionUpdate).not.toHaveBeenCalled();
    expect(mockRedisPublish).not.toHaveBeenCalled();
  });

  it('should reject artifact if score < minPassingScore (8.0 by default) without critical violations', async () => {
    const lowScoreEvaluation: CausalEvaluation = {
      score: 7.2, // Abaixo de 8.0
      summary: 'Especificação técnica com diversas fragilidades e RNFs sem métricas.',
      rootCauses: ['Critérios vagos em requisitos não funcionais'],
      violations: [
        {
          ruleCode: 'REQ_NO_PREMATURE_TECH_STACK',
          severity: 'WARNING',
          location: 'RF-01',
          cause: 'Detalhes excessivos de banco',
          remedy: 'Simplifique para abstração lógica.',
        },
      ],
      counterfactualFeedback:
        'Melhore a precisão dos requisitos e quantifique os tempos de resposta.',
    };

    mockInvoke.mockResolvedValue({
      parsed: lowScoreEvaluation,
      raw: new AIMessage({ content: '' }),
    });

    const result = await judgeAgent(mockState, mockConfig);

    expect(result.evaluationStatus?.[ArtifactType.REQUIREMENTS]).toBe('FAILED');
    expect(mockArtifactUpdate).toHaveBeenCalledWith({
      where: { id: 'art-001' },
      data: { status: 'NEEDS_REVISION' },
    });
  });

  it('should respect custom JUDGE_MIN_PASSING_SCORE environment variable', async () => {
    process.env.JUDGE_MIN_PASSING_SCORE = '7.0';

    const midScoreEvaluation: CausalEvaluation = {
      score: 7.5, // Acima de 7.0
      summary: 'Especificação atende ao patamar mínimo customizado.',
      rootCauses: [],
      violations: [],
      counterfactualFeedback: 'Aprovado sob régua customizada de 7.0.',
    };

    mockInvoke.mockResolvedValue({
      parsed: midScoreEvaluation,
      raw: new AIMessage({ content: '' }),
    });

    const result = await judgeAgent(mockState, mockConfig);

    expect(result.evaluationStatus?.[ArtifactType.REQUIREMENTS]).toBe('PASSED');
  });

  it('should throw TemplateNotFoundException when judge_requirements_prompt is missing', async () => {
    mockTemplateFindUnique.mockResolvedValue(null);

    await expect(judgeAgent(mockState, mockConfig)).rejects.toThrow(
      TemplateNotFoundException,
    );
  });

  it('should return FAILED if artifact or generatedContent is missing', async () => {
    mockArtifactFindFirst.mockResolvedValue(null);

    const result = await judgeAgent(mockState, mockConfig);

    expect(result.evaluationStatus?.[ArtifactType.REQUIREMENTS]).toBe('FAILED');
    expect(result.evaluationFeedback?.[ArtifactType.REQUIREMENTS]).toContain(
      'não encontrado',
    );
  });

  it('should dynamically include contextual constraints when keywords match in project context', async () => {
    const mixedConstraints = [
      {
        id: 'qc-core',
        code: 'REQ_MOSCOW_COVERAGE',
        artifactType: 'REQUIREMENTS',
        title: 'Cobertura Integral MoSCoW',
        description: 'Must Haves obrigatórios.',
        type: 'INVARIANT',
        severity: 'CRITICAL',
        category: 'SCOPE_INTEGRITY',
        sourceReference: 'Context-Whisperer Standard',
        isCore: true,
        contextKeywords: [],
        isActive: true,
      },
      {
        id: 'qc-security',
        code: 'REQ_ISO25010_SECURITY_AUTH',
        artifactType: 'REQUIREMENTS',
        title: 'Autenticação e RBAC',
        description: 'Exige RBAC e tokens com expiração.',
        type: 'INVARIANT',
        severity: 'CRITICAL',
        category: 'SECURITY',
        sourceReference: 'ISO/IEC 25010 §4.5',
        isCore: false,
        contextKeywords: ['auth', 'login', 'senha', 'jwt'],
        isActive: true,
      },
      {
        id: 'qc-uptime',
        code: 'REQ_ISO25010_RELIABILITY_AVAILABILITY',
        artifactType: 'REQUIREMENTS',
        title: 'Disponibilidade e SLA',
        description: 'Exige SLA de 99.9%.',
        type: 'INVARIANT',
        severity: 'WARNING',
        category: 'PERFORMANCE',
        sourceReference: 'ISO/IEC 25010 §4.4',
        isCore: false,
        contextKeywords: ['uptime', 'disponibilidade', 'sla'],
        isActive: true,
      },
    ];

    mockConstraintFindMany.mockResolvedValue(mixedConstraints);

    const authProjectState: GraphStateType = {
      ...mockState,
      projectRequest: {
        name: 'Auth Service',
        prompt: 'Build a centralized authentication system with login and JWT',
        artifacts: [ArtifactType.REQUIREMENTS],
      },
    };

    const dummyEvaluation: CausalEvaluation = {
      score: 9.0,
      summary: 'Prompt avaliado com regras selecionadas dinamicamente.',
      rootCauses: [],
      violations: [],
      counterfactualFeedback: 'OK',
    };

    mockInvoke.mockResolvedValue({
      parsed: dummyEvaluation,
      raw: new AIMessage({ content: '' }),
    });

    await judgeAgent(authProjectState, mockConfig);

    // O prompt deve conter a regra Core
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('REQ_MOSCOW_COVERAGE'),
    );
    // O prompt deve conter a regra contextual ativada pela keyword "login" / "jwt"
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('REQ_ISO25010_SECURITY_AUTH'),
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('[Categoria: SECURITY]'),
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('[Fonte: ISO/IEC 25010 §4.5]'),
    );
    // O prompt NÃO deve conter a regra de uptime (palavras-chave ausentes)
    expect(mockInvoke).not.toHaveBeenCalledWith(
      expect.stringContaining('REQ_ISO25010_RELIABILITY_AVAILABILITY'),
    );
  });

  it('should not query previous evaluation on first iteration (iterationCount === 0)', async () => {
    mockArtifactFindFirst.mockResolvedValue({
      ...mockArtifact,
      iterationCount: 0,
    });

    const dummyEvaluation: CausalEvaluation = {
      score: 9.0,
      summary: 'Primeira iteração sem contexto prévio.',
      rootCauses: [],
      violations: [],
      counterfactualFeedback: 'OK',
    };

    mockInvoke.mockResolvedValue({
      parsed: dummyEvaluation,
      raw: new AIMessage({ content: '' }),
    });

    await judgeAgent(mockState, mockConfig);

    expect(mockEvaluationFindFirst).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.not.stringContaining('=== CONTEXTO DE ITERAÇÃO SUBSEQUENTE'),
    );
  });

  it('should query previous evaluation and inject revision context when iterationCount > 0', async () => {
    mockArtifactFindFirst.mockResolvedValue({
      ...mockArtifact,
      iterationCount: 1, // Iteração 2
    });

    mockEvaluationFindFirst.mockResolvedValue({
      id: 'eval-prev-001',
      artifactId: 'art-001',
      iteration: 1,
      score: 7.0,
      status: 'FAILED',
      violations: [
        {
          ruleCode: 'REQ_ISO25010_SECURITY_AUTH',
          severity: 'CRITICAL',
          remedy: 'Especificar RBAC e expiração de sessão JWT.',
        },
      ],
      counterfactualFeedback: 'Adicione matriz RBAC para os perfis de usuário.',
    });

    const dummyEvaluation: CausalEvaluation = {
      score: 9.2,
      summary: 'Segunda iteração aprovada com sucesso.',
      rootCauses: [],
      violations: [],
      counterfactualFeedback: 'Perfeito.',
    };

    mockInvoke.mockResolvedValue({
      parsed: dummyEvaluation,
      raw: new AIMessage({ content: '' }),
    });

    await judgeAgent(mockState, mockConfig);

    expect(mockEvaluationFindFirst).toHaveBeenCalledWith({
      where: {
        artifactId: 'art-001',
        iteration: 1,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('=== CONTEXTO DE ITERAÇÃO SUBSEQUENTE (REVISÃO EM CICLO DE REWORK) ==='),
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('Esta é a Iteração 2 de refinamento do artefato.'),
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('REQ_ISO25010_SECURITY_AUTH'),
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('Especificar RBAC e expiração de sessão JWT.'),
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('Adicione matriz RBAC para os perfis de usuário.'),
    );
  });
});
