import { APIRequestContext, Page, expect, test as base } from '@playwright/test';
import { backendUrl } from './environment';

// Usuarios creados por PlaywrightSeeder.
export const credentials = { email: 'playwright@salkantay.local', password: 'Playwright2026!' };
export const otherCredentials = { email: 'other@salkantay.local', password: 'Playwright2026!' };

export type TestRecord = { id: number; title: string; status: string };

type Fixtures = {
  createRecord: (title: string, status?: string) => Promise<TestRecord>;
};

type WorkerFixtures = {
  api: APIRequestContext;
};

/**
 * Inicia sesión desde la vista de Login (pruebas de interfaz).
 */
export async function loginFromUi(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(credentials.email);
  await page.getByLabel('Contraseña').fill(credentials.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/records$/);
}

/**
 * - api: cliente HTTP del backend con sesión iniciada (un JWT por worker).
 * - createRecord: crea registros y los elimina al terminar cada prueba.
 */
export const test = base.extend<Fixtures, WorkerFixtures>({
  api: [
    async ({ playwright }, use) => {
      const baseURL = backendUrl;
      const guest = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { Accept: 'application/json' },
      });

      const login = await guest.post('/api/login', { data: credentials });
      expect(login.status()).toBe(200);
      const { token } = await login.json();
      await guest.dispose();

      const api = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });

      await use(api);

      await api.post('/api/logout');
      await api.dispose();
    },
    { scope: 'worker' },
  ],

  createRecord: async ({ api }, use) => {
    const ids: number[] = [];

    await use(async (title, status = 'pending') => {
      const response = await api.post('/api/records', {
        data: { title, description: 'Registro de prueba', status },
      });
      expect(response.status()).toBe(201);

      const { data: record } = await response.json();
      ids.push(record.id);

      return record;
    });

    for (const id of ids) {
      await api.delete(`/api/records/${id}`);
    }
  },
});

export { expect };
