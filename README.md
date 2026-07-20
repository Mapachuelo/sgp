# SGP — Sistema de Gestion de Peluqueria

Aplicacion web fullstack para la gestion operativa de peluquerias: reservas online, validacion QR, cobros, reportes y administracion. Backend Node.js + Express, frontend React + Vite, PostgreSQL 17, desplegado con Podman.

## Stack tecnologico

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 19 + Vite 6 + Tailwind CSS 4 + react-router-dom 7 |
| UI | Componentes propios estilo shadcn/ui + Leaflet (mapas) |
| Backend | Node.js 22 + Express (CommonJS) |
| BD | PostgreSQL 17 Alpine |
| BD driver | pg (raw SQL, sin ORM) |
| Auth | JWT (jsonwebtoken) + bcryptjs + AES-256-CBC (crypto) |
| QR | qrcode |
| Realtime | WebSocket (ws) |
| Logs | Pino (logs.txt + errores.txt) |
| Monorepo | pnpm workspaces |
| Contenedores | Podman (kube play, 2 pods) |
| Lint | ESLint + Prettier |

## Estructura del proyecto

```
sgp/
├── pnpm-workspace.yaml
├── package.json              # Root: scripts dev, lint, start, test
├── Containerfile             # Backend (Node 22 Alpine + pnpm)
├── Containerfile.nginx       # Frontend (Nginx Alpine)
├── nginx.conf                # Proxy reverso /api → backend, SPA fallback
├── sgp-db-pod.yaml           # Pod PostgreSQL + PVC persistente
├── sgp-app-pod.yaml          # Pod backend + frontend
├── .env / .env.example
├── db/
│   └── init.sql              # 10 tablas + seed data
├── backend/
│   └── src/
│       ├── server.js / app.js
│       ├── config/           # env, db, database-init
│       ├── features/         # auth, clientes, reservas, checkin, reportes,
│       │                       ubicaciones, disponibilidad, logs, preferencias
│       ├── integrations/realtime/ws-hub.js
│       ├── routes/api.routes.js
│       └── shared/           # logger, async-handler, http-error, middlewares, utils
├── frontend/
│   └── src/
│       ├── main.jsx / app.jsx
│       ├── api/cliente.js           # Fetch wrapper con JWT
│       ├── contexto/auth-context.jsx
│       ├── hooks/use-auth.js, use-websocket.js
│       ├── componentes/             # Layout, RutaProtegida, ui/ (Button, Input, Card, Badge, Sheet, Modal, Select, Toast)
│       └── funcionalidades/
│           ├── auth/                # login-page, registro-page
│           ├── cliente/             # dashboard, nueva-reserva (stepper 5 pasos), mi-perfil
│           ├── empleado/            # dashboard, validar-qr, mi-disponibilidad, mi-perfil
│           └── admin/               # dashboard + 9 sheets modales
└── tests/
    └── api.sh                # 38 pruebas de integracion curl
```

## Ejecucion con Podman

### Requisitos
- Podman

### Arquitectura de pods

Dos pods independientes conectados via red `sgp-net`:

| Pod | Contenido | Acceso host |
|-----|-----------|-------------|
| `sgp-db` | PostgreSQL 17 Alpine + PVC `sgp-pgdata` | Solo interno (`sgp-db:5432`) |
| `sgp-app` | Backend Node.js (:3000) + Frontend Nginx (:80) | `http://localhost:8080` |

Al eliminar el pod `sgp-app` para actualizar, la base de datos sigue corriendo en `sgp-db` y los datos persisten en el volumen.

### Levantar entorno

```bash
# 1. Build de imagenes (solo la primera vez o al cambiar codigo)
podman build -t localhost/sgp-backend:latest -f Containerfile .
podman build -t localhost/sgp-frontend:latest -f Containerfile.nginx .

# 2. Crear red compartida (una sola vez)
podman network create sgp-net

# 3. Levantar base de datos
podman kube play sgp-db-pod.yaml --network sgp-net

# 4. Levantar backend + frontend
podman kube play sgp-app-pod.yaml --network sgp-net
```

### Acceso

- **Frontend:** `http://localhost:8080`
- **API directa:** `http://localhost:3000/api`
- **Healthcheck:** `http://localhost:3000/api/healthcheck`

### Actualizar solo la app (sin tocar la base de datos)

```bash
podman build -t localhost/sgp-backend:latest -f Containerfile .
podman build -t localhost/sgp-frontend:latest -f Containerfile.nginx .
podman kube down sgp-app-pod.yaml
podman kube play sgp-app-pod.yaml --network sgp-net
```

### Detener

```bash
podman kube down sgp-app-pod.yaml
podman kube down sgp-db-pod.yaml   # los datos persisten en el volumen sgp-pgdata
```

Para eliminar tambien los datos:

```bash
podman volume rm sgp-pgdata
```

### Usuarios semilla

| Rol | Email | Password |
|-----|-------|----------|
| Admin | admin@sgp.local | admin123 |
| Empleado | empleado@sgp.local | empleado123 |

## Base de datos (10 tablas)

| Tabla | Proposito |
|-------|-----------|
| `ubicacion` | Sedes fisicas con lat/lng |
| `app_user` | Usuarios con roles: cliente, empleado, admin |
| `empleado_perfil` | Datos extra de empleados |
| `servicio_catalogo` | Catalogo de servicios |
| `empleado_tiempo_servicio` | Duracion personalizada empleado/servicio |
| `jornada` | Horario global por sede y fecha |
| `empleado_disponibilidad` | Disponibilidad semanal por empleado/sede |
| `reserva` | Citas con QR token y estados |
| `cobro` | Pagos con metodo fisico/online |
| `preferencia_usuario` | Rango horario, granularidad, tema por usuario |

