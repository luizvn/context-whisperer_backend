import { Component, OnInit, computed, inject, input, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ARTIFACT_META, type ArtifactType } from "@core/models/types";
import { ProjectsService } from "@core/services/projects.service";
import { MarkdownViewComponent } from "@shared/components/markdown-view/markdown-view.component";
import { StatusBadgeComponent } from "@shared/components/status-badge/status-badge.component";

@Component({
  selector: "app-project-artifacts",
  standalone: true,
  imports: [MarkdownViewComponent, StatusBadgeComponent],
  template: `
    @if (project(); as p) {
      <div class="space-y-4">
        <!-- Cabeçalho -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold tracking-tight">Artefatos gerados</h2>
            <p class="text-xs text-muted-foreground">
              Documentos finais em formato Markdown (RF09).
            </p>
          </div>

          <button
            type="button"
            (click)="downloadAllZip(p.id)"
            class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors shadow-xs cursor-pointer"
          >
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            Exportar tudo (.zip)
          </button>
        </div>

        <!-- Banner de Processamento de Agentes -->
        @if (p.status === "GENERATING") {
          <div
            class="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/10 p-3.5 text-xs text-primary"
          >
            <svg class="h-4 w-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
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
            <span>
              Os agentes estão gerando e refinando os artefatos técnicos em conjunto com o Juiz
              Causal. Acompanhe o progresso em tempo real abaixo.
            </span>
          </div>
        }

        <!-- Grid de Cards de Artefatos -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          @for (it of items(); track it.type) {
            <div
              class="flex flex-col justify-between rounded-xl border border-border bg-card text-card-foreground p-5 shadow-xs space-y-4"
            >
              <div>
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2 text-base font-semibold leading-tight">
                    <span>{{ it.meta.icon }}</span>
                    <span>{{ it.meta.label }}</span>
                  </div>
                  <app-status-badge [status]="it.status" />
                </div>
                <p class="mt-1 font-mono text-xs text-muted-foreground">{{ it.meta.file }}</p>
              </div>

              <div class="space-y-3">
                <span
                  class="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
                >
                  {{ it.iter }} iteraç{{ it.iter === 1 ? "ão" : "ões" }}
                </span>

                <div class="flex gap-2">
                  <button
                    type="button"
                    (click)="previewArtifact.set(it.type)"
                    [disabled]="!it.content"
                    class="flex-1 inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    Visualizar
                  </button>

                  <button
                    type="button"
                    (click)="download(it.meta.file, it.content)"
                    [disabled]="!it.content"
                    class="flex-1 inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Baixar
                  </button>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Modal de Visualização de Artefato -->
        @if (activePreview(); as preview) {
          <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4"
          >
            <div
              class="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
            >
              <div class="flex items-center justify-between border-b border-border px-5 py-4">
                <div class="flex items-center gap-2">
                  <span>{{ preview.meta.icon }}</span>
                  <h3 class="font-mono text-sm font-semibold">{{ preview.meta.file }}</h3>
                </div>
                <button
                  type="button"
                  (click)="previewArtifact.set(null)"
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

              <div class="flex-1 overflow-y-auto p-5">
                <div class="rounded-md border border-border bg-muted/30 p-4">
                  <app-markdown-view [content]="preview.content || '_Sem conteúdo gerado._'" />
                </div>
              </div>
            </div>
          </div>
        }
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
        <p class="text-sm font-medium text-foreground">Carregando artefatos do projeto...</p>
        <p class="text-xs text-muted-foreground mt-1">
          Obtendo status atualizado dos documentos técnicos.
        </p>
      </div>
    }
  `,
})
export class ProjectArtifactsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
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

  readonly previewArtifact = signal<ArtifactType | null>(null);

  readonly items = computed(() => {
    const p = this.project();
    if (!p) return [];

    return p.selectedArtifacts.map((t) => {
      const art = p.artifacts.find((x) => x.type === t);
      return {
        type: t,
        meta: ARTIFACT_META[t],
        status: art?.status ?? "IDLE",
        iter: art?.iterationCount ?? 0,
        content: art?.content ?? "",
      };
    });
  });

  readonly activePreview = computed(() => {
    const type = this.previewArtifact();
    if (!type) return null;
    return this.items().find((i) => i.type === type) ?? null;
  });

  async ngOnInit(): Promise<void> {
    const projectId = this.id();
    const p = this.project();
    if (projectId && (!p || p.artifacts.length === 0)) {
      await this.projectsService.loadProjectById(projectId);
    }
  }

  download(filename: string, content: string): void {
    const blob = new Blob([content || `# ${filename}\n\n_Sem conteúdo gerado._\n`], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async downloadAllZip(id: string): Promise<void> {
    await this.projectsService.downloadAllZip(id);
  }
}
