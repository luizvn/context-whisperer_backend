export type ArtifactType = "REQUIREMENTS" | "ARCHITECTURE" | "UML" | "AGENTS_MD";

export const ARTIFACT_META: Record<
  ArtifactType,
  { label: string; file: string; icon: string; description: string }
> = {
  REQUIREMENTS: {
    label: "Requisitos",
    file: "1_Requisitos.md",
    icon: "📋",
    description: "RF e RNF estruturados a partir do escopo aprovado.",
  },
  ARCHITECTURE: {
    label: "Arquitetura",
    file: "2_Arquitetura.md",
    icon: "🏗️",
    description: "Documento arquitetural com camadas, decisões e trade-offs.",
  },
  UML: {
    label: "Diagramas UML",
    file: "3_UML.md",
    icon: "🧩",
    description: "Casos de uso, classes e fluxo em sintaxe Mermaid.",
  },
  AGENTS_MD: {
    label: "agents.md",
    file: "agents.md",
    icon: "⚙️",
    description: "Configuração de agentes derivada da arquitetura.",
  },
};

export type ProjectStatus = "AWAITING_SCOPE" | "GENERATING" | "COMPLETED" | "FAILED";

export type ScopeStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ArtifactStatus = "DRAFT" | "RUNNING" | "APPROVED" | "REJECTED" | "IDLE";

export interface Artifact {
  type: ArtifactType;
  status: ArtifactStatus;
  iterationCount: number;
  content: string;
}

export interface EvaluationLog {
  id: string;
  artifactType: ArtifactType;
  iteration: number;
  constraintCategory: string;
  constraintRule: string;
  isApproved: boolean;
  causalFeedback: string;
  judgePrompt: string;
  rawJudgeResponse: string;
  globalStateSnapshot: Record<string, string>;
  evaluatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  prompt: string;
  status: ProjectStatus;
  selectedArtifacts: ArtifactType[];
  scope: {
    id?: string;
    status: ScopeStatus;
    contentMd: string;
    feedback?: string;
  };
  artifacts: Artifact[];
  evaluations: EvaluationLog[];
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  targetDocument: string;
  contentMd: string;
}

export interface Constraint {
  id: string;
  category: string;
  ruleDescription: string;
  ruleContent: string;
  isActive: boolean;
}

export enum SseEventType {
  HEARTBEAT = "HEARTBEAT",
  REQUISITION_STATUS_CHANGED = "REQUISITION_STATUS_CHANGED",
  SCOPE_READY = "SCOPE_READY",
  SCOPE_APPROVED = "SCOPE_APPROVED",
  SCOPE_REJECTED = "SCOPE_REJECTED",
  ARTIFACT_GENERATING = "ARTIFACT_GENERATING",
  ARTIFACT_REWORKING = "ARTIFACT_REWORKING",
  ARTIFACT_COMPLETED = "ARTIFACT_COMPLETED",
  WORKFLOW_FAILED = "WORKFLOW_FAILED",
}

export interface SseEventMessage<T = unknown> {
  id?: string;
  type: SseEventType;
  userId: string;
  requisitionId?: string;
  projectName?: string;
  threadId?: string;
  timestamp: string;
  data: T;
}
