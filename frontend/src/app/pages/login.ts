import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth-service';
import { errorMessage } from '../core/http-error';

@Component({
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');
  email = '';
  password = '';

  constructor() {
    if (this.auth.user()) {
      void this.router.navigateByUrl('/records');
    }
  }

  submit(): void {
    if (this.busy()) {
      return;
    }

    this.busy.set(true);
    this.error.set('');

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.password = '';
        this.busy.set(false);
        void this.router.navigateByUrl('/records');
      },
      error: (error) => {
        this.error.set(errorMessage(error));
        this.busy.set(false);
      },
    });
  }
}
