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
}

main()
  .catch((e) => {
    console.error('❌ [Seed] Erro ao semear banco de dados:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
