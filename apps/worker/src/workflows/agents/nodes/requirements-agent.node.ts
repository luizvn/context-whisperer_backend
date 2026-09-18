import { RunnableConfig } from "@langchain/core/runnables";
import { AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  RequirementsSchema,
  RequirementsResponse,
  GraphStateType,
  ArtifactType,
  TemplateNotFoundException,
} from "@context-whisperer/core";
import { prisma } from "@context-whisperer/database";
import { logger } from "../../../utils/logger";

function buildMarkdownFromRequirementsResponse(
  data: RequirementsResponse,
  templateContent: string,
): string {
  const functionalMd = data.functionalRequirements
    .map((r) => `### ${r.id} - ${r.title}\n${r.description}\n`)
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

  const feedback = state.evaluationFeedback?.[ArtifactType.REQUIREMENTS];
  let previousContent =
    state.previousArtifactsContent?.[ArtifactType.REQUIREMENTS];

  if (feedback && !previousContent) {
    const existing = await prisma.artifact.findFirst({
      where: {
        requisitionId: state.requisitionId,
        artifactType: ArtifactType.REQUIREMENTS,
      },
    });
    if (existing?.generatedContent) {
      previousContent = existing.generatedContent;
    }
  }

  let prompt: string;

  if (feedback && previousContent) {
    prompt = `Você é um Engenheiro de Requisitos de Software Sênior atuando no MODO DE REVISÃO TÉCNICA E REFINAMENTO CIRÚRGICO.

Sua tarefa NÃO é criar uma especificação do zero. Sua missão é REFINAR E CORRIGIR cirurgicamente a especificação anterior gerada, sanando todas as inconformidades apontadas pelo Agente Juiz e preservando tudo que já estava correto.

Projeto: ${state.projectRequest.name}

Prompt Original do Usuário:
${state.projectRequest.prompt}

Escopo Aprovado:
${state.approvedScopeContent || "Escopo delimitado conforme especificações aprovadas."}

=== DOCUMENTO DE REQUISITOS ANTERIOR (VERSÃO A SER REFINADA) ===
${previousContent}

=== AVALIAÇÃO TÉCNICA ANTERIOR E INSTRUÇÕES DE CORREÇÃO (FEEDBACK CONTRAFACTUAL) ===
${feedback}

DIRETRIZES MANDATÓRIAS PARA ESTE REFINAMENTO:
1. PRESERVAÇÃO: Mantenha os requisitos funcionais (RFs), não-funcionais (RNFs) e regras de negócio (RNs) que não foram objeto de violação.
2. CONSISTÊNCIA DE IDENTIFICADORES: Conserve os mesmos IDs existentes (ex: RF-01, RF-02, RNF-01, RN-01) para os itens preservados.
3. CORREÇÃO CIRÚRGICA: Modifique, adicione ou remova especificamente os itens indicados no diagnóstico de causa-raiz e nos remédios contrafactuais.
4. COBERTURA TOTAL: Garanta que todas as funcionalidades Must Have do escopo aprovado possuam cobertura rastreável (RFs para capacidades funcionais observáveis, ou telas/RNFs de usabilidade caso o Must Have expresse expectativas de experiência/interface) e que nenhum item fora de escopo esteja presente.

Retorne EXCLUSIVAMENTE o JSON estruturado seguindo o schema fornecido.`;
  } else if (feedback) {
    prompt = `${promptTemplate.content}

Projeto: ${state.projectRequest.name}

Prompt Original do Usuário:
${state.projectRequest.prompt}

Escopo Aprovado:
${state.approvedScopeContent || "Escopo delimitado conforme especificações aprovadas."}

=== AVALIAÇÃO TÉCNICA ANTERIOR E INSTRUÇÕES DE CORREÇÃO (FEEDBACK CONTRAFACTUAL) ===
O artefato gerado anteriormente foi reprovado pelo Agente Juiz com os seguintes apontamentos e instruções de correção:
${feedback}

ATENÇÃO: Mantenha as partes do artefato que estavam corretas e reescreva de forma cirúrgica os requisitos, RNFs ou regras de negócio apontados acima para sanar integralmente todas as inconformidades.
`;
  } else {
    prompt = `${promptTemplate.content}

Projeto: ${state.projectRequest.name}

Prompt Original do Usuário:
${state.projectRequest.prompt}

Escopo Aprovado:
${state.approvedScopeContent || "Escopo delimitado conforme especificações aprovadas."}
`;
  }

  const structuredLlm = model.withStructuredOutput(RequirementsSchema);
  const response = await structuredLlm.invoke(prompt);

  const markdown = buildMarkdownFromRequirementsResponse(
    response,
    responseTemplate.content,
  );

  // 2. Atualiza o artefato com o conteúdo gerado e status EVALUATING para o juiz
  await prisma.artifact.updateMany({
    where: {
      requisitionId: state.requisitionId,
      artifactType: ArtifactType.REQUIREMENTS,
    },
    data: {
      status: "EVALUATING",
      generatedContent: markdown,
    },
  });

  logger.info(
    {
      requisitionId: state.requisitionId,
      threadId,
      isRework: Boolean(feedback),
    },
    "Requirements generation completed; ready for causal evaluation by judgeAgent",
  );

  return {
    messages: [
      new AIMessage({
        content: feedback
          ? "Especificação de requisitos refinada com base no feedback contrafactual do Agente Juiz."
          : "Especificação de requisitos gerada com sucesso, aguardando avaliação técnica.",
      }),
    ],
  };
};
