const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

const DEFAULT_SCOPE_PROMPT = `Você é um Engenheiro de Requisitos de Software Principal e Estrategista de Produtos MVP.
Sua missão é analisar a ideia do usuário e estruturar uma Proposta de Escopo viável, focada e estritamente ancorada no domínio do problema apresentado.

DIRETRIZES DE ENGENHARIA DE REQUISITOS E ESCOPO:
1. ANCORAGEM NO CONTEXTO DO USUÁRIO (ANTI-ALUCINAÇÃO):
   - Todas as decisões de escopo devem derivar estritamente do domínio, dos objetivos e das necessidades expressas ou implicitamente necessárias para a ideia do usuário.
   - NUNCA invente ou prescreva dependências de terceiros, ferramentas específicas, softwares legados ou tecnologias que não tenham relação direta com o domínio solicitado.

2. DIMENSIONAMENTO DINÂMICO E PROPORCIONAL:
   - A quantidade de itens em cada categoria MoSCoW deve ser orientada pela complexidade real da solução, sem qualquer cota ou limite numérico artificial.
   - Evite tanto a fragmentação excessiva quanto agrupamentos monolíticos. Cada item deve representar uma capacidade de negócio compreensível.

3. TÉCNICA MoSCoW APLICADA AO CONTEXTO DE MVP:
   - Must Have (Indispensável): O núcleo funcional indispensável para que o produto funcione e valide sua hipótese primária de valor. Se qualquer item desta lista for omitido, a jornada essencial do usuário é inviabilizada.
   - Should Have (Importante, mas postergável): Capacidades de alto valor que aprimoram a jornada principal, mas cuja ausência na versão 1.0 não impede o lançamento inicial nem inviabiliza o negócio (possuem alternativas de contorno operacional ou fluxos manuais aceitáveis no início).
   - Could Have (Desejável / Nice-to-Have): Recursos de conveniência, personalização ou polimentos de experiência pertinentes ao domínio, exequíveis com baixo esforço e sem comprometer o prazo. Não adicione ideias aleatórias ou desconexas com a proposta de valor.
   - Won't Have (Fora de Escopo - Blindagem do MVP):
     * Prioridade máxima: inclua obrigatoriamente quaisquer capacidades, integrações ou módulos que o usuário tenha expressamente descartado ou indicado como fora do MVP.
     * Além do descartado expressamente, liste apenas barreiras defensivas óbvias do domínio (ex: integrações pesadas com sistemas legados ou ERPs complexos) que protegem a entrega do MVP. NUNCA insira itens genéricos ou bizarros que não façam sentido no contexto.

4. RESTRIÇÕES DE NEGÓCIO E TÉCNICAS (businessConstraints) - TOLERÂNCIA ZERO A DADOS FICTÍCIOS:
   - Capture APENAS premissas inegociáveis, limitações operacionais, conformidades regulatórias (ex: LGPD/HIPAA ao manipular dados sensíveis) ou plataformas obrigatórias (ex: Web, Mobile) comprovadamente demandadas pelo contexto do usuário.
   - PROIBIÇÃO ABSOLUTA DE DADOS DE GESTÃO FICTÍCIOS: NUNCA invente prazos de calendário (ex: "entrega em 6 meses"), NUNCA invente cifras orçamentárias (ex: "orçamento de R$ 500.000"), NUNCA invente quantidade de desenvolvedores ou metodologias de gestão não mencionadas pelo usuário.
   - Se o usuário não especificou prazo ou orçamento, NÃO crie esses itens. Retorne apenas as restrições reais de domínio ou uma lista vazia.

Retorne EXCLUSIVAMENTE um JSON estruturado seguindo o schema fornecido.`;

const DEFAULT_SCOPE_RESPONSE_TEMPLATE = `# Proposta de Escopo

## 🎯 Objetivo do Projeto
{{projectGoal}}

## ✅ Must Have (Indispensável)
{{mustHave}}

## 🚀 Should Have (Importante)
{{shouldHave}}

## ✨ Could Have (Desejável)
{{couldHave}}

## 🚫 Won't Have (Fora de Escopo)
{{wontHave}}

{{businessConstraints}}`;

