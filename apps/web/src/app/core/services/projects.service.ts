import { Injectable, computed, inject, signal } from "@angular/core";
import { mockConstraints, mockTemplates } from "@core/data/mock-data";
import {
  ARTIFACT_META,
  SseEventType,
  type Artifact,
  type ArtifactType,
  type Constraint,
  type EvaluationLog,
  type Project,
  type ProjectStatus,
  type ScopeStatus,
  type SseEventMessage,
  type Template,
} from "@core/models/types";
import { GraphQLService } from "./graphql.service";
import { NotificationService } from "./notification.service";
import { SseService } from "./sse.service";

export interface CreateProjectInput {
  name: string;
  prompt: string;
  selectedArtifacts: ArtifactType[];
}

function mapWebTypeToBackend(type: ArtifactType): string {
  switch (type) {
    case "REQUIREMENTS":
      return "REQUIREMENTS";
    case "ARCHITECTURE":
      return "ARCHITECTURE_DOC";
    case "UML":
      return "UML_DIAGRAM";
    case "AGENTS_MD":
      return "RECOMMENDED_PROMPT";
  }
}

function mapBackendTypeToWeb(type: string): ArtifactType {
  switch (type) {
    case "ARCHITECTURE_DOC":
      return "ARCHITECTURE";
    case "UML_DIAGRAM":
      return "UML";
    case "RECOMMENDED_PROMPT":
    case "USER_STORIES":
    case "DOMAIN_MODEL":
    case "API_SPEC":
      return "AGENTS_MD";
    case "REQUIREMENTS":
    default:
      return "REQUIREMENTS";
  }
}

interface GraphQLRequisition {
  id: string;
  name: string;
  originalPrompt: string;
  status: string;
  createdAt: string;
  scopeProposals?: Array<{
    id: string;
    contentMd: string;
    status: string;
    userFeedback?: string | null;
  }>;
  artifacts?: Array<{
    id: string;
    artifactType: string;
    fileName: string;
    generatedContent?: string | null;
    status: string;
    iterationCount: number;
  }>;
  evaluations?: Array<{
    id: string;
    artifactId: string;
    iteration: number;
    status: string;
    score: number;
    summary: string;
    rootCauses: string[];
    counterfactualFeedback?: string | null;
    createdAt: string;
  }>;
}

function mapRequisitionToProject(req: GraphQLRequisition): Project {
  const latestScope = req.scopeProposals?.[0];
  const scope: Project["scope"] = {
    id: latestScope?.id,
    status: (latestScope?.status as ScopeStatus) || "PENDING",
    contentMd:
      latestScope?.contentMd ||
      (req.status === "AWAITING_SCOPE"
        ? "> **Aguardando geração pelo Agente de Escopo...**\n\nO worker está processando a proposta com base nas diretrizes do MVP."
        : "> **Nenhuma proposta de escopo registrada para esta requisição.**"),
    feedback: latestScope?.userFeedback || undefined,
  };

  const artifacts: Artifact[] = (req.artifacts || []).map((a) => ({
    type: mapBackendTypeToWeb(a.artifactType),
    status:
      a.status === "COMPLETED" ? "APPROVED" : a.status === "DRAFT" ? "IDLE" : (a.status as any),
    iterationCount: a.iterationCount || 0,
    content: a.generatedContent || "",
  }));

  const evaluations: EvaluationLog[] = (req.evaluations || []).map((e) => ({
    id: e.id,
    artifactType: "REQUIREMENTS",
    iteration: e.iteration,
    constraintCategory: "QUALIDADE",
    constraintRule: e.summary || "Avaliação Causal",
    isApproved: e.status === "PASSED",
    causalFeedback: e.counterfactualFeedback || "",
    judgePrompt: "",
    rawJudgeResponse: JSON.stringify(e),
    globalStateSnapshot: {},
    evaluatedAt: e.createdAt,
  }));

  return {
    id: req.id,
    name: req.name || "Projeto",
    prompt: req.originalPrompt || "",
    status: (req.status as ProjectStatus) || "AWAITING_SCOPE",
    selectedArtifacts:
      artifacts.length > 0
        ? artifacts.map((a) => a.type)
        : ["REQUIREMENTS", "ARCHITECTURE", "UML", "AGENTS_MD"],
    scope,
    artifacts,
    evaluations,
    createdAt: req.createdAt || new Date().toISOString(),
  };
}

