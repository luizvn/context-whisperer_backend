import { Component, computed, input, output } from "@angular/core";
import { ARTIFACT_META, type ArtifactType } from "@core/models/types";

const ORDER: ArtifactType[] = ["REQUIREMENTS", "ARCHITECTURE", "UML", "AGENTS_MD"];

@Component({
  selector: "app-artifact-toolbar",
  standalone: true,
  template: `
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium text-foreground">Artefatos a produzir</label>
        <span class="text-xs text-muted-foreground">
          {{ selectedCount() }} selecionado{{ selectedCount() === 1 ? "" : "s" }}
        </span>
      </div>

      <div class="flex flex-wrap justify-start gap-2">
        @for (type of order; track type) {
          @let meta = getMeta(type);
          @let isSelected = isTypeSelected(type);

          <button
            type="button"
            (click)="toggle(type)"
            [disabled]="disabled()"
            [title]="meta.description"
            [class]="buttonClasses(isSelected)"
          >
            <span aria-hidden>{{ meta.icon }}</span>
            <span class="font-medium">{{ meta.label }}</span>
            <span class="hidden text-xs opacity-75 sm:inline">
              {{ meta.file }}
            </span>
          </button>
        }
      </div>
    </div>
  `,
})
export class ArtifactToolbarComponent {
  readonly value = input<ArtifactType[]>([]);
  readonly disabled = input<boolean>(false);
  readonly valueChange = output<ArtifactType[]>();

  readonly order = ORDER;

  readonly selectedCount = computed(() => this.value().length);

  getMeta(type: ArtifactType) {
    return ARTIFACT_META[type];
  }

  isTypeSelected(type: ArtifactType): boolean {
    return this.value().includes(type);
  }

  toggle(type: ArtifactType): void {
    if (this.disabled()) return;
    const current = [...this.value()];
    const index = current.indexOf(type);

    if (index >= 0) {
      if (current.length > 1) {
        current.splice(index, 1);
        this.valueChange.emit(current);
      }
    } else {
      current.push(type);
      this.valueChange.emit(current);
    }
  }

  buttonClasses(selected: boolean): string {
    const base =
      "inline-flex h-auto items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
    if (selected) {
      return `${base} border-primary bg-primary/15 text-primary shadow-sm`;
    }
    return `${base} border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground`;
  }
}
