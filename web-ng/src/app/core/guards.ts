import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';

/** Rotas protegidas: sem sessão, manda para o login guardando o destino. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.user()) return true;
  const next = encodeURIComponent(state.url);
  return router.createUrlTree(['/login'], { queryParams: { next } });
};

/** Login/cadastro: quem já entrou volta para o destino (ou para o início). */
export const guestGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.user()) return true;
  const next = (state.root.queryParams['next'] as string | undefined) ?? '/';
  return router.parseUrl(next.startsWith('/') && !next.startsWith('//') ? next : '/');
};
