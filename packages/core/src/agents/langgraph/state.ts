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

export const GraphState = Annotation.Root({
  projectRequest: Annotation<CreateProjectInput>(),
  requisitionId: Annotation<string>(),
  userId: Annotation<string>(),
  scopeProposalId: Annotation<string>(),

  messages: Annotation<BaseMessage[]>({
    reducer: (currentState: BaseMessage[], newMessages: BaseMessage[]) =>
      currentState.concat(newMessages),
    default: () => [],
  }),
});
