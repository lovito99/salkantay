import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth-service';
import { SettingsService } from './settings-service';

/**
 * Añade el JWT a cada llamada a la API y cierra la sesión local si responde 401.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const settings = inject(SettingsService);

  if (!request.url.startsWith(`${settings.apiUrl}/`)) {
    return next(request);
  }

  const isLogin = request.url === `${settings.apiUrl}/login`;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (!isLogin && auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  return next(request.clone({ setHeaders: headers })).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!isLogin && error.status === 401) {
        auth.clear();
        void router.navigateByUrl('/login');
      }

      return throwError(() => error);
    }),
  );
};