@Injectable({
  providedIn: "root",
})
export class ProjectsService {
  private readonly gql = inject(GraphQLService);
  private readonly sse = inject(SseService);
  private readonly notificationService = inject(NotificationService);

  // Estado base reativo com Signals nativos do Angular
  private readonly _projects = signal<Project[]>([]);
  private readonly _templates = signal<Template[]>(mockTemplates);
  private readonly _constraints = signal<Constraint[]>(mockConstraints);
  private readonly _loading = signal<boolean>(false);

  // Computed signals públicos
  readonly projects = this._projects.asReadonly();
  readonly templates = this._templates.asReadonly();
  readonly constraints = this._constraints.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly totalProjects = computed(() => this._projects().length);

  constructor() {
    this.setupSseListeners();
  }

  private getProjectName(reqId: string, fallback?: string): string {
    if (fallback) return fallback;
    const found = this._projects().find((p) => p.id === reqId);
    return found?.name || "Projeto";
  }

  /**
   * Configura os ouvintes em tempo real para os eventos de streaming da IA
   */
  private setupSseListeners(): void {
    // 1. Proposta de Escopo pronta (Human-in-the-Loop)
    this.sse.on(SseEventType.SCOPE_READY, (msg: SseEventMessage<any>) => {
      const reqId = msg.requisitionId;
      if (!reqId) return;

      const proposal = (msg.data as any)?.proposal ?? msg.data;
      const projectName = this.getProjectName(reqId, msg.projectName);

      this._projects.update((list) =>
        list.map((p) => {
          if (p.id !== reqId) return p;
          return {
            ...p,
            status: "AWAITING_SCOPE",
            scope: {
              status: "PENDING",
              contentMd: proposal?.contentMd || p.scope.contentMd,
              feedback: proposal?.userFeedback || undefined,
            },
          };
        }),
      );

      this.notificationService.show({
        type: "info",
        title: "Escopo Concluído",
        message: `Projeto "${projectName}" teve a geração de escopo concluída.`,
        projectName,
        requisitionId: reqId,
        targetRoute: ["/projects", reqId, "scope"],
        actionLabel: "Revisar Escopo",
      });

      // Hidratação proativa em background para atualizar tudo no cache
      void this.loadProjectById(reqId);
    });

    // 2. Escopo Aprovado
    this.sse.on(SseEventType.SCOPE_APPROVED, (msg: SseEventMessage<any>) => {
      const reqId = msg.requisitionId;
      if (!reqId) return;

      this._projects.update((list) =>
        list.map((p) => {
          if (p.id !== reqId) return p;
          return {
            ...p,
            status: "GENERATING",
            scope: { ...p.scope, status: "APPROVED" },
          };
        }),
      );

      void this.loadProjectById(reqId);
    });

    // 3. Escopo Recusado / Solicitado Ajustes
    this.sse.on(SseEventType.SCOPE_REJECTED, (msg: SseEventMessage<any>) => {
      const reqId = msg.requisitionId;
      if (!reqId) return;

      this._projects.update((list) =>
        list.map((p) => {
          if (p.id !== reqId) return p;
          return {
            ...p,
            scope: {
              ...p.scope,
              status: "REJECTED",
              feedback: (msg.data as any)?.userFeedback || p.scope.feedback,
            },
          };
        }),
      );

      void this.loadProjectById(reqId);
    });

    // 4. Artefato em Geração
    this.sse.on(SseEventType.ARTIFACT_GENERATING, (msg: SseEventMessage<any>) => {
      const reqId = msg.requisitionId;
      if (!reqId) return;

      const rawType = (msg.data as any)?.artifactType || "REQUIREMENTS";
      const type = mapBackendTypeToWeb(rawType);
      const meta = ARTIFACT_META[type];
      const label = meta?.label || "Artefato";
      const projectName = this.getProjectName(reqId, msg.projectName);

      this._projects.update((list) =>
        list.map((p) => {
          if (p.id !== reqId) return p;
          const updatedArts = p.artifacts.map((a) =>
            a.type === type ? { ...a, status: "RUNNING" as const } : a,
          );
          return { ...p, status: "GENERATING", artifacts: updatedArts };
        }),
      );

      this.notificationService.show({
        type: "info",
        title: "Gerando Artefato",
        message: `O agente iniciou a geração de ${label} para o projeto "${projectName}".`,
        projectName,
        requisitionId: reqId,
        targetRoute: ["/projects", reqId, "artifacts"],
        actionLabel: "Ver Artefatos",
      });
    });

    // 5. Artefato em Refinamento / Retrabalho pelo Juiz
    this.sse.on(SseEventType.ARTIFACT_REWORKING, (msg: SseEventMessage<any>) => {
      const reqId = msg.requisitionId;
      if (!reqId) return;

      const rawType = (msg.data as any)?.artifactType || "REQUIREMENTS";
      const type = mapBackendTypeToWeb(rawType);
      const meta = ARTIFACT_META[type];
      const label = meta?.label || "Artefato";
      const projectName = this.getProjectName(reqId, msg.projectName);

      this._projects.update((list) =>
        list.map((p) => {
          if (p.id !== reqId) return p;
          const updatedArts = p.artifacts.map((a) =>
            a.type === type ? { ...a, status: "RUNNING" as const } : a,
          );
          return { ...p, artifacts: updatedArts };
        }),
      );

      this.notificationService.show({
        type: "warning",
        title: "Ajuste pelo Juiz",
        message: `O artefato ${label} do projeto "${projectName}" foi reprovado pelo Juiz e está sendo ajustado.`,
        projectName,
        requisitionId: reqId,
        targetRoute: ["/projects", reqId, "artifacts"],
        actionLabel: "Ver Artefatos",
      });

      void this.loadProjectById(reqId);
    });

    // 6. Artefato Concluído e Aprovado
    this.sse.on(SseEventType.ARTIFACT_COMPLETED, (msg: SseEventMessage<any>) => {
      const reqId = msg.requisitionId;
      if (!reqId) return;

      const rawType = (msg.data as any)?.artifactType || "REQUIREMENTS";
      const type = mapBackendTypeToWeb(rawType);
      const meta = ARTIFACT_META[type];
      const label = meta?.label || "Artefato";
      const projectName = this.getProjectName(reqId, msg.projectName);
      const content = (msg.data as any)?.contentMd ?? (msg.data as any)?.generatedContent;

      this._projects.update((list) =>
        list.map((p) => {
          if (p.id !== reqId) return p;
          const updatedArts = p.artifacts.map((a) =>
            a.type === type
              ? {
                  ...a,
                  status: "APPROVED" as const,
                  content: content || a.content,
                  iterationCount: (msg.data as any)?.iterationCount ?? a.iterationCount,
                }
              : a,
          );
          return { ...p, artifacts: updatedArts };
        }),
      );

      this.notificationService.show({
        type: "success",
        title: "Artefato Concluído",
        message: `O artefato ${label} do projeto "${projectName}" foi concluído e aprovado pelo Juiz.`,
        projectName,
        requisitionId: reqId,
        targetRoute: ["/projects", reqId, "artifacts"],
        actionLabel: "Ver Artefatos",
      });

      void this.loadProjectById(reqId);
    });

    // 7. Transição de Status da Requisição
    this.sse.on(SseEventType.REQUISITION_STATUS_CHANGED, (msg: SseEventMessage<any>) => {
      const reqId = msg.requisitionId;
      const status = (msg.data as any)?.status as ProjectStatus;
      if (!reqId || !status) return;

      const projectName = this.getProjectName(reqId, msg.projectName);
      this.setProjectStatus(reqId, status);
      void this.loadProjectById(reqId);

      if (status === "COMPLETED") {
        this.notificationService.show({
          type: "success",
          title: "Projeto Finalizado",
          message: `Todos os artefatos do projeto "${projectName}" foram concluídos com sucesso!`,
          projectName,
          requisitionId: reqId,
          targetRoute: ["/projects", reqId, "artifacts"],
          actionLabel: "Explorar Artefatos",
        });
      } else if (status === "FAILED") {
        this.notificationService.show({
          type: "error",
          title: "Falha na Geração",
          message: `Ocorreu um erro durante o processamento do projeto "${projectName}".`,
          projectName,
          requisitionId: reqId,
          targetRoute: ["/projects", reqId, "artifacts"],
          actionLabel: "Ver Artefatos",
        });
      }
    });

    // 8. Falha Geral de Workflow
    this.sse.on(SseEventType.WORKFLOW_FAILED, (msg: SseEventMessage<any>) => {
      const reqId = msg.requisitionId;
      if (!reqId) return;

      const projectName = this.getProjectName(reqId, msg.projectName);
      this.setProjectStatus(reqId, "FAILED");
      void this.loadProjectById(reqId);

      this.notificationService.show({
        type: "error",
        title: "Falha no Workflow",
        message: `Ocorreu uma falha no fluxo de agentes do projeto "${projectName}".`,
        projectName,
        requisitionId: reqId,
        targetRoute: ["/projects", reqId, "artifacts"],
        actionLabel: "Ver Artefatos",
      });
    });
  }