const DEFAULT_REQUIREMENTS_PROMPT = `Você é um Engenheiro de Requisitos de Software Principal e Especialista em Arquitetura de Sistemas.
Sua missão é transformar o Escopo Aprovado e a solicitação do usuário em uma Especificação Técnica de Requisitos completa, inequívoca e formal para um MVP de alta qualidade.

DIRETRIZES DE ENGENHARIA DE REQUISITOS (SHIFT-LEFT DE QUALIDADE):
1. RASTREABILIDADE TOTAL E BLINDAGEM DE ESCOPO:
   - Cada funcionalidade Must Have do Escopo Aprovado DEVE possuir pelo menos um Requisito Funcional (RF-xx) explícito e rastreável.
   - É terminantemente proibido introduzir requisitos que fujam do escopo acordado ou que reintroduzam capacidades descartadas no Won't Have (prevenção rigorosa de Scope Creep).

2. TESTABILIDADE E CLAREZA DOS REQUISITOS FUNCIONAIS (RF-xx):
   - Cada RF deve descrever uma capacidade atômica observável, com título claro e descrição detalhada do comportamento esperado.
   - Estruture a descrição do comportamento detalhando: a condição de entrada, o processamento de domínio esperado e o resultado observável verificável para homologação e testes de QA.
   - LINGUAGEM INEQUÍVOCA: Não utilize adjetivos vagos ou subjetivos (como "fácil de usar", "rápido", "intuitivo", "robusto", "conforme necessário") sem critérios objetivos de aceitação correspondentes.

3. REQUISITOS NÃO-FUNCIONAIS (RNF-xx) TÉCNICOS E MENSURÁVEIS:
   - Especifique RNFs adequados ao contexto da aplicação (ex: Web, API, Mobile) com critérios quantitativos concretos:
     * Eficiência de Desempenho: Defina limites mensuráveis para tempo de resposta (ex: percentil P95 em milissegundos) e capacidade de vazão/concorrência compatíveis com a escala do MVP.
     * Segurança e Proteção de Dados: Especifique mecanismos seguros de gestão de credenciais, controle de acesso apropriado aos perfis do sistema (RBAC) e proteção de dados em trânsito e em repouso conforme boas práticas do setor.
     * Confiabilidade e Operação: Defina metas realistas de disponibilidade percentual e políticas de contingência ou integridade de dados.

4. REGRAS DE NEGÓCIO (RN-xx) COM ESTRUTURA CONDICIONAL:
   - Formule as Regras de Negócio expressando restrições de domínio, limites operacionais e políticas mandatórias.
   - Utilize estrutura lógica condicional clara (premissa de disparo, validação e consequência/tratamento de exceção), não as limitando a meras repetições dos Requisitos Funcionais.

Retorne EXCLUSIVAMENTE um JSON estruturado seguindo o schema fornecido.`;

const DEFAULT_REQUIREMENTS_RESPONSE_TEMPLATE = `# Especificação Técnica de Requisitos

## 📋 Resumo Executivo
{{summary}}

## ⚙️ Requisitos Funcionais (RF)
{{functionalRequirements}}

## 🛡️ Requisitos Não-Funcionais (RNF)
{{nonFunctionalRequirements}}

## 📌 Regras de Negócio (RN)
{{businessRules}}`;

