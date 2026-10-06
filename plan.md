# Plan de desarrollo — SGP

Documento de planificación y estado del proyecto. El detalle de requisitos está en `docs/formato_ieee830.md` y el índice de documentación en `README.md`.

## 1. Objetivo

Construir un sistema web de gestión de peluquería (reservas en línea, validación QR, cobros, reportes y administración) con React + Node.js/Express + PostgreSQL, desplegable con Podman.

## 2. Fases y estado

| Fase | Alcance | Estado |
|------|---------|--------|
| 0. Infraestructura | Monorepo pnpm, Containerfiles, pods, red, volumen, `db/init.sql` | Completada |
| 1. Backend base | Express, pool `pg`, logger Pino, middlewares, manejo de errores | Completada |
| 2. Dominio | Auth, clientes, ubicaciones, reservas, checkin, reportes, disponibilidad, logs, preferencias | Completada |
| 3. Realtime | WebSocket `/ws` (disponibilidad y reservas) | Completada |
| 4. Frontend | React + Vite + Tailwind, componentes UI, layout por rol, i18n ES/EN | Completada |
| 5. Reservas y paneles | Stepper de reserva, kanban+mapa, timeline empleado, dashboard admin, planificador | Completada |
| 6. Verificación OTP | Registro con OTP por correo (Brevo API v3) y verificación por código | Completada (pendiente credenciales válidas de Brevo) |
| 7. Endurecimiento | Transacciones, locks, validaciones, AES-256 del teléfono, rate limiting | Completada |
| 8. Datos demo | Seed masivo parametrizable y validaciones SQL | Completada |
| 9. Pruebas | API, datos, esquema, unitarias con cobertura y E2E | Completada |
| 10. Documentación | IEEE 830, UML, mockups, modelo de datos, manuales ES/EN | Completada |

## 3. Funcionalidades entregadas

- Login unificado con redirección por rol y verificación de cuenta por OTP.
- Reserva de citas: sede → estilista → calendario → modal (servicio, duración, personas) → QR.
- Kanban del cliente con mapa de la sede, descarga de QR y cancelación.
- Panel del empleado: timeline por color, mapa, `[Validar QR]` y `[Registrar cobro]`.
- Panel del administrador: KPIs, timeline, 9 accesos en ventanas flotantes y **planificador de horarios empleados × días** con citas superpuestas y cambio de sede (RF9).
- CRUD de empleados/servicios/sedes, jornadas por sede, reportes, moderación de clientes y logs con exportación.
- Interfaz ES/EN, responsiva y accesible; documentación de API en `/api/docs`.

## 4. Tecnologías

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, react-router-dom 7, Leaflet, lucide-react |
| Backend | Node.js 22, Express 4 (CommonJS), JWT, bcryptjs, Pino, ws, qrcode |
| Base de datos | PostgreSQL 17 (SQL directo con `pg`) |
| Correo | Brevo API v3 |
| Infraestructura | Podman (`kube play`), Nginx |
| Pruebas | `node:test` + cobertura, bash+curl, SQL, Python (E2E), Chromium/CDP |

## 5. Verificación

| Suite | Resultado |
|-------|-----------|
| API (`tests/api.sh`) | 27/27 |
| Datos (`tests/datos.sh`) | 6/6 |
| Esquema (`tests/esquema.sh`) | 32/32 |
| Unitarias (`backend/tests/unit`) | 36/36 |
| Cobertura (líneas) | 93.84 % |
| E2E (`tests/e2e.py`) | 29/29 |

Detalle en `docs/plan-pruebas.md`.

## 6. Riesgos y pendientes

- Rotar `BREVO_API_KEY`, `JWT_SECRET` y `AES_SECRET` antes de producción; la key actual falla al enviar OTP.
- Probar el escaneo QR con cámara en un equipo con webcam (entrada manual disponible como respaldo).
- HTTPS en producción para habilitar cámara y proteger credenciales.
- Respaldos del volumen `sgp-pgdata`.
