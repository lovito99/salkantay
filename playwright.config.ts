import { defineConfig } from '@playwright/test';
import { backendUrl, frontendUrl } from './backend/tests/e2e/support/environment';

/**
 * Antes de ejecutar las pruebas deben estar levantados:
 * - backend:  docker compose up   (o php artisan serve)
 * - frontend: npm start           (dentro de frontend/)
 */
export default defineConfig({
  testDir: './backend/tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'api',
      testMatch: 'api/**/*.ts',
      use: { baseURL: backendUrl, extraHTTPHeaders: { Accept: 'application/json' } },
    },
    {
      name: 'chromium',
      testMatch: 'ui/**/*.ts',
      use: { baseURL: frontendUrl, browserName: 'chromium' },
    },
  ],
});