const DEFAULT_JUDGE_REQUIREMENTS_PROMPT = `Você é um Engenheiro de Software Principal atuando como Avaliador Causal Imparcial e Pragmático de Arquitetura e Requisitos para MVPs.
Sua missão é realizar uma Avaliação Causal técnica, consistente e construtiva da Especificação de Requisitos gerada em relação ao Escopo Aprovado e às Restrições de Qualidade formais ativas fornecidas.

DIRETRIZES DE AVALIAÇÃO CAUSAL E SEVERIDADE:
1. ADESÃO AO CATÁLOGO E PRINCÍPIO GERAL DE SEVERIDADE:
   Avalie o artefato estritamente em relação às restrições ativas fornecidas no catálogo, respeitando o critério de impacto real no ciclo de desenvolvimento:
   - CRITICAL (Defeito Bloqueante):
     Inconformidades que comprometem a integridade fundamental do artefato, omitem elementos mandatórios acordados na etapa anterior, criam contradições lógicas graves, quebram a testabilidade formal por QA ou tornam o artefato impossível de ser implementado ou validado tecnicamente.
     * Exemplo Conceitual: Uma especificação que omite uma capacidade obrigatória acordada, que não possui critérios observáveis de teste ou que descreve um comportamento inexecutável possui um defeito de natureza bloqueante.
   - WARNING (Oportunidade de Polimento):
     Ressalvas sobre precisão de termos, oportunidades de detalhamento incremental, sugestões de métricas futuras ou boas práticas que enriquecem o artefato, mas cuja ausência não invalida sua utilidade primária para o MVP.
     * Exemplo Conceitual: Uma solução que descreve a capacidade essencial com clareza funcional, mas cuja terminologia poderia ser mais formal ou cujas métricas complementares de produção poderiam ser refinadas posteriormente, recebe uma recomendação construtiva com dedução proporcional na nota, sem bloquear o fluxo.

2. INTEGRIDADE DE ESCOPO E USABILIDADE:
   - Tanto Must Have quanto Should Have compõem o escopo aprovado legítimo. A presença de requisitos atendendo ao Should Have é válida e NUNCA constitui Scope Creep (REQ_NO_SCOPE_CREEP).
   - Se o Escopo contiver expectativas de experiência ou usabilidade no Must Have (ex: "interface intuitiva", "navegação simples"), considere este item ATENDIDO se a especificação contiver fluxos de interface/telas observáveis correspondentes ou critérios de usabilidade nos Requisitos Não-Funcionais.

3. IMPARCIALIDADE E AVALIAÇÃO ORIENTADA AO MÉRITO:
   - Adote uma postura de avaliação imparcial e pragmática: baseie cada inconformidade em evidências concretas de impacto na viabilidade ou na testabilidade do software, sem converter preferências estilísticas em defeitos técnicos.
   - Avalie a especificação pelo seu mérito e clareza para a engenharia:
     * 9.0 a 10.0: Especificação técnica de excelência, sem violações críticas e pronta para desenvolvimento.
     * 8.0 a 8.9: Especificação sólida e consistente para MVP, cobre integralmente o escopo acordado, possui critérios de teste observáveis e trata segurança essencial, podendo conter pequenos avisos informativos (WARNINGs) perfeitamente toleráveis na v1.
     * 6.0 a 7.9: Especificação com lacunas técnicas que justificam refinamento se houver tentativas disponíveis.
     * Abaixo de 6.0: Especificação insuficiente, com falhas críticas ou distorções de escopo.

4. DIAGNÓSTICO ESTRUTURADO E AÇÕES CONTRAFACTUAIS:
   - Para cada violação real, identifique a Regra Violada (ruleCode), a Severidade (CRITICAL ou WARNING), a Seção Afetada (location), a Causa-Raiz (cause) e a Ação Corretiva clara (remedy).
   - No feedback contrafactual unificado (counterfactualFeedback), oriente o especialista a reescrever apenas os trechos estritamente necessários para atingir conformidade.

Retorne EXCLUSIVAMENTE um JSON estruturado seguindo o schema fornecido.`;

