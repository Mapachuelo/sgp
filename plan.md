# Plan de Desarrollo — SGP (Sistema de Gestion de Peluqueria)

## Stack tecnologico

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Frontend | React + Vite + JavaScript | 19 / 6 |
| UI | shadcn/ui + Tailwind CSS | latest |
| Ruteo | react-router-dom | latest |
| Backend | Node.js + Express (CommonJS) | 22 / 4 |
| BD | PostgreSQL Alpine | 17 |
| BD driver | pg (raw SQL, sin ORM) | latest |
| Auth | JWT (jsonwebtoken) + bcryptjs + AES-256 (crypto) + helmet | latest |
| QR | qrcode | latest |
| Realtime | WebSocket (ws) | latest |
| Logs | Pino (logs.txt + errores.txt) | latest |
| Lint | ESLint + Prettier | latest |
| Mapas | Leaflet + react-leaflet | latest |
| Monorepo | pnpm workspaces | 10 |
| Contenedores | Podman + podman-compose | latest |
| Seguridad | HTTPS (Nginx reverse proxy + Let's Encrypt) | latest |

## Convencion de idioma en codigo

- Archivos, rutas API, tablas BD, variables: **espanol** (`empleado`, `ubicacion`, `reserva`, `cobro`)
- Roles: `cliente`, `empleado`, `admin`
- Sin TypeScript. Sin comentarios a menos que se pidan.

---

## Roles y permisos

### Cliente
| Puede | No puede |
|-------|----------|
| Registrarse | Validar QR |
| Login | Registrar cobros |
| Reservar cita (max 5 activas) | Ver reportes |
| Ver panel kanban de sus reservas | Gestionar empleados |
| Cancelar reservas | Configurar servicios/horarios |
| Descargar QR | Ver reservas de otros |
| Editar perfil | Bloquear clientes |
| Eliminar cuenta | Acceder a portales empleado/admin |
| Ver mapa de sede en panel kanban | |

### Empleado
| Puede | No puede |
|-------|----------|
| Login | Registrarse |
| Ver dashboard con citas del dia | Ver reportes |
| Validar QR y cobrar en efectivo (en un solo paso) | CRUD empleados |
| Ver mapa de sede donde trabaja hoy | CRUD servicios |
| Autogestionar disponibilidad semanal por sede | CRUD ubicaciones |
| Editar perfil | Configurar horarios globales |
| | Bloquear clientes |
| | Acceder a portal admin |

### Administrador
| Puede | No puede |
|-------|----------|
| Todo lo del empleado | Registrarse |
| CRUD empleados | — (acceso total) |
| CRUD servicios | |
| CRUD ubicaciones (con lat/lng) | |
| Configurar horarios globales por sede | |
| Ver reportes (ventas, ocupacion, recurrencia) | |
| Moderar clientes (bloquear/eliminar) | |
| Ver todas las reservas | |
| Ver gestor de logs (logs.txt, errores.txt) | |

---

## Estructura del proyecto

```
sgp/
├── pnpm-workspace.yaml
├── package.json              # Root: scripts dev, build, start
├── podman-compose.yml        # 3 servicios: db, backend, frontend
├── Containerfile             # Backend (Node 22 Alpine + pnpm)
├── Containerfile.nginx       # Frontend (Nginx Alpine)
├── Makefile                  # podman-compose shortcuts
├── .env.example
├── .gitignore
├── .containerignore
├── plan.md                   # Este archivo
├── README.md
├── .agents/
│   ├── notes/
│   │   └── memory.md
│   └── skills/
│       ├── contexto.md
│       └── architecture.md
├── docs/
│   ├── ieee830/
│   │   └── formato_ieee830.md
│   ├── requisitos/
│   │   └── historias_usuario.md
│   ├── tecnicos/
│   │   ├── ficha_tecnica.md
│   │   ├── manual_tecnico.md
│   │   └── despliegue.md
│   └── usuario/
│       └── manual_usuario.md
├── db/
│   └── init.sql
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── app.jsx
│       ├── index.css
│       ├── api/
│       │   └── cliente.js
│       ├── contexto/
│       │   └── auth-context.jsx
│       ├── hooks/
│       │   └── use-auth.js
│       ├── componentes/
│       │   ├── ui/             # shadcn/ui (Button, Card, Input, Dialog, Sheet, Select, Table...)
│       │   ├── ruta-protegida.jsx
│       │   └── layout.jsx
│       ├── funcionalidades/
│       │   ├── auth/
│       │   │   ├── login-page.jsx
│       │   │   └── registro-page.jsx
│       │   ├── cliente/
│       │   │   ├── cliente-dashboard.jsx
│       │   │   ├── nueva-reserva.jsx
│       │   │   ├── mis-reservas.jsx (kanban + mapa)
│       │   │   └── mi-perfil.jsx
│       │   ├── empleado/
│       │   │   ├── empleado-dashboard.jsx
│       │   │   ├── validar-qr.jsx (incluye cobro en efectivo)
│       │   │   ├── mi-disponibilidad.jsx (calendario semanal por sede)
│       │   │   └── mi-perfil.jsx
│       │   └── admin/
│       │       ├── admin-dashboard.jsx
│       │       ├── gestion-empleados.jsx
│       │       ├── gestion-servicios.jsx
│       │       ├── gestion-ubicaciones.jsx
│       │       ├── configurar-horarios.jsx
│       │       ├── reportes-page.jsx
│       │       ├── moderar-clientes.jsx
│       │       └── gestor-logs.jsx
│       └── lib/
│           └── utils.js
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── app.js
│       ├── config/
│       │   ├── env.js
│       │   ├── db.js
│       │   └── database-init.js
│       ├── features/
│       │   ├── auth/
│       │   │   ├── auth.routes.js
│       │   │   ├── auth.controller.js
│       │   │   ├── auth.service.js
│       │   │   └── auth.model.js
│       │   ├── clientes/
│       │   │   ├── clientes.routes.js
│       │   │   ├── clientes.controller.js
│       │   │   ├── clientes.service.js
│       │   │   └── clientes.model.js
│       │   ├── reservas/
│       │   │   ├── reservas.routes.js
│       │   │   ├── reservas.controller.js
│       │   │   ├── reservas.service.js
│       │   │   └── reservas.model.js
│       │   ├── checkin/
│       │   │   ├── checkin.routes.js
│       │   │   ├── checkin.controller.js
│       │   │   ├── checkin.service.js
│       │   │   └── checkin.model.js
│       │   ├── reportes/
│       │   │   ├── reportes.routes.js
│       │   │   ├── reportes.controller.js
│       │   │   ├── reportes.service.js
│       │   │   └── reportes.model.js
│       │   ├── ubicaciones/
│       │   │   ├── ubicaciones.routes.js
│       │   │   ├── ubicaciones.controller.js
│       │   │   ├── ubicaciones.service.js
│       │   │   └── ubicaciones.model.js
│       │   ├── disponibilidad/
│       │   │   ├── disponibilidad.routes.js
│       │   │   ├── disponibilidad.controller.js
│       │   │   ├── disponibilidad.service.js
│       │   │   └── disponibilidad.model.js
│       │   └── logs/
│       │       ├── logs.routes.js
│       │       ├── logs.controller.js
│       │       └── logs.service.js
│       │   └── preferencias/
│       │       ├── preferencias.routes.js
│       │       ├── preferencias.controller.js
│       │       ├── preferencias.service.js
│       │       └── preferencias.model.js
│       ├── integrations/
│       │   └── realtime/
│       │       └── ws-hub.js
│       ├── routes/
│       │   └── api.routes.js
│       └── shared/
│           ├── async-handler.js
│           ├── http-error.js
│           ├── logger.js
│           └── middlewares/
│               ├── auth.middleware.js
│               ├── error.middleware.js
│               ├── notFound.middleware.js
│               └── rateLimit.middleware.js
```

---

## Esquema de base de datos (db/init.sql)

### Tablas

| Tabla | Proposito | Columnas clave |
|-------|-----------|----------------|
| `ubicacion` | Sedes fisicas | `id`, `nombre`, `direccion`, `latitud`, `longitud` |
| `app_user` | Usuarios y roles | `id`, `email` (UNIQUE), `password_hash`, `rol` (`cliente`/`empleado`/`admin`), `nombre`, `apellido`, `telefono` (+57 CHECK), `esta_bloqueado`, `motivo_bloqueo`, `bloqueado_por`, `bloqueado_en` |
| `empleado_perfil` | Datos extra empleados/admin | `usuario_id` (FK), `identificacion`, `password_asignada_hash`, `ubicacion_base_id` (FK) |
| `servicio_catalogo` | Servicios ofrecidos | `id`, `nombre`, `descripcion`, `precio_base`, `duracion_base_minutos` |
| `empleado_tiempo_servicio` | Duracion por empleado/servicio | `empleado_id`, `servicio_id`, `duracion_minutos` |
| `jornada` | Horario global por sede y fecha | `id`, `ubicacion_id`, `fecha`, `hora_inicio`, `hora_fin` |
| `empleado_disponibilidad` | Disponibilidad semanal por empleado/sede | `id`, `empleado_id` (FK), `ubicacion_id` (FK), `dia_semana` (1-7), `hora_inicio`, `hora_fin`, UNIQUE(empleado_id, ubicacion_id, dia_semana) |
| `reserva` | Citas | `id`, `cliente_id` (FK), `empleado_id` (FK), `servicio_id` (FK), `ubicacion_id` (FK), `inicia_en`, `termina_en`, `cantidad_personas` (1-5), `estado` (`pendiente`/`confirmada`/`en_curso`/`cobrado`/`cancelada`), `qr_token` (UUID), `qr_data_url`, `motivo_cancelacion` |
| `cobro` | Pagos (registrado en check-in o en reserva online) | `id`, `reserva_id` (FK UNIQUE), `monto`, `metodo` (`fisico`/`online`), `cobrado_en`, `registrado_por` (FK) |
| `preferencia_usuario` | Configuracion por usuario | `id`, `usuario_id` (FK UNIQUE), `rango_hora_desde` TIME DEFAULT '06:00', `rango_hora_hasta` TIME DEFAULT '22:00', `granularidad_calendario` INT DEFAULT 30, `tema` VARCHAR(10) DEFAULT 'claro' |

### Indices
- `reserva`: `inicia_en`, `cliente_id`, `empleado_id`, `estado`, `ubicacion_id`
- `cobro`: `cobrado_en`
- `app_user`: compuesto `(rol, esta_bloqueado)`

### Seed data
- Admin: `admin@sgp.local` / `admin123`
- Empleado demo: `empleado@sgp.local` / `empleado123`
- Ubicacion demo: Sede Centro (Calle 123 #45-67, Bogota)
- Servicios demo: Corte clasico ($25.000, 30min), Barba ($15.000, 20min), Tinte ($60.000, 90min), Corte + Barba ($35.000, 45min)
- Jornada demo: L-V 09:00-18:00, S 09:00-14:00

---

## Fases de desarrollo

### Fase 0 — Infraestructura base
- [ ] `pnpm-workspace.yaml`
- [ ] Root `package.json` (scripts: dev, build, start, test)
- [ ] `backend/package.json` con dependencias
- [ ] `frontend/` scaffold con Vite + React + Tailwind + shadcn/ui
- [ ] `Containerfile` (backend) y `Containerfile.nginx` (frontend)
- [ ] `podman-compose.yml` (db, backend, frontend)
- [ ] `Makefile` (up, down, build, logs)
- [ ] `.env.example`, `.gitignore`, `.containerignore`
- [ ] `.eslintrc.cjs` y `.prettierrc` (frontend + backend)
- [ ] `.agents/skills/architecture.md`

### Fase 1 — Base de datos
- [ ] `db/init.sql` con esquema completo + seed data

### Fase 2 — Backend: nucleo compartido
- [ ] `server.js` (entry point, HTTP + WebSocket)
- [ ] `app.js` (Express, CORS, middlewares globales)
- [ ] `config/env.js` + `config/db.js` + `config/database-init.js`
- [ ] `shared/` (asyncHandler, httpError, logger Pino con logs.txt + errores.txt)
- [ ] Middlewares (auth, error, notFound, rateLimit)
- [ ] `routes/api.routes.js` + healthcheck

### Fase 3 — Backend: Auth (RF0, RF1)
- [ ] `POST /api/auth/register` (solo rol cliente)
- [ ] `POST /api/auth/login` (login unificado, redirige por rol)
- [ ] `GET /api/auth/me`
- [ ] JWT middleware (authenticate + authorize)
- [ ] `shared/utils/encriptacion.js` (AES-256 para datos sensibles)

### Fase 4 — Backend: Features del negocio (RF2-RF12)

**4.1 Clientes (`/api/clientes`)**
- `GET /api/clientes/me`, `PUT /api/clientes/me`, `DELETE /api/clientes/me`
- `GET /api/clientes` (admin)
- `PUT /api/clientes/:id/bloquear`, `PUT /api/clientes/:id/desbloquear` (admin)
- `DELETE /api/clientes/:id` (admin, regla no-show)

**4.2 Ubicaciones (`/api/ubicaciones`)**
- `GET /api/ubicaciones`, `POST /api/ubicaciones` (admin)
- `PUT /api/ubicaciones/:id`, `DELETE /api/ubicaciones/:id` (admin)

**4.3 Reservas (`/api/reservas`)**
- `GET /api/reservas/servicios` (publico)
- `POST|PUT|DELETE /api/reservas/servicios/:id` (admin)
- `GET /api/reservas/disponibilidad?fecha=&empleado_id=&ubicacion_id=&desde=&hasta=&granularidad=`
- `GET|PUT /api/reservas/jornada` (horario global, admin)
- `GET|PUT /api/reservas/empleado-tiempos-servicio` (admin)
- `POST /api/reservas` (cliente, max 5 activas)
- `GET /api/reservas/me` (cliente)
- `DELETE /api/reservas/me/:id` (cliente)
- `GET /api/reservas` (empleado/admin, filtrable)

**4.4 Checkin y Cobro (`/api/checkin`)**
- `POST /api/checkin/validar` (empleado/admin, ventana +-120 min, incluye cobro en efectivo)
- El endpoint recibe: `{ qr_token, monto }`. Valida QR, registra check-in y cobro en una sola operacion atomica.
- Si el cliente ya pago online, el campo `monto` es 0 y `metodo` queda como `online` (ya registrado en la reserva).
- Si el cliente paga en efectivo, `metodo` = `fisico` y `monto` > 0.

**4.5 Reportes (`/api/reportes`)**
- `GET /api/reportes/ventas-diarias?fecha=` (admin)
- `GET /api/reportes/ocupacion?fecha=` (admin)
- `GET /api/reportes/clientes-recurrentes` (admin)

**4.6 Auth admin — Gestion de empleados (RF7)**
- `GET /api/auth/empleados` (admin)
- `POST /api/auth/empleados` (admin)
- `PUT /api/auth/empleados/:id` (admin)
- `DELETE /api/auth/empleados/:id` (admin)

**4.7 Disponibilidad del empleado (RF9)**
- `GET|PUT /api/empleados/disponibilidad` (empleado gestiona su semana)
- Al cambiar sede, cancelar reservas futuras en sede anterior

**4.8 Logs (RF12)**
- `GET /api/logs/actividad?filtro=&fecha=&severidad=` (admin)
- `GET /api/logs/errores?filtro=&fecha=&severidad=` (admin)
- `GET /api/logs/exportar?tipo=&desde=&hasta=` (admin)

**4.9 Preferencias de usuario**
- `GET /api/preferencias` (autenticado, obtiene preferencias del usuario)
- `PUT /api/preferencias` (autenticado, actualiza rango horario, granularidad, tema)
- Rango horario por defecto: 06:00-22:00. El usuario puede ajustarlo (ej. 12:00-18:00) y se persiste en `preferencia_usuario`.
- La granularidad por defecto es 30 min. Se guarda por usuario.

### Fase 5 — Frontend: Setup y navegacion
- [ ] Vite + React + Tailwind + shadcn/ui inicializado
- [ ] Router (`app.jsx`): `/login`, `/register`, `/cliente/*`, `/empleado/*`, `/admin/*`
- [ ] `api/cliente.js` (fetch wrapper con JWT)
- [ ] `auth-context.jsx` + `use-auth.js`
- [ ] `ruta-protegida.jsx` + `layout.jsx`
- [ ] Componentes shadcn/ui base (Button, Card, Input, Dialog, Sheet, Select, Table, Calendar, Badge, toast/useToast)

### Fase 6 — Frontend: Cliente
- [ ] `login-page.jsx` (formulario unificado, redireccion por rol)
- [ ] `registro-page.jsx` (nombre, apellido, +57, correo, password)
- [ ] `cliente-dashboard.jsx`
- [ ] `nueva-reserva.jsx` (stepper 5 pasos: ubicacion → empleado → calendario con modal de servicio → confirmar con QR → pago online o efectivo)
- [ ] `mis-reservas.jsx` (kanban por columnas de estado + mapa lateral Leaflet)
- [ ] `mi-perfil.jsx`

### Fase 7 — Frontend: Empleado
- [ ] `empleado-dashboard.jsx` (timeline de citas del dia + mapa sede + KPIs)
- [ ] `validar-qr.jsx` (modal: camara + input manual + cobro en efectivo en un solo paso)
- [ ] `mi-disponibilidad.jsx` (calendario semanal por sede con granularidad 5/10/15/30/60min y bloqueos de horario)
- [ ] `mi-perfil.jsx`

### Fase 8 — Frontend: Administrador
- [ ] `admin-dashboard.jsx` (4 KPIs + timeline todas las sedes + 8 botones)
- [ ] Ventanas flotantes (sheets laterales):
  - `gestion-empleados.jsx` (tabla CRUD)
  - `gestion-servicios.jsx` (tabla CRUD + tiempos por empleado)
  - `gestion-ubicaciones.jsx` (tabla CRUD con mapa Leaflet para coordenadas)
  - `configurar-horarios.jsx` (sede + dias + horas)
  - `reportes-page.jsx` (tabs: ventas, ocupacion, recurrentes)
  - `moderar-clientes.jsx` (tabla con toggle bloquear/desbloquear)
  - `gestor-logs.jsx` (dos tabs: logs.txt / errores.txt, con busqueda, filtro, exportar)
- [ ] Modales chicos: validar-qr (incluye cobro en efectivo)

### Fase 9 — Tiempo real
- [ ] `ws-hub.js` emite `disponibilidad.actualizada` al cambiar reservas
- [ ] Frontend: `use-websocket.js` hook, integrado en `nueva-reserva.jsx` y dashboards

### Fase 10 — Pruebas y pulido
- [ ] Script `tests/api.sh` (pruebas de integracion bash + curl)
- [ ] Responsividad mobile/tablet/desktop
- [ ] WCAG 2.1 AA (contraste, teclado)
- [ ] `podman-compose up --build -d` funcional

---

## API endpoints completo

| Metodo | Ruta | Rol | RF |
|--------|------|-----|-----|
| `POST` | `/api/auth/register` | Publico | RF1 |
| `POST` | `/api/auth/login` | Publico | RF0 |
| `GET` | `/api/auth/me` | Autenticado | RF0 |
| `GET` | `/api/auth/empleados` | Admin | RF7 |
| `POST` | `/api/auth/empleados` | Admin | RF7 |
| `PUT` | `/api/auth/empleados/:id` | Admin | RF7 |
| `DELETE` | `/api/auth/empleados/:id` | Admin | RF7 |
| `GET` | `/api/clientes/me` | Cliente | RF1 |
| `PUT` | `/api/clientes/me` | Cliente | RF1 |
| `DELETE` | `/api/clientes/me` | Cliente | RF1 |
| `GET` | `/api/clientes` | Admin | RF1 |
| `PUT` | `/api/clientes/:id/bloquear` | Admin | RF11 |
| `PUT` | `/api/clientes/:id/desbloquear` | Admin | RF11 |
| `DELETE` | `/api/clientes/:id` | Admin | RF11 |
| `GET` | `/api/ubicaciones` | Publico | RF6 |
| `POST` | `/api/ubicaciones` | Admin | RF6 |
| `PUT` | `/api/ubicaciones/:id` | Admin | RF6 |
| `DELETE` | `/api/ubicaciones/:id` | Admin | RF6 |
| `GET` | `/api/reservas/servicios` | Publico | RF2 |
| `POST` | `/api/reservas/servicios` | Admin | RF2 |
| `PUT` | `/api/reservas/servicios/:id` | Admin | RF2 |
| `DELETE` | `/api/reservas/servicios/:id` | Admin | RF2 |
| `GET` | `/api/reservas/disponibilidad` | Publico | RF2 |
| `GET` | `/api/reservas/disponibilidad?desde=&hasta=&granularidad=` | Publico | RF2 |
| `GET` | `/api/reservas/jornada` | Publico | RF6 |
| `PUT` | `/api/reservas/jornada` | Admin | RF6 |
| `GET` | `/api/reservas/empleado-tiempos-servicio` | Admin | RF2 |
| `PUT` | `/api/reservas/empleado-tiempos-servicio` | Admin | RF2 |
| `POST` | `/api/reservas` | Cliente | RF2 |
| `GET` | `/api/reservas/me` | Cliente | RF8 |
| `DELETE` | `/api/reservas/me/:id` | Cliente | RF8 |
| `GET` | `/api/reservas` | Empleado/Admin | RF10/11 |
| `POST` | `/api/checkin/validar` | Empleado/Admin | RF3 |
| `GET` | `/api/reportes/ventas-diarias` | Admin | RF5 |
| `GET` | `/api/reportes/ocupacion` | Admin | RF5 |
| `GET` | `/api/reportes/clientes-recurrentes` | Admin | RF5 |
| `GET` | `/api/empleados/disponibilidad` | Empleado | RF9 |
| `PUT` | `/api/empleados/disponibilidad` | Empleado | RF9 |
| `GET` | `/api/logs/actividad` | Admin | RF12 |
| `GET` | `/api/logs/errores` | Admin | RF12 |
| `GET` | `/api/logs/exportar` | Admin | RF12 |
| `GET` | `/api/preferencias` | Autenticado | RF2 |
| `PUT` | `/api/preferencias` | Autenticado | RF2 |
| `WS` | `/ws` | Publico | COM1 |

---

## Arquitectura Podman

```
podman-compose.yml
─────────────────────────────────────────────
  db:
    image: postgres:17-alpine
    healthcheck: pg_isready
    volume: pgdata:/var/lib/postgresql/data
    env: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
    network: host (o puente interna)

  backend:
    build: Containerfile (Node 22 Alpine + pnpm)
    depends_on: db (healthy)
    env: DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, PORT
    ports: 3000:3000
    network: host (o puente interna)

  frontend:
    build: Containerfile.nginx
    depends_on: backend
    ports: 80:80, 443:443
    network: host (o puente interna)
    env: incluye HTTPS con Let's Encrypt
```

---

## Variables de entorno (.env)

```
APP_PORT=3000
PORT=3000
DATABASE_URL=postgresql://sgp_user:sgp_password@localhost:5432/sgp
JWT_SECRET=sgp_super_secret
JWT_EXPIRES_IN=30m
NODE_ENV=development
VITE_API_URL=http://localhost:3000
```

---

## Reglas de seguridad

- Contrasenas hasheadas con **bcryptjs** (12 rounds)
- Datos sensibles encriptados con **AES-256-CBC** via `crypto` nativo de Node.js
- **HTTPS** obligatorio en produccion (Nginx reverse proxy + Let's Encrypt)
- Tokens JWT con expiracion (`JWT_EXPIRES_IN=30m`)
- **RBAC** con tres roles: `admin`, `empleado`, `cliente`
- Rate limiting por IP en endpoints de auth (`express-rate-limit`)
- Headers de seguridad: Helmet (`helmet`)
- CORS configurado solo para el origen del frontend

## Reglas de negocio

- Maximo **5 reservas activas** por cliente (antes era 1 por servicio)
- Anticipacion minima: **60 minutos**
- Ventana de validacion QR: **+-120 minutos** respecto a la cita
- `cantidad_personas`: entre **1 y 5**
- Cliente bloqueado no puede iniciar sesion ni reservar
- Un solo cobro por reserva
- Cambio de sede por empleado cancela reservas futuras en sede anterior
- Eliminar cliente solo si tiene **3+ no-shows**
- Eliminar empleado solo si **no tiene cobros asociados**
- Metodos de cobro: `fisico` (efectivo en el local al hacer check-in) o `online` (pagado por el cliente al reservar). El cobro fisico lo registra el empleado en el mismo paso de validacion QR.
- Estados de reserva BD: `pendiente` -> `confirmada` (pago online) -> `en_curso` (check-in) -> `cobrado`
- Estados kanban (vista cliente): `pendiente` (sin pagar), `confirmada` (pagada, sin iniciar), `en_curso`, `completada` (= cobrado), `cancelada`
- Rango horario del calendario por defecto: **06:00 a 22:00**. El usuario puede personalizarlo (ej. 12:00-18:00) y se guarda en `preferencia_usuario`.
- Granularidad de slots del calendario: **5, 10, 15, 30 o 60 minutos**. Por defecto 30 min. Configurable por usuario.
- Las preferencias de calendario (rango y granularidad) se persisten por usuario en BD.
