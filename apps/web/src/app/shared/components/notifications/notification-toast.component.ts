import { Component, inject } from "@angular/core";
import {
  NotificationService,
  type AppNotification,
  type NotificationType,
} from "@core/services/notification.service";

@Component({
  selector: "app-notification-toast",
  standalone: true,
  template: `
    <div
      class="fixed bottom-5 right-5 z-50 flex flex-col-reverse gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      @for (n of notifications(); track n.id) {
        <div
          class="pointer-events-auto flex flex-col gap-2 rounded-xl border bg-card/95 p-4 shadow-xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-3"
          [class.border-border]="n.type === 'info'"
          [class.border-emerald-500/40]="n.type === 'success'"
          [class.border-amber-500/40]="n.type === 'warning'"
          [class.border-rose-500/40]="n.type === 'error'"
        >
          <!-- Cabeçalho do Toast -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2">
              <!-- Ícone por tipo -->
              @switch (n.type) {
                @case ("success") {
                  <div
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                }
                @case ("warning") {
                  <div
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                }
                @case ("error") {
                  <div
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-500"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                }
                @default {
                  <div
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                }
              }

              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-xs font-semibold text-foreground">{{ n.title }}</span>
                @if (n.projectName) {
                  <span
                    class="inline-flex items-center rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
                  >
                    {{ n.projectName }}
                  </span>
                }
              </div>
            </div>

            <!-- Botão de Fechar -->
            <button
              type="button"
              (click)="dismiss(n.id)"
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Fechar notificação"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Mensagem Amigável -->
          <p class="text-xs text-muted-foreground leading-relaxed pl-8">
            {{ n.message }}
          </p>

          <!-- Ação / Navegação Direta -->
          @if (n.actionLabel && n.targetRoute) {
            <div class="flex justify-end pt-1">
              <button
                type="button"
                (click)="navigate(n)"
                class="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
              >
                <span>{{ n.actionLabel }}</span>
                <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class NotificationToastComponent {
  private readonly notificationService = inject(NotificationService);

  readonly notifications = this.notificationService.notifications;

  dismiss(id: string): void {
    this.notificationService.dismiss(id);
  }

  navigate(notification: AppNotification): void {
    void this.notificationService.navigate(notification);
  }
}
