import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth-service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  readonly auth = inject(AuthService);
  readonly leaving = signal(false);
  readonly logoutError = signal('');

  logout(): void {
    this.leaving.set(true);
    this.logoutError.set('');

    this.auth.logout().subscribe({
      next: () => this.leaving.set(false),
      error: () => {
        this.leaving.set(false);
        this.logoutError.set('No se pudo cerrar la sesión. Intenta otra vez.');
      },
    });
  }
}
