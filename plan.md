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
| Auth | JWT (jsonwebtoken) + bcryptjs | latest |
| QR | qrcode | latest |
| Realtime | WebSocket (ws) | latest |
| Logs | Pino (logs.txt + errores.txt) | latest |
| Mapas | Leaflet + react-leaflet | latest |
| Monorepo | pnpm workspaces | 10 |
| Contenedores | Podman + podman-compose | latest |

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
| Validar QR (camara + manual) | CRUD empleados |
| Registrar cobro (fisico/digital) | CRUD servicios |
| Ver mapa de sede donde trabaja hoy | CRUD ubicaciones |
| Autogestionar disponibilidad semanal por sede | Configurar horarios globales |
| Editar perfil | Bloquear clientes |
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
│   ├── formato_ieee830.md
│   ├── historias_usuario.md
│   ├── ficha_tecnica.md
│   ├── manual_tecnico.md
│   ├── manual_usuario.md
│   └── ...
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
│       ├── App.jsx
│       ├── index.css
│       ├── api/
│       │   └── cliente.js
│       ├── contexto/
│       │   └── AuthContext.jsx
│       ├── hooks/
│       │   └── useAuth.js
│       ├── componentes/
│       │   ├── ui/             # shadcn/ui (Button, Card, Input, Dialog, Sheet, Select, Table...)
│       │   ├── RutaProtegida.jsx
│       │   └── Layout.jsx
│       ├── funcionalidades/
│       │   ├── auth/
│       │   │   ├── LoginPage.jsx
│       │   │   └── RegistroPage.jsx
│       │   ├── cliente/
│       │   │   ├── ClienteDashboard.jsx
│       │   │   ├── NuevaReserva.jsx
│       │   │   ├── MisReservas.jsx (kanban + mapa)
│       │   │   └── MiPerfil.jsx
│       │   ├── empleado/
│       │   │   ├── EmpleadoDashboard.jsx
│       │   │   ├── ValidarQR.jsx
│       │   │   ├── RegistrarCobro.jsx
│       │   │   ├── MiDisponibilidad.jsx (calendario semanal por sede)
│       │   │   └── MiPerfil.jsx
│       │   └── admin/
│       │       ├── AdminDashboard.jsx
│       │       ├── GestionEmpleados.jsx
│       │       ├── GestionServicios.jsx
│       │       ├── GestionUbicaciones.jsx
│       │       ├── ConfigurarHorarios.jsx
│       │       ├── ReportesPage.jsx
│       │       ├── ModerarClientes.jsx
│       │       └── GestorLogs.jsx
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
│       │   └── databaseInit.js
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
│       │   ├── cobros/
│       │   │   ├── cobros.routes.js
│       │   │   ├── cobros.controller.js
│       │   │   ├── cobros.service.js
│       │   │   └── cobros.model.js
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
│       ├── integrations/
│       │   └── realtime/
│       │       └── wsHub.js
│       ├── routes/
│       │   └── api.routes.js
│       └── shared/
│           ├── asyncHandler.js
│           ├── httpError.js
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
| `reserva` | Citas | `id`, `cliente_id` (FK), `empleado_id` (FK), `servicio_id` (FK), `ubicacion_id` (FK), `inicia_en`, `termina_en`, `cantidad_personas` (1-5), `estado` (`pendiente`/`en_curso`/`cobrado`/`cancelada`), `qr_token` (UUID), `qr_data_url`, `motivo_cancelacion` |
| `cobro` | Pagos | `id`, `reserva_id` (FK UNIQUE), `monto`, `metodo` (`fisico`/`digital`), `cobrado_en`, `registrado_por` (FK) |

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
- [ ] `.agents/skills/architecture.md`

### Fase 1 — Base de datos
- [ ] `db/init.sql` con esquema completo + seed data

### Fase 2 — Backend: nucleo compartido
- [ ] `server.js` (entry point, HTTP + WebSocket)
- [ ] `app.js` (Express, CORS, middlewares globales)
- [ ] `config/env.js` + `config/db.js` + `config/databaseInit.js`
- [ ] `shared/` (asyncHandler, httpError, logger Pino con logs.txt + errores.txt)
- [ ] Middlewares (auth, error, notFound, rateLimit)
- [ ] `routes/api.routes.js` + healthcheck

### Fase 3 — Backend: Auth (RF0, RF1)
- [ ] `POST /api/auth/register` (solo rol cliente)
- [ ] `POST /api/auth/login` (login unificado, redirige por rol)
- [ ] `GET /api/auth/me`
- [ ] JWT middleware (authenticate + authorize)

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
- `GET /api/reservas/disponibilidad?fecha=&empleado_id=&ubicacion_id=`
- `GET|PUT /api/reservas/jornada` (horario global, admin)
- `GET|PUT /api/reservas/empleado-tiempos-servicio` (admin)
- `POST /api/reservas` (cliente, max 5 activas)
- `GET /api/reservas/me` (cliente)
- `DELETE /api/reservas/me/:id` (cliente)
- `GET /api/reservas` (empleado/admin, filtrable)

**4.4 Checkin (`/api/checkin`)**
- `POST /api/checkin/validar` (empleado/admin, ventana +-120 min)

**4.5 Cobros (`/api/cobros`)**
- `POST /api/cobros` (empleado/admin, metodo fisico/digital)

**4.6 Reportes (`/api/reportes`)**
- `GET /api/reportes/ventas-diarias?fecha=` (admin)
- `GET /api/reportes/ocupacion?fecha=` (admin)
- `GET /api/reportes/clientes-recurrentes` (admin)

