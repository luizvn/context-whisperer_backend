import { GraphStateType } from '../state';
import { AIMessage } from '@langchain/core/messages';

export const scopeAgent = async (
  state: GraphStateType,
): Promise<Partial<GraphStateType>> => {
  console.log('--- EXECUTING SCOPE AGENT ---');

  // Implemente a lógica do nó aqui (ex: chamar o LLM via OpenAI)
  // const response = await llm.invoke(...)

  return {
    messages: [new AIMessage({ content: 'Example node executed' })],
  };
};
