import { expect, test } from '../support/fixtures';

test.describe('Acciones masivas (API)', () => {
  test('M1: dada una selección de ids, cuando se activa, entonces solo cambian esos registros', async ({
    api,
    createRecord,
  }) => {
    const first = await createRecord('Selección individual');
    const second = await createRecord('Selección múltiple');
    const untouched = await createRecord('Sin seleccionar');

    const response = await api.post('/api/records/bulk', {
      data: { action: 'activate', ids: [first.id, second.id] },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).affected).toBe(2);

    for (const record of [first, second]) {
      const detail = await (await api.get(`/api/records/${record.id}`)).json();
      expect(detail.data.status).toBe('active');
    }

    const rest = await (await api.get(`/api/records/${untouched.id}`)).json();
    expect(rest.data.status).toBe('pending');
  });

  test('M2: dado "seleccionar todos", cuando se archiva, entonces respeta filtros y exclusiones', async ({
    api,
    createRecord,
  }) => {
    const marker = `Masivo ${Date.now()}`;
    const first = await createRecord(`${marker} A`, 'active');
    const excluded = await createRecord(`${marker} B`, 'active');
    const third = await createRecord(`${marker} C`, 'active');
    const untouched = await createRecord(`${marker} D`, 'pending');

    const response = await api.post('/api/records/bulk', {
      data: {
        action: 'archive',
        all: true,
        exceptIds: [excluded.id],
        filters: { q: marker, status: 'active' },
      },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).affected).toBe(2);

    const statusOf = async (id: number) => (await (await api.get(`/api/records/${id}`)).json()).data.status;

    expect(await statusOf(first.id)).toBe('archived');
    expect(await statusOf(third.id)).toBe('archived');
    expect(await statusOf(excluded.id)).toBe('active');
    expect(await statusOf(untouched.id)).toBe('pending');
  });

  test('M3: dada una selección, cuando se elimina en lote, entonces solo se borra esa selección', async ({
    api,
    createRecord,
  }) => {
    const first = await createRecord('Eliminar A');
    const second = await createRecord('Eliminar B');
    const kept = await createRecord('Conservar');

    const response = await api.post('/api/records/bulk', {
      data: { action: 'delete', ids: [first.id, second.id] },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).affected).toBe(2);

    expect((await api.get(`/api/records/${first.id}`)).status()).toBe(404);
    expect((await api.get(`/api/records/${second.id}`)).status()).toBe(404);
    expect((await api.get(`/api/records/${kept.id}`)).status()).toBe(200);

    // Sin ids ni "all" la acción se rechaza
    expect((await api.post('/api/records/bulk', { data: { action: 'delete' } })).status()).toBe(422);
  });
});
