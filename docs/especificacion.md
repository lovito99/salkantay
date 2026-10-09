# Especificación de Salkantay

Alcance: autenticación, gestión de registros propios y acciones masivas.
Backend Laravel 12 + JWT, frontend Angular 17, MySQL y Redis.

Cada criterio tiene una prueba Playwright con el mismo código en `backend/tests/e2e`.

## Autenticación

| Código | Dado / Cuando / Entonces | Prueba |
| --- | --- | --- |
| A1 | Dado un visitante sin JWT válido, cuando llama a un endpoint protegido, entonces recibe 401. | `api/auth.ts` |
| A2 | Dadas credenciales incorrectas o vacías, cuando inicia sesión, entonces recibe 401 o 422 y ningún JWT. | `api/auth.ts` |
| A3 | Dado un usuario válido, cuando hace login, me y logout, entonces ese JWT deja de funcionar (401). | `api/auth.ts` |
| U1 | Desde la vista Login, el usuario entra, ve su perfil y cierra sesión con el botón. | `ui/auth.ts` |

## Gestión de registros

| Código | Dado / Cuando / Entonces | Prueba |
| --- | --- | --- |
| R1 | Dado un usuario, cuando crea, consulta, actualiza y elimina un registro, entonces el CRUD responde 201/200/200/204. | `api/records.ts` |
| R2 | Dados filtros de texto, estado o fechas, cuando pide el listado, entonces se filtra antes de paginar. | `api/records.ts` |
| R3 | Dados datos inválidos, cuando se envían, entonces la API responde 422 sin cambiar nada. | `api/records.ts` |
| R4 | Dado un registro ajeno, cuando otro usuario lo usa, entonces recibe 404; una selección mixta se rechaza completa. | `api/records.ts` |
| U3 | Desde la tabla, el usuario crea, busca y elimina un registro. | `ui/records.ts` |

## Acciones masivas

| Código | Dado / Cuando / Entonces | Prueba |
| --- | --- | --- |
| M1 | Dada una selección de ids, cuando aplica una acción, entonces solo cambian esos registros. | `api/bulk.ts` |
| M2 | Dado "seleccionar todos", cuando aplica una acción, entonces respeta filtros y exclusiones de todas las páginas. | `api/bulk.ts` |
| M3 | Dada una selección, cuando elimina en lote, entonces solo se borra esa selección. | `api/bulk.ts` |
| U2 | En la tabla, el usuario selecciona la página, luego todos los resultados, excluye uno y aplica la acción. | `ui/records.ts` |

## Ciclo de trabajo para cambios nuevos

1. **SDD**: escribir o ajustar el criterio en este archivo.
2. **BDD**: escribir la prueba con el mismo código y el formato Dado / Cuando / Entonces.
3. **TDD**: ejecutarla y verla fallar (rojo), implementar lo mínimo (verde) y mejorar el código sin romperla (refactor).
