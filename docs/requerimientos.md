# Implementación de los requerimientos

Este documento explica, requerimiento por requerimiento, **qué archivos intervienen, cómo
funciona cada parte y qué prueba lo verifica**. Para instalar y ejecutar el proyecto, ver el
[README](../README.md).

Recorrido general de una petición:

```
Vista Angular ──► Servicio (core/) ──► Interceptor (añade JWT) ──► API Laravel
                                                                       │
                       routes/api.php ──► Middleware auth:api ──► Form Request (valida)
                                                                       │
                       Controlador ──► Modelo Eloquent ──► MySQL       │
                                                                       ▼
                       Resource (JSON camelCase) ◄─────────────── respuesta
```

---

## 1. Autenticación

### 1.1 Endpoints: login, me, logout

**Archivos**

| Archivo | Responsabilidad |
| --- | --- |
| [backend/routes/api.php](../backend/routes/api.php) | Declara las rutas y sus middlewares |
| [backend/app/Http/Controllers/AuthController.php](../backend/app/Http/Controllers/AuthController.php) | Métodos `login`, `me` y `logout` |
| [backend/app/Http/Requests/LoginRequest.php](../backend/app/Http/Requests/LoginRequest.php) | Valida email y contraseña |
| [backend/app/Http/Resources/UserResource.php](../backend/app/Http/Resources/UserResource.php) | Define qué datos del usuario se devuelven |
| [backend/config/auth.php](../backend/config/auth.php) | Guard `api` con driver `jwt` |

**Rutas**

```php
Route::post('login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware(['auth:api', 'throttle:120,1'])->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);
    // ...
});
```

- `login` es pública, pero con **límite de 10 intentos por minuto** (`throttle:10,1`) para frenar
  ataques de fuerza bruta.
- `me` y `logout` están dentro del grupo `auth:api`: sin un JWT válido, Laravel responde **401**
  antes de llegar al controlador.

**¿Qué es un JWT?** Es un texto con tres partes separadas por puntos
(`cabecera.datos.firma`). Los datos incluyen el id del usuario y la fecha de expiración. La firma
se calcula con `JWT_SECRET` (algoritmo HS256), así que nadie puede modificar el token sin que el
servidor lo detecte. El servidor no guarda sesiones: le basta con verificar la firma.

**`POST /api/login`**

```php
public function login(LoginRequest $request): JsonResponse
{
    $token = auth('api')->attempt($request->validated());

    if (! $token) {
        return response()->json(['message' => 'Correo o contraseña incorrectos.'], 401);
    }

    return response()->json([
        'token' => $token,
        'tokenType' => 'bearer',
        'expiresIn' => auth('api')->factory()->getTTL() * 60,
        'user' => UserResource::make(auth('api')->user()),
    ]);
}
```

1. `LoginRequest` valida que `email` sea un correo y que `password` exista. Si falla, Laravel
   responde **422** automáticamente.
2. `attempt()` busca al usuario por email y compara la contraseña con el **hash bcrypt** guardado
   (nunca se guarda la contraseña en texto plano: el cast `'password' => 'hashed'` del modelo
   `User` la cifra al guardarla).
3. Si coincide, genera el JWT; si no, responde **401** con un mensaje genérico (no revela si el
   correo existe).
4. `expiresIn` está en segundos (por defecto 60 minutos, `config/jwt.php`).

**`GET /api/me`**: devuelve el usuario dueño del token. El middleware `auth:api` ya validó el
JWT, así que `auth('api')->user()` está disponible.

**`POST /api/logout`**: `auth('api')->logout()` añade el JWT a una **lista negra en Redis**. Como
un JWT es válido hasta su expiración, sin esta lista negra seguiría funcionando después del
logout. Con ella, cualquier petición posterior con ese token recibe **401**.

**`UserResource`**: el JSON solo incluye `id`, `name`, `email` y `createdAt`. La contraseña y el
`remember_token` nunca salen de la API.

