import { Injectable, inject, signal } from "@angular/core";
import { Router } from "@angular/router";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  projectName?: string;
  requisitionId?: string;
  targetRoute?: (string | number)[];
  actionLabel?: string;
  createdAt: number;
}

@Injectable({
  providedIn: "root",
})
export class NotificationService {
  private readonly router = inject(Router);

  private readonly _notifications = signal<AppNotification[]>([]);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly notifications = this._notifications.asReadonly();

  /**
   * Exibe uma notificação toast semântica e amigável ao usuário
   */
  show(options: Omit<AppNotification, "id" | "createdAt">, autoDismissMs = 8000): string {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notification: AppNotification = {
      ...options,
      id,
      createdAt: Date.now(),
    };

    // Mantém no máximo 5 notificações ativas simultâneas
    this._notifications.update((list) => {
      const next = [...list, notification];
      if (next.length > 5) {
        const removed = next.shift();
        if (removed) {
          this.clearTimer(removed.id);
        }
      }
      return next;
    });

    if (autoDismissMs > 0) {
      const timer = setTimeout(() => {
        this.dismiss(id);
      }, autoDismissMs);
      this.timers.set(id, timer);
    }

    return id;
  }

  /**
   * Remove uma notificação pelo ID
   */
  dismiss(id: string): void {
    this.clearTimer(id);
    this._notifications.update((list) => list.filter((n) => n.id !== id));
  }

  /**
   * Navega para a rota de destino associada à notificação e a descarta
   */
  async navigate(notification: AppNotification): Promise<void> {
    this.dismiss(notification.id);
    if (notification.targetRoute && notification.targetRoute.length > 0) {
      await this.router.navigate(notification.targetRoute);
    }
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
