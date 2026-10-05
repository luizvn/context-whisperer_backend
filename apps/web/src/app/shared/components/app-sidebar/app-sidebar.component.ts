import { Component, computed, inject } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { AuthService } from "@core/services/auth.service";
import { ProjectsService } from "@core/services/projects.service";
import { SseService } from "@core/services/sse.service";
import { StatusBadgeComponent } from "../status-badge/status-badge.component";

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, StatusBadgeComponent],
  template: `
    <aside
      class="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <!-- Header do Sidebar -->
      <div class="flex flex-col gap-3 border-b border-sidebar-border p-4">
        <a routerLink="/" class="flex items-center gap-2 group">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
          </div>
          <div class="flex flex-col leading-tight">
            <span
              class="text-sm font-semibold tracking-tight text-sidebar-foreground group-hover:text-primary transition-colors"
            >
              Context Whisperer
            </span>
            <span class="text-[11px] text-muted-foreground">Orquestrador de agentes</span>
          </div>
        </a>

        <a
          routerLink="/"
          class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Novo projeto
        </a>
      </div>

      <!-- Navegação e Histórico com rolagem independente -->
      <div class="flex-1 min-h-0 flex flex-col px-3 py-3 gap-3">
        <!-- Grupo: Histórico de Projetos (rolável de forma independente) -->
        <div class="flex-1 min-h-0 flex flex-col space-y-1.5">
          <div
            class="flex items-center justify-between px-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            <span>Histórico</span>
            @if (projects().length > 0) {
              <span class="text-[10px] text-muted-foreground/70 font-normal"
                >({{ projects().length }})</span
              >
            }
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1">
            @if (projects().length === 0) {
              <div
                class="rounded-md border border-dashed border-sidebar-border p-3 text-center text-[11px] text-muted-foreground/80 leading-relaxed"
              >
                Nenhum projeto ainda.<br />
                Clique em "Novo projeto" acima!
              </div>
            } @else {
              @for (p of projects(); track p.id) {
                <a
                  [routerLink]="['/projects', p.id, 'scope']"
                  routerLinkActive="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  class="flex flex-col gap-1 rounded-md px-2.5 py-2 text-xs transition-colors hover:bg-sidebar-accent/50 text-sidebar-foreground/90"
                >
                  <div class="flex items-center gap-2">
                    <svg
                      class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    <span class="truncate font-medium">{{ p.name }}</span>
                  </div>
                  <div class="pl-5">
                    <app-status-badge [status]="p.status" className="text-[10px] py-0" />
                  </div>
                </a>
              }
            }
          </div>
        </div>

        <!-- Grupo: Conhecimento (fixo diretamente acima da seção de perfil/logout) -->
        <div class="shrink-0 border-t border-sidebar-border pt-3 space-y-1.5">
          <div class="px-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Conhecimento
          </div>
          <div class="space-y-1">
            <a
              routerLink="/templates"
              routerLinkActive="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              class="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent/50"
            >
              <svg
                class="h-3.5 w-3.5 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
                />
              </svg>
              <span>Templates & Constraints</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Rodapé do Usuário e Logout -->
      @if (user(); as u) {
        <div class="border-t border-sidebar-border p-3">
          <div class="flex items-center justify-between gap-2 rounded-lg bg-sidebar-accent/40 p-2">
            <div class="flex items-center gap-2.5 overflow-hidden">
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              >
                {{ userInitials() }}
              </div>
              <div class="flex flex-col truncate leading-tight">
                <span class="truncate text-xs font-medium text-sidebar-foreground">
                  {{ u.name }}
                </span>
                <span class="truncate text-[10px] text-muted-foreground">
                  {{ u.email }}
                </span>
              </div>
            </div>

            <button
              type="button"
              (click)="logout()"
              title="Encerrar sessão"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      }
    </aside>
  `,
})
export class AppSidebarComponent {
  private readonly projectsService = inject(ProjectsService);
  private readonly auth = inject(AuthService);
  private readonly sse = inject(SseService);

  readonly projects = this.projectsService.projects;
  readonly user = this.auth.currentUser;

  readonly userInitials = computed(() => {
    const name = this.user()?.name || "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  logout(): void {
    this.sse.disconnect();
    this.projectsService.clearProjects();
    this.auth.logout();
  }
}
