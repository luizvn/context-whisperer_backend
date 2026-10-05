import { Component, computed, effect, inject, input } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { ARTIFACT_META, type ArtifactType } from "@core/models/types";
import { ProjectsService } from "@core/services/projects.service";
import { StatusBadgeComponent } from "@shared/components/status-badge/status-badge.component";

interface StepTab {
  to: string;
  label: string;
}

const STEPS: StepTab[] = [
  { to: "scope", label: "Escopo" },
  { to: "artifacts", label: "Artefatos" },
];

@Component({
  selector: "app-project-shell",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, StatusBadgeComponent],
  template: `
    @if (project(); as p) {
      <div class="flex flex-col">
        <!-- Barra de Cabeçalho do Projeto -->
        <div class="border-b border-border bg-card/40">
          <div class="mx-auto max-w-6xl px-4 py-5">
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <a
                  routerLink="/"
                  class="-ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Novo projeto
                </a>
                <h1 class="text-2xl font-semibold tracking-tight">{{ p.name }}</h1>
                <p class="line-clamp-2 max-w-2xl text-sm text-muted-foreground">
                  {{ p.prompt }}
                </p>
              </div>

              <app-status-badge [status]="p.status" />
            </div>

            <!-- Badges dos artefatos selecionados -->
            <div class="mt-4 flex flex-wrap gap-1.5">
              @for (t of p.selectedArtifacts; track t) {
                @let meta = getMeta(t);
                <span
                  class="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                >
                  <span>{{ meta.icon }}</span>
                  <span>{{ meta.label }}</span>
                </span>
              }
            </div>

            <!-- Abas de Navegação -->
            <nav class="mt-5 flex gap-1 border-b border-border">
              @for (s of steps; track s.to) {
                <a
                  [routerLink]="['/projects', p.id, s.to]"
                  routerLinkActive="border-primary text-foreground font-semibold"
                  [routerLinkActiveOptions]="{ exact: true }"
                  class="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {{ s.label }}
                </a>
              }
            </nav>
          </div>
        </div>

        <!-- Conteúdo da Rota Ativa -->
        <div class="mx-auto w-full max-w-6xl px-4 py-6">
          <router-outlet></router-outlet>
        </div>
      </div>
    } @else {
      <div class="p-10 text-center text-muted-foreground">Projeto não encontrado.</div>
    }
  `,
})
export class ProjectShellComponent {
  readonly id = input.required<string>();

  private readonly projectsService = inject(ProjectsService);

  readonly steps = STEPS;

  readonly project = computed(() => this.projectsService.getProjectById(this.id()));

  constructor() {
    effect(() => {
      const currentId = this.id();
      if (currentId) {
        // Dispara lazy loading sob demanda para carregar escopo e artefatos detalhados
        void this.projectsService.loadProjectById(currentId);
      }
    });
  }

  getMeta(type: ArtifactType) {
    return ARTIFACT_META[type];
  }
}