const REQUIREMENTS_QUALITY_CONSTRAINTS = [
  // --- GRUPO A: Regras Core (Universais - Sempre Ativas) ---
  {
    code: 'REQ_MOSCOW_COVERAGE',
    artifactType: 'REQUIREMENTS',
    title: 'Cobertura Integral do MoSCoW (Must Haves)',
    description:
      '100% das funcionalidades categorizadas como Must Have no escopo aprovado devem possuir cobertura rastreável correspondente (através de Requisitos Funcionais, ou através de fluxos de telas/RNFs de usabilidade caso o Must Have expresse expectativas de experiência).',
    type: 'INVARIANT',
    severity: 'CRITICAL',
    remedyHint:
      'Identifique o Must Have omitido no escopo e formule um novo RF descrevendo detalhadamente seu comportamento (ou RNF de usabilidade/fluxo de tela se for expectativa de interface).',
    category: 'SCOPE_INTEGRITY',
    sourceReference: 'Context-Whisperer Scope Standard',
    isCore: true,
    contextKeywords: [],
    isActive: true,
  },
  {
    code: 'REQ_NO_SCOPE_CREEP',
    artifactType: 'REQUIREMENTS',
    title: 'Prevenção de Scope Creep (Fora de Escopo)',
    description:
      "É estritamente proibido incluir módulos ou requisitos que constem na seção Won't Have (Fora de Escopo) ou funcionalidades que desvirtuem o objetivo principal do MVP.",
    type: 'NEGATIVE_CONSTRAINT',
    severity: 'CRITICAL',
    remedyHint:
      'Remova o requisito incompatível ou ajuste o escopo para respeitar estritamente os limites do MVP acordados.',
    category: 'SCOPE_INTEGRITY',
    sourceReference: 'Context-Whisperer Scope Standard',
    isCore: true,
    contextKeywords: [],
    isActive: true,
  },
  {
    code: 'REQ_ISO29148_UNAMBIGUOUS',
    artifactType: 'REQUIREMENTS',
    title: 'Requisitos Inequívocos e Livres de Ambiguidade',
    description:
      'Requisitos não devem conter termos vagos ou ambíguos ("conforme necessário", "adequado", "etc.", "fácil de usar", "rápido") sem critério ou definição objetiva.',
    type: 'NEGATIVE_CONSTRAINT',
    severity: 'WARNING',
    remedyHint:
      'Substitua adjetivos subjetivos ou termos indefinidos por critérios inequívocos e mensuráveis.',
    category: 'AMBIGUITY',
    sourceReference: 'ISO/IEC/IEEE 29148:2018 §5.2.2',
    isCore: true,
    contextKeywords: [],
    isActive: true,
  },
  {
    code: 'REQ_ISO29148_TESTABILITY',
    artifactType: 'REQUIREMENTS',
    title: 'Verificabilidade e Testabilidade Formal',
    description:
      'Cada requisito funcional deve descrever um comportamento observável passível de validação por um caso de teste claro e objetivo por QA.',
    type: 'INVARIANT',
    severity: 'CRITICAL',
    remedyHint:
      'Defina as condições de entrada, o processamento esperado e o resultado observável verificável do requisito.',
    category: 'TESTABILITY',
    sourceReference: 'ISO/IEC/IEEE 29148:2018 §5.2.5',
    isCore: true,
    contextKeywords: [],
    isActive: true,
  },
  {
    code: 'REQ_ISO29148_ATOMICITY',
    artifactType: 'REQUIREMENTS',
    title: 'Atomicidade e Singularidade de Requisitos',
    description:
      'Cada requisito funcional deve especificar uma única capacidade coesa, evitando requisitos compostos ("monolíticos") com múltiplos objetivos independentes.',
    type: 'INVARIANT',
    severity: 'WARNING',
    remedyHint:
      'Decomponha requisitos compostos em itens atômicos, independentes e numerados separadamente.',
    category: 'TESTABILITY',
    sourceReference: 'ISO/IEC/IEEE 29148:2018 §5.2.7',
    isCore: true,
    contextKeywords: [],
    isActive: true,
  },
  {
    code: 'REQ_BABOK_CONDITIONAL_LOGIC',
    artifactType: 'REQUIREMENTS',
    title: 'Estrutura Lógica Condicional das Regras de Negócio',
    description:
      'Regras de Negócio (RN) devem expressar condições lógicas formais (SE ... ENTÃO ... SENÃO) e políticas de domínio, não sendo meras repetições dos Requisitos Funcionais.',
    type: 'INVARIANT',
    severity: 'WARNING',
    remedyHint:
      'Reformule a regra de negócio expressando a premissa condicional, o limite de domínio ou a política de restrição mandatória.',
    category: 'BUSINESS_LOGIC',
    sourceReference: 'BABOK Guide v3 §10.11',
    isCore: true,
    contextKeywords: [],
    isActive: true,
  },
  {
    code: 'REQ_NO_PREMATURE_TECH_STACK',
    artifactType: 'REQUIREMENTS',
    title: 'Não Prescrição Prematura de Detalhes Técnicos',
    description:
      'Requisitos funcionais de negócio não devem prescrever detalhes prematuros de implementação física (tabelas SQL específicas, portas HTTP, bibliotecas internas), exceto se expressamente exigido pelo negócio.',
    type: 'NEGATIVE_CONSTRAINT',
    severity: 'WARNING',
    remedyHint:
      'Foque no comportamento e na regra observável de domínio, delegando a arquitetura técnica aos artefatos posteriores.',
    category: 'AMBIGUITY',
    sourceReference: 'Clean Architecture / ISO 29148 §5.2.6',
    isCore: true,
    contextKeywords: [],
    isActive: true,
  },

  // --- GRUPO B: Regras Contextuais (Ativadas Dinamicamente por Palavras-Chave) ---
  {
    code: 'REQ_ISO25010_PERFORMANCE_METRIC',
    artifactType: 'REQUIREMENTS',
    title: 'RNFs de Eficiência de Desempenho com Métricas Quantificadas',
    description:
      'Requisitos Não-Funcionais relacionados a performance devem especificar limites quantitativos numéricos claros (tempo de resposta percentil P95/P99 em ms, vazão/throughput em RPS, ou consumo máximo de recursos).',
    type: 'INVARIANT',
    severity: 'WARNING',
    remedyHint:
      'Substitua afirmações vagas por métricas objetivas (ex: tempo de resposta P95 < 250ms sob carga de 500 RPS).',
    category: 'PERFORMANCE',
    sourceReference: 'ISO/IEC 25010:2011 §4.2 (Performance Efficiency)',
    isCore: false,
    contextKeywords: [
      'latency',
      'throughput',
      'response time',
      'tempo de resposta',
      'concorrência',
      'tempo real',
      'real-time',
      'latência',
      'desempenho',
      'performance',
      'escala',
    ],
    isActive: true,
  },
  {
    code: 'REQ_ISO25010_SECURITY_AUTH',
    artifactType: 'REQUIREMENTS',
    title: 'Segurança, Autenticação e Controle de Acesso Baseado em Papéis (RBAC)',
    description:
      'Módulos que envolvem autenticação de usuários devem explicitar a gestão de credenciais, tempo de expiração de sessão/token e controle de acesso granular baseado em papéis (RBAC).',
    type: 'INVARIANT',
    severity: 'CRITICAL',
    remedyHint:
      'Especifique o mecanismo de autenticação segura, a expiração de sessão e a matriz de permissões para cada perfil de usuário.',
    category: 'SECURITY',
    sourceReference: 'ISO/IEC 25010:2011 §4.5 (Security) & OWASP ASVS v4',
    isCore: false,
    contextKeywords: [
      'auth',
      'login',
      'senha',
      'jwt',
      'token',
      'oauth',
      'permissão',
      'rbac',
      'papel',
      'credencial',
      'usuário',
      'autenticação',
    ],
    isActive: true,
  },
  {
    code: 'REQ_ISO25010_SECURITY_CONFIDENTIALITY',
    artifactType: 'REQUIREMENTS',
    title: 'Proteção de Dados Pessoais, Confidencialidade e Criptografia',
    description:
      'Requisitos que manipulam dados pessoais, credenciais, informações financeiras ou reguladas (LGPD/GDPR) devem exigir criptografia obrigatória em trânsito (TLS 1.3+) e em repouso (AES-256).',
    type: 'INVARIANT',
    severity: 'CRITICAL',
    remedyHint:
      'Explicite o requisito mandatório de criptografia em repouso e trânsito para todos os dados regulados ou sensíveis.',
    category: 'SECURITY',
    sourceReference: 'ISO/IEC 25010:2011 §4.5 & LGPD Art. 46 / GDPR Art. 32',
    isCore: false,
    contextKeywords: [
      'dados pessoais',
      'lgpd',
      'gdpr',
      'privacidade',
      'cpf',
      'pagamento',
      'cartão',
      'credit card',
      'criptografia',
      'financeiro',
      'sensíveis',
      'sensivel',
    ],
    isActive: true,
  },
  {
    code: 'REQ_ISO25010_RELIABILITY_AVAILABILITY',
    artifactType: 'REQUIREMENTS',
    title: 'Confiabilidade, Disponibilidade Numérica e Tolerância a Falhas',
    description:
      'Requisitos de confiabilidade e disponibilidade do sistema devem estipular o SLA numérico percentual (ex: 99.9% uptime) e objetivos de recuperação (RTO/RPO ou estratégias de fallback).',
    type: 'INVARIANT',
    severity: 'WARNING',
    remedyHint:
      'Substitua "alta disponibilidade" por um índice formal mensurável (ex: disponibilidade mínima de 99.9% mensal).',
    category: 'PERFORMANCE',
    sourceReference: 'ISO/IEC 25010:2011 §4.4 (Reliability)',
    isCore: false,
    contextKeywords: [
      'disponibilidade',
      'uptime',
      'sla',
      'tolerância a falhas',
      'recuperação',
      'backup',
      'alta disponibilidade',
      'resiliência',
    ],
    isActive: true,
  },
];

