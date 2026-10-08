# Manual técnico — SGP

Sistema de Gestión de Peluquería. Dirigido a desarrolladores y personal de operación.

## 1. Visión general

Aplicación web fullstack de tres capas:

```
React SPA (Vite, Tailwind)  ->  Nginx :80/:8080
       |  /api, /ws (proxy)
       v
Node.js/Express :3000  (JWT + RBAC + Pino + WebSocket + Swagger)
       |
       v
PostgreSQL 17  (10 tablas, SQL directo con pg)
```

Despliegue con Podman: pod `sgp-db` (PostgreSQL + volumen `sgp-pgdata`) y pod `sgp-app` (Nginx + backend) sobre la red `sgp-net`.

## 2. Estructura del repositorio

```
backend/src/config/        env, pool (withTransaction), database-init
backend/src/features/      auth, clientes, ubicaciones, reservas, checkin,
                           reportes, disponibilidad, logs, preferencias
                           (routes -> controller -> service -> model)
backend/src/integrations/  email (Brevo), realtime (ws-hub)
backend/src/shared/        logger, errores, middlewares, utils (AES, telefono)
backend/src/docs/          OpenAPI 3 + Swagger UI
backend/tests/unit/        unitarias node:test
frontend/src/              app, componentes, contexto, hooks, i18n, lib
frontend/src/funcionalidades/  auth, cliente, empleado, admin/secciones
db/init.sql                esquema, migraciones idempotentes y seeds
tests/                     api.sh, datos.sh, esquema.sh, e2e.py
scripts/generar-drawio.js  genera los diagramas .drawio
docs/                      requisitos, diseño, mockups, datos, pruebas, manuales
```

## 3. Puesta en marcha (desarrollo)

```bash
pnpm install
pnpm --filter backend dev     # API en :3000
pnpm --filter frontend dev    # Vite en :5173 (proxy /api -> :3000)
```

Desarrollo con contenedores y datos de demo: ver `docs/despliegue.md`.

Credenciales semilla: `admin@sgp.local / admin123` y `empleado@sgp.local / empleado123`. Cuentas demo del seed: `clienteXX@demo.sgp` / `estilistaXX@demo.sgp` con `demo1234`.

## 4. Configuración

Variables principales (`.env` en desarrollo; `environment` en el pod):

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Cadena de conexión PostgreSQL |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Firma y expiración del token (30m) |
| `AES_SECRET` | Llave AES-256 para teléfonos (fallback a `JWT_SECRET`) |
| `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | Envío de OTP |
| `PORT` | Puerto del backend (3000) |
| `VITE_API_URL` | Origen permitido por CORS en desarrollo |

## 5. Base de datos

- 10 tablas: `ubicacion`, `app_user`, `empleado_perfil`, `servicio_catalogo`, `empleado_tiempo_servicio`, `jornada`, `empleado_disponibilidad`, `reserva`, `cobro`, `preferencia_usuario`.
- Esquema y migraciones idempotentes en `db/init.sql`; el backend lo ejecuta al arrancar (`database-init.js`) y cifra teléfonos en claro.
- Diccionario completo y correspondencia con UML en `docs/modelo-datos.md`.
- Reglas clave: un cobro por reserva (`UNIQUE`), estados válidos por CHECK, 1–5 personas, una sede por día por empleado (validada en servicio), fechas de negocio en `America/Bogota`.

## 6. API

Documentación interactiva: `http://localhost:8080/api/docs` (OpenAPI 3).

| Grupo | Rutas |
|-------|-------|
| Auth | `/api/auth/register`, `/login`, `/verificar`, `/reenviar-codigo`, `/me`, CRUD `/empleados` |
| Clientes | `/api/clientes/me`, `/api/clientes`, bloquear/desbloquear/eliminar |
| Ubicaciones | CRUD `/api/ubicaciones` |
| Reservas | `/api/reservas` (crear/listar), `/me`, `/agenda`, servicios, jornada, disponibilidad, tiempos |
| Check-in | `POST /api/checkin/validar` (atómico check-in + cobro) |
| Reportes | `/api/reportes/ventas-diarias`, `/ocupacion`, `/clientes-recurrentes` |
| Disponibilidad | `/api/empleados/disponibilidad`, `/disponibilidad/todas`, `/:id/disponibilidad` |
| Logs | `/api/logs/actividad`, `/errores`, `/exportar` |
| Preferencias | `/api/preferencias` |
| Realtime | `ws://.../ws` (eventos `conexion`, `disponibilidad.actualizada`, `reserva.actualizada`) |

Formato de respuesta: `{ "ok": true, "data": ... }` o `{ "ok": false, "error": "..." }`.

## 7. Seguridad

- bcryptjs 12 rounds; JWT 30 minutos; RBAC (`cliente`, `empleado`, `admin`).
- Teléfono cifrado con AES-256-CBC (`shared/utils/telefono.js`).
- OTP como hash SHA-256 con tiempo de registro de 5 minutos (`REGISTRO_TTL_MINUTOS`) y máximo 3 reenvíos/15 min. Un registro sin verificar se purga al expirar (cada 60 s y al arrancar) liberando el correo; si el correo ya existe sin verificar, el registro se reemplaza.
- Rate limiting (10 intentos/15 min en auth), Helmet, CORS restringido y SQL parametrizado.
- Manejo de errores PostgreSQL (23505/23503/23514/22P02) con respuestas 4xx.

## 8. Operación y mantenimiento

- Logs: `logs.txt` (actividad) y `errores.txt` (warn+) dentro del contenedor; visibles/exportables desde el panel admin.
- Actualizar la app: rebuild de imágenes + `kube down`/`kube play` (`docs/despliegue.md`).
- Seed masivo: `node src/utils/semillar-demo.js --reset` (idempotente; borra solo datos `@demo.sgp`).
- Los diagramas se regeneran con `node scripts/generar-drawio.js`.

## 9. Pruebas

```bash
bash tests/api.sh          # integración API
bash tests/datos.sh        # integridad del dataset
bash tests/esquema.sh      # esquema vs modelo de datos
pnpm run test:unit         # unitarias (contenedor backend)
pnpm run test:coverage     # cobertura (>= 80 %)
python3 tests/e2e.py       # extremo a extremo
```

Resultados y criterios en `docs/plan-pruebas.md`.

## 10. Solución de problemas

| Problema | Solución |
|----------|----------|
| Backend reinicia con `ENOTFOUND sgp-db` | Levantar primero el pod de BD y esperar `pg_isready`. |
| `429` en auth | Rate limit activo; reiniciar el pod de la app. |
| OTP no enviado (502) | Credenciales Brevo inválidas o remitente no verificado. |
| `/api/healthcheck` devuelve `"brevo":"error"` | La clave no es una API key v3 válida (`xkeysib-…`); las SMTP key (`xsmtpsib-…`) no sirven para la API. |
| Teléfonos ilegibles | `AES_SECRET`/`JWT_SECRET` cambiaron respecto a los datos existentes. |
| Cámara bloqueada | Usar `localhost` o HTTPS y conceder permisos. |
