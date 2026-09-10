import { RunnableConfig } from "@langchain/core/runnables";
import { AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  RequirementsSchema,
  RequirementsResponse,
  GraphStateType,
  SseEventType,
  SseEventMessage,
  ArtifactType,
  TemplateNotFoundException,
} from "@context-whisperer/core";
import { prisma } from "@context-whisperer/database";
import type IORedis from "ioredis";
import { logger } from "../../../utils/logger";

function buildMarkdownFromRequirementsResponse(
  data: RequirementsResponse,
  templateContent: string,
): string {
  const functionalMd = data.functionalRequirements
    .map(
      (r) =>
        `### ${r.id} - ${r.title} [Prioridade: ${r.priority}]\n${r.description}\n`,
    )
    .join("\n");

  const nonFunctionalMd = data.nonFunctionalRequirements
    .map((r) => `- **${r.id} (${r.category}):** ${r.description}`)
    .join("\n");

  const rulesMd = data.businessRules
    .map((r) => `- **${r.id}:** ${r.description}`)
    .join("\n");

  return (
    templateContent
      .replace("{{summary}}", data.summary || "")
      .replace("{{functionalRequirements}}", functionalMd)
      .replace("{{nonFunctionalRequirements}}", nonFunctionalMd)
      .replace("{{businessRules}}", rulesMd)
      .trim() + "\n"
  );
}

export const requirementsAgent = async (
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> => {
  const configurable = config?.configurable;
  const redis = configurable?.redis as IORedis | undefined;
  const threadId = configurable?.thread_id as string | undefined;

  logger.info(
    { requisitionId: state.requisitionId, threadId },
    "Executing requirements generation agent",
  );

  const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-4o",
    temperature: 0.2,
    apiKey: process.env.OPENAI_API_KEY,
  });

  // 1. Busca os templates do banco de dados (sem fallback)
  const promptTemplate = await prisma.template.findUnique({
    where: { name: "default_requirements" },
  });

  if (!promptTemplate) {
    throw new TemplateNotFoundException("default_requirements");
  }

  const responseTemplate = await prisma.template.findUnique({
    where: { name: "default_requirements_response" },
  });

  if (!responseTemplate) {
    throw new TemplateNotFoundException("default_requirements_response");
  }

  const prompt = `${promptTemplate.content}

Projeto: ${state.projectRequest.name}

Prompt Original do Usuário:
${state.projectRequest.prompt}

Escopo Aprovado:
${state.approvedScopeContent || "Escopo delimitado conforme especificações aprovadas."}
`;

  const structuredLlm = model.withStructuredOutput(RequirementsSchema);
  const response = await structuredLlm.invoke(prompt);

  const markdown = buildMarkdownFromRequirementsResponse(
    response,
    responseTemplate.content,
  );

  // 2. Atualiza o artefato de requisitos para COMPLETED
  await prisma.artifact.updateMany({
    where: {
      requisitionId: state.requisitionId,
      artifactType: ArtifactType.REQUIREMENTS,
    },
    data: {
      status: "COMPLETED",
      generatedContent: markdown,
    },
  });

  // 3. Emite notificação SSE ARTIFACT_COMPLETED
  if (redis && state.userId) {
    const artifactCompletedEvent: SseEventMessage = {
      type: SseEventType.ARTIFACT_COMPLETED,
      userId: state.userId,
      requisitionId: state.requisitionId,
      threadId: threadId ?? undefined,
      timestamp: new Date().toISOString(),
      data: {
        artifactType: ArtifactType.REQUIREMENTS,
        fileName: "requirements.md",
        contentMd: markdown,
      },
    };
    await redis.publish(
      `USER_EVENTS_${state.userId}`,
      JSON.stringify(artifactCompletedEvent),
    );
  }

  // 4. Marca requisição como COMPLETED e notifica
  await prisma.requisition.update({
    where: { id: state.requisitionId },
    data: { status: "COMPLETED" },
  });

  if (redis && state.userId) {
    const completedEvent: SseEventMessage = {
      type: SseEventType.REQUISITION_STATUS_CHANGED,
      userId: state.userId,
      requisitionId: state.requisitionId,
      threadId: threadId ?? undefined,
      timestamp: new Date().toISOString(),
      data: { status: "COMPLETED" },
    };
    await redis.publish(
      `USER_EVENTS_${state.userId}`,
      JSON.stringify(completedEvent),
    );
  }

  logger.info(
    { requisitionId: state.requisitionId, threadId },
    "Requirements generation completed successfully",
  );

  return {
    messages: [
      new AIMessage({
        content: "Especificação de requisitos gerada com sucesso.",
      }),
    ],
  };
};