### 1.2 Vistas: Login y perfil (me)

**Archivos**

| Archivo | Responsabilidad |
| --- | --- |
| [frontend/src/app/pages/login.ts](../frontend/src/app/pages/login.ts) y `login.html` | Formulario de inicio de sesión |
| [frontend/src/app/pages/profile.ts](../frontend/src/app/pages/profile.ts) y `profile.html` | Datos del usuario |
| [frontend/src/app/core/auth-service.ts](../frontend/src/app/core/auth-service.ts) | Llamadas a login, me y logout; guarda el token |
| [frontend/src/app/core/auth-guard.ts](../frontend/src/app/core/auth-guard.ts) | Protege las rutas privadas |
| [frontend/src/app/core/auth-interceptor.ts](../frontend/src/app/core/auth-interceptor.ts) | Añade el JWT a cada petición |
| [frontend/src/app/routes.ts](../frontend/src/app/routes.ts) | Rutas `/login`, `/records`, `/profile` |

**Vista Login**

- Formulario *template-driven* (`ngModel`) con validaciones HTML: `required`, `email` y
  `maxlength`. El botón queda deshabilitado mientras el formulario es inválido o hay una petición
  en curso (`busy()`), lo que evita envíos dobles.
- Al enviar, llama a `AuthService.login()`. Si responde bien, guarda el token y navega a
  `/records`; si falla, muestra el mensaje que devuelve `errorMessage()`
  ([core/http-error.ts](../frontend/src/app/core/http-error.ts)), que traduce 0, 401, 422 y 429 a
  textos claros.

**Dónde se guarda el token**

```ts
sessionStorage.setItem('salkantay-token', result.token);
this.user.set(result.user);
```

- `sessionStorage`: el token desaparece al cerrar la pestaña.
- `user` es un **signal** de Angular: cualquier vista que lo lea (menú lateral, perfil) se
  actualiza sola cuando cambia.

**Interceptor**: cada petición a la API pasa por `authInterceptor`, que añade
`Authorization: Bearer <token>`. Si la API responde **401** (token vencido o revocado), borra la
sesión local y redirige a `/login`.

**Guard**: `/records` y `/profile` tienen `canActivate: [authGuard]`.

```ts
if (!auth.token) {
  return router.createUrlTree(['/login']);
}

try {
  await firstValueFrom(auth.me());   // valida el token y carga el usuario
  return true;
} catch {
  auth.clear();
  return router.createUrlTree(['/login']);
}
```

**Vista Perfil**: no hace peticiones propias. Muestra `auth.user()`, que el guard ya cargó con
`GET /api/me`: nombre, correo, fecha de alta e identificador.

### 1.3 Botón de logout

Está en el menú lateral, [frontend/src/app/app.html](../frontend/src/app/app.html), así que se ve
en todas las páginas privadas.

```ts
logout(): void {
  this.leaving.set(true);
  this.auth.logout().subscribe({
    next: () => this.leaving.set(false),
    error: () => { /* muestra "No se pudo cerrar la sesión" */ },
  });
}
```

`AuthService.logout()` llama a `POST /api/logout` (el servidor revoca el token), borra
`sessionStorage`, pone `user` en `null` y navega a `/login`. Mientras tanto el botón muestra
"Cerrando sesión…" y queda deshabilitado.

### 1.4 Base de datos

**Migraciones** en [backend/database/migrations](../backend/database/migrations):

| Tabla | Uso |
| --- | --- |
| `users` | Usuarios: `name`, `email` (único), `password` (hash bcrypt) |
| `records` | Registros de cada usuario |
| `cache`, `jobs` | Tablas estándar de Laravel |

**Modelo `User`** ([app/Models/User.php](../backend/app/Models/User.php)):

- Implementa `JWTSubject`: `getJWTIdentifier()` indica qué va dentro del token (el id).
- `$hidden` oculta `password` y `remember_token` al convertir a JSON.
- Relación `records()`: un usuario tiene muchos registros.

