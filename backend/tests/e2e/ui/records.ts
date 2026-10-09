import { TestRecord, expect, loginFromUi, test } from '../support/fixtures';

test.describe('Registros y acciones masivas (interfaz)', () => {
  test('U2: dado un listado filtrado, cuando selecciona todos y excluye uno, entonces la acción afecta al resto', async ({
    page,
    api,
    createRecord,
  }) => {
    // Dado: 12 registros pendientes con un texto común (más de una página de 10)
    const marker = `Interfaz ${Date.now()}`;
    const records: TestRecord[] = [];
    for (let i = 1; i <= 12; i++) {
      records.push(await createRecord(`${marker} ${String(i).padStart(2, '0')}`));
    }

    await loginFromUi(page);

    // Cuando: filtra por el texto
    await page.getByLabel('Buscar').fill(marker);
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(10);

    // Selección de la página y luego de todos los resultados
    await page.getByLabel('Seleccionar página').check();
    const toolbar = page.getByRole('region', { name: 'Acciones masivas' });
    await expect(toolbar).toContainText('10 seleccionado(s)');

    await toolbar.getByRole('button', { name: 'Seleccionar los 12 resultados' }).click();
    await expect(toolbar).toContainText('12 seleccionado(s)');

    // Selección individual: se excluye un registro
    const excluded = records[11];
    await page.getByLabel(`Seleccionar ${excluded.title}`).uncheck();
    await expect(toolbar).toContainText('11 seleccionado(s)');

    // Ejecuta la acción masiva
    page.once('dialog', (dialog) => dialog.accept());
    await toolbar.getByLabel('Acción masiva').selectOption('activate');
    await toolbar.getByRole('button', { name: 'Aplicar' }).click();

    // Entonces: 11 activos y el excluido sigue pendiente
    await expect(page.getByRole('status')).toContainText('11 registro(s) afectados');

    const statusOf = async (id: number) => (await (await api.get(`/api/records/${id}`)).json()).data.status;
    expect(await statusOf(records[0].id)).toBe('active');
    expect(await statusOf(excluded.id)).toBe('pending');
  });

  test('U3: dado un usuario, cuando crea y elimina un registro desde la tabla, entonces el listado se actualiza', async ({
    page,
  }) => {
    const title = `Desde interfaz ${Date.now()}`;

    await loginFromUi(page);

    // Crear
    await page.getByRole('button', { name: '+ Nuevo registro' }).click();
    await page.getByLabel('Título', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('status')).toContainText('Registro creado');

    // Buscar
    await page.getByLabel('Buscar').fill(title);
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);

    // Eliminar
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByRole('status')).toContainText('Registro eliminado');
    await expect(page.getByText('No hay registros')).toBeVisible();
  });
});