**4.7 Auth admin — Gestion de empleados (RF7)**
- `GET /api/auth/empleados` (admin)
- `POST /api/auth/empleados` (admin)
- `PUT /api/auth/empleados/:id` (admin)
- `DELETE /api/auth/empleados/:id` (admin)

**4.8 Disponibilidad del empleado (RF9)**
- `GET|PUT /api/empleados/disponibilidad` (empleado gestiona su semana)
- Al cambiar sede, cancelar reservas futuras en sede anterior

**4.9 Logs (RF12)**
- `GET /api/logs/actividad?filtro=&fecha=&severidad=` (admin)
- `GET /api/logs/errores?filtro=&fecha=&severidad=` (admin)
- `GET /api/logs/exportar?tipo=&desde=&hasta=` (admin)

### Fase 5 — Frontend: Setup y navegacion
- [ ] Vite + React + Tailwind + shadcn/ui inicializado
- [ ] Router (`App.jsx`): `/login`, `/register`, `/cliente/*`, `/empleado/*`, `/admin/*`
- [ ] `api/cliente.js` (fetch wrapper con JWT)
- [ ] `AuthContext.jsx` + `useAuth.js`
- [ ] `RutaProtegida.jsx` + `Layout.jsx`
- [ ] Componentes shadcn/ui base (Button, Card, Input, Dialog, Sheet, Select, Table, Calendar, Badge, toast/useToast)

### Fase 6 — Frontend: Cliente
- [ ] `LoginPage.jsx` (formulario unificado, redireccion por rol)
- [ ] `RegistroPage.jsx` (nombre, apellido, +57, correo, password)
- [ ] `ClienteDashboard.jsx`
- [ ] `NuevaReserva.jsx` (stepper: ubicacion → empleado → calendario → ventana flotante con servicio/duracion/personas)
- [ ] `MisReservas.jsx` (kanban por columnas de estado + mapa lateral Leaflet)
- [ ] `MiPerfil.jsx`

### Fase 7 — Frontend: Empleado
- [ ] `EmpleadoDashboard.jsx` (timeline de citas del dia + mapa sede + KPIs)
- [ ] `ValidarQR.jsx` (modal: camara + input manual)
- [ ] `RegistrarCobro.jsx` (modal: monto + selector fisico/digital)
- [ ] `MiDisponibilidad.jsx` (calendario semanal con columnas por sede)
- [ ] `MiPerfil.jsx`

### Fase 8 — Frontend: Administrador
- [ ] `AdminDashboard.jsx` (4 KPIs + timeline todas las sedes + 9 botones)
- [ ] Ventanas flotantes (sheets laterales):
  - `GestionEmpleados.jsx` (tabla CRUD)
  - `GestionServicios.jsx` (tabla CRUD + tiempos por empleado)
  - `GestionUbicaciones.jsx` (tabla CRUD con mapa Leaflet para coordenadas)
  - `ConfigurarHorarios.jsx` (sede + dias + horas)
  - `ReportesPage.jsx` (tabs: ventas, ocupacion, recurrentes)
  - `ModerarClientes.jsx` (tabla con toggle bloquear/desbloquear)
  - `GestorLogs.jsx` (dos tabs: logs.txt / errores.txt, con busqueda, filtro, exportar)
- [ ] Modales chicos: ValidarQR, RegistrarCobro

### Fase 9 — Tiempo real
- [ ] `wsHub.js` emite `disponibilidad.actualizada` al cambiar reservas
- [ ] Frontend: `useWebSocket` hook, integrado en `NuevaReserva` y dashboards

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
| `GET` | `/api/reservas/jornada` | Publico | RF6 |
| `PUT` | `/api/reservas/jornada` | Admin | RF6 |
| `GET` | `/api/reservas/empleado-tiempos-servicio` | Admin | RF2 |
| `PUT` | `/api/reservas/empleado-tiempos-servicio` | Admin | RF2 |
| `POST` | `/api/reservas` | Cliente | RF2 |
| `GET` | `/api/reservas/me` | Cliente | RF8 |
| `DELETE` | `/api/reservas/me/:id` | Cliente | RF8 |
| `GET` | `/api/reservas` | Empleado/Admin | RF10/11 |
| `POST` | `/api/checkin/validar` | Empleado/Admin | RF3 |
| `POST` | `/api/cobros` | Empleado/Admin | RF4 |
| `GET` | `/api/reportes/ventas-diarias` | Admin | RF5 |
| `GET` | `/api/reportes/ocupacion` | Admin | RF5 |
| `GET` | `/api/reportes/clientes-recurrentes` | Admin | RF5 |
| `GET` | `/api/empleados/disponibilidad` | Empleado | RF9 |
| `PUT` | `/api/empleados/disponibilidad` | Empleado | RF9 |
| `GET` | `/api/logs/actividad` | Admin | RF12 |
| `GET` | `/api/logs/errores` | Admin | RF12 |
| `GET` | `/api/logs/exportar` | Admin | RF12 |
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
    ports: 8080:80
    network: host (o puente interna)
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
- Metodos de cobro: `fisico` (efectivo) o `digital` (transferencia/Nequi/Daviplata)
- Estados de reserva: `pendiente` -> `en_curso` (checkin) -> `cobrado`
- Estados de reserva kanban: `pendiente`, `confirmada`, `en_curso`, `completada`, `cancelada`
