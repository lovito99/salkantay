import { HttpErrorResponse } from '@angular/common/http';

/**
 * Convierte un error HTTP en un mensaje legible para el usuario.
 */
export function errorMessage(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'No se puede conectar con el servidor. Intenta otra vez.';
  }

  if (error.status === 429) {
    return 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.';
  }

  if (error.status === 422 && error.error?.errors) {
    return Object.values(error.error.errors).flat().join(' ');
  }

  return error.error?.message || 'No se pudo completar la operación.';
}
