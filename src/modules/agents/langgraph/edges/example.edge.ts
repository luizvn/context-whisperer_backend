import { GraphStateType } from '../state';

/**
 * Exemplo de roteamento condicional.
 * Retorna o nome do próximo nó a ser executado ou '__end__' para finalizar o grafo.
 */
export const shouldContinueEdge = (state: GraphStateType): string => {
  console.log('--- EVALUATING CONDITIONAL EDGE ---');

  const { messages } = state;

  // Exemplo: encerra se houver mais de 3 mensagens, caso contrário, entra em loop
  if (messages.length > 3) {
    return '__end__';
  }

  return 'exampleNode';
};
