import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth-service';

/**
 * Deja pasar solo si hay un JWT válido; lo comprueba con GET /api/me.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.token) {
    return router.createUrlTree(['/login']);
  }

  try {
    await firstValueFrom(auth.me());
    return true;
  } catch {
    auth.clear();
    return router.createUrlTree(['/login']);
  }
};
