# Requerimientos: cómo está implementado cada uno

Cada requerimiento se explica en dos partes:

- **Uso**: qué hace y qué ve el usuario, paso a paso.
- **Técnico**: dónde está el código y cómo funciona.

---

## Rutas

### Pantallas (frontend, http://localhost:4200)

| Ruta | Pantalla | ¿Requiere sesión? | Si no hay sesión |
| --- | --- | --- | --- |
| `/login` | Inicio de sesión | No | — |
| `/records` | Gestión de registros | Sí | Redirige a `/login` |
| `/profile` | Mi perfil | Sí | Redirige a `/login` |
| `/` | — | — | Redirige a `/records` |
| Cualquier otra | — | — | Redirige a `/records` |

Definidas en `frontend/src/app/routes.ts`. La protección la hace `core/auth-guard.ts`.

### Endpoints (backend, http://localhost:8000/api)

| Método | Ruta | Qué hace | Requiere token | Límite |
| --- | --- | --- | --- | --- |
| POST | `/login` | Inicia sesión | No | 10 por minuto |
| GET | `/me` | Usuario actual | Sí | 120 por minuto |
| POST | `/logout` | Cierra sesión | Sí | 120 por minuto |
| GET | `/records` | Listado con filtros y paginación | Sí | 120 por minuto |
| POST | `/records` | Crear registro | Sí | 120 por minuto |
| GET | `/records/{id}` | Ver un registro | Sí | 120 por minuto |
| PUT | `/records/{id}` | Editar registro | Sí | 120 por minuto |
| DELETE | `/records/{id}` | Eliminar registro | Sí | 120 por minuto |
| POST | `/records/bulk` | Acción masiva | Sí | 120 por minuto |

Definidas en `backend/routes/api.php`. Para verlas: `php artisan route:list --path=api`.

**Códigos de respuesta**

| Código | Significado |
| --- | --- |
| 200 / 201 / 204 | Correcto / creado / eliminado |
| 401 | Sin sesión, token inválido o credenciales incorrectas |
| 404 | El registro no existe o es de otro usuario |
| 422 | Datos inválidos (el mensaje indica qué campo falla) |
| 429 | Demasiados intentos; hay que esperar un minuto |

---

## 1. Autenticación

### 1.1 Endpoints: login, me, logout

**Uso**

El usuario no llama a estos endpoints directamente; los usan las pantallas:

| Cuando el usuario… | Se llama a |
| --- | --- |
| Pulsa "Iniciar sesión" | `POST /api/login` |
| Entra a `/records` o `/profile` | `GET /api/me` |
| Pulsa "Cerrar sesión" | `POST /api/logout` |

**Técnico** · `backend/app/Http/Controllers/AuthController.php`

1. `login` compara la contraseña con la guardada (cifrada) en la base de datos. Si coincide,
   devuelve un **JWT**: un texto firmado que identifica al usuario.

   ```json
   { "token": "eyJhbGciOi...", "tokenType": "bearer", "expiresIn": 3600, "user": { ... } }
   ```

2. El frontend envía ese token en cada petición: `Authorization: Bearer <token>`.
3. `me` y `logout` están protegidos con el middleware `auth:api`: sin token válido responden **401**.
4. `logout` guarda el token en una lista negra (Redis), así deja de funcionar aunque no haya expirado.
5. El token dura 60 minutos. Después, cualquier petición responde 401 y la app vuelve a Login.

### 1.2 Vistas: Login y perfil (me)

**Uso: iniciar sesión**

1. El usuario abre http://localhost:4200 y, al no tener sesión, llega a `/login`.
2. Escribe su **Correo electrónico** y **Contraseña**.
   - El botón "Iniciar sesión" se habilita solo cuando ambos campos son válidos.
3. Pulsa **Iniciar sesión**; el botón cambia a "Ingresando…".
4. Resultado:
   - Correcto → entra a `/records` y ve el menú lateral con su nombre.
   - Datos incorrectos → aparece "Correo o contraseña incorrectos."
   - Más de 10 intentos en un minuto → "Demasiados intentos. Espera un minuto…"
   - Servidor apagado → "No se puede conectar con el servidor."

**Uso: ver el perfil**

1. En el menú lateral pulsa **Mi perfil** (`/profile`).
2. Ve su nombre completo, correo electrónico, fecha de alta ("Miembro desde") e identificador.

**Técnico** · `frontend/src/app/pages/` y `frontend/src/app/core/`

