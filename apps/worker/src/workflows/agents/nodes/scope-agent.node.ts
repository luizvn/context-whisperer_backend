import { RunnableConfig } from "@langchain/core/runnables";
import { AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  ProposedScopeSchema,
  ProposedScopeResponse,
  GraphStateType,
} from "@context-whisperer/core";
import { prisma } from "@context-whisperer/database";
import type IORedis from "ioredis";

function buildMarkdownFromScopeResponse(data: ProposedScopeResponse): string {
  let md = `# Proposta de Escopo\n\n`;

  md += `## 🎯 Objetivo do Projeto\n${data.projectGoal}\n\n`;

  md += `## ✅ Must Have (Indispensável)\n`;
  data.mustHave.forEach((item) => (md += `- ${item}\n`));
  md += `\n`;

  md += `## 🚀 Should Have (Importante)\n`;
  data.shouldHave.forEach((item) => (md += `- ${item}\n`));
  md += `\n`;

  md += `## ✨ Could Have (Desejável)\n`;
  data.couldHave.forEach((item) => (md += `- ${item}\n`));
  md += `\n`;

  md += `## 🚫 Won't Have (Fora de Escopo)\n`;
  data.wontHave.forEach((item) => (md += `- ${item}\n`));
  md += `\n`;

  if (data.businessConstraints && data.businessConstraints.length > 0) {
    md += `## ⚠️ Restrições de Negócio\n`;
    data.businessConstraints.forEach((item) => (md += `- ${item}\n`));
    md += `\n`;
  }

  return md;
}

export const scopeAgent = async (
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> => {
  console.log("--- [ScopeAgent] Executing Scope Generation ---");
  const configurable = config?.configurable;
  const redis = configurable?.redis as IORedis | undefined;
  const threadId = configurable?.thread_id as string | undefined;

  const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-4o",
    temperature: 0.2,
    apiKey: process.env.OPENAI_API_KEY,
  });

  const structuredLlm = model.withStructuredOutput(ProposedScopeSchema);

  const prompt = `Você é um Engenheiro de Requisitos Sênior rigoroso. 
Sua missão é transformar ideias em especificações de MVP bem delimitadas. 
Aplique a técnica MoSCoW. Rejeite funcionalidades supérfluas. 
Retorne EXCLUSIVAMENTE um JSON estruturado contendo 
o objetivo principal, uma lista de no máximo 5 funcionalidades de cada 
categoria (Must Have, Should Have, Could Have e Won't Have) 
e as restrições do negócio.

Prompt do usuário:
${state.projectRequest.prompt}
`;

  const response = await structuredLlm.invoke(prompt);

  const markdown = buildMarkdownFromScopeResponse(response);

  // Persiste a proposta gerada no MongoDB
  const proposal = await prisma.scopeProposal.create({
    data: {
      requisitionId: state.requisitionId,
      templateId: "default",
      contentMd: markdown,
      status: "PENDING",
    },
  });

  // Atualiza o status da requisição
  await prisma.requisition.update({
    where: { id: state.requisitionId },
    data: { status: "AWAITING_SCOPE" },
  });

  // Notifica via Redis PubSub para assinantes GraphQL
  if (redis && state.userId) {
    const payload = JSON.stringify({
      scopeGenerated: proposal,
      threadId: threadId ?? undefined,
      type: "SCOPE_GENERATED",
    });
    console.log(`[Worker PubSub] Publishing to USER_EVENTS_${state.userId}`);
    await redis.publish(`USER_EVENTS_${state.userId}`, payload);
  }

  return {
    messages: [
      new AIMessage({
        content: `Escopo gerado com sucesso para: ${response.projectGoal || "Projeto"}`,
      }),
    ],
    scopeProposalId: proposal.id,
  };
};