  /**
   * Carrega os projetos reais do usuário via GraphQL
   */
  async loadProjects(): Promise<void> {
    this._loading.set(true);

    const query = `
      query MyProjects {
        myProjects {
          id
          name
          originalPrompt
          status
          createdAt
        }
      }
    `;

    try {
      const result = await this.gql.execute<{ myProjects: GraphQLRequisition[] }>(query);
      if (result.myProjects) {
        // Preserva projetos que já estejam totalmente hidratados em memória
        const currentMap = new Map(this._projects().map((p) => [p.id, p]));
        const loaded = result.myProjects.map((req) => {
          const existing = currentMap.get(req.id);
          // Se o projeto já foi hidratado em detalhes (possui escopo com ID ou artefatos gerados), mantém os dados detalhados
          if (existing && (existing.scope?.id || existing.artifacts.length > 0)) {
            return {
              ...existing,
              name: req.name || existing.name,
              status: (req.status as ProjectStatus) || existing.status,
              createdAt: req.createdAt || existing.createdAt,
            };
          }
          return mapRequisitionToProject(req);
        });
        this._projects.set(loaded);
      }
    } catch (err) {
      console.warn(
        "[ProjectsService] Não foi possível carregar projetos da API, mantendo dados locais:",
        err,
      );
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Limpa todos os projetos do estado local (usado no logout)
   */
  clearProjects(): void {
    this._projects.set([]);
  }

  /**
   * Obtém um projeto por ID através de computed ou busca fresca da API
   */
  getProjectById(id: string): Project | undefined {
    return this._projects().find((p) => p.id === id);
  }

  /**
   * Carrega detalhes completos de um projeto pelo ID a partir do backend
   */
  async loadProjectById(id: string): Promise<Project | undefined> {
    const query = `
      query GetProject($id: ID!) {
        project(id: $id) {
          id
          name
          originalPrompt
          status
          createdAt
          scopeProposals {
            id
            contentMd
            status
            userFeedback
          }
          artifacts {
            id
            artifactType
            fileName
            generatedContent
            status
            iterationCount
          }
          evaluations {
            id
            artifactId
            iteration
            status
            score
            summary
            rootCauses
            counterfactualFeedback
            createdAt
          }
        }
      }
    `;

    try {
      const result = await this.gql.execute<{ project: GraphQLRequisition }>(query, { id });
      if (result.project) {
        const project = mapRequisitionToProject(result.project);
        this._projects.update((list) => {
          const idx = list.findIndex((p) => p.id === id);
          if (idx >= 0) {
            const next = [...list];
            next[idx] = project;
            return next;
          }
          return [project, ...list];
        });
        return project;
      }
    } catch (err) {
      console.warn(`[ProjectsService] Falha ao buscar detalhes do projeto ${id}:`, err);
    }

    return this.getProjectById(id);
  }

  /**
   * Cria um novo projeto via Mutation GraphQL e enfileira no LangGraph/BullMQ
   */
  async createProject(input: CreateProjectInput): Promise<string> {
    const mutation = `
      mutation CreateProject($input: CreateProjectInput!) {
        createProject(input: $input) {
          jobId
          requisitionId
          status
        }
      }
    `;

    const backendArtifacts = input.selectedArtifacts.map(mapWebTypeToBackend);

    try {
      const result = await this.gql.execute<{
        createProject: { jobId: string; requisitionId: string; status: string };
      }>(mutation, {
        input: {
          name: input.name,
          prompt: input.prompt,
          artifacts: backendArtifacts,
        },
      });

      const requisitionId = result.createProject.requisitionId;

      // Cria estado preliminar no signal para renderização imediata na UI
      const newProject: Project = {
        id: requisitionId,
        name: input.name,
        prompt: input.prompt,
        status: "AWAITING_SCOPE",
        selectedArtifacts: input.selectedArtifacts,
        scope: {
          status: "PENDING",
          contentMd:
            "> **Gerando proposta de escopo com IA...**\n\nO agente está analisando os requisitos do MVP.",
        },
        artifacts: input.selectedArtifacts.map((t) => ({
          type: t,
          status: "IDLE",
          iterationCount: 0,
          content: "",
        })),
        evaluations: [],
        createdAt: new Date().toISOString(),
      };

      this._projects.update((list) => [newProject, ...list]);
      return requisitionId;
    } catch (err) {
      console.error("[ProjectsService] Falha ao criar na API:", err);
      throw err;
    }
  }

  /**
   * Aprova uma proposta de escopo (Human-in-the-Loop)
   */
  async approveScope(projectId: string): Promise<void> {
    const project = this.getProjectById(projectId);
    if (!project) return;

    // Atualização otimista no Signal
    this.setScopeStatus(projectId, "APPROVED");

    const targetId = project.scope?.id || projectId;

    const mutation = `
      mutation ApproveScope($id: String!) {
        approveScopeProposal(id: $id) {
          id
          status
        }
      }
    `;

    try {
      await this.gql.execute(mutation, { id: targetId });
    } catch (err) {
      console.warn("[ProjectsService] Falha na mutação approveScopeProposal:", err);
    }
  }

  /**
   * Recusa ou solicita ajustes na proposta de escopo com feedback
   */
  async rejectScope(projectId: string, feedback: string): Promise<void> {
    const project = this.getProjectById(projectId);
    if (!project) return;

    // Atualização otimista no Signal
    this.setScopeStatus(projectId, "REJECTED", feedback);

    const targetId = project.scope?.id || projectId;

    const mutation = `
      mutation RejectScope($id: String!, $feedback: String!) {
        rejectScopeProposal(id: $id, feedback: $feedback) {
          id
          status
          userFeedback
        }
      }
    `;

    try {
      await this.gql.execute(mutation, { id: targetId, feedback });
    } catch (err) {
      console.warn("[ProjectsService] Falha na mutação rejectScopeProposal:", err);
    }
  }

  /**
   * Faz o download do pacote ZIP com todos os artefatos técnicos gerados pelo backend
   */
  async downloadAllZip(projectId: string): Promise<void> {
    const query = `
      query DownloadZip($requisitionId: ID!) {
        downloadArtifactsZip(requisitionId: $requisitionId) {
          fileName
          contentType
          base64
          sizeBytes
        }
      }
    `;

    try {
      const res = await this.gql.execute<{
        downloadArtifactsZip: {
          fileName: string;
          contentType: string;
          base64: string;
          sizeBytes: number;
        };
      }>(query, { requisitionId: projectId });

      const zipData = res.downloadArtifactsZip;
      if (!zipData?.base64) {
        throw new Error("Conteúdo do ZIP não retornado pelo servidor.");
      }

      // Converte Base64 para Blob e dispara o download no navegador
      const binaryString = atob(zipData.base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], {
        type: zipData.contentType || "application/zip",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = zipData.fileName || `artifacts-${projectId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[ProjectsService] Erro ao baixar pacote ZIP:", err);
      alert(
        "Não foi possível gerar o pacote ZIP de artefatos. Verifique se os artefatos foram concluídos.",
      );
    }
  }

  /**
   * Atualiza o status do escopo no estado reativo local
   */
  setScopeStatus(id: string, status: ScopeStatus, feedback?: string): void {
    this._projects.update((list) =>
      list.map((p) => {
        if (p.id !== id) return p;

        const nextStatus: ProjectStatus =
          status === "APPROVED" ? "GENERATING" : status === "REJECTED" ? "FAILED" : p.status;

        return {
          ...p,
          scope: {
            ...p.scope,
            status,
            ...(feedback !== undefined ? { feedback } : {}),
          },
          status: nextStatus,
        };
      }),
    );
  }

  /**
   * Altera o status geral do projeto
   */
  setProjectStatus(id: string, status: ProjectStatus): void {
    this._projects.update((list) => list.map((p) => (p.id === id ? { ...p, status } : p)));
  }

  /**
   * Avança a simulação determinística dos agentes
   */
  advanceSimulation(id: string): void {
    const SAMPLE_DRAFT_REQ = `# Requisitos\n\n## RF\n- RF01 ...\n- RF02 ...\n\n## RNF\n- RNF01 ...\n`;
    const SAMPLE_DRAFT_ARCH = `# Arquitetura\n\n## Camadas\n- Apresentação\n- Aplicação\n- Domínio\n- Infra\n`;
    const SAMPLE_DRAFT_UML = "# UML\n\n```mermaid\nclassDiagram\n  class Entidade\n```\n";
    const SAMPLE_DRAFT_AGENTS = "# agents.md\n\n- AgenteA\n- AgenteB\n";

    const draftFor = (type: ArtifactType) =>
      type === "REQUIREMENTS"
        ? SAMPLE_DRAFT_REQ
        : type === "ARCHITECTURE"
          ? SAMPLE_DRAFT_ARCH
          : type === "UML"
            ? SAMPLE_DRAFT_UML
            : SAMPLE_DRAFT_AGENTS;

    this._projects.update((list) =>
      list.map((p) => {
        if (p.id !== id) return p;

        const next = p.artifacts.map((a) => ({ ...a }));
        const idleIdx = next.findIndex((a) => a.status === "IDLE");
        const runningIdx = next.findIndex((a) => a.status === "RUNNING");

        if (runningIdx >= 0) {
          next[runningIdx] = {
            ...next[runningIdx],
            status: "APPROVED",
            iterationCount: next[runningIdx].iterationCount + 1,
            content: draftFor(next[runningIdx].type),
          };
        } else if (idleIdx >= 0) {
          next[idleIdx] = {
            ...next[idleIdx],
            status: "RUNNING",
            iterationCount: next[idleIdx].iterationCount + 1,
          };
        }

        const allDone = next.length > 0 && next.every((a) => a.status === "APPROVED");

        return {
          ...p,
          artifacts: next,
          status: allDone ? "COMPLETED" : "GENERATING",
        };
      }),
    );
  }

  /**
   * Alterna estado de ativação de uma constraint
   */
  toggleConstraint(id: string, active: boolean): void {
    this._constraints.update((list) =>
      list.map((c) => (c.id === id ? { ...c, isActive: active } : c)),
    );
  }
}
