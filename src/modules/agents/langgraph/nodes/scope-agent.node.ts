import { RunnableConfig } from '@langchain/core/runnables';
import { ProposedScopeSchema } from '../schemas/proposed-scope.response';
import { GraphStateType } from '../state';
import { AIMessage } from '@langchain/core/messages';
import { OpenAIService } from '../../../../openai/openai.service';
import { ScopeProposalService } from '../../../scope-proposals/scope-proposal.service';

export const scopeAgent = async (
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> => {
  console.log('--- EXECUTING SCOPE AGENT ---');
  const configurable = config?.configurable;
  const openAIService = configurable?.openAIService as OpenAIService;
  const scopeProposalService =
    configurable?.scopeProposalService as ScopeProposalService;

  const llm = openAIService.getChatModel();
  const structuredLlm = llm.withStructuredOutput(ProposedScopeSchema);

  const prompt = `Você é um Engenheiro de Requisitos Sênior rigoroso. 
  Sua única missão é transformar ideias cruas em especificações de MVP 
  para delimitar o escopo para os agentes seguintes. 
  Aplique a técnica MoSCoW. Rejeite funcionalidades supérfluas. 
  Retorne EXCLUSIVAMENTE um JSON estruturado contendo 
  o objetivo principal, uma lista de no máximo 5 funcionalidades de cada 
  categoria (Must Have, Should Have, Could Have e Won't Have) 
  e as restrições do negócio.

  Prompt do usuário:
  ${state.projectRequest.prompt}
  `;

  const response = await structuredLlm.invoke(prompt);

  const markdown = scopeProposalService.buildMarkdownFromResponse(response);
  const { id } = await scopeProposalService.create(
    state.requisitionId,
    markdown,
  );

  return {
    // Adiciona uma mensagem ao histórico e salva o ID/estado gerado
    messages: [
      new AIMessage({
        content: `Escopo gerado com sucesso para: ${response.projectGoal || 'Projeto'}`,
      }),
    ],
    scopeProposalId: id,
  };
};