| Archivo | Función |
| --- | --- |
| `pages/login.ts` / `login.html` | Formulario; llama a `AuthService.login()` |
| `pages/profile.ts` / `profile.html` | Muestra `auth.user()` |
| `core/auth-service.ts` | Llama a la API y guarda el token en `sessionStorage` |
| `core/auth-guard.ts` | Antes de abrir `/records` o `/profile`, valida el token con `/api/me` |
| `core/auth-interceptor.ts` | Añade el token a cada petición; si recibe 401, vuelve a Login |

El token se guarda en `sessionStorage`: al cerrar la pestaña, la sesión termina.

### 1.3 Botón de logout

**Uso**

1. El botón **Cerrar sesión** está al final del menú lateral, en todas las pantallas.
2. Al pulsarlo cambia a "Cerrando sesión…".
3. El usuario vuelve a `/login`. Si intenta entrar a `/records`, se le redirige otra vez a Login.

**Técnico** · `frontend/src/app/app.html` y `app.ts`

Llama a `POST /api/logout` (el servidor invalida el token), borra el token del navegador y
redirige a `/login`.

### 1.4 Base de datos

**Uso**

Para tener datos con los que probar:

```bash
php artisan migrate     # crea las tablas
php artisan db:seed     # crea los usuarios y 24 registros de ejemplo
```

| Usuario | Contraseña | Para |
| --- | --- | --- |
| `demo@salkantay.local` | `Salkantay2026!` | Probar la aplicación |
| `playwright@salkantay.local` | `Playwright2026!` | Pruebas automáticas |

**Técnico** · `backend/database/`

| Tabla | Columnas principales |
| --- | --- |
| `users` | `id`, `name`, `email` (único), `password` (cifrada) |
| `records` | `id`, `user_id` (dueño), `title`, `description`, `status`, `created_at`, `updated_at` |

Cada registro pertenece a un usuario (`user_id`). Si se borra el usuario, se borran sus registros.

---

## 2. Gestión de registros

Todo ocurre en la pantalla **`/records`**, que tiene, de arriba abajo:

```
┌──────────────────────────────────────────────────────────┐
│ Registros [24]                          [+ Nuevo registro]│
├──────────────┬──────────────┬────────────────────────────┤
│ Total: 24    │ Seleccionados│ Página 1 de 3              │  ← resumen
├──────────────┴──────────────┴────────────────────────────┤
│ Buscar [____]  Estado [▼]  Desde [__]  Hasta [__] Filtrar │  ← filtros
├──────────────────────────────────────────────────────────┤
│ (barra de acciones masivas, si hay selección)            │
├──────────────────────────────────────────────────────────┤
│ ☐ │ TÍTULO        │ ESTADO   │ CREADO     │ ACCIONES     │  ← tabla
│ ☐ │ Plan de...    │ Activo   │ 09/10/2026 │ Editar Elim. │
├──────────────────────────────────────────────────────────┤
│ Por página [10▼]              [Anterior] 1 [Siguiente]   │  ← paginación
└──────────────────────────────────────────────────────────┘
```

### 2.1 Tabla con listado

**Uso**

- Cada fila muestra: título, descripción, estado (con color), fecha de creación y botones
  **Editar** y **Eliminar**.
- Los más recientes aparecen primero.
- Mientras carga se ve "Cargando registros…"; si no hay resultados, "No hay registros".
- En el móvil, cada fila se muestra como una tarjeta.

**Técnico** · `GET /api/records` → `RecordController@index`

El backend solo consulta los registros del usuario conectado (`user_id` = el del token). Un
usuario nunca ve registros de otro.

### 2.2 Filtros

**Uso**

1. Completa uno o varios campos:
   - **Buscar**: texto que aparezca en el título o la descripción.
   - **Estado**: Todos, Pendiente, Activo o Archivado.
   - **Desde / Hasta**: rango de fechas de creación.
2. Pulsa **Filtrar**. La tabla vuelve a la página 1 y muestra solo los resultados que cumplen todo.
3. **Limpiar** borra los filtros y muestra todo otra vez.

Si "Desde" es posterior a "Hasta", aparece un aviso y no se filtra.

**Técnico** · `Record::scopeFilter()` en `backend/app/Models/Record.php`

```
GET /api/records?q=plan&status=active&from=2026-10-01&to=2026-10-31
```

Cada filtro solo se aplica si tiene valor.

### 2.3 Paginación

**Uso**

- **Por página**: elige ver 10, 25 o 50 registros.
- **Anterior / Siguiente**: cambian de página; se desactivan en la primera y la última.
- Arriba de la tabla se indica el rango: "1–10 de 24".

**Técnico** · `paginate()` en `RecordController@index`

```
GET /api/records?page=2&perPage=10
```

Primero filtra y después corta la página. Respuesta:

```json
{
  "data": [ ... ],
  "meta": { "page": 2, "lastPage": 3, "perPage": 10, "total": 24, "from": 11, "to": 20 }
}
```

### 2.4 CRUD

**Uso**

| Para… | El usuario… | Resultado |
| --- | --- | --- |
| **Crear** | Pulsa "+ Nuevo registro", completa título, descripción y estado, y pulsa "Guardar" | Aviso "Registro creado." |
| **Ver** | Hace clic en el título de una fila | Se abre el detalle en solo lectura |
| **Editar** | Pulsa "Editar", cambia los datos y pulsa "Guardar" | Aviso "Registro actualizado." |
| **Eliminar** | Pulsa "Eliminar" y confirma | Aviso "Registro eliminado." |

- El título es obligatorio: sin título, "Guardar" no se habilita.
- Eliminar pide confirmación porque no se puede deshacer.

**Técnico** · `RecordController` (`store`, `show`, `update`, `destroy`)

| Acción | Endpoint | Cuerpo de la petición |
| --- | --- | --- |
| Crear | `POST /api/records` | `{ "title": "...", "description": "...", "status": "pending" }` |
| Ver | `GET /api/records/7` | — |
| Editar | `PUT /api/records/7` | Igual que crear |
| Eliminar | `DELETE /api/records/7` | — |

- `RecordRequest` valida los datos; si fallan, responde **422**.
- Si el registro es de otro usuario, responde **404**.

---

## 3. Acciones masivas

### 3.1 Selección individual y múltiple

**Uso**

1. Marca el checkbox de una fila → queda resaltada y aparece la **barra de acciones masivas**
   con "1 seleccionado(s)".
2. Marca más filas → el contador sube. Puede cambiar de página y seguir marcando: la selección
   se mantiene.
3. El checkbox de la **cabecera** marca o desmarca todas las filas de la página visible.
   - Si solo hay algunas marcadas, muestra un guion (–).
4. **Quitar selección** desmarca todo.

**Técnico** · `frontend/src/app/pages/records.ts`

Los ids marcados se guardan en `selected` (un `Set`). `toggle(id)` marca o desmarca una fila;
`togglePage()`, la página completa.

### 3.2 Seleccionar todos

**Uso**

1. Marca el checkbox de la cabecera (se seleccionan las 10 filas visibles).
2. Si hay más resultados, aparece **"Seleccionar los 24 resultados"**. Al pulsarlo, se
   seleccionan todos los que cumplen el filtro, en todas las páginas.
3. La barra muestra "Todos los resultados del filtro están seleccionados."
4. Puede desmarcar filas sueltas para excluirlas: 24 → 23 seleccionados.

**Técnico**

En lugar de guardar miles de ids, la app cambia de modo:

| Modo | Guarda | Envía al backend |
| --- | --- | --- |
| Manual | Los ids **marcados** (`selected`) | `{ "ids": [1, 2, 3] }` |
| Todos | Los ids **desmarcados** (`excluded`) | `{ "all": true, "exceptIds": [5], "filters": { ... } }` |

### 3.3 Acción sobre varios registros

**Uso**

1. Con registros seleccionados, elige la acción en la barra:
   - Marcar como activos
   - Marcar como pendientes
   - Archivar
   - Eliminar
2. Pulsa **Aplicar** y confirma.
3. Aparece "Acción completada: 23 registro(s) afectados." y la tabla se actualiza.

**Técnico** · `POST /api/records/bulk` → `RecordController@bulk`

```json
{ "action": "archive", "all": true, "exceptIds": [5], "filters": { "q": "plan" } }
```

1. El backend toma los registros del usuario + los filtros + (`ids` o "todos menos `exceptIds`").
2. Ejecuta un único `UPDATE` o `DELETE` dentro de una transacción.
3. Si algún id no existe o es de otro usuario, rechaza todo (**404**) y no cambia nada.
4. Responde cuántos cambió: `{ "affected": 23 }`.

---

## Pruebas (Playwright)

Están en `backend/tests/e2e/`. Cada una comprueba un requerimiento:

| Requerimiento | Prueba | Archivo |
| --- | --- | --- |
| Endpoints login, me, logout | A1, A2, A3 | `api/auth.ts` |
| Vistas Login, perfil y logout | U1 | `ui/auth.ts` |
| Listado, filtros, paginación y CRUD | R1, R2, R3, R4 | `api/records.ts` |
| CRUD desde la tabla | U3 | `ui/records.ts` |
| Acciones masivas | M1, M2, M3 | `api/bulk.ts` |
| Selección y "seleccionar todos" en la tabla | U2 | `ui/records.ts` |

```bash
npm run test:api    # pruebas de la API
npm run test:ui     # pruebas en el navegador
```
