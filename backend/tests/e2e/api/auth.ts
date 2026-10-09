import { credentials, expect, test } from '../support/fixtures';

test.describe('Autenticación (API)', () => {
  test('A1: dado un visitante sin JWT, cuando llama a un endpoint protegido, entonces recibe 401', async ({
    request,
  }) => {
    expect((await request.get('/api/me')).status()).toBe(401);
    expect((await request.get('/api/records')).status()).toBe(401);
    expect((await request.post('/api/logout')).status()).toBe(401);
    expect(
      (await request.post('/api/records/bulk', { data: { action: 'delete', all: true } })).status(),
    ).toBe(401);

    const invalid = await request.get('/api/me', { headers: { Authorization: 'Bearer invalido' } });
    expect(invalid.status()).toBe(401);
  });

  test('A2: dadas credenciales incorrectas o vacías, cuando inicia sesión, entonces no recibe JWT', async ({
    request,
  }) => {
    const wrong = await request.post('/api/login', {
      data: { ...credentials, password: 'incorrecta' },
    });
    expect(wrong.status()).toBe(401);
    expect(await wrong.json()).not.toHaveProperty('token');

    const empty = await request.post('/api/login', { data: {} });
    expect(empty.status()).toBe(422);
  });

  test('A3: dado un usuario válido, cuando hace login, me y logout, entonces el JWT queda revocado', async ({
    request,
  }) => {
    // Login
    const login = await request.post('/api/login', { data: credentials });
    expect(login.status()).toBe(200);

    const body = await login.json();
    expect(body.token.split('.')).toHaveLength(3);
    expect(body.user.email).toBe(credentials.email);
    expect(body.user).not.toHaveProperty('password');

    const headers = { Authorization: `Bearer ${body.token}` };

    // Me
    const me = await request.get('/api/me', { headers });
    expect(me.status()).toBe(200);
    expect((await me.json()).user.email).toBe(credentials.email);

    // Logout: el mismo JWT deja de funcionar
    expect((await request.post('/api/logout', { headers })).status()).toBe(200);
    expect((await request.get('/api/me', { headers })).status()).toBe(401);
    expect((await request.get('/api/records', { headers })).status()).toBe(401);
  });
});
