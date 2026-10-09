import { Routes } from '@angular/router';
import { authGuard } from './core/auth-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login').then((m) => m.LoginPage),
  },
  {
    path: 'records',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/records').then((m) => m.RecordsPage),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile').then((m) => m.ProfilePage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'records' },
  { path: '**', redirectTo: 'records' },
];
