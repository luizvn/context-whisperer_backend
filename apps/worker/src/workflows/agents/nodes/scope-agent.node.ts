import { RunnableConfig } from "@langchain/core/runnables";
import { AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  ProposedScopeSchema,
  ProposedScopeResponse,
  GraphStateType,
  SseEventType,
  SseEventMessage,
} from "@context-whisperer/core";
import { prisma } from "@context-whisperer/database";
import type IORedis from "ioredis";

function buildMarkdownFromScopeResponse(
  data: ProposedScopeResponse,
  templateContent: string,
): string {
  const formatList = (items?: string[]): string => {
    if (!items || items.length === 0) return "_Nenhum item definido._";
    return items.map((item) => `- ${item}`).join("\n");
  };

  let constraintsSection = "";
  if (data.businessConstraints && data.businessConstraints.length > 0) {
    constraintsSection = `## ⚠️ Restrições de Negócio\n${formatList(data.businessConstraints)}\n`;
  }

  return (
    templateContent
      .replace("{{projectGoal}}", data.projectGoal || "")
      .replace("{{mustHave}}", formatList(data.mustHave))
      .replace("{{shouldHave}}", formatList(data.shouldHave))
      .replace("{{couldHave}}", formatList(data.couldHave))
      .replace("{{wontHave}}", formatList(data.wontHave))
      .replace("{{businessConstraints}}", constraintsSection)
      .trim() + "\n"
  );
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

  // 1. Busca os templates cadastrados no banco de dados (sem fallback, erro sobe diretamente)
  const promptTemplate = await prisma.template.findUnique({
    where: { name: "default_scope" },
  });

  if (!promptTemplate) {
    throw new Error(
      "Template 'default_scope' não encontrado no banco de dados.",
    );
  }

  const responseTemplate = await prisma.template.findUnique({
    where: { name: "default_scope_response" },
  });

  if (!responseTemplate) {
    throw new Error(
      "Template 'default_scope_response' não encontrado no banco de dados.",
    );
  }

  const prompt = `${promptTemplate.content}

Prompt do usuário:
${state.projectRequest.prompt}
`;

  const structuredLlm = model.withStructuredOutput(ProposedScopeSchema);
  const response = await structuredLlm.invoke(prompt);

  const markdown = buildMarkdownFromScopeResponse(
    response,
    responseTemplate.content,
  );

  // Persiste a proposta gerada no MongoDB vinculada ao template de resposta
  const proposal = await prisma.scopeProposal.create({
    data: {
      requisitionId: state.requisitionId,
      templateId: responseTemplate.id,
      contentMd: markdown,
      status: "PENDING",
    },
  });

  // Atualiza o status da requisição
  await prisma.requisition.update({
    where: { id: state.requisitionId },
    data: { status: "AWAITING_SCOPE" },
  });

  // Notifica via Redis PubSub para SSE
  if (redis && state.userId) {
    const event: SseEventMessage = {
      type: SseEventType.SCOPE_READY,
      userId: state.userId,
      requisitionId: state.requisitionId,
      threadId: threadId ?? undefined,
      timestamp: new Date().toISOString(),
      data: {
        proposal,
      },
    };
    console.log(
      `[Worker SSE PubSub] Publishing SCOPE_READY to USER_EVENTS_${state.userId}`,
    );
    await redis.publish(`USER_EVENTS_${state.userId}`, JSON.stringify(event));
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
