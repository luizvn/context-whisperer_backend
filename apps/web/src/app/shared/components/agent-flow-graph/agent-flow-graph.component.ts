import { Component, computed, input, output } from "@angular/core";
import { ARTIFACT_META, type Artifact, type ArtifactType } from "@core/models/types";
import { StatusBadgeComponent } from "../status-badge/status-badge.component";

@Component({
  selector: "app-agent-flow-graph",
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    <div class="space-y-6 overflow-x-auto pb-2">
      <!-- Fase 1: Análise e HITL -->
      <div class="flex items-center gap-3">
        <div class="min-w-[180px] rounded-lg border border-primary/40 bg-card p-3 shadow-xs">
          <div class="text-sm font-semibold leading-tight">🎯 Analisador de Escopo</div>
          <div class="text-xs text-muted-foreground">Fase 1 — Negócio</div>
        </div>

        <div class="flex items-center justify-center text-muted-foreground">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </div>

        <div class="min-w-[180px] rounded-lg border border-status-pending/40 bg-card p-3 shadow-xs">
          <div class="text-sm font-semibold leading-tight">👤 Aprovação Humana (HITL)</div>
          <div class="text-xs text-muted-foreground">Validação</div>
        </div>

        <div class="flex items-center justify-center text-muted-foreground">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </div>

        <div class="min-w-[180px] rounded-lg border border-primary/40 bg-card p-3 shadow-xs">
          <div class="text-sm font-semibold leading-tight">🧭 Coordenador (Tech Lead)</div>
          <div class="text-xs text-muted-foreground">Fase 2 — Distribui</div>
        </div>
      </div>

      <!-- Fase 2: Agentes Especialistas (Drafters) -->
      <div>
        <div class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Geração especializada
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (d of drafters(); track d.type) {
            <div
              class="flex flex-col justify-between min-w-[180px] rounded-lg border border-border bg-card p-3 shadow-xs"
            >
              <div>
                <div class="flex items-start justify-between gap-2">
                  <div class="text-sm font-semibold leading-tight">✍️ {{ d.label }}</div>
                  @if (d.status !== "IDLE") {
                    <app-status-badge [status]="d.status" className="text-[10px]" />
                  }
                </div>
                <div class="font-mono text-xs text-muted-foreground mt-0.5">{{ d.file }}</div>
                @if (d.iter > 0) {
                  <span
                    class="mt-2 inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    iter. {{ d.iter }}
                  </span>
                }
              </div>

              <div class="mt-3 pt-2 border-t border-border/50">
                <button
                  type="button"
                  (click)="showPrompt.emit(d.type)"
                  class="text-xs text-primary hover:underline font-medium cursor-pointer"
                >
                  Ver prompt injetado
                </button>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Fase 3: Juiz Causal e Finalização -->
      <div class="flex items-center gap-3">
        <div class="min-w-[180px] rounded-lg border border-border bg-card p-3 shadow-xs">
          <div class="text-sm font-semibold leading-tight">⚖️ Juiz Restritivo</div>
          <div class="text-xs text-muted-foreground">LLM-as-a-Judge</div>
        </div>

        <div class="flex items-center justify-center text-muted-foreground">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </div>

        <div class="min-w-[180px] rounded-lg border border-border bg-card p-3 shadow-xs">
          <div class="text-sm font-semibold leading-tight">🛠️ Resolvedor</div>
          <div class="text-xs text-muted-foreground">Delega correção</div>
        </div>

        <div class="flex items-center justify-center text-muted-foreground">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </div>

        <div
          class="min-w-[180px] rounded-lg border border-status-approved/40 bg-card p-3 shadow-xs"
        >
          <div class="text-sm font-semibold leading-tight">⚙️ Gerador agents.md</div>
          <div class="text-xs text-muted-foreground">Fase 4 — Final</div>
        </div>
      </div>
    </div>
  `,
})
export class AgentFlowGraphComponent {
  readonly selected = input.required<ArtifactType[]>();
  readonly artifacts = input<Artifact[]>([]);
  readonly showPrompt = output<ArtifactType>();

  readonly drafters = computed(() => {
    const list = this.artifacts();
    return this.selected().map((t) => {
      const a = list.find((x) => x.type === t);
      return {
        type: t,
        label: ARTIFACT_META[t].label,
        file: ARTIFACT_META[t].file,
        status: a?.status ?? "IDLE",
        iter: a?.iterationCount ?? 0,
      };
    });
  });
}
