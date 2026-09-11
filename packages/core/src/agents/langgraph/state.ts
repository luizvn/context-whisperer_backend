import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { CreateProjectInput } from '../dto/create-project.input';

export interface GraphStateType {
  projectRequest: CreateProjectInput;
  requisitionId: string;
  userId: string;
  scopeProposalId: string;
  messages: BaseMessage[];
  scopeApproved?: boolean;
  userFeedback?: string;
  approvedScopeContent?: string;
  generatedArtifactIds?: string[];
  evaluationFeedback?: Record<string, string>;
  artifactIterations?: Record<string, number>;
  currentEvaluationId?: string;
  evaluationStatus?: Record<string, 'PASSED' | 'FAILED'>;
  retryExhausted?: boolean;
}

export const GraphState = Annotation.Root({
  projectRequest: Annotation<CreateProjectInput>(),
  requisitionId: Annotation<string>(),
  userId: Annotation<string>(),
  scopeProposalId: Annotation<string>(),

  scopeApproved: Annotation<boolean | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  userFeedback: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  approvedScopeContent: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  generatedArtifactIds: Annotation<string[]>({
    reducer: (current, update) => (update ? current.concat(update) : current),
    default: () => [],
  }),

  evaluationFeedback: Annotation<Record<string, string> | undefined>({
    reducer: (current, next) =>
      next ? { ...(current ?? {}), ...next } : current,
    default: () => undefined,
  }),

  artifactIterations: Annotation<Record<string, number> | undefined>({
    reducer: (current, next) =>
      next ? { ...(current ?? {}), ...next } : current,
    default: () => undefined,
  }),

  currentEvaluationId: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  evaluationStatus: Annotation<
    Record<string, 'PASSED' | 'FAILED'> | undefined
  >({
    reducer: (current, next) =>
      next ? { ...(current ?? {}), ...next } : current,
    default: () => undefined,
  }),

  retryExhausted: Annotation<boolean | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  messages: Annotation<BaseMessage[]>({
    reducer: (currentState: BaseMessage[], newMessages: BaseMessage[]) =>
      currentState.concat(newMessages),
    default: () => [],
  }),
});
