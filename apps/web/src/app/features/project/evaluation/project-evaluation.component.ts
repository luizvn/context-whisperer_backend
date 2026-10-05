import { Component, computed, inject, input, signal } from "@angular/core";
import { ARTIFACT_META, type ArtifactType } from "@core/models/types";
import { ProjectsService } from "@core/services/projects.service";

@Component({
  selector: "app-project-evaluation",
  standalone: true,
  template: `
    @if (project(); as p) {
      <div class="space-y-4">
        <!-- Card de Resumo Global -->
        <div class="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-xs">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs text-muted-foreground uppercase font-medium">Status global</div>
              <div class="text-lg font-semibold">
                {{ approvedCount() }} de {{ totalCount() }} artefatos aprovados
              </div>
            </div>
            <span
              class="inline-flex items-center rounded-md border border-primary/40 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {{ p.evaluations.length }} avaliações registradas
            </span>
          </div>
        </div>

        <!-- Card de Tabela de Logs do Juiz -->
        <div class="rounded-xl border border-border bg-card text-card-foreground shadow-xs">
          <div
            class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border p-5 pb-4"
          >
            <div>
              <h2 class="text-base font-semibold leading-tight">Logs de avaliação do Juiz</h2>
              <p class="text-xs text-muted-foreground">
                EVALUATION_LOGS — feedback causal e snapshot do estado global.
              </p>
            </div>

            <!-- Filtros -->
            <div class="flex flex-wrap gap-2 w-full sm:w-auto">
              <select
                [value]="artifactFilter()"
                (change)="artifactFilter.set($any($event.target).value)"
                class="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL" class="bg-card text-card-foreground">Todos os artefatos</option>
                @for (t of p.selectedArtifacts; track t) {
                  <option [value]="t" class="bg-card text-card-foreground">
                    {{ getMeta(t).label }}
                  </option>
                }
              </select>

              <select
                [value]="statusFilter()"
                (change)="statusFilter.set($any($event.target).value)"
                class="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL" class="bg-card text-card-foreground">Todos os status</option>
                <option value="APPROVED" class="bg-card text-card-foreground">Aprovados</option>
                <option value="REJECTED" class="bg-card text-card-foreground">Reprovados</option>
              </select>
            </div>
          </div>

          <div class="p-5">
            @if (filteredLogs().length === 0) {
              <div
                class="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
              >
                Nenhuma avaliação encontrada com os filtros selecionados.
              </div>
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                  <thead class="border-b border-border text-xs text-muted-foreground uppercase">
                    <tr>
                      <th class="py-3 px-3 font-medium">Artefato</th>
                      <th class="py-3 px-3 font-medium">Iter.</th>
                      <th class="py-3 px-3 font-medium">Constraint</th>
                      <th class="py-3 px-3 font-medium">Resultado</th>
                      <th class="py-3 px-3 font-medium">Feedback causal</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    @for (log of filteredLogs(); track log.id) {
                      @let isOpen = openId() === log.id;
                      <tr
                        (click)="toggleOpen(log.id)"
                        class="hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <td class="py-3 px-3 font-medium">{{ getMeta(log.artifactType).label }}</td>
                        <td class="py-3 px-3 font-mono text-xs">{{ log.iteration }}</td>
                        <td class="py-3 px-3">
                          <div class="text-xs text-muted-foreground">
                            {{ log.constraintCategory }}
                          </div>
                          <div class="text-sm font-medium">{{ log.constraintRule }}</div>
                        </td>
                        <td class="py-3 px-3">
                          @if (log.isApproved) {
                            <span
                              class="inline-flex items-center gap-1 rounded-full bg-status-approved/15 px-2 py-0.5 text-xs font-medium text-status-approved"
                            >
                              ✓ Aprovado
                            </span>
                          } @else {
                            <span
                              class="inline-flex items-center gap-1 rounded-full bg-status-rejected/15 px-2 py-0.5 text-xs font-medium text-status-rejected"
                            >
                              ✗ Reprovado
                            </span>
                          }
                        </td>
                        <td class="py-3 px-3 max-w-md text-xs text-muted-foreground">
                          {{ log.causalFeedback }}
                        </td>
                      </tr>

                      <!-- Linha Expandida com Detalhes da Auditoria Causal -->
                      @if (isOpen) {
                        <tr class="bg-muted/20">
                          <td colspan="5" class="p-4">
                            <div class="grid gap-3 lg:grid-cols-3">
                              <div>
                                <div
                                  class="mb-1 text-xs font-medium uppercase text-muted-foreground"
                                >
                                  Judge prompt
                                </div>
                                <pre
                                  class="overflow-x-auto rounded-md border border-border bg-background p-2 font-mono text-xs"
                                  >{{ log.judgePrompt }}</pre
                                >
                              </div>
                              <div>
                                <div
                                  class="mb-1 text-xs font-medium uppercase text-muted-foreground"
                                >
                                  Resposta bruta
                                </div>
                                <pre
                                  class="overflow-x-auto rounded-md border border-border bg-background p-2 font-mono text-xs"
                                  >{{ log.rawJudgeResponse }}</pre
                                >
                              </div>
                              <div>
                                <div
                                  class="mb-1 text-xs font-medium uppercase text-muted-foreground"
                                >
                                  Snapshot global
                                </div>
                                <pre
                                  class="overflow-x-auto rounded-md border border-border bg-background p-2 font-mono text-xs"
                                  >{{ formatJson(log.globalStateSnapshot) }}</pre
                                >
                              </div>
                            </div>
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class ProjectEvaluationComponent {
  readonly id = input.required<string>();

  private readonly projectsService = inject(ProjectsService);

  readonly project = computed(() => this.projectsService.getProjectById(this.id()));

  readonly artifactFilter = signal<string>("ALL");
  readonly statusFilter = signal<string>("ALL");
  readonly openId = signal<string | null>(null);

  readonly approvedCount = computed(
    () => this.project()?.artifacts.filter((a) => a.status === "APPROVED").length ?? 0,
  );

  readonly totalCount = computed(() => this.project()?.selectedArtifacts.length ?? 0);

  readonly filteredLogs = computed(() => {
    const p = this.project();
    if (!p) return [];

    const art = this.artifactFilter();
    const st = this.statusFilter();

    return p.evaluations.filter((e) => {
      if (art !== "ALL" && e.artifactType !== art) return false;
      if (st === "APPROVED" && !e.isApproved) return false;
      if (st === "REJECTED" && e.isApproved) return false;
      return true;
    });
  });

  getMeta(type: ArtifactType) {
    return ARTIFACT_META[type];
  }

  toggleOpen(logId: string): void {
    this.openId.update((current) => (current === logId ? null : logId));
  }

  formatJson(data: Record<string, string>): string {
    return JSON.stringify(data, null, 2);
  }
}
