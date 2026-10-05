import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { AuthService } from "@core/services/auth.service";
import { ProjectsService } from "@core/services/projects.service";
import { SseService } from "@core/services/sse.service";
import { AppSidebarComponent } from "@shared/components/app-sidebar/app-sidebar.component";
import { NotificationToastComponent } from "@shared/components/notifications/notification-toast.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, AppSidebarComponent, NotificationToastComponent],
  template: `
    <div class="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <!-- Barra lateral global (exibida apenas quando autenticado) -->
      @if (auth.isAuthenticated()) {
        <app-sidebar></app-sidebar>
      }

      <!-- Conteúdo principal com rolagem independente -->
      <main class="flex-1 overflow-y-auto">
        <router-outlet></router-outlet>
      </main>

      <!-- Toasts de Notificações em Tempo Real -->
      <app-notification-toast />
    </div>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly sse = inject(SseService);
  private readonly projectsService = inject(ProjectsService);

  async ngOnInit(): Promise<void> {
    const hasSession = await this.auth.initSession();
    if (hasSession) {
      await this.sse.connect();
      await this.projectsService.loadProjects();
    }
  }

  ngOnDestroy(): void {
    this.sse.disconnect();
  }
}
