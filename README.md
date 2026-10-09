# Salkantay · Documentación técnica

Aplicación para gestionar registros personales con:

1. **Autenticación**: login, perfil (me) y logout con JWT.
2. **Gestión de registros**: tabla con filtros, paginación y CRUD.
3. **Acciones masivas**: selección individual, múltiple, "seleccionar todos" y una acción sobre varios registros.

> Explicación técnica de cada requerimiento, con el código y la prueba que lo verifica:
> [docs/requerimientos.md](docs/requerimientos.md)

| Capa | Tecnología |
| --- | --- |
| Backend (API) | Laravel 12, PHP 8.2 (XAMPP), JWT (`php-open-source-saver/jwt-auth` 2.8) |
| Frontend | Angular 17 (componentes standalone y signals) |
| Base de datos | MySQL (XAMPP), base `salkantay`, usuario `root` sin contraseña |
| Caché | Redis con contraseña (lista negra de JWT y límite de peticiones) |
| Pruebas | Playwright (API y navegador) |

---

## 1. Estructura de carpetas

```
salkantay/
├── backend/                     API Laravel
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/     AuthController, RecordController
│   │   │   ├── Requests/        Validaciones (LoginRequest, RecordRequest, ...)
│   │   │   └── Resources/       Formato JSON de salida (UserResource, RecordResource)
│   │   └── Models/              User, Record
│   ├── config/                  Configuración (valores fijos del proyecto)
│   ├── database/
│   │   ├── migrations/          Tablas
│   │   ├── factories/           Datos falsos (UserFactory, RecordFactory)
│   │   └── seeders/             Datos iniciales (DemoSeeder, PlaywrightSeeder)
│   ├── routes/api.php           Endpoints
│   ├── tests/e2e/               Pruebas Playwright
│   │   ├── api/                 Pruebas HTTP de la API
│   │   ├── ui/                  Pruebas en navegador (Chromium)
│   │   └── support/             fixtures.ts y environment.ts
│   └── .env                     Variables del entorno
├── frontend/                    App Angular
│   ├── public/config.json       URL de la API (se genera al arrancar)
│   ├── scripts/configure.cjs    Genera config.json a partir de APP_URL
│   └── src/app/
│       ├── app.ts / app.html    Plantilla general (menú lateral y botón de logout)
│       ├── config.ts            Proveedores: router, HttpClient, interceptor
│       ├── routes.ts            Rutas: /login, /records, /profile
│       ├── core/                Servicios y lógica compartida
│       └── pages/               Vistas: login, profile, records
├── docs/especificacion.md       Criterios de aceptación (SDD)
├── playwright.config.ts         Configuración de Playwright
└── compose.yaml                 Docker: Redis (y backend opcional)
```

---

## 2. Configuración (`backend/.env`)

Solo están las variables que cambian entre entornos. Los valores fijos (nombre de la app,
driver `mysql`, cliente `predis`, caché `redis`) están en `backend/config/`.

| Variable | Ejemplo local | Para qué sirve |
| --- | --- | --- |
| `APP_ENV` | `local` | `local` o `production` |
| `APP_KEY` | `base64:...` | Clave de cifrado de Laravel (`php artisan key:generate`) |
| `APP_DEBUG` | `true` | En producción siempre `false` |
| `APP_URL` | `http://localhost:8000` | **URL base del backend** |
| `FRONTEND_URL` | `http://localhost:4200` | **URL base del frontend** (CORS). Admite varias separadas por coma |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | Servidor MySQL |
| `DB_DATABASE` | `salkantay` | Nombre de la base |
| `DB_USERNAME` / `DB_PASSWORD` | `root` / *(vacío)* | Credenciales MySQL |
| `REDIS_HOST` / `REDIS_PORT` | `127.0.0.1` / `6381` | Servidor Redis |
| `REDIS_PASSWORD` | *(generada)* | Contraseña de Redis (Docker la usa al arrancar Redis) |
| `JWT_SECRET` | *(generado)* | Firma de los JWT (`php artisan jwt:secret`) |

