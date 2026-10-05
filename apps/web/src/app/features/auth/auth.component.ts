import { Component, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "@core/services/auth.service";
import { ProjectsService } from "@core/services/projects.service";
import { SseService } from "@core/services/sse.service";

@Component({
  selector: "app-auth",
  standalone: true,
  template: `
    <div
      class="flex min-h-screen w-full items-center justify-center bg-background px-4 py-12 text-foreground"
    >
      <div class="w-full max-w-md space-y-6">
        <!-- Logo e Cabeçalho da Marca -->
        <div class="flex flex-col items-center text-center space-y-2">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md"
          >
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
          </div>
          <h1 class="text-2xl font-bold tracking-tight">Context Whisperer</h1>
          <p class="text-xs text-muted-foreground">
            Orquestração autônoma de requisitos, arquitetura e MVPs com IA
          </p>
        </div>

        <!-- Card de Autenticação -->
        <div class="rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8 space-y-6">
          <!-- Alternador de Abas (Entrar / Criar Conta) -->
          <div class="grid grid-cols-2 rounded-lg bg-muted p-1 text-xs font-medium">
            <button
              type="button"
              (click)="setMode('login')"
              [class]="
                mode() === 'login'
                  ? 'rounded-md bg-background py-1.5 text-foreground shadow-xs'
                  : 'py-1.5 text-muted-foreground hover:text-foreground transition-colors'
              "
            >
              Entrar
            </button>
            <button
              type="button"
              (click)="setMode('signup')"
              [class]="
                mode() === 'signup'
                  ? 'rounded-md bg-background py-1.5 text-foreground shadow-xs'
                  : 'py-1.5 text-muted-foreground hover:text-foreground transition-colors'
              "
            >
              Criar Conta
            </button>
          </div>

          <!-- Mensagem de Erro -->
          @if (errorMessage()) {
            <div
              class="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <svg
                class="h-4 w-4 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <!-- Formulário -->
          <form (submit)="onSubmit($event)" class="space-y-4">
            <!-- Campo Nome (Apenas no Cadastro) -->
            @if (mode() === "signup") {
              <div class="space-y-1.5">
                <label for="name" class="text-xs font-medium text-foreground">
                  Nome completo
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Ex.: Alice Silva"
                  [value]="name()"
                  (input)="name.set($any($event.target).value)"
                  autocomplete="name"
                  required
                  class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            }

            <!-- Campo E-mail -->
            <div class="space-y-1.5">
              <label for="email" class="text-xs font-medium text-foreground"> E-mail </label>
              <input
                id="email"
                type="email"
                placeholder="seu.email@exemplo.com"
                [value]="email()"
                (input)="email.set($any($event.target).value)"
                autocomplete="email"
                required
                class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <!-- Campo Senha -->
            <div class="space-y-1.5">
              <label for="password" class="text-xs font-medium text-foreground"> Senha </label>
              <input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                [value]="password()"
                (input)="password.set($any($event.target).value)"
                autocomplete="current-password"
                required
                class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <!-- Botão de Ação Principal -->
            <button
              type="submit"
              [disabled]="loading() || !canSubmit()"
              class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              @if (loading()) {
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
                <span>Processando...</span>
              } @else if (mode() === "login") {
                <span>Entrar no Context Whisperer</span>
              } @else {
                <span>Criar Conta</span>
              }
            </button>
          </form>

          <!-- Dica ou Atalho -->
          <div class="border-t border-border pt-4 text-center">
            @if (mode() === "login") {
              <p class="text-xs text-muted-foreground">
                Não possui uma conta?
                <button
                  type="button"
                  (click)="setMode('signup')"
                  class="font-medium text-primary hover:underline ml-1 cursor-pointer"
                >
                  Cadastre-se agora
                </button>
              </p>
            } @else {
              <p class="text-xs text-muted-foreground">
                Já possui uma conta?
                <button
                  type="button"
                  (click)="setMode('login')"
                  class="font-medium text-primary hover:underline ml-1 cursor-pointer"
                >
                  Acesse com suas credenciais
                </button>
              </p>
            }
          </div>
        </div>

        <div class="text-center text-[11px] text-muted-foreground/60">
          Context Whisperer &bull; Monorepo Fastify GraphQL & Angular 21
        </div>
      </div>
    </div>
  `,
})
export class AuthComponent {
  private readonly auth = inject(AuthService);
  private readonly sse = inject(SseService);
  private readonly projectsService = inject(ProjectsService);
  private readonly router = inject(Router);

  readonly mode = signal<"login" | "signup">("login");
  readonly name = signal<string>("");
  readonly email = signal<string>("");
  readonly password = signal<string>("");
  readonly errorMessage = signal<string | null>(null);

  readonly loading = this.auth.loading;

  readonly canSubmit = computed(() => {
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim());
    const passValid = this.password().length >= 6;
    if (this.mode() === "signup") {
      return emailValid && passValid && this.name().trim().length >= 2;
    }
    return emailValid && passValid;
  });

  setMode(mode: "login" | "signup"): void {
    this.mode.set(mode);
    this.errorMessage.set(null);
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmit() || this.loading()) return;

    this.errorMessage.set(null);

    try {
      if (this.mode() === "login") {
        await this.auth.login({
          email: this.email(),
          password: this.password(),
        });
      } else {
        await this.auth.signup({
          name: this.name(),
          email: this.email(),
          password: this.password(),
        });
      }

      // Conecta o streaming em tempo real com o novo token
      await this.sse.connect();
      // Carrega os projetos reais do usuário recém-autenticado
      await this.projectsService.loadProjects();

      // Navega para a tela principal
      await this.router.navigate(["/"]);
    } catch (err: any) {
      this.errorMessage.set(err?.message || "Ocorreu um erro na autenticação. Tente novamente.");
    }
  }
}