**Seeders** ([database/seeders](../backend/database/seeders)):

- `DemoSeeder`: usuario `demo@salkantay.local` con 24 registros generados por `RecordFactory`.
- `PlaywrightSeeder`: usuarios `playwright@` y `other@` para las pruebas.
- `DatabaseSeeder` llama a los dos, pero **solo en local o testing**, para no crear usuarios con
  contraseñas conocidas en producción.

**Pruebas**: A1, A2 y A3 en [backend/tests/e2e/api/auth.ts](../backend/tests/e2e/api/auth.ts);
U1 en [backend/tests/e2e/ui/auth.ts](../backend/tests/e2e/ui/auth.ts).

---

## 2. Gestión de registros

### 2.1 Tabla con listado de registros

**Archivos**

| Archivo | Responsabilidad |
| --- | --- |
| [backend/app/Http/Controllers/RecordController.php](../backend/app/Http/Controllers/RecordController.php) | `index`, `store`, `show`, `update`, `destroy`, `bulk` |
| [backend/app/Models/Record.php](../backend/app/Models/Record.php) | Modelo, estados válidos y scope `filter` |
| [backend/app/Http/Resources/RecordResource.php](../backend/app/Http/Resources/RecordResource.php) | JSON de cada registro |
| [frontend/src/app/core/records-service.ts](../frontend/src/app/core/records-service.ts) | Llamadas HTTP y tipos |
| [frontend/src/app/pages/records.ts](../frontend/src/app/pages/records.ts) y `records.html` | Tabla, filtros, paginación, modal y selección |

**Tabla `records`**

| Columna | Tipo | Nota |
| --- | --- | --- |
| `id` | bigint | Clave primaria |
| `user_id` | bigint | Dueño (clave foránea, borrado en cascada) |
| `title` | varchar(255) | Obligatorio |
| `description` | text | Opcional |
| `status` | varchar(20) | `pending`, `active` o `archived` |
| `created_at`, `updated_at` | timestamp | Automáticas |

Índice `(user_id, status, created_at)`: el listado siempre filtra por usuario y casi siempre por
estado o fecha, así que MySQL usa este índice en lugar de recorrer toda la tabla.

**Aislamiento por usuario**: todas las consultas del controlador parten de este método:

```php
private function records(): Builder
{
    return auth('api')->user()->records()->getQuery();
}
```

Equivale a `WHERE user_id = <usuario autenticado>`. Por eso un usuario **nunca** puede ver ni
modificar registros de otro: para él no existen y recibe **404**.