### Cómo llega la URL del backend al frontend

`npm start` y `npm run build` ejecutan primero `frontend/scripts/configure.cjs`, que lee `APP_URL`
y escribe `frontend/public/config.json`:

```json
{ "apiUrl": "http://localhost:8000/api" }
```

Angular lee ese archivo al arrancar (`core/settings-service.ts`). Así, **en producción
sirve cualquier dominio**: se cambian `APP_URL` y `FRONTEND_URL`, o se edita `config.json`
en el servidor, sin tocar el código.

---

## 3. Puesta en marcha

Requisitos: MySQL de XAMPP encendido, la base `salkantay` creada y Redis en marcha
(`docker compose up -d redis` desde la raíz).

`composer` debe ejecutarse con el PHP de XAMPP (`/opt/lampp/bin/php`), que tiene las extensiones
`dom`, `xml` y `pdo_mysql`. En este equipo lo hace el script `~/.local/bin/composer`.
XAMPP no trae `ext-sodium`; `composer.json` la declara en `config.platform` porque la librería
JWT solo la usa para algoritmos que el proyecto no emplea (aquí se usa HS256).

### Backend

```bash
cd backend

# Instalación
composer install
cp .env.example .env          # solo si no existe .env
php artisan key:generate      # solo si APP_KEY está vacío
php artisan jwt:secret        # solo si JWT_SECRET está vacío

# Base de datos
php artisan migrate                           # crea las tablas
php artisan db:seed                           # usuario demo + usuarios de prueba
php artisan db:seed --class=DemoSeeder        # solo el usuario demo
php artisan db:seed --class=PlaywrightSeeder  # solo los usuarios de prueba
php artisan migrate:status                    # ver migraciones aplicadas
php artisan migrate:rollback                  # deshacer la última migración
php artisan migrate:fresh --seed              # borrar todo y recrear con datos

# Levantar la API
php artisan serve                             # http://localhost:8000

# Consultas y mantenimiento
php artisan route:list --path=api             # ver endpoints
php artisan config:clear                      # después de cambiar el .env
php artisan optimize:clear                    # limpiar todas las cachés
php artisan tinker                            # consola para probar modelos
```

### Frontend

```bash
cd frontend
npm install
npm start                     # desarrollo en http://localhost:4200
npm run build                 # producción en frontend/dist/salkantay
```

Usuarios creados por los seeders:

| Usuario | Contraseña | Uso |
| --- | --- | --- |
| `demo@salkantay.local` | `Salkantay2026!` | Demostración (24 registros) |
| `playwright@salkantay.local` | `Playwright2026!` | Pruebas Playwright |
| `other@salkantay.local` | `Playwright2026!` | Pruebas de acceso a registros ajenos |

---

## 4. Base de datos

### Tabla `records` (migración `2026_10_09_000001_create_records_table.php`)

| Columna | Tipo | Nota |
| --- | --- | --- |
| `id` | bigint | Clave primaria |
| `user_id` | bigint | Dueño; se borra en cascada con el usuario |
| `title` | varchar(255) | Obligatorio |
| `description` | text | Opcional |
| `status` | varchar(20) | `pending`, `active` o `archived` |
| `created_at` / `updated_at` | timestamp | Fechas automáticas |

Índice compuesto `(user_id, status, created_at)`: acelera el listado, que siempre filtra por
usuario y casi siempre por estado o fecha.

La tabla `users` y las tablas `cache` y `jobs` son las estándar de Laravel.

### Seeders

- `DatabaseSeeder`: solo funciona en `local` o `testing` y llama a los otros dos.
- `DemoSeeder`: crea el usuario demo y 24 registros con `RecordFactory`.
- `PlaywrightSeeder`: crea los usuarios que usan las pruebas.

---

