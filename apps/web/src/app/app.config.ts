import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";
import {
  provideRouter,
  withComponentInputBinding,
  withRouterConfig,
  withViewTransitions,
} from "@angular/router";
import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
  providers: [
    // Reatividade nativa sem Zone.js (Zoneless)
    provideZonelessChangeDetection(),

    // Roteamento moderno com vinculação automática de parâmetros e herança de params ancestrais
    provideRouter(
      routes,
      withComponentInputBinding(),
      withRouterConfig({ paramsInheritanceStrategy: "always" }),
      withViewTransitions(),
    ),
  ],
};
