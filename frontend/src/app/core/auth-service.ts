import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { SettingsService } from './settings-service';

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

interface LoginResponse {
  token: string;
  user: User;
}

const tokenKey = 'salkantay-token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);

  readonly user = signal<User | null>(null);

  get token(): string | null {
    return sessionStorage.getItem(tokenKey);
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${this.settings.apiUrl}/login`, { email, password }).pipe(
      tap((result) => {
        sessionStorage.setItem(tokenKey, result.token);
        this.user.set(result.user);
      }),
    );
  }

  me() {
    return this.http
      .get<{ user: User }>(`${this.settings.apiUrl}/me`)
      .pipe(tap((result) => this.user.set(result.user)));
  }

  logout() {
    return this.http.post(`${this.settings.apiUrl}/logout`, {}).pipe(
      tap(() => {
        this.clear();
        void this.router.navigateByUrl('/login');
      }),
    );
  }

  clear(): void {
    sessionStorage.removeItem(tokenKey);
    this.user.set(null);
  }
}
