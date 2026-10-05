import { Component, OnInit, computed, inject, input, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { ProjectsService } from "@core/services/projects.service";
import { MarkdownViewComponent } from "@shared/components/markdown-view/markdown-view.component";
import { StatusBadgeComponent } from "@shared/components/status-badge/status-badge.component";

@Component({
  selector: "app-project-scope",
  standalone: true,
  imports: [MarkdownViewComponent, StatusBadgeComponent],
  template: `
    @if (project(); as p) {
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <!-- Coluna da Esquerda: Prompt Original -->
        <div class="h-fit rounded-xl border border-border bg-card text-card-foreground shadow-xs">
          <div class="border-b border-border p-4 pb-3">
            <h2 class="text-sm font-medium text-muted-foreground">Prompt original</h2>
          </div>
          <div class="p-4 text-sm whitespace-pre-wrap text-foreground/90">
            {{ p.prompt }}
          </div>
        </div>

        <!-- Coluna da Direita: Proposta de Escopo (HITL) -->
        <div class="rounded-xl border border-border bg-card text-card-foreground shadow-xs">
          <div class="flex items-center justify-between border-b border-border p-5 pb-4">
            <div>
              <h2 class="text-base font-semibold leading-tight">Proposta de escopo</h2>
              <p class="text-xs text-muted-foreground">Validação Human-in-the-Loop (RF03)</p>
            </div>
            <app-status-badge [status]="p.scope.status" />
          </div>

          <div class="p-5 space-y-4">
            <!-- Renderizador de Escopo em Markdown -->
            <div class="rounded-md border border-border bg-muted/30 p-4">
              <app-markdown-view [content]="p.scope.contentMd" />
            </div>

            <!-- Box de Feedback Anterior se houver -->
            @if (p.scope.feedback) {
              <div
                class="rounded-md border border-status-pending/40 bg-status-pending/10 p-3 text-sm"
              >
                <div class="mb-1 text-xs font-medium text-status-pending">
                  Feedback enviado ao agente
                </div>
                <p class="text-foreground/90">{{ p.scope.feedback }}</p>
              </div>
            }

            <!-- Formulário de Feedback Recursivo -->
            @if (showFeedback()) {
              <div class="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
                <label for="feedback" class="text-sm font-medium"
                  >Solicitar ajustes na proposta</label
                >
                <textarea
                  id="feedback"
                  rows="3"
                  placeholder="Ex.: incluir suporte a múltiplos endereços por usuário…"
                  [value]="feedback()"
                  (input)="feedback.set($any($event.target).value)"
                  class="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                ></textarea>
                <div class="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    (click)="showFeedback.set(false)"
                    class="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    [disabled]="!feedback().trim()"
                    (click)="sendFeedback(p.id)"
                    class="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Reenviar para o agente
                  </button>
                </div>
              </div>
            }

            <!-- Ações Human-in-the-Loop -->
            @if (p.scope.status !== "APPROVED") {
              <div
                class="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4"
              >
                <button
                  type="button"
                  (click)="reject(p.id)"
                  class="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Rejeitar
                </button>

                <button
                  type="button"
                  (click)="showFeedback.set(true)"
                  class="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  Solicitar ajustes
                </button>

                <button
                  type="button"
                  (click)="approve(p.id)"
                  class="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Aprovar escopo
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    } @else {
      <div
        class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center"
      >
        <svg
          class="h-8 w-8 animate-spin text-muted-foreground mb-3"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p class="text-sm font-medium text-foreground">Carregando escopo do projeto...</p>
        <p class="text-xs text-muted-foreground mt-1">Obtendo dados atualizados da proposta.</p>
      </div>
    }
  `,
})
export class ProjectScopeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectsService = inject(ProjectsService);

  readonly inputId = input<string>("", { alias: "id" });

  readonly id = computed(
    () =>
      this.inputId() ||
      this.route.snapshot.paramMap.get("id") ||
      this.route.parent?.snapshot.paramMap.get("id") ||
      "",
  );

  readonly project = computed(() => this.projectsService.getProjectById(this.id()));

  readonly showFeedback = signal(false);
  readonly feedback = signal("");

  async ngOnInit(): Promise<void> {
    const projectId = this.id();
    const p = this.project();
    if (projectId && (!p || !p.scope?.id)) {
      await this.projectsService.loadProjectById(projectId);
    }
  }

  async approve(id: string): Promise<void> {
    await this.projectsService.approveScope(id);
    this.router.navigate(["/projects", id, "artifacts"]);
  }

  async reject(id: string): Promise<void> {
    await this.projectsService.rejectScope(id, "Escopo rejeitado pelo usuário");
  }

  async sendFeedback(id: string): Promise<void> {
    if (!this.feedback().trim()) return;
    const text = this.feedback().trim();
    this.showFeedback.set(false);
    this.feedback.set("");
    await this.projectsService.rejectScope(id, text);
  }
}
