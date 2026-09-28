import { RunnableConfig } from "@langchain/core/runnables";
import { AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  GraphStateType,
  ArtifactType,
  RecommendedPromptSchema,
  RecommendedPromptResponse,
  SseEventType,
  SseEventMessage,
  TemplateNotFoundException,
} from "@context-whisperer/core";
import { prisma } from "@context-whisperer/database";
import type IORedis from "ioredis";
import { logger } from "../../../utils/logger";

function cleanMasterPrompt(prompt: string): string {
  let cleaned = (prompt || "").trim();
  if (cleaned.startsWith("```markdown")) {
    cleaned = cleaned.replace(/^```markdown\r?\n?/, "");
    cleaned = cleaned.replace(/\r?\n?```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\r?\n?/, "");
    cleaned = cleaned.replace(/\r?\n?```$/, "");
  }
  return cleaned.trim();
}

function buildMarkdownFromRecommendedPromptResponse(
  data: RecommendedPromptResponse,
  templateContent: string,
): string {
  const roadmapMd = Array.isArray(data.implementationRoadmap)
    ? data.implementationRoadmap.map((step) => `- ${step}`).join("\n")
    : "- Configuração inicial e implementação dos fluxos centrais.";

  const masterPromptCleaned = cleanMasterPrompt(data.masterPrompt);

  return (
    templateContent
      .replace("{{projectOverview}}", data.projectOverview || "")
      .replace("{{recommendedStack}}", data.recommendedStack || "")
      .replace("{{implementationRoadmap}}", roadmapMd)
      .replace("{{masterPrompt}}", masterPromptCleaned)
      .replace("{{usageInstructions}}", data.usageInstructions || "")
      .trim() + "\n"
  );
}

export const recommendedPromptAgent = async (
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> => {
  const configurable = config?.configurable;
  const redis = configurable?.redis as IORedis | undefined;
  const threadId = configurable?.thread_id as string | undefined;

  logger.info(
    { requisitionId: state.requisitionId, threadId },
    "Executing recommended prompt agent (MVP Master Prompt synthesis)",
  );

  // 1. Busca os templates cadastrados no banco de dados
  const promptTemplate = await prisma.template.findUnique({
    where: { name: "default_recommended_prompt" },
  });
  if (!promptTemplate) {
    throw new TemplateNotFoundException("default_recommended_prompt");
  }

  const responseTemplate = await prisma.template.findUnique({
    where: { name: "default_recommended_prompt_response" },
  });
  if (!responseTemplate) {
    throw new TemplateNotFoundException("default_recommended_prompt_response");
  }

  // 2. Busca os artefatos técnicos gerados e concluídos no banco de dados
  const completedArtifacts = await prisma.artifact.findMany({
    where: {
      requisitionId: state.requisitionId,
      status: "COMPLETED",
    },
    select: {
      fileName: true,
      artifactType: true,
      generatedContent: true,
    },
  });

  const requirementsArtifact = completedArtifacts.find(
    (a) => a.artifactType === (ArtifactType.REQUIREMENTS as string),
  );

  const requirementsContent =
    requirementsArtifact?.generatedContent ||
    state.previousArtifactsContent?.[ArtifactType.REQUIREMENTS] ||
    "Especificação de requisitos técnicos conforme escopo aprovado.";

  // Monta a lista dinâmica de arquivos locais disponíveis no repositório
  const availableFilesList: string[] = [
    "- docs/requirements.md (FONTE PRIMÁRIA DA VERDADE TÉCNICA: Requisitos Funcionais observáveis, RNFs mensuráveis, Regras de Negócio condicionais e Matriz RBAC)",
    "- docs/scope.md (CONTEXTO EXECUTIVO & FRONTEIRAS MOSCOW: Objetivo do Projeto, Proposta de Valor e itens terminantemente fora de escopo - Won't Have)",
  ];

  for (const art of completedArtifacts) {
    if (
      art.artifactType !== (ArtifactType.REQUIREMENTS as string) &&
      art.fileName
    ) {
      availableFilesList.push(`- docs/${art.fileName} (${art.artifactType})`);
    }
  }

  // 3. Constrói o prompt com o contexto consolidado de alta fidelidade
  const prompt = `${promptTemplate.content}

=== DADOS DO PROJETO ===
Nome do Projeto: ${state.projectRequest?.name ?? "Projeto"}
Prompt Original do Usuário:
${state.projectRequest?.prompt ?? ""}

=== ARQUIVOS DE ESPECIFICAÇÃO DISPONÍVEIS NO REPOSITÓRIO ===
${availableFilesList.join("\n")}

=== ESCOPO APROVADO (MOSCOW - CONTEXTO E FRONTEIRAS) ===
${state.approvedScopeContent || "Escopo aprovado conforme acordado."}

=== ESPECIFICAÇÃO TÉCNICA DE REQUISITOS (FONTE PRIMÁRIA DA VERDADE - AUDITADA PELO JUIZ) ===
${requirementsContent}
`;

  const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-4o",
    temperature: 0.2,
    apiKey: process.env.OPENAI_API_KEY,
  });

  const structuredLlm = model.withStructuredOutput(RecommendedPromptSchema);
  const response = await structuredLlm.invoke(prompt);

  const markdown = buildMarkdownFromRecommendedPromptResponse(
    response,
    responseTemplate.content,
  );

  // 4. Persiste o artefato RECOMMENDED_PROMPT no MongoDB
  const artifact = await prisma.artifact.create({
    data: {
      requisitionId: state.requisitionId,
      templateId: responseTemplate.id,
      artifactType: ArtifactType.RECOMMENDED_PROMPT,
      fileName: "recommended_mvp_prompt.md",
      generatedContent: markdown,
      status: "COMPLETED",
      iterationCount: 1,
    },
  });

  // 5. Publica evento SSE do artefato concluído
  if (redis && state.userId) {
    const artifactCompletedEvent: SseEventMessage = {
      type: SseEventType.ARTIFACT_COMPLETED,
      userId: state.userId,
      requisitionId: state.requisitionId,
      projectName: state.projectRequest.name,
      threadId: threadId ?? undefined,
      timestamp: new Date().toISOString(),
      data: {
        artifactType: ArtifactType.RECOMMENDED_PROMPT,
        fileName: artifact.fileName,
        contentMd: markdown,
      },
    };
    await redis.publish(
      `USER_EVENTS_${state.userId}`,
      JSON.stringify(artifactCompletedEvent),
    );
  }

  // 6. Atualiza a Requisition como COMPLETED e publica evento final
  await prisma.requisition.update({
    where: { id: state.requisitionId },
    data: { status: "COMPLETED" },
  });

  if (redis && state.userId) {
    const completedEvent: SseEventMessage = {
      type: SseEventType.REQUISITION_STATUS_CHANGED,
      userId: state.userId,
      requisitionId: state.requisitionId,
      projectName: state.projectRequest.name,
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
    { requisitionId: state.requisitionId, artifactId: artifact.id },
    "Recommended prompt agent successfully generated and persisted MVP master prompt",
  );

  return {
    generatedArtifactIds: [artifact.id],
    messages: [
      new AIMessage(
        `[RecommendedPromptAgent] Generated AI-ready master prompt for MVP: ${artifact.fileName}.`,
      ),
    ],
  };
};