## 5. API

Todas las respuestas son JSON con claves en camelCase. Las rutas protegidas exigen la cabecera
`Authorization: Bearer <token>`.

| Método | Ruta | Descripción | Respuesta |
| --- | --- | --- | --- |
| POST | `/api/login` | Inicia sesión | `{ token, tokenType, expiresIn, user }` |
| GET | `/api/me` | Usuario actual | `{ user }` |
| POST | `/api/logout` | Revoca el JWT | `{ message }` |
| GET | `/api/records` | Listado filtrado y paginado | `{ data: [...], meta }` |
| POST | `/api/records` | Crear | 201 `{ data }` |
| GET | `/api/records/{id}` | Detalle | `{ data }` |
| PUT | `/api/records/{id}` | Actualizar | `{ data }` |
| DELETE | `/api/records/{id}` | Eliminar | 204 |
| POST | `/api/records/bulk` | Acción masiva | `{ message, affected }` |

Límites: `login` admite 10 intentos por minuto; el resto, 120 peticiones por minuto.

### Parámetros del listado

`q` (texto en título o descripción), `status`, `from` y `to` (fechas `AAAA-MM-DD`), `page` y
`perPage` (de 1 a 100).

```json
{
  "data": [{ "id": 7, "title": "Plan", "description": null, "status": "active",
             "createdAt": "2026-10-09T15:00:00-05:00", "updatedAt": "..." }],
  "meta": { "page": 1, "lastPage": 3, "perPage": 10, "total": 24, "from": 1, "to": 10 }
}
```

### Errores

| Código | Cuándo |
| --- | --- |
| 401 | Sin JWT, JWT inválido, JWT revocado o credenciales incorrectas |
| 404 | El registro no existe **o es de otro usuario** (no se revela cuál de las dos) |
| 422 | Validación fallida: `{ message, errors: { campo: [...] } }` |
| 429 | Demasiadas peticiones |

---

## 6. Autenticación paso a paso

```
Login (vista)        AuthService            API                    Base de datos
    │  email+clave       │                     │                         │
    ├───────────────────►│  POST /api/login    │                         │
    │                    ├────────────────────►│ attempt(): compara hash │
    │                    │                     ├────────────────────────►│
    │                    │   { token, user }   │                         │
    │                    │◄────────────────────┤                         │
    │                    │ guarda token en sessionStorage                │
    │  navega a /records │                     │                         │
```

- **`core/auth-interceptor.ts`** añade `Authorization: Bearer ...` a cada petición. Si la API
  responde 401, borra la sesión y redirige a `/login`.
- **`core/auth-guard.ts`** protege `/records` y `/profile`: si no hay token redirige a Login;
  si lo hay, lo valida con `GET /api/me` (que además carga los datos de la vista de perfil).
- **Logout**: el botón "Cerrar sesión" (`app.html`) llama a `POST /api/logout`. El backend
  guarda el JWT en una lista negra en Redis, así que ese token deja de servir aunque alguien
  lo haya copiado.
- El token se guarda en `sessionStorage`: se pierde al cerrar la pestaña.

---

## 7. Gestión de registros

**Backend** (`RecordController`):

- Todas las consultas parten de `records()`, que devuelve **solo los registros del usuario
  autenticado**. Por eso un registro ajeno siempre da 404.
- Los filtros viven en el modelo como scope: `Record::filter($filters)`.
- La validación está en Form Requests (`RecordRequest`, `RecordFilterRequest`), lo que deja
  los controladores cortos.
- `RecordResource` define el JSON de salida, así la API no expone los nombres de las columnas.

**Frontend** (`pages/records.ts` y `records.html`):

- `filters` es lo que el usuario escribe; `applied` es lo que se envió al pulsar "Filtrar".
  La paginación y las acciones masivas usan siempre `applied`.
