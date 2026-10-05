import { Component, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import type { ArtifactType } from "@core/models/types";
import { ProjectsService } from "@core/services/projects.service";
import { ArtifactToolbarComponent } from "@shared/components/artifact-toolbar/artifact-toolbar.component";

const SUGGESTIONS = [
  "App de delivery local com pagamento PIX e rastreio em tempo real",
  "SaaS de agendamento para clínicas pequenas com lembretes via WhatsApp",
  "Marketplace de cursos em vídeo com repasse automático para instrutores",
];

@Component({
  selector: "app-new-project",
  standalone: true,
  imports: [ArtifactToolbarComponent],
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <!-- Cabeçalho -->
      <div class="space-y-2">
        <span
          class="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          <svg class="h-3 w-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
          Nova requisição
        </span>
        <h1 class="text-3xl font-semibold tracking-tight">Descreva seu MVP</h1>
        <p class="text-sm text-muted-foreground">
          O Context Whisperer vai gerar uma proposta de escopo, distribuir tarefas para agentes
          especialistas e auditar cada artefato com um juiz restritivo.
        </p>
      </div>

      <!-- Card do Formulário -->
      <div class="rounded-xl border border-border bg-card text-card-foreground shadow-xs">
        <div class="border-b border-border p-6 pb-4">
          <h2 class="text-base font-semibold leading-none tracking-tight">Detalhes do projeto</h2>
        </div>

        <div class="p-6 space-y-5">
          <!-- Nome -->
          <div class="space-y-2">
            <label for="name" class="text-sm font-medium">Nome do projeto</label>
            <input
              id="name"
              type="text"
              placeholder="Ex.: Delivery local"
              [value]="name()"
              (input)="name.set($any($event.target).value)"
              class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <!-- Prompt -->
          <div class="space-y-2">
            <label for="prompt" class="text-sm font-medium">Prompt em linguagem natural</label>
            <textarea
              id="prompt"
              rows="6"
              placeholder="Descreva o produto, público-alvo, funcionalidades essenciais e restrições conhecidas…"
              [value]="prompt()"
              (input)="prompt.set($any($event.target).value)"
              class="flex min-h-[140px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
            ></textarea>

            <!-- Sugestões em pills -->
            <div class="flex flex-wrap gap-2 pt-1">
              @for (s of suggestions; track s) {
                <button
                  type="button"
                  (click)="prompt.set(s)"
                  class="inline-flex h-7 items-center rounded-full border border-border bg-transparent px-3 text-xs font-normal text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
                >
                  {{ s.length > 50 ? s.slice(0, 50) + "…" : s }}
                </button>
              }
            </div>
          </div>

          <!-- Seletor de Artefatos -->
          <app-artifact-toolbar [value]="selected()" (valueChange)="selected.set($event)" />

          <!-- Mensagem de Erro -->
          @if (submitError()) {
            <div
              class="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>{{ submitError() }}</span>
            </div>
          }

          <!-- Botão Submeter -->
          <div class="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              [disabled]="!canSubmit() || submitting()"
              (click)="handleSubmit()"
              class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              @if (submitting()) {
                <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                <span>Criando requisição...</span>
              } @else {
                <span>Gerar proposta de escopo</span>
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class NewProjectComponent {
  private readonly router = inject(Router);
  private readonly projectsService = inject(ProjectsService);

  readonly name = signal("");
  readonly prompt = signal("");
  readonly selected = signal<ArtifactType[]>(["REQUIREMENTS", "ARCHITECTURE", "UML", "AGENTS_MD"]);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly suggestions = SUGGESTIONS;

  readonly canSubmit = computed(
    () =>
      this.name().trim().length > 0 &&
      this.prompt().trim().length > 0 &&
      this.selected().length > 0,
  );

  async handleSubmit(): Promise<void> {
    if (!this.canSubmit() || this.submitting()) return;

    this.submitting.set(true);
    this.submitError.set(null);

    try {
      const projectId = await this.projectsService.createProject({
        name: this.name().trim(),
        prompt: this.prompt().trim(),
        selectedArtifacts: this.selected(),
      });

      await this.router.navigate(["/projects", projectId, "scope"]);
    } catch (err: any) {
      this.submitError.set(
        err?.message || "Não foi possível criar o projeto no servidor. Verifique a conexão.",
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
