import { credentials, expect, loginFromUi, test } from '../support/fixtures';

test.describe('Autenticación (interfaz)', () => {
  test('U1: dado un usuario, cuando inicia sesión, ve su perfil y cierra sesión, entonces vuelve a Login', async ({
    page,
  }) => {
    // Login
    await loginFromUi(page);
    await expect(page.getByRole('heading', { name: /Registros/ })).toBeVisible();

    // Perfil (me)
    await page.getByRole('link', { name: 'Mi perfil' }).click();
    await expect(page.getByRole('heading', { name: 'Mi perfil' })).toBeVisible();
    await expect(page.getByText(credentials.email).first()).toBeVisible();

    // Logout
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);

    // Sin sesión, las rutas protegidas redirigen a Login
    await page.goto('/records');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('U1b: dadas credenciales incorrectas, cuando inicia sesión, entonces ve un error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(credentials.email);
    await page.getByLabel('Contraseña').fill('incorrecta');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos');
    await expect(page).toHaveURL(/\/login$/);
  });
});
