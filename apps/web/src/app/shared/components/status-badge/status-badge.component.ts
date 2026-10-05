import { Component, computed, input } from "@angular/core";
import type { ArtifactStatus, ProjectStatus, ScopeStatus } from "@core/models/types";

type AnyStatus = ProjectStatus | ScopeStatus | ArtifactStatus;

const LABELS: Record<string, string> = {
  AWAITING_SCOPE: "Aguardando escopo",
  GENERATING: "Gerando",
  COMPLETED: "Concluído",
  FAILED: "Com falhas",
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  DRAFT: "Rascunho",
  RUNNING: "Em execução",
  IDLE: "Aguardando",
};

const COLOR: Record<string, string> = {
  AWAITING_SCOPE: "bg-status-pending/15 text-status-pending border-status-pending/30",
  GENERATING: "bg-status-running/15 text-status-running border-status-running/30",
  COMPLETED: "bg-status-approved/15 text-status-approved border-status-approved/30",
  FAILED: "bg-status-rejected/15 text-status-rejected border-status-rejected/30",
  PENDING: "bg-status-pending/15 text-status-pending border-status-pending/30",
  APPROVED: "bg-status-approved/15 text-status-approved border-status-approved/30",
  REJECTED: "bg-status-rejected/15 text-status-rejected border-status-rejected/30",
  DRAFT: "bg-muted text-muted-foreground border-border",
  RUNNING: "bg-status-running/15 text-status-running border-status-running/30",
  IDLE: "bg-muted text-muted-foreground border-border",
};

@Component({
  selector: "app-status-badge",
  standalone: true,
  template: `
    <span [class]="badgeClasses()">
      {{ label() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<AnyStatus>();
  readonly className = input<string>("");

  readonly label = computed(() => LABELS[this.status()] || this.status());

  readonly badgeClasses = computed(() => {
    const base =
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors";
    const color = COLOR[this.status()] || "bg-muted text-muted-foreground border-border";
    return this.className() ? `${base} ${color} ${this.className()}` : `${base} ${color}`;
  });
}
