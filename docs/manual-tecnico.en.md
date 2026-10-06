# Technical Manual — SGP

Hair Salon Management System. Intended for developers and operations staff.

## 1. Overview

Three-tier full-stack web application:

```
React SPA (Vite, Tailwind)  ->  Nginx :80/:8080
       |  /api, /ws (proxy)
       v
Node.js/Express :3000  (JWT + RBAC + Pino + WebSocket + Swagger)
       |
       v
PostgreSQL 17  (10 tables, raw SQL with pg)
```

Deployed with Podman: pod `sgp-db` (PostgreSQL + `sgp-pgdata` volume) and pod `sgp-app` (Nginx + backend) on the `sgp-net` network.

## 2. Repository layout

```
backend/src/config/        env, pool (withTransaction), database-init
backend/src/features/      auth, clientes, ubicaciones, reservas, checkin,
                           reportes, disponibilidad, logs, preferencias
                           (routes -> controller -> service -> model)
backend/src/integrations/  email (Brevo), realtime (ws-hub)
backend/src/shared/        logger, errors, middlewares, utils (AES, phone)
backend/src/docs/          OpenAPI 3 + Swagger UI
backend/tests/unit/        node:test unit tests
frontend/src/              app, components, context, hooks, i18n, lib
frontend/src/funcionalidades/  auth, cliente, empleado, admin/secciones
db/init.sql                schema, idempotent migrations and seeds
tests/                     api.sh, datos.sh, esquema.sh, e2e.py
scripts/generar-drawio.js  generates the .drawio diagrams
docs/                      requirements, design, mockups, data, tests, manuals
```

## 3. Local setup (development)

```bash
pnpm install
pnpm --filter backend dev     # API on :3000
pnpm --filter frontend dev    # Vite on :5173 (proxy /api -> :3000)
```

Container setup and demo data: see `docs/despliegue.md` (Spanish).

Seed accounts: `admin@sgp.local / admin123` and `empleado@sgp.local / empleado123`. Demo seed accounts: `clienteXX@demo.sgp` / `estilistaXX@demo.sgp` with `demo1234`.

## 4. Configuration

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Token signature and expiry (30m) |
| `AES_SECRET` | AES-256 key for phones (falls back to `JWT_SECRET`) |
| `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | OTP email delivery |
| `PORT` | Backend port (3000) |
| `VITE_API_URL` | CORS-allowed origin in development |

## 5. Database

- 10 tables: `ubicacion`, `app_user`, `empleado_perfil`, `servicio_catalogo`, `empleado_tiempo_servicio`, `jornada`, `empleado_disponibilidad`, `reserva`, `cobro`, `preferencia_usuario`.
- Schema and idempotent migrations in `db/init.sql`; the backend runs it on startup (`database-init.js`) and encrypts plaintext phones.
- Full data dictionary and UML mapping: `docs/modelo-datos.md` (Spanish).
- Key rules: one payment per booking (`UNIQUE`), valid states by CHECK, 1–5 people, one venue per employee per day (service-level), business dates in `America/Bogota`.

## 6. API

Interactive documentation: `http://localhost:8080/api/docs` (OpenAPI 3).

| Group | Routes |
|-------|--------|
| Auth | `/api/auth/register`, `/login`, `/verificar`, `/reenviar-codigo`, `/me`, `/empleados` CRUD |
| Customers | `/api/clientes/me`, `/api/clientes`, block/unblock/delete |
| Venues | `/api/ubicaciones` CRUD |
| Bookings | `/api/reservas` (create/list), `/me`, `/agenda`, services, shifts, availability, times |
| Check-in | `POST /api/checkin/validar` (atomic check-in + payment) |
| Reports | `/api/reportes/ventas-diarias`, `/ocupacion`, `/clientes-recurrentes` |
| Availability | `/api/empleados/disponibilidad`, `/disponibilidad/todas`, `/:id/disponibilidad` |
| Logs | `/api/logs/actividad`, `/errores`, `/exportar` |
| Preferences | `/api/preferencias` |
| Realtime | `ws://.../ws` (`conexion`, `disponibilidad.actualizada`, `reserva.actualizada`) |

Response format: `{ "ok": true, "data": ... }` or `{ "ok": false, "error": "..." }`.

## 7. Security

- bcryptjs 12 rounds; 30-minute JWT; RBAC (`cliente`, `empleado`, `admin`).
- Phone encrypted with AES-256-CBC (`shared/utils/telefono.js`).
- OTP stored as SHA-256 hash with a 5-minute registration window (`REGISTRO_TTL_MINUTOS`) and max 3 resends/15 min. Unverified registrations are purged on expiry (every 60 s and at startup), freeing the email; registering an existing unverified email replaces the record.
- Rate limiting (10 attempts/15 min on auth), Helmet, restricted CORS and parameterized SQL.
- PostgreSQL error mapping (23505/23503/23514/22P02) to 4xx responses.

## 8. Operations and maintenance

- Logs: `logs.txt` (activity) and `errores.txt` (warn+) inside the container; viewable/exportable from the admin panel.
- Updating the app: rebuild images + `kube down`/`kube play` (`docs/despliegue.md`).
- Bulk seed: `node src/utils/semillar-demo.js --reset` (idempotent; deletes only `@demo.sgp` data).
- Diagrams are regenerated with `node scripts/generar-drawio.js`.

## 9. Testing

```bash
bash tests/api.sh          # API integration
bash tests/datos.sh        # dataset integrity
bash tests/esquema.sh      # schema vs data model
pnpm run test:unit         # unit tests (backend container)
pnpm run test:coverage     # coverage (>= 80%)
python3 tests/e2e.py       # end to end
```

Results and acceptance criteria: `docs/plan-pruebas.md` (Spanish).

## 10. Troubleshooting

| Problem | Fix |
|---------|-----|
| Backend restarts with `ENOTFOUND sgp-db` | Start the DB pod first and wait for `pg_isready`. |
| `429` on auth | Rate limit active; restart the app pod. |
| OTP not sent (502) | Invalid Brevo credentials or unverified sender. |
| `/api/healthcheck` returns `"brevo":"error"` | The key is not a valid v3 API key (`xkeysib-…`); SMTP keys (`xsmtpsib-…`) do not work with the API. |
| Unreadable phone numbers | `AES_SECRET`/`JWT_SECRET` changed since the data was encrypted. |
| Camera blocked | Use `localhost` or HTTPS and grant permissions. |
