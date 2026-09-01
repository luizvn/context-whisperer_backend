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
}

main()
  .catch((e) => {
    console.error('❌ [Seed] Erro ao semear banco de dados:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
