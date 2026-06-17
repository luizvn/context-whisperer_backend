import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { CreateProjectInput } from '../dto/create-project.input';

// Definição do estado global do seu LangGraph
export const GraphState = Annotation.Root({
  projectRequest: Annotation<CreateProjectInput>(),
  requisitionId: Annotation<string>(),
  userId: Annotation<string>(),
  scopeProposalId: Annotation<string>(),

  messages: Annotation<BaseMessage[]>({
    reducer: (currentState, newMessages) => currentState.concat(newMessages),
    default: () => [],
  }),
  // TODO: Adicione outras propriedades de estado necessárias para seu fluxo, como:
  // artifactsGenerated: Annotation<string[]>({ reducer: (x, y) => x.concat(y), default: () => [] }),
});

export type GraphStateType = typeof GraphState.State;
