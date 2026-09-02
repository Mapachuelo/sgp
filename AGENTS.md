# AGENTS.md — SGP

Sistema de Gestión de Peluquería: aplicación web fullstack para reservas online, validación QR, cobros, reportes y administración.

## Arquitectura

- Monorepo pnpm workspaces con `frontend/` y `backend/` como paquetes independientes.
- Frontend: React 19 + Vite + JavaScript (sin TypeScript), Tailwind CSS, react-router-dom, Leaflet para mapas.
- Backend: Node.js 22 + Express (CommonJS), arquitectura feature-based (`routes → controller → service → model`).
- Base de datos: PostgreSQL 17, SQL directo con `pg` (sin ORM), esquema en `db/init.sql`.
- Realtime: WebSocket (`ws`) para notificaciones de disponibilidad.
- Logs: Pino (`logs.txt` actividad, `errores.txt` excepciones).
- QR: `qrcode`; Autenticación: JWT + bcryptjs + AES-256.
- Despliegue: Podman (kube play), dos pods `sgp-db` y `sgp-app` en la red `sgp-net`.

## Convenciones

- Código, archivos, rutas API y tablas de BD en español. Roles: `cliente`, `empleado`, `admin`.
- Sin TypeScript, sin ORM, sin comentarios en código salvo que se pidan.
- Ejecutar `pnpm run lint` después de cambios de código.
- No commitear sin que el usuario lo pida explícitamente.

## Comandos

```bash
pnpm install                          # Instalar dependencias
pnpm --filter backend dev             # Backend en :3000
pnpm --filter frontend dev            # Frontend en :5173
pnpm run lint                         # ESLint
bash tests/api.sh                     # Pruebas de integración
podman kube play sgp-db-pod.yaml --network sgp-net
podman kube play sgp-app-pod.yaml --network sgp-net
```

## Más contexto

Leer las carpetas `.agents/` y `docs/` para entender el proyecto a fondo:

- `.agents/skills/architecture.md` — arquitectura completa, estructura, seguridad y despliegue.
- `.agents/skills/contexto.md` — reglas de documentación y comportamiento del agente.
- `.agents/notes/memory.md` — memoria de sesiones, decisiones y estado actual.
- `docs/formato_ieee830.md` — requisitos funcionales y no funcionales (IEEE 830).
- `README.md` — documentación completa: endpoints, despliegue y reglas de negocio.