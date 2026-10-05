import { inject } from "@angular/core";
import { type CanActivateFn, Router } from "@angular/router";
import { AuthService } from "@core/services/auth.service";

/**
 * Guarda de rota que exige autenticação para acessar a tela.
 * Redireciona usuários anônimos para /login.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(["/login"]);
};

/**
 * Guarda de rota para páginas públicas exclusivas de visitantes (ex: /login).
 * Redireciona usuários já autenticados para a home /.
 */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return router.createUrlTree(["/"]);
  }

  return true;
};
