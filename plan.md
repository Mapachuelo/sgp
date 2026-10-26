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
| 9. Pruebas | API, datos, esquema, unitarias con cobertura, E2E y regresion 10x10 | Completada |
| 10. Documentación | IEEE 830, UML, mockups, modelo de datos, manuales ES/EN | Completada |

## 3. Funcionalidades entregadas

- Login unificado con redirección por rol y verificación de cuenta por OTP.
- Reserva de citas: sede → estilista → calendario → modal (servicio, duración, personas) → QR.
- Pago digital Wompi (tarjeta, PSE, Nequi, Bancolombia) con widget, QR en el celular del cliente y webhook idempotente.
- Cola de atencion por cita: llegada por QR, inicio anticipado, cobro QR/efectivo y finalizacion con paso al siguiente cliente.
- Kanban del cliente con mapa de la sede, descarga de QR, pago posterior y cancelación.
- Panel del empleado: cola de atencion, timeline por color, mapa, llegada, cobro y finalizacion.
- Telefonos internacionales E.164 con Colombia (+57) por defecto y mapa seleccionable al crear sedes.
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
| API (`tests/api.sh`) | 34/34 |
| Datos (`tests/datos.sh`) | 6/6 |
| Esquema (`tests/esquema.sh`) | 48/48 |
| Unitarias (`backend/tests/unit`) | 50/50 |
| Cobertura (líneas / ramas / funciones) | 91.91 % / 75.83 % / 94.90 % |
| E2E (`tests/e2e.py`) | 42/42 |
| Regresion 10x10 (`tests/regresion_10x10.py`) | 122/122 |

Detalle en `docs/plan-pruebas.md`.

## 6. Riesgos y pendientes

- Rotar `BREVO_API_KEY`, `JWT_SECRET`, `AES_SECRET` y las llaves de producción de Wompi antes de producción; la key actual de Brevo puede fallar al enviar OTP.
- Configurar la URL pública de eventos de Wompi (`https://<dominio>/api/pagos/webhook`).
- Probar el escaneo QR con cámara en un equipo con webcam (entrada manual disponible como respaldo).
- HTTPS en producción para habilitar cámara y proteger credenciales.
- Respaldos del volumen `sgp-pgdata`.
- NFC queda fuera de alcance; el cobro presencial usa QR/checkout Wompi o efectivo.
