# Memoria del proyecto — SGP

## Sesion inicial — 30 Mayo 2026

### Decisiones tomadas
- Rehacer todo el software desde cero en rama `todo/nuevo` (la rama `main` tiene codigo viejo con frontend+backend acoplados)
- Stack confirmado: React + Vite + shadcn/ui + Tailwind (frontend), Node.js + Express CommonJS (backend), PostgreSQL 17, Podman
- Monorepo con pnpm workspaces: `frontend/` y `backend/` separados
- Idioma en codigo: español (archivos, rutas, tablas, variables)
- Roles: `cliente`, `empleado`, `admin`
- Sin TypeScript. Sin ORM. Sin Docker (solo Podman)

### Cambios al IEEE 830
- `docs/formato_ieee830.md` actualizado con nuevos requisitos (12 funciones F1-F12, 13 RFs RF0-RF12)
- Cambios clave respecto al original:
  - Cliente: max 5 reservas activas, flujo ubicacion->empleado->calendario->ventana flotante
  - Cobro: fisico o digital (empleado elige metodo)
  - Nuevo: kanban + mapa lateral para cliente (RF8, F8)
  - Nuevo: disponibilidad semanal del empleado por sede (RF9, F9)
  - Nuevo: dashboard administrador con ventanas flotantes (RF11, F11)
  - Nuevo: gestor de logs.txt y errores.txt (RF12, F12)
  - Empleado NO genera reportes (solo admin)
  - Ubicaciones con coordenadas lat/lng para mapa Leaflet
  - Tablas renombradas de ingles "employee" a español "empleado"

### Estructura renombrada
- `.agent/` -> `.agents/`
- `Documentacion/` -> `docs/`
- Skill actualizada con stack tecnologico y monorepo

### Archivos creados esta sesion
- `plan.md` (plan completo de desarrollo)
- `.agents/notes/memory.md` (este archivo)
- `.agents/skills/contexto.md` (actualizado)

### Pendientes
- Iniciar Fase 0 (infraestructura: pnpm-workspace, package.json, Podman, Containerfile, db/init.sql)
- Crear `.agents/skills/architecture.md`
- Scaffold frontend (Vite + React + Tailwind + shadcn/ui)
- Crear backend base (Express + pg + JWT + Pino)
- Implementar por fases segun plan.md

### Bugs conocidos
- Ninguno (no hay codigo aun)

---

## Sesion — 1 Junio 2026

### Backend completo implementado (Fases 0-5)

#### Infraestructura
- Monorepo pnpm workspaces con `backend/` y `frontend/` (placeholder)
- Podman: 2 contenedores (`db` postgres:17-alpine + `backend` Node 22 Alpine)
- `podman-compose up -d --build` funcional
- ESLint + Prettier configurados, lint limpio (0 errores, 0 warnings)

#### Base de datos (db/init.sql)
- 10 tablas: `ubicacion`, `app_user`, `empleado_perfil`, `servicio_catalogo`, `empleado_tiempo_servicio`, `jornada`, `empleado_disponibilidad`, `reserva`, `cobro`, `preferencia_usuario`
- Indices en reserva (inicia_en, cliente_id, empleado_id, estado, ubicacion_id), cobro (cobrado_en), app_user (rol, esta_bloqueado)
- Seed: admin@sgp.local/admin123, empleado@sgp.local/empleado123, Sede Centro, 4 servicios, jornadas demo
- Inicializacion automatica con `CREATE TABLE IF NOT EXISTS` via `config/database-init.js`

#### Nucleo compartido
- `logger.js`: Pino con 2 streams → `backend/logs.txt` (info+) y `backend/errores.txt` (warn+)
- `async-handler.js`: wrapper try/catch para controladores async
- `http-error.js`: clase Error con statusCode
- `encriptacion.js`: AES-256-CBC (encriptar/desencriptar)
- Middlewares: `auth.middleware.js` (authenticate + authorize roles), `error.middleware.js`, `notFound.middleware.js`, `rateLimit.middleware.js` (10 intentos/15min)
- `app.js`: Express con helmet, CORS, JSON, middlewares, rutas
- `server.js`: http.createServer + WebSocket, listen en PORT

#### Features implementados (35+ endpoints)
- **Auth** (RF0, RF1): register (solo cliente), login unificado, /me, CRUD empleados (admin)
- **Clientes** (RF1, RF11): GET|PUT|DELETE /me, GET / (admin), bloquear/desbloquear (admin), DELETE (admin, regla 3+ no-shows)
- **Ubicaciones** (RF6): CRUD con lat/lng
- **Reservas** (RF2, RF8): CRUD servicios, disponibilidad, jornada, empleado-tiempos-servicio, POST reserva (max 5 activas, anticipacion 60min, QR code), GET /me, DELETE /me/:id, GET / (empleado/admin)
- **Checkin** (RF3): POST /validar con validacion QR, ventana +-120min, transaccion atomica (checkin + cobro)
- **Reportes** (RF5): ventas-diarias, ocupacion, clientes-recurrentes
- **Disponibilidad** (RF9): GET|PUT disponibilidad semanal empleado, cancela reservas futuras al cambiar sede
- **Logs** (RF12): GET actividad/errores/exportar con filtros
- **Preferencias**: GET|PUT rango horario, granularidad, tema por usuario

#### Tiempo real (Fase 5)
- WebSocket server en `/ws` via `ws-hub.js`
- Emite `conexion`, `disponibilidad.actualizada`, `reserva.actualizada`

#### Pruebas
- `tests/api.sh`: 38 pruebas de integracion, todas pasan (38 PASS, 0 FAIL)
- Rate limiting verificado (bloquea tras 7 intentos de login)

#### Rutas de import corregidas
- Todos los modelos usan `require('../../config/db')` (2 niveles, no 3)

### Decisiones importantes
- `.env` excluido del contenedor via `.containerignore`; variables se pasan via `environment:` en podman-compose.yml
- `db/init.sql` copiado al contenedor via `COPY db/ ./db/` en Containerfile
- PostgreSQL 17 requiere volumen limpio si habia PG16 previo
- Imagen postgres debe ser `docker.io/library/postgres:17-alpine` (fully qualified)

### Bugs conocidos
- Ninguno

### Proximos pasos (Fases 5-10 segun plan.md)
- Fase 5 ya completada (WebSocket)
- Pendiente: Frontend (React + Vite + shadcn/ui) — NO iniciar hasta que se pida
- Pendiente: Containerfile.nginx para frontend
- Pendiente: Pruebas unitarias >80% cobertura
- Pendiente: HTTPS con Nginx + Let's Encrypt