- Cambiar los filtros vuelve a la página 1 y limpia la selección.
- Un solo `<dialog>` sirve para crear, editar y ver (`mode`).
- Si al eliminar la página queda vacía, `load()` retrocede a la última página válida.

---

## 8. Acciones masivas

La selección tiene dos modos:

| Modo | Qué guarda el frontend | Qué se envía |
| --- | --- | --- |
| Manual | `selected`: ids marcados | `{ action, all: false, ids: [3, 7] }` |
| Todos | `excluded`: ids desmarcados | `{ action, all: true, exceptIds: [5], filters }` |

Ejemplo: hay 120 resultados y se ven 10 por página.

1. El checkbox de la cabecera marca las 10 filas visibles (modo manual).
2. Aparece "Seleccionar los 120 resultados" y se pasa al modo **todos**.
3. Desmarcar una fila ya no la quita de una lista: la añade a `excluded` (119 seleccionados).
4. "Aplicar" envía los filtros activos y las exclusiones. El backend vuelve a aplicar los
   mismos filtros y no necesita recibir 119 ids.

Acciones: `activate`, `pending`, `archive` y `delete`. En el backend:

- Se ejecutan dentro de una transacción (`DB::transaction`).
- En modo manual, si **algún** id no existe o es ajeno, se rechaza todo con 404 y no cambia nada.

---

## 9. Pruebas con Playwright (SDD, BDD y TDD)

| Enfoque | Dónde se aplica |
| --- | --- |
| **SDD** (especificación) | `docs/especificacion.md`: cada criterio tiene un código (A1, R2, M2...) |
| **BDD** (comportamiento) | Cada prueba usa el código del criterio y el formato *Dado / Cuando / Entonces* |
| **TDD** (pruebas primero) | Para un cambio: prueba en rojo → código mínimo en verde → refactor |

```bash
# Requisitos: backend y frontend levantados, y db:seed ejecutado
npm install                       # en la raíz (instala Playwright)
npx playwright install chromium   # solo la primera vez

npm test                          # todas
npm run test:api                  # solo API      (backend/tests/e2e/api)
npm run test:ui                   # solo interfaz (backend/tests/e2e/ui)
npx playwright show-report        # informe HTML
```

Las fixtures de `support/fixtures.ts`:

- `api`: un cliente HTTP con sesión iniciada.
- `createRecord`: crea registros y **los borra al terminar cada prueba**, así la base queda limpia.
- `loginFromUi`: inicia sesión desde la vista de Login.

> La extensión de Playwright para VS Code necesita Node 20 o superior. Si VS Code usa el Node
> del sistema (v18), ábrelo desde una terminal con nvm activo: `code .`

---

## 10. Convenciones

- Archivos y carpetas **sin guion bajo ni punto intermedio**: `auth-service.ts`, `records.ts`, `e2e/api/`.
- Clases en PascalCase; variables, métodos y claves JSON en camelCase.
- **Excepciones que impone cada herramienta:**
  - Migraciones (`2026_10_09_000001_...`): Laravel solo las encuentra con ese formato.
  - Columnas de la base (`user_id`, `created_at`): convención de Eloquent. No llegan a la API porque los Resources las traducen.
  - `.env.example`, `package-lock.json` y `playwright.config.ts`: nombres fijos de Laravel, npm y la extensión de Playwright.
  - Variables de entorno (`DB_HOST`): estándar en mayúsculas.

---

## 11. Producción

1. `backend/.env`: `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://api.tudominio.com`,
   `FRONTEND_URL=https://tudominio.com`, credenciales reales de MySQL y Redis.
2. `php artisan key:generate`, `php artisan jwt:secret`, `php artisan migrate --force`
   (**sin** `db:seed`, que solo es para local).
3. `php artisan config:cache && php artisan route:cache`.
4. Frontend: `APP_URL=https://api.tudominio.com npm run build` y publicar `frontend/dist/salkantay`.
   Si cambia el dominio, basta con editar `config.json` en el servidor.
