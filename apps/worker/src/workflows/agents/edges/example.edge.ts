import { GraphStateType } from "@context-whisperer/core";
import { logger } from "../../../utils/logger";

/**
 * Exemplo de roteamento condicional.
 * Retorna o nome do próximo nó a ser executado ou '__end__' para finalizar o grafo.
 */
export const shouldContinueEdge = (state: GraphStateType): string => {
  logger.debug(
    { messagesCount: state.messages.length },
    "Evaluating conditional edge routing",
  );

  const { messages } = state;

  // Exemplo: encerra se houver mais de 3 mensagens, caso contrário, entra em loop
  if (messages.length > 3) {
    return "__end__";
  }

  return "exampleNode";
};