Seed: Sede Centro (Bogota), 4 servicios (Corte clasico, Barba, Tinte, Corte+Barba), jornadas L-V 09-18 + S 09-14.

## API — Endpoints completos

### Auth (RF0, RF1)
| Metodo | Ruta | Rol |
|--------|------|-----|
| POST | `/api/auth/register` | Publico |
| POST | `/api/auth/login` | Publico |
| GET | `/api/auth/me` | Autenticado |
| GET | `/api/auth/empleados` | Admin |
| POST | `/api/auth/empleados` | Admin |
| PUT | `/api/auth/empleados/:id` | Admin |
| DELETE | `/api/auth/empleados/:id` | Admin |

### Clientes (RF1, RF11)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/clientes/me` | Cliente |
| PUT | `/api/clientes/me` | Cliente |
| DELETE | `/api/clientes/me` | Cliente |
| GET | `/api/clientes` | Admin |
| PUT | `/api/clientes/:id/bloquear` | Admin |
| PUT | `/api/clientes/:id/desbloquear` | Admin |
| DELETE | `/api/clientes/:id` | Admin (3+ no-shows) |

### Ubicaciones (RF6)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/ubicaciones` | Publico |
| POST | `/api/ubicaciones` | Admin |
| PUT | `/api/ubicaciones/:id` | Admin |
| DELETE | `/api/ubicaciones/:id` | Admin |

### Reservas (RF2, RF8)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/reservas/servicios` | Publico |
| POST | `/api/reservas/servicios` | Admin |
| PUT | `/api/reservas/servicios/:id` | Admin |
| DELETE | `/api/reservas/servicios/:id` | Admin |
| GET | `/api/reservas/disponibilidad` | Autenticado |
| GET | `/api/reservas/jornada` | Publico |
| PUT | `/api/reservas/jornada` | Admin |
| GET | `/api/reservas/empleado-tiempos-servicio` | Admin |
| PUT | `/api/reservas/empleado-tiempos-servicio` | Admin |
| POST | `/api/reservas` | Cliente |
| GET | `/api/reservas/me` | Cliente |
| DELETE | `/api/reservas/me/:id` | Cliente |
| GET | `/api/reservas` | Empleado/Admin |

### Checkin (RF3)
| Metodo | Ruta | Rol |
|--------|------|-----|
| POST | `/api/checkin/validar` | Empleado/Admin |

### Reportes (RF5)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/reportes/ventas-diarias` | Admin |
| GET | `/api/reportes/ocupacion` | Admin |
| GET | `/api/reportes/clientes-recurrentes` | Admin |

### Disponibilidad (RF9)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/empleados/disponibilidad` | Empleado |
| PUT | `/api/empleados/disponibilidad` | Empleado |

### Logs (RF12)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/logs/actividad` | Admin |
| GET | `/api/logs/errores` | Admin |
| GET | `/api/logs/exportar` | Admin |

### Preferencias
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/preferencias` | Autenticado |
| PUT | `/api/preferencias` | Autenticado |

### WebSocket
| Path | Evento |
|------|--------|
| `/ws` | `conexion`, `disponibilidad.actualizada`, `reserva.actualizada` |

Formato de respuesta: `{ "ok": true, "data": {...} }` o `{ "ok": false, "error": "mensaje" }`.

## Reglas de negocio

- Maximo 5 reservas activas por cliente
- Anticipacion minima: 60 minutos
- Ventana validacion QR: +-120 minutos
- Cantidad de personas: 1 a 5
- Cliente bloqueado no inicia sesion ni reserva
- Un solo cobro por reserva
- Cambio de sede cancela reservas futuras en sede anterior
- Eliminar cliente solo con 3+ no-shows
- Eliminar empleado solo sin cobros asociados
- Metodos de cobro: `fisico` (efectivo) o `online`
- Estados BD: pendiente → confirmada → en_curso → cobrado (cancelada)
- Rango horario default: 06:00-22:00, granularidad default: 30 min

## Seguridad

- Contrasenas: bcryptjs 12 rounds
- Datos sensibles: AES-256-CBC via crypto nativo
- JWT con expiracion 30 minutos
- RBAC: admin, empleado, cliente
- Rate limiting: 10 intentos/15 min en auth
- Helmet para headers HTTP
- CORS configurado para origen del frontend
- SQL injection prevenido con consultas parametrizadas (pg)

Cubre: healthcheck, auth (register/login/me), ubicaciones CRUD, servicios CRUD, disponibilidad, reservas (crear/listar/cancelar), checkin, reportes, clientes (perfil/bloquear/desbloquear), empleados CRUD, logs, preferencias, rate limiting.

## Desarrollo local

```bash
pnpm install
pnpm --filter backend dev      # Backend en :3000
pnpm --filter frontend dev     # Frontend en :5173 con proxy /api → :3000
pnpm run lint                  # ESLint
```

## Documentacion

- [Plan de desarrollo](plan.md)
- [Requisitos IEEE 830](docs/formato_ieee830.md)
- [Arquitectura y convenciones](.agents/skills/architecture.md)
- [Reglas de comportamiento](.agents/skills/contexto.md)
- [Memoria de sesiones](.agents/notes/memory.md)
