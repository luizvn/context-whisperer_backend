import { Routes } from "@angular/router";
import { authGuard, guestGuard } from "@core/guards/auth.guard";

export const routes: Routes = [
  {
    path: "login",
    loadComponent: () => import("@features/auth/auth.component").then((m) => m.AuthComponent),
    canActivate: [guestGuard],
    title: "Entrar ou Cadastrar — Context Whisperer",
  },
  {
    path: "",
    canActivate: [authGuard],
    children: [
      {
        path: "",
        loadComponent: () =>
          import("@features/new-project/new-project.component").then((m) => m.NewProjectComponent),
        title: "Novo Projeto — Context Whisperer",
      },
      {
        path: "templates",
        loadComponent: () =>
          import("@features/templates/templates.component").then((m) => m.TemplatesComponent),
        title: "Templates & Constraints — Context Whisperer",
      },
      {
        path: "projects/:id",
        loadComponent: () =>
          import("@features/project/shell/project-shell.component").then(
            (m) => m.ProjectShellComponent,
          ),
        children: [
          {
            path: "",
            pathMatch: "full",
            redirectTo: "scope",
          },
          {
            path: "scope",
            loadComponent: () =>
              import("@features/project/scope/project-scope.component").then(
                (m) => m.ProjectScopeComponent,
              ),
            title: "Escopo — Context Whisperer",
          },
          {
            path: "artifacts",
            loadComponent: () =>
              import("@features/project/artifacts/project-artifacts.component").then(
                (m) => m.ProjectArtifactsComponent,
              ),
            title: "Artefatos — Context Whisperer",
          },
          {
            path: "orchestration",
            redirectTo: "artifacts",
          },
          {
            path: "evaluation",
            redirectTo: "artifacts",
          },
        ],
      },
    ],
  },
  {
    path: "**",
    redirectTo: "",
  },
];
