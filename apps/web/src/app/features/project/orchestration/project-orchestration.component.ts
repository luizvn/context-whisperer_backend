import { Component, computed, inject, input, signal } from "@angular/core";
import { ARTIFACT_META, type ArtifactType } from "@core/models/types";
import { ProjectsService } from "@core/services/projects.service";
import { AgentFlowGraphComponent } from "@shared/components/agent-flow-graph/agent-flow-graph.component";

@Component({
  selector: "app-project-orchestration",
  standalone: true,
  imports: [AgentFlowGraphComponent],
  template: `
    @if (project(); as p) {
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <!-- Coluna da Esquerda: Grafo de Orquestração -->
        <div class="rounded-xl border border-border bg-card text-card-foreground shadow-xs">
          <div class="flex items-center justify-between border-b border-border p-5 pb-4">
            <div>
              <h2 class="text-base font-semibold leading-tight">Grafo de orquestração</h2>
              <p class="text-xs text-muted-foreground">
                Coordenador → Drafters selecionados → Juiz → Resolvedor
              </p>
            </div>
            <button
              type="button"
              (click)="advance(p.id)"
              class="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Avançar simulação
            </button>
          </div>

          <div class="p-5">
            <app-agent-flow-graph
              [selected]="p.selectedArtifacts"
              [artifacts]="p.artifacts"
              (showPrompt)="openPrompt.set($event)"
            />
          </div>
        </div>

        <!-- Coluna da Direita: Snapshot Global -->
        <div class="h-fit rounded-xl border border-border bg-card text-card-foreground shadow-xs">
          <div class="border-b border-border p-4 pb-3">
            <div class="flex items-center gap-1.5 text-sm font-semibold">
              <svg
                class="h-4 w-4 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Estado global do grafo</span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">global_state_snapshot (RNF03)</p>
          </div>

          <div class="p-4">
            <pre
              class="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs"
              >{{ stateSnapshotJson() }}</pre
            >
          </div>
        </div>

        <!-- Drawer Lateral / Modal Sheet com Prompt Injetado -->
        @if (openPrompt(); as artType) {
          <div class="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-xs">
            <div
              class="h-full w-full max-w-lg border-l border-border bg-card p-6 shadow-xl overflow-y-auto space-y-6"
            >
              <div class="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 class="text-lg font-semibold">
                    Prompt injetado — {{ getMeta(artType).label }}
                  </h3>
                  <p class="text-xs text-muted-foreground">
                    RAG determinístico (RF05): template + constraints ativas.
                  </p>
                </div>
                <button
                  type="button"
                  (click)="openPrompt.set(null)"
                  class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <!-- Template -->
              <div>
                <div class="mb-1 text-xs font-medium uppercase text-muted-foreground">Template</div>
                <pre
                  class="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs"
                  >{{ currentTemplate()?.contentMd ?? "—" }}</pre
                >
              </div>

              <!-- Constraints Ativas -->
              <div>
                <div class="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  Constraints ativas
                </div>
                <ul class="space-y-2">
                  @for (c of activeConstraints(); track c.id) {
                    <li class="rounded-md border border-border p-2.5 space-y-1">
                      <div class="text-xs font-semibold text-primary">{{ c.category }}</div>
                      <div class="text-sm font-medium">{{ c.ruleDescription }}</div>
                      <div class="text-xs text-muted-foreground">{{ c.ruleContent }}</div>
                    </li>
                  }
                </ul>
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class ProjectOrchestrationComponent {
  readonly id = input.required<string>();

  private readonly projectsService = inject(ProjectsService);

  readonly project = computed(() => this.projectsService.getProjectById(this.id()));

  readonly openPrompt = signal<ArtifactType | null>(null);

  readonly stateSnapshotJson = computed(() => {
    const p = this.project();
    if (!p) return "{}";
    const snapshot: Record<string, string> = {};
    for (const t of p.selectedArtifacts) {
      const art = p.artifacts.find((x) => x.type === t);
      snapshot[ARTIFACT_META[t].file] = art?.status ?? "NOT_STARTED";
    }
    return JSON.stringify(snapshot, null, 2);
  });

  readonly currentTemplate = computed(() => {
    const art = this.openPrompt();
    if (!art) return null;
    const filename = ARTIFACT_META[art].file;
    return this.projectsService.templates().find((t) => t.targetDocument === filename) ?? null;
  });

  readonly activeConstraints = computed(() =>
    this.projectsService.constraints().filter((c) => c.isActive),
  );

  getMeta(type: ArtifactType) {
    return ARTIFACT_META[type];
  }

  advance(id: string): void {
    this.projectsService.advanceSimulation(id);
  }
}