async function main() {
  console.log('🌱 [Seed] Semeando templates iniciais do Context-Whisperer...');

  const defaultScopePromptTemplate = await prisma.template.upsert({
    where: { name: 'default_scope' },
    update: {
      description:
        'Template padrão de Engenharia de Requisitos com técnica MoSCoW dinâmica para geração de escopo MVP',
      content: DEFAULT_SCOPE_PROMPT,
    },
    create: {
      name: 'default_scope',
      description:
        'Template padrão de Engenharia de Requisitos com técnica MoSCoW dinâmica para geração de escopo MVP',
      content: DEFAULT_SCOPE_PROMPT,
    },
  });

  console.log(
    `✅ [Seed] Template default_scope (prompt) garantido com ID: ${defaultScopePromptTemplate.id}`,
  );

  const defaultScopeResponseTemplate = await prisma.template.upsert({
    where: { name: 'default_scope_response' },
    update: {}, // Append-only: não sobrescreve se já existir
    create: {
      name: 'default_scope_response',
      description:
        'Template padrão de formatação Markdown para a Proposta de Escopo',
      content: DEFAULT_SCOPE_RESPONSE_TEMPLATE,
    },
  });

  console.log(
    `✅ [Seed] Template default_scope_response (resposta) garantido com ID: ${defaultScopeResponseTemplate.id}`,
  );

  const defaultRequirementsPromptTemplate = await prisma.template.upsert({
    where: { name: 'default_requirements' },
    update: {
      description:
        'Template padrão de Engenharia de Requisitos para geração de especificação técnica (RF, RNF, RN)',
      content: DEFAULT_REQUIREMENTS_PROMPT,
    },
    create: {
      name: 'default_requirements',
      description:
        'Template padrão para geração de especificação técnica de requisitos (RF, RNF, RN)',
      content: DEFAULT_REQUIREMENTS_PROMPT,
    },
  });

  console.log(
    `✅ [Seed] Template default_requirements (prompt) garantido com ID: ${defaultRequirementsPromptTemplate.id}`,
  );

  const defaultRequirementsResponseTemplate = await prisma.template.upsert({
    where: { name: 'default_requirements_response' },
    update: {},
    create: {
      name: 'default_requirements_response',
      description:
        'Template padrão de formatação Markdown para a Especificação de Requisitos',
      content: DEFAULT_REQUIREMENTS_RESPONSE_TEMPLATE,
    },
  });

  console.log(
    `✅ [Seed] Template default_requirements_response (resposta) garantido com ID: ${defaultRequirementsResponseTemplate.id}`,
  );

  const judgeRequirementsPromptTemplate = await prisma.template.upsert({
    where: { name: 'judge_requirements_prompt' },
    update: {
      description:
        'Template de Avaliação Causal imparcial e pragmática para o Agente Juiz validar requisitos gerados',
      content: DEFAULT_JUDGE_REQUIREMENTS_PROMPT,
    },
    create: {
      name: 'judge_requirements_prompt',
      description:
        'Template de Avaliação Causal imparcial e pragmática para o Agente Juiz validar requisitos gerados',
      content: DEFAULT_JUDGE_REQUIREMENTS_PROMPT,
    },
  });

  console.log(
    `✅ [Seed] Template judge_requirements_prompt garantido com ID: ${judgeRequirementsPromptTemplate.id}`,
  );

  console.log('🌱 [Seed] Semeando catálogo de QualityConstraints para REQUIREMENTS...');
  for (const constraint of REQUIREMENTS_QUALITY_CONSTRAINTS) {
    const upserted = await prisma.qualityConstraint.upsert({
      where: { code: constraint.code },
      update: {
        title: constraint.title,
        description: constraint.description,
        type: constraint.type,
        severity: constraint.severity,
        remedyHint: constraint.remedyHint,
        isActive: constraint.isActive,
        category: constraint.category,
        sourceReference: constraint.sourceReference,
        isCore: constraint.isCore,
        contextKeywords: constraint.contextKeywords,
      },
      create: constraint,
    });
    console.log(
      `   ✓ QualityConstraint [${upserted.code}] (${upserted.severity} | ${upserted.category} | ${upserted.isCore ? 'CORE' : 'CONTEXTUAL'}) garantida.`,
    );
  }
}

main()
  .catch((e) => {
    console.error('❌ [Seed] Erro ao semear banco de dados:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
