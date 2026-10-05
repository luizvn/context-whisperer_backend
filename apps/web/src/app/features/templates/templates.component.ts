import { Component, inject, signal } from "@angular/core";
import { ProjectsService } from "@core/services/projects.service";

@Component({
  selector: "app-templates",
  standalone: true,
  template: `
    <div class="mx-auto max-w-5xl px-4 py-6">
      <div class="mb-6 flex items-end justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Templates & Constraints</h1>
          <p class="text-sm text-muted-foreground">
            Repositório do RAG determinístico (RF05 / RNF04).
          </p>
        </div>
      </div>

      <div class="rounded-xl border border-border bg-card text-card-foreground shadow-xs">
        <div class="border-b border-border p-6 pb-3">
          <h2 class="text-base font-semibold leading-none tracking-tight">Biblioteca</h2>
        </div>

        <div class="p-6">
          <!-- Abas de navegação -->
          <div class="flex items-center justify-between border-b border-border pb-3">
            <div
              class="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground"
            >
              <button
                type="button"
                (click)="activeTab.set('templates')"
                [class]="tabButtonClasses(activeTab() === 'templates')"
              >
                Templates
              </button>
              <button
                type="button"
                (click)="activeTab.set('constraints')"
                [class]="tabButtonClasses(activeTab() === 'constraints')"
              >
                Constraints
              </button>
            </div>

            <button
              type="button"
              disabled
              class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Novo
            </button>
          </div>

          <!-- Conteúdo da Aba: Templates -->
          @if (activeTab() === "templates") {
            <div class="mt-4 overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="border-b border-border text-xs text-muted-foreground uppercase">
                  <tr>
                    <th class="py-3 px-4 font-medium">Nome</th>
                    <th class="py-3 px-4 font-medium">Documento alvo</th>
                    <th class="py-3 px-4 font-medium">Preview</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  @for (t of templates(); track t.id) {
                    <tr class="hover:bg-muted/30 transition-colors">
                      <td class="py-3 px-4 font-medium">{{ t.name }}</td>
                      <td class="py-3 px-4">
                        <span
                          class="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-medium text-secondary-foreground"
                        >
                          {{ t.targetDocument }}
                        </span>
                      </td>
                      <td class="py-3 px-4 font-mono text-xs text-muted-foreground">
                        {{ getFirstLine(t.contentMd) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <!-- Conteúdo da Aba: Constraints -->
          @if (activeTab() === "constraints") {
            <div class="mt-4 overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="border-b border-border text-xs text-muted-foreground uppercase">
                  <tr>
                    <th class="py-3 px-4 font-medium">Categoria</th>
                    <th class="py-3 px-4 font-medium">Regra</th>
                    <th class="py-3 px-4 font-medium">Detalhe</th>
                    <th class="py-3 px-4 font-medium text-right">Ativa</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  @for (c of constraints(); track c.id) {
                    <tr class="hover:bg-muted/30 transition-colors">
                      <td class="py-3 px-4">
                        <span
                          class="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium"
                        >
                          {{ c.category }}
                        </span>
                      </td>
                      <td class="py-3 px-4 font-medium">{{ c.ruleDescription }}</td>
                      <td class="py-3 px-4 text-xs text-muted-foreground">{{ c.ruleContent }}</td>
                      <td class="py-3 px-4 text-right">
                        <!-- Switch toggle button -->
                        <button
                          type="button"
                          role="switch"
                          [attr.aria-checked]="c.isActive"
                          (click)="toggleConstraint(c.id, !c.isActive)"
                          [class]="switchClasses(c.isActive)"
                        >
                          <span [class]="switchThumbClasses(c.isActive)"></span>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class TemplatesComponent {
  private readonly projectsService = inject(ProjectsService);

  readonly templates = this.projectsService.templates;
  readonly constraints = this.projectsService.constraints;
  readonly activeTab = signal<"templates" | "constraints">("templates");

  getFirstLine(md: string): string {
    return md.split("\n")[0] || "";
  }

  toggleConstraint(id: string, active: boolean): void {
    this.projectsService.toggleConstraint(id, active);
  }

  tabButtonClasses(active: boolean): string {
    const base =
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all cursor-pointer";
    if (active) {
      return `${base} bg-background text-foreground shadow-xs font-semibold`;
    }
    return `${base} text-muted-foreground hover:text-foreground`;
  }

  switchClasses(active: boolean): string {
    const base =
      "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none";
    return active ? `${base} bg-primary` : `${base} bg-muted`;
  }

  switchThumbClasses(active: boolean): string {
    const base =
      "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform";
    return active ? `${base} translate-x-4` : `${base} translate-x-0`;
  }
}
