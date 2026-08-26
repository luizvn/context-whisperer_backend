import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { CreateProjectInput } from '../dto/create-project.input';

export interface GraphStateType {
  projectRequest: CreateProjectInput;
  requisitionId: string;
  userId: string;
  scopeProposalId: string;
  messages: BaseMessage[];
}

// Definição do estado global do seu LangGraph
export const GraphState: any = Annotation.Root({
  projectRequest: Annotation<CreateProjectInput>(),
  requisitionId: Annotation<string>(),
  userId: Annotation<string>(),
  scopeProposalId: Annotation<string>(),

  messages: Annotation<BaseMessage[]>({
    reducer: (currentState, newMessages) => currentState.concat(newMessages),
    default: () => [],
  }),
});
