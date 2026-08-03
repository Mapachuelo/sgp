# Skill: Arquitectura del proyecto

Guia tecnica del stack, comandos, seguridad, y convenciones para desarrollo.

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
| Correo | Brevo API v3 REST (`fetch` nativo, sin SMTP) | latest |
| QR | qrcode | latest |
| Realtime | WebSocket (ws) | latest |
| Logs | Pino (logs.txt + errores.txt) | latest |
| Lint | ESLint + Prettier | latest |
| Mapas | Leaflet + react-leaflet | latest |
| Monorepo | pnpm workspaces | 10 |
| Contenedores | Podman (kube play) | latest |
| Seguridad | HTTPS (Nginx reverse proxy + Let's Encrypt) + express-rate-limit | latest |

## Comandos de ejecucion

### Desarrollo local

```bash
pnpm install                          # Instalar dependencias (raiz + paquetes)
pnpm --filter backend dev             # Backend en modo desarrollo (nodemon)
pnpm --filter frontend dev            # Frontend en modo desarrollo (Vite HMR)
pnpm run lint                         # ESLint en frontend y backend
```

### Contenedores

```bash
podman network create sgp-net                     # Crear red (una sola vez)
podman build -t localhost/sgp-backend:latest -f Containerfile .
podman build -t localhost/sgp-frontend:latest -f Containerfile.nginx .
podman kube play sgp-db-pod.yaml --network sgp-net
podman kube play sgp-app-pod.yaml --network sgp-net --configmap sgp-config.yaml
```

### Pruebas

```bash
bash tests/api.sh                     # Pruebas de integracion bash + curl
```

## Estructura del proyecto

```
sgp/
├── pnpm-workspace.yaml
├── package.json              # Root: scripts dev, build, start, test
├── sgp-db-pod.yaml           # Pod PostgreSQL + PVC persistente
├── sgp-app-pod.yaml          # Pod backend + frontend
├── Containerfile             # Backend (Node 22 Alpine + pnpm)
├── Containerfile.nginx       # Frontend (Nginx Alpine)
├── .env.example
├── .gitignore
├── .containerignore
├── .eslintrc.cjs
├── .prettierrc
├── plan.md
├── README.md
├── .agents/
│   ├── notes/
│   │   └── memory.md
│   └── skills/
│       ├── architecture.md   # Este archivo
│       └── contexto.md
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
│       │   ├── use-auth.js
│       │   └── use-websocket.js
│       ├── componentes/
│       │   ├── ui/
│       │   ├── ruta-protegida.jsx
│       │   └── layout.jsx
│       ├── funcionalidades/
│       │   ├── auth/
│       │   │   ├── login-page.jsx
│       │   │   ├── registro-page.jsx
│       │   │   └── verificar-page.jsx
│       │   ├── cliente/
│       │   │   ├── cliente-dashboard.jsx
│       │   │   ├── nueva-reserva.jsx
│       │   │   ├── mis-reservas.jsx
│       │   │   └── mi-perfil.jsx
│       │   ├── empleado/
│       │   │   ├── empleado-dashboard.jsx
│       │   │   ├── validar-qr.jsx
│       │   │   ├── mi-disponibilidad.jsx
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
│       │   ├── logs/
│       │   │   ├── logs.routes.js
│       │   │   ├── logs.controller.js
│       │   │   └── logs.service.js
│       │   └── preferencias/
│       │       ├── preferencias.routes.js
│       │       ├── preferencias.controller.js
│       │       ├── preferencias.service.js
│       │       └── preferencias.model.js
│       ├── integrations/
│       │   ├── email/
│       │   │   └── mailer.js
│       │   └── realtime/
│       │       └── ws-hub.js
│       ├── routes/
│       │   └── api.routes.js
│       └── shared/
│           ├── async-handler.js
│           ├── http-error.js
│           ├── logger.js
│           ├── utils/
│           │   └── encriptacion.js
│           └── middlewares/
│               ├── auth.middleware.js
│               ├── error.middleware.js
│               ├── notFound.middleware.js
│               └── rateLimit.middleware.js
│   └── scripts/
│       └── enviar-correo-prueba.js
└── tests/
    └── api.sh
```

## Convenciones de codigo

- **Idioma:** español para archivos, rutas API, tablas BD, variables. Roles: `cliente`, `empleado`, `admin`.
- **Nombres de archivo:** minusculas, sin tildes, sin espacios, con guiones (`empleado-dashboard.jsx`).
- **Sin TypeScript.** JavaScript puro en frontend y backend.
- **Sin comentarios** a menos que se pidan explicitamente.
- **Backend:** CommonJS (`require`/`module.exports`). Arquitectura feature-based con `routes → controller → service → model`.
- **Frontend:** ES modules. Componentes funcionales con hooks. shadcn/ui para componentes base.
- **CSS:** solo Tailwind, sin CSS vanilla fuera de `index.css`.

## Seguridad

- Contrasenas hasheadas con **bcryptjs** (12 rounds).
- Datos sensibles encriptados con **AES-256-CBC** via `crypto` nativo de Node.js. El modulo `shared/utils/encriptacion.js` expone `encriptar(texto)` y `desencriptar(iv, encrypted)`.
- **HTTPS** obligatorio en produccion (Nginx reverse proxy + Let's Encrypt). Desarrollo local en HTTP.
- Tokens **JWT** con expiracion configurable (`JWT_EXPIRES_IN`, default 30m). Middleware `auth.middleware.js` exporta `authenticate` (verifica token) y `authorize(...roles)` (verifica rol).
- **RBAC** con tres roles: `admin`, `empleado`, `cliente`.
- **Verificacion de cuenta por OTP:** al registrarse, el backend genera un codigo de 6 digitos (hash SHA-256 en BD), lo envia por correo via Brevo API v3 (`integrations/email/mailer.js`) y no emite JWT hasta `POST /api/auth/verificar`. Expiracion de 15 min (`token_verificacion_expiracion`). Reenvio limitado a 3 cada 15 min (`verificacionLimiter`). Usuarios creados antes del sistema quedan verificados por backfill en `db/init.sql`. Empleados creados por admin nacen verificados.
- **Rate limiting** con `express-rate-limit` en endpoints de auth (`authLimiter` max 10 intentos por IP cada 15 min; `verificacionLimiter` max 3 reenvios cada 15 min).
- **Helmet** para headers de seguridad HTTP.
- **CORS** configurado solo para el origen del frontend (`VITE_API_URL`).
- **SQL injection:** prevenido mediante consultas parametrizadas con `pg` (sin concatenacion de strings).
- **Credenciales de Brevo** (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`) solo en `.env` (gitignored) o `sgp-config.yaml` (gitignored). En `sgp-app-pod.yaml` se referencian con `configMapKeyRef` (sin valores, seguro para repo publico); se aplican con `podman kube play --configmap sgp-config.yaml`. Nunca en `.env.example` ni en repositorios publicos.

## Base de datos

- PostgreSQL 17 Alpine. Esquema definido en `db/init.sql`.
- Sin ORM. Consultas SQL directas con el driver `pg`.
- Conexion via `DATABASE_URL` en `.env`.
- `config/db.js` exporta un `Pool` de conexiones.
- `config/database-init.js` ejecuta `db/init.sql` al iniciar el backend (solo en desarrollo, usa `CREATE TABLE IF NOT EXISTS`).

## Logs

- Pino logger configurado en `shared/logger.js`.
- Dos streams: `logs.txt` (actividad general, nivel `info`) y `errores.txt` (errores, nivel `warn` en adelante).
- Acceso via `/api/logs/*` restringido a rol `admin`.

## Tiempo real

- WebSocket server en `integrations/realtime/ws-hub.js` usando el paquete `ws`.
- Se adjunta al mismo `http.Server` de Express en `server.js`.
- Emite `disponibilidad.actualizada` cuando se crea, modifica o cancela una reserva.
- Frontend: hook `use-websocket.js` que se conecta a `ws://localhost:3000/ws` y expone `ultimoEvento`.

## Despliegue

- `sgp-db-pod.yaml` define el pod de PostgreSQL 17 Alpine con PVC persistente (`sgp-pgdata`).
- `sgp-app-pod.yaml` define el pod de aplicacion con backend Node.js + frontend Nginx.
- Los pods se conectan via la red `sgp-net`.
- `Containerfile` (backend): Node 22 Alpine, instala pnpm, copia monorepo, ejecuta `pnpm --filter backend start`.
- `Containerfile.nginx` (frontend): Nginx Alpine, copia `frontend/dist/` tras build, configura proxy reverso a backend en `/api`.
- Variables de entorno en `.env` y `.env.example`. `sgp-config.yaml` (gitignored) contiene las credenciales de Brevo y se aplica con `--configmap`.
- Script de prueba de correo: `pnpm --filter backend exec node scripts/enviar-correo-prueba.js [email]` (usa las variables `BREVO_*` del `.env`).

## Testing

- `tests/api.sh`: script bash que prueba los endpoints principales con `curl`, incluido el flujo registro → login sin verificar (403) → reenvio → codigo incorrecto (400). El paso final (codigo correcto) es manual con el codigo del correo.
- Pruebas manuales con el demo (`demo.html`) como referencia visual.
- No hay tests unitarios en el MVP inicial. Se agregaran en fase 10.
