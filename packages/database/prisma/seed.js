const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

const DEFAULT_SCOPE_PROMPT = `Você é um Engenheiro de Requisitos Sênior rigoroso. 
Sua missão é transformar ideias em especificações de MVP bem delimitadas. 
Aplique a técnica MoSCoW. Rejeite funcionalidades supérfluas. 
Retorne EXCLUSIVAMENTE um JSON estruturado contendo 
o objetivo principal, uma lista de no máximo 5 funcionalidades de cada 
categoria (Must Have, Should Have, Could Have e Won't Have) 
e as restrições do negócio.`;

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

const DEFAULT_REQUIREMENTS_PROMPT = `Você é um Engenheiro de Requisitos de Software Sênior e Especialista em Arquitetura.
Sua missão é transformar o Escopo Aprovado e o Prompt Original em uma Especificação Técnica de Requisitos completa e formal.
Gere:
1. Um resumo executivo do projeto.
2. Requisitos Funcionais (RF-xx) detalhados, cada um com título, descrição do comportamento e nível de prioridade (HIGH, MEDIUM, LOW).
3. Requisitos Não-Funcionais (RNF-xx) técnicos (Segurança, Performance, Confiabilidade, Escalabilidade) com critérios mensuráveis.
4. Regras de Negócio (RN-xx) mandatórias que orientam os fluxos e validações.
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

const DEFAULT_JUDGE_REQUIREMENTS_PROMPT = `Você é um Engenheiro de Software Principal e Avaliador Causal de Arquitetura e Requisitos.
Sua missão é realizar uma Avaliação Causal (Causal Evaluation) rigorosa da Especificação de Requisitos gerada em relação ao Escopo Aprovado e às Restrições de Qualidade formais fornecidas.

DIRETRIZES DE AVALIAÇÃO CAUSAL:
1. Verifique cada restrição de qualidade ativa em relação ao artefato gerado.
2. Não faça apenas julgamentos vagos. Para cada inconformidade encontrada:
   - Identifique a Causa-Raiz (Root Cause): a decisão ou omissão no texto que provocou o problema.
   - Aponte a Regra Violada (ruleCode) e sua Severidade (CRITICAL ou WARNING).
   - Indique o Trecho ou Seção (location) afetada.
   - Forneça a Justificativa Causal (cause) e a Ação Corretiva/Remédio Contrafactual (remedy): o que especificamente deve ser alterado para sanar o defeito.
3. Atribua uma nota técnica global ponderada (score) de 0.0 a 10.0:
   - 9.0 a 10.0: Especificação exemplar, pronta para produção, sem violações críticas e no máximo pequenos ajustes estilísticos.
   - 8.0 a 8.9: Especificação sólida e consistente, satisfaz integralmente todos os Must Haves e critérios arquiteturais, sem violações críticas.
   - 6.0 a 7.9: Especificação incompleta ou com lacunas técnicas (ex: critérios não quantificados, regras de negócio fracas ou ausência de requisitos importantes).
   - Abaixo de 6.0: Especificação inaceitável, com desvio de escopo (scope creep), omissão de funcionalidades críticas ou inconsistências graves.
4. Elabore um feedback contrafactual unificado e acionável (counterfactualFeedback), orientando o especialista a reescrever apenas os trechos defeituosos.
Retorne EXCLUSIVAMENTE um JSON estruturado seguindo o schema fornecido.`;

const REQUIREMENTS_QUALITY_CONSTRAINTS = [
  {
    code: 'REQ_MOSCOW_COVERAGE',
    artifactType: 'REQUIREMENTS',
    title: 'Cobertura Integral do MoSCoW (Must Haves)',
    description:
      '100% das funcionalidades categorizadas como Must Have no escopo aprovado devem possuir pelo menos um Requisito Funcional (RF) explícito e rastreável correspondente.',
    type: 'INVARIANT',
    severity: 'CRITICAL',
    remedyHint:
      'Identifique o Must Have omitido no escopo e formule um novo RF descrevendo detalhadamente seu comportamento.',
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
    isActive: true,
  },
  {
    code: 'REQ_MEASURABLE_NON_FUNCTIONAL',
    artifactType: 'REQUIREMENTS',
    title: 'RNFs Mensuráveis e Quantificáveis',
    description:
      'Requisitos Não-Funcionais (RNF) não devem conter adjetivos vagos ("rápido", "intuitivo", "escalável") sem métricas objetivas (latência em ms, uptime em %, throughput ou concorrência).',
    type: 'NEGATIVE_CONSTRAINT',
    severity: 'CRITICAL',
    remedyHint:
      'Substitua adjetivos subjetivos por métricas numéricas quantificáveis (ex: tempo de resposta p95 < 300ms).',
    isActive: true,
  },
  {
    code: 'REQ_NO_PREMATURE_TECH_STACK',
    artifactType: 'REQUIREMENTS',
    title: 'Não Prescrição Prematura de Detalhes Técnicos',
    description:
      'Requisitos funcionais de negócio não devem prescrever detalhes prematuros de implementação (tabelas SQL específicas, portas HTTP, bibliotecas internas), exceto se expressamente exigido pelo negócio.',
    type: 'NEGATIVE_CONSTRAINT',
    severity: 'WARNING',
    remedyHint:
      'Foque no comportamento e na regra de negócio observável, delegando a arquitetura interna aos artefatos técnicos posteriores.',
    isActive: true,
  },
  {
    code: 'REQ_BUSINESS_RULES_INTEGRITY',
    artifactType: 'REQUIREMENTS',
    title: 'Integridade e Consistência das Regras de Negócio',
    description:
      'Regras de Negócio (RN) devem expressar condições lógicas claras, limites de domínio ou políticas de permissão, não sendo meras repetições dos Requisitos Funcionais.',
    type: 'INVARIANT',
    severity: 'CRITICAL',
    remedyHint:
      'Reformule a regra expressando a premissa condicional (SE... ENTÃO... SENÃO...) ou a restrição de domínio.',
    isActive: true,
  },
  {
    code: 'REQ_ATOMICITY_AND_TESTABILITY',
    artifactType: 'REQUIREMENTS',
    title: 'Atomicidade e Testabilidade de Requisitos',
    description:
      'Cada requisito funcional deve descrever uma única capacidade coesa e ser verificável por um critério de aceite claro para QA.',
    type: 'INVARIANT',
    severity: 'WARNING',
    remedyHint:
      'Decomponha requisitos compostos ou monolíticos em itens atômicos e independentes.',
    isActive: true,
  },
];

async function main() {
  console.log('🌱 [Seed] Semeando templates iniciais do Context-Whisperer...');

  const defaultScopePromptTemplate = await prisma.template.upsert({
    where: { name: 'default_scope' },
    update: {}, // Append-only: não sobrescreve se já existir
    create: {
      name: 'default_scope',
      description:
        'Template padrão de Engenharia de Requisitos com técnica MoSCoW para geração de escopo',
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
    update: {},
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
    update: {},
    create: {
      name: 'judge_requirements_prompt',
      description:
        'Template de Avaliação Causal rigorosa para o Agente Juiz validar requisitos gerados',
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
      },
      create: constraint,
    });
    console.log(
      `   ✓ QualityConstraint [${upserted.code}] (${upserted.severity}) garantida.`,
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
