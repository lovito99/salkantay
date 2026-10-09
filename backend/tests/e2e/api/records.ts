import { expect, otherCredentials, test } from '../support/fixtures';

test.describe('Gestión de registros (API)', () => {
  test('R1: dado un usuario, cuando crea, consulta, actualiza y elimina, entonces el CRUD funciona', async ({
    api,
    createRecord,
  }) => {
    const record = await createRecord(`CRUD ${Date.now()}`);

    const detail = await api.get(`/api/records/${record.id}`);
    expect(detail.status()).toBe(200);
    expect((await detail.json()).data.title).toBe(record.title);

    const update = await api.put(`/api/records/${record.id}`, {
      data: { title: 'Título actualizado', description: 'Descripción actualizada', status: 'active' },
    });
    expect(update.status()).toBe(200);
    expect((await update.json()).data.status).toBe('active');

    expect((await api.delete(`/api/records/${record.id}`)).status()).toBe(204);
    expect((await api.get(`/api/records/${record.id}`)).status()).toBe(404);
  });

  test('R2: dados filtros, cuando pide el listado, entonces se filtra antes de paginar', async ({
    api,
    createRecord,
  }) => {
    const marker = `Filtros ${Date.now()}`;
    await createRecord(`${marker} A`, 'active');
    await createRecord(`${marker} B`, 'active');
    await createRecord(`${marker} C`, 'pending');

    const filters = { q: marker, status: 'active', perPage: 1 };
    const first = await (await api.get('/api/records', { params: { ...filters, page: 1 } })).json();
    const second = await (await api.get('/api/records', { params: { ...filters, page: 2 } })).json();

    expect(first.meta.total).toBe(2);
    expect(first.meta.lastPage).toBe(2);
    expect(first.data).toHaveLength(1);
    expect(second.data[0].id).not.toBe(first.data[0].id);

    const future = await api.get('/api/records', { params: { q: marker, from: '2099-01-01' } });
    expect((await future.json()).meta.total).toBe(0);
  });

  test('R3: dados datos inválidos, cuando se envían, entonces la API responde 422', async ({ api }) => {
    const emptyTitle = await api.post('/api/records', { data: { title: '', status: 'active' } });
    const badStatus = await api.post('/api/records', { data: { title: 'Prueba', status: 'otro' } });
    const bigPage = await api.get('/api/records', { params: { perPage: 101 } });
    const badDate = await api.get('/api/records', { params: { from: 'fecha' } });
    const badRange = await api.get('/api/records', { params: { from: '2026-02-01', to: '2026-01-01' } });

    for (const response of [emptyTitle, badStatus, bigPage, badDate, badRange]) {
      expect(response.status()).toBe(422);
    }
  });

  test('R4: dado un registro ajeno, cuando otro usuario lo usa, entonces recibe 404', async ({
    api,
    request,
    createRecord,
  }) => {
    const owned = await createRecord('Registro privado');

    const login = await request.post('/api/login', { data: otherCredentials });
    const headers = { Authorization: `Bearer ${(await login.json()).token}` };
    const own = (
      await (
        await request.post('/api/records', {
          headers,
          data: { title: 'Otro usuario', status: 'pending' },
        })
      ).json()
    ).data;

    try {
      const url = `/api/records/${owned.id}`;
      expect((await request.get(url, { headers })).status()).toBe(404);
      expect(
        (await request.put(url, { headers, data: { title: 'Cambio', status: 'active' } })).status(),
      ).toBe(404);
      expect((await request.delete(url, { headers })).status()).toBe(404);

      // Una selección mixta (propio + ajeno) se rechaza completa
      const bulk = await request.post('/api/records/bulk', {
        headers,
        data: { action: 'activate', ids: [owned.id, own.id] },
      });
      expect(bulk.status()).toBe(404);

      const ownAfter = await (await request.get(`/api/records/${own.id}`, { headers })).json();
      expect(ownAfter.data.status).toBe('pending');
      expect((await (await api.get(url)).json()).data.status).toBe('pending');
    } finally {
      await request.delete(`/api/records/${own.id}`, { headers });
      await request.post('/api/logout', { headers });
    }
  });
});