**En la tabla** (`records.html`) cada fila muestra un checkbox, el título (clic para ver el
detalle), la descripción, el estado como etiqueta de color, la fecha de creación y los botones
Editar y Eliminar. Hay además un estado de carga (spinner) y un estado vacío ("No hay
registros"). En pantallas pequeñas la tabla se convierte en tarjetas gracias al CSS
(`td[data-label]`).

### 2.2 Filtros

| Parámetro | Efecto | Validación |
| --- | --- | --- |
| `q` | Busca en título **o** descripción (`LIKE %texto%`) | texto, máx. 255 |
| `status` | Estado exacto | `pending`, `active` o `archived` |
| `from` | Creados desde esa fecha | `AAAA-MM-DD` |
| `to` | Creados hasta esa fecha | `AAAA-MM-DD`, no anterior a `from` |

Las reglas están en [RecordFilterRequest](../backend/app/Http/Requests/RecordFilterRequest.php) y
la consulta en el **scope** del modelo:

```php
public function scopeFilter(Builder $query, array $filters): Builder
{
    return $query
        ->when($filters['q'] ?? null, function (Builder $query, string $search) {
            $query->where(function (Builder $query) use ($search) {
                $query->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        })
        ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
        ->when($filters['from'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '>=', $date))
        ->when($filters['to'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '<=', $date));
}
```

- `when()` solo añade la condición si el filtro tiene valor.
- La búsqueda de texto va dentro de un `where(function ...)` para que el `OR` quede entre
  paréntesis: `user_id = 1 AND (title LIKE ... OR description LIKE ...)`. Sin paréntesis, el `OR`
  podría devolver registros de otros usuarios.
- Eloquent usa *bindings* (parámetros preparados), así que el texto buscado no puede inyectar SQL.

**En el frontend** hay dos copias de los filtros:

- `filters`: lo que el usuario está escribiendo en el formulario.
- `applied`: lo que se envió al pulsar "Filtrar".

La paginación y las acciones masivas usan siempre `applied`. Así, escribir en el buscador sin
pulsar "Filtrar" no altera lo que ya se muestra. Al aplicar filtros se vuelve a la página 1 y se
limpia la selección.

### 2.3 Paginación

```php
$page = $this->records()
    ->filter($filters)
    ->latest('id')
    ->paginate($filters['perPage'] ?? 10);
```

`paginate()` ejecuta dos consultas: un `COUNT(*)` para el total y un `LIMIT/OFFSET` para la
página. **Los filtros se aplican antes de paginar**, así que el total y las páginas corresponden
solo a los resultados filtrados.

Respuesta:

```json
{
  "data": [ { "id": 24, "title": "...", "status": "active", "createdAt": "..." } ],
  "meta": { "page": 1, "lastPage": 3, "perPage": 10, "total": 24, "from": 1, "to": 10 }
}
```

En el frontend:

- Selector "Por página" (10, 25 o 50) y botones Anterior / Siguiente, que se deshabilitan en la
  primera y última página.
- Si al eliminar registros la página actual queda fuera de rango, `load()` retrocede
  automáticamente a la última página válida.
- `load()` cancela la petición anterior antes de lanzar otra (`request?.unsubscribe()`), así una
  respuesta lenta no pisa una más reciente.

### 2.4 CRUD

| Operación | Endpoint | Controlador | Respuesta |
| --- | --- | --- | --- |
| Crear | `POST /api/records` | `store` | **201** + registro |
| Leer | `GET /api/records/{id}` | `show` | **200** + registro |
| Actualizar | `PUT /api/records/{id}` | `update` | **200** + registro |
| Eliminar | `DELETE /api/records/{id}` | `destroy` | **204** sin contenido |

- Las rutas salen de `Route::apiResource('records', ...)`, con `whereNumber('id')` para que solo
  acepten ids numéricos.
- Crear y actualizar usan [RecordRequest](../backend/app/Http/Requests/RecordRequest.php):
  `title` obligatorio (máx. 255), `description` opcional (máx. 10 000) y `status` dentro de
  `Record::STATUSES`.
- `store` crea con `user()->records()->create(...)`, que asigna `user_id` automáticamente. El
  cliente no puede elegir el dueño.
- `$fillable = ['title', 'description', 'status']` impide asignar otros campos (protección contra
  *mass assignment*).
- `show`, `update` y `destroy` usan `findRecord($id)`, que busca dentro de `records()`: si el id
  es de otro usuario, responde **404**.

**En el frontend** un solo `<dialog>` sirve para tres modos (`mode`):

| Modo | Se abre con | Comportamiento |
| --- | --- | --- |
| `create` | "+ Nuevo registro" | Formulario vacío |
| `edit` | "Editar" | Formulario con los datos de la fila |
| `view` | Clic en el título | Campos de solo lectura, sin botón Guardar |

Eliminar pide confirmación con `window.confirm`. Después de cada operación se muestra un aviso
("Registro creado", "Registro eliminado"...) y se recarga el listado.

**Pruebas**: R1 (CRUD), R2 (filtros y paginación), R3 (validaciones) y R4 (registros ajenos) en
[backend/tests/e2e/api/records.ts](../backend/tests/e2e/api/records.ts); U3 en
[backend/tests/e2e/ui/records.ts](../backend/tests/e2e/ui/records.ts).

---

## 3. Acciones masivas

### 3.1 Selección individual y múltiple

El estado vive en signals de `records.ts`:

```ts
readonly allSelected = signal(false);          // ¿modo "todos"?
readonly selected = signal(new Set<number>()); // modo manual: ids marcados
readonly excluded = signal(new Set<number>()); // modo todos: ids desmarcados
```

- Se usa `Set` porque añadir, quitar y comprobar un id es inmediato.
- Cada checkbox de fila llama a `toggle(id)`:

```ts
toggle(id: number): void {
  // En modo "todos", desmarcar significa excluir.
  const target = this.allSelected() ? this.excluded : this.selected;
  const ids = new Set(target());

  if (ids.has(id)) {
    ids.delete(id);
  } else {
    ids.add(id);
  }

  target.set(ids);
}
```

- Se crea un `Set` **nuevo** en lugar de modificar el existente porque un signal solo avisa del
  cambio cuando recibe un objeto distinto.
- La selección se mantiene al cambiar de página, así que se pueden marcar filas de varias
  páginas (selección múltiple).
- Las filas marcadas se resaltan (`selected-row`).

**Checkbox de la cabecera**: marca o desmarca todas las filas **de la página visible**
(`togglePage()`). Tiene tres estados:

| Estado | Cuándo |
| --- | --- |
| Marcado | `pageSelected()`: todas las filas visibles están seleccionadas |
| Indeterminado (–) | `pagePartial()`: solo algunas |
| Vacío | Ninguna |

### 3.2 Seleccionar todos

Cuando toda la página está marcada y hay más resultados que filas visibles, aparece el botón
**"Seleccionar los N resultados"**:

```ts
selectAll(): void {
  this.allSelected.set(true);
  this.selected.set(new Set());
  this.excluded.set(new Set());
}
```

En lugar de descargar y guardar miles de ids, se cambia de modo:

| | Modo manual | Modo todos |
| --- | --- | --- |
| Se guarda | ids **marcados** | ids **desmarcados** |
| ¿Está seleccionada una fila? | `selected.has(id)` | `!excluded.has(id)` |
| Cantidad | `selected.size` | `total - excluded.size` |
| Se envía | `{ all: false, ids }` | `{ all: true, exceptIds, filters }` |

Ejemplo con 120 resultados y 10 por página:

1. Clic en el checkbox de la cabecera → 10 seleccionados (manual).
2. Clic en "Seleccionar los 120 resultados" → 120 seleccionados (todos).
3. Desmarcar una fila → se añade a `excluded` → 119 seleccionados.
4. "Aplicar" envía solo los filtros y un id excluido, no 119 ids.

`selectionCount` es un `computed`: se recalcula solo cuando cambia alguno de los signals de los
que depende, y alimenta la barra de acciones y la tarjeta "Seleccionados".

### 3.3 Ejecución de una acción sobre varios registros

**Frontend**: la barra de acciones masivas aparece cuando hay al menos un seleccionado. Se elige
la acción, se pulsa "Aplicar" y se pide confirmación (con aviso extra si es eliminar):

```ts
const selection: Selection = this.allSelected()
  ? { all: true, exceptIds: [...this.excluded()] }
  : { all: false, ids: [...this.selected()] };

this.api.bulk(this.bulkAction, selection, this.applied)
```

El tipo `Selection` (en `records-service.ts`) obliga a enviar `ids` **o** `exceptIds` según el
modo; TypeScript no permite mezclarlos.

**Backend**: `POST /api/records/bulk`.

| Acción | Efecto |
| --- | --- |
| `activate` | `status = active` |
| `pending` | `status = pending` |
| `archive` | `status = archived` |
| `delete` | Elimina los registros |

Validación en [BulkRecordRequest](../backend/app/Http/Requests/BulkRecordRequest.php):

- `action` debe ser una de las cuatro.
- `ids` es obligatorio salvo que `all` sea `true` (`required_unless:all,true`). Máximo 1000 ids,
  enteros y sin repetir.
- `filters` reutiliza las mismas reglas que el listado (`RecordFilterRequest::filterRules`).

```php
public function bulk(BulkRecordRequest $request): JsonResponse
{
    $data = $request->validated();
    $query = $this->records()->filter($data['filters'] ?? []);

    if ($data['all'] ?? false) {
        $query->whereNotIn('id', $data['exceptIds'] ?? []);
    } else {
        $query->whereIn('id', $data['ids']);

        // Si algún id no existe o es de otro usuario, se rechaza toda la operación.
        abort_unless((clone $query)->count() === count($data['ids']), 404, 'Selección inválida.');
    }

    $status = BulkRecordRequest::ACTIONS[$data['action']];

    $affected = DB::transaction(fn () => $status === null
        ? $query->delete()
        : $query->update(['status' => $status, 'updated_at' => now()]));

    return response()->json(['message' => 'Acción completada.', 'affected' => $affected]);
}
```

Puntos clave:

1. **Siempre parte de `records()`**: aunque se envíe `all: true`, solo afecta a registros del
   usuario autenticado.
2. **Modo todos**: el backend vuelve a aplicar los mismos filtros que ve el usuario y descarta
   los excluidos. El resultado coincide con lo que se mostraba.
3. **Modo manual, todo o nada**: si de 5 ids uno no existe o es ajeno, el conteo no coincide y se
   responde **404** sin modificar nada.
4. **Una sola consulta**: `UPDATE ... WHERE ...` o `DELETE ... WHERE ...` afecta a todas las filas
   a la vez, en lugar de recorrerlas una por una.
5. **Transacción**: si algo falla a mitad, MySQL deshace todo.
6. La respuesta indica cuántos registros se modificaron (`affected`), y la interfaz lo muestra:
   "Acción completada: 11 registro(s) afectados".

**Pruebas**: M1 (selección de ids), M2 (todos con filtros y exclusiones) y M3 (eliminar en lote)
en [backend/tests/e2e/api/bulk.ts](../backend/tests/e2e/api/bulk.ts); U2 (flujo completo en el
navegador: página → todos → excluir uno → aplicar) en
[backend/tests/e2e/ui/records.ts](../backend/tests/e2e/ui/records.ts).

---

## Resumen: requerimiento → archivos → prueba

| Requerimiento | Backend | Frontend | Prueba |
| --- | --- | --- | --- |
| Endpoints login, me, logout | `AuthController`, `LoginRequest`, `UserResource` | `auth-service.ts`, `auth-interceptor.ts` | A1, A2, A3 |
| Vistas Login y perfil | — | `pages/login`, `pages/profile`, `auth-guard.ts` | U1 |
| Botón de logout | `logout()` + lista negra en Redis | `app.html`, `app.ts` | A3, U1 |
| Base de datos | Migraciones, `User`, `Record`, seeders | — | todas |
| Tabla con listado | `RecordController@index`, `RecordResource` | `pages/records` | R2, U3 |
| Filtros | `RecordFilterRequest`, `Record::scopeFilter` | `filters` / `applied` | R2, R3 |
| Paginación | `paginate()` + `meta` | Selector por página, Anterior / Siguiente | R2 |
| CRUD | `store`, `show`, `update`, `destroy`, `RecordRequest` | `<dialog>` con 3 modos | R1, R3, R4, U3 |
| Selección individual y múltiple | — | `selected`, `toggle()`, `togglePage()` | U2 |
| Seleccionar todos | `all` + `exceptIds` + `filters` | `allSelected`, `excluded`, `selectAll()` | M2, U2 |
| Acción sobre varios registros | `RecordController@bulk`, `BulkRecordRequest` | `runBulk()`, barra de acciones | M1, M2, M3, U2 |
