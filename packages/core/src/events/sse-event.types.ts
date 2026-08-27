export enum SseEventType {
  HEARTBEAT = 'HEARTBEAT',
  REQUISITION_STATUS_CHANGED = 'REQUISITION_STATUS_CHANGED',
  SCOPE_READY = 'SCOPE_READY',
  SCOPE_APPROVED = 'SCOPE_APPROVED',
  SCOPE_REJECTED = 'SCOPE_REJECTED',
  ARTIFACT_GENERATING = 'ARTIFACT_GENERATING',
  ARTIFACT_COMPLETED = 'ARTIFACT_COMPLETED',
  WORKFLOW_FAILED = 'WORKFLOW_FAILED',
}

export interface SseEventMessage<T = unknown> {
  id?: string;
  type: SseEventType;
  userId: string;
  requisitionId?: string;
  threadId?: string;
  timestamp: string;
  data: T;
}
