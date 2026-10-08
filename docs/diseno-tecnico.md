# Diseño técnico — SGP

Documento de diseño del Sistema de Gestión de Peluquería: arquitectura, decisiones técnicas y modelos UML. Los diagramas son editables en draw.io.

## 1. Arquitectura general

```
Navegador (React SPA)
   |  HTTP :8080 (Nginx)
   v
Pod sgp-app
   ├── Nginx: SPA compilada + proxy /api y /ws -> 127.0.0.1:3000
   └── Backend Node.js/Express :3000
          ├── REST /api/* (JWT + RBAC + validaciones)
          ├── WebSocket /ws (eventos de disponibilidad y reservas)
          ├── Swagger /api/docs
          ├── Pino -> logs.txt / errores.txt
          └── pg Pool -> PostgreSQL
   v
Pod sgp-db
   └── PostgreSQL 17 Alpine + volumen PVC sgp-pgdata
```

- **Patrón backend:** feature-based `routes -> controller -> service -> model` (CommonJS, sin ORM).
- **Patrón frontend:** funcionalidades por rol (`auth`, `cliente`, `empleado`, `admin`) con componentes UI propios, contexto de autenticación, i18n y hooks.
- **Realtime:** `ws-hub.js` emite `conexion`, `disponibilidad.actualizada` y `reserva.actualizada`.
- **Documentación API:** spec OpenAPI 3 en `backend/src/docs/openapi.js`, servida en `/api/docs`.

## 2. Diagramas (draw.io)

| Diagrama | Archivo | Página |
|----------|---------|--------|
| Flujo de trabajo actualizado (cliente/empleado/admin) | `docs/diagrama.drawio` | Flujo actual |
| Casos de uso | `docs/modelos-uml.drawio` | Casos de uso |
| Clases del dominio | `docs/modelos-uml.drawio` | Clases |
| Secuencia Reserva → QR | `docs/modelos-uml.drawio` | Secuencia reserva |
| Secuencia Validación → Cobro | `docs/modelos-uml.drawio` | Secuencia check-in |
| Estados de la reserva | `docs/modelos-uml.drawio` | Estados |
| Despliegue (pods y red) | `docs/modelos-uml.drawio` | Despliegue |
| Modelo entidad-relación | `docs/modelos-uml.drawio` | Modelo ER |

Los diagramas se regeneran con `node scripts/generar-drawio.js` (idempotente; agrega la página "Flujo actual" si no existe y reescribe `modelos-uml.drawio`).

## 3. Decisiones de diseño relevantes

| Decisión | Justificación |
|----------|---------------|
| Reserva con `pg_advisory_xact_lock(empleado, día)` + transacción | Evita solapes concurrentes sin constraints de exclusión; el 409 sugiere otro horario. |
| Check-in y cobro atómicos con `SELECT ... FOR UPDATE` y `UNIQUE(reserva_id)` | Garantiza un único cobro y deja la reserva en `cobrado`; el reintento responde 409. |
| Cancelación por cambio de sede por **día** cambiado y motivo literal | Cumple RF9 y permite notificar por WebSocket a los paneles abiertos. |
| Cifrado AES-256-CBC del teléfono en aplicación (`telefono.js`) | Datos sensibles en reposo; migración automática de valores en claro al arrancar. |
| Fechas de negocio comparadas en `America/Bogota` (`AT TIME ZONE`) | Evita desfases UTC en reportes, agenda y filtros del timeline. |
| i18n por diccionario ES→EN con observador DOM y recarga al cambiar | Traduce toda la interfaz sin reescribir cada componente; preferencia por usuario. |
| Ventanas flotantes (2 modales + 7 sheets) en el admin | Cumple RF11 y mantiene el dashboard visible de fondo. |
| Planificador por empleado en sheet ancho | La matriz empleados × días con citas requiere más ancho que un sheet estándar. |
| Pruebas con `node:test` y `--experimental-test-coverage` | Cobertura sin dependencias adicionales; se ejecutan dentro del contenedor backend. |

## 4. Estructura del código

```
backend/src/
  config/            env, pool (withTransaction), database-init
  features/          auth, clientes, ubicaciones, reservas, checkin,
                     reportes, disponibilidad, logs, preferencias
                     cada uno: routes -> controller -> service -> model
  integrations/      email (Brevo API v3), realtime (ws-hub)
  shared/            logger Pino, http-error, async-handler,
                     middlewares (auth/error/notFound/rateLimit),
                     utils (encriptacion AES, telefono)
  docs/              openapi.js + docs.routes.js
frontend/src/
  api/               cliente.js (fetch wrapper con JWT)
  componentes/       layout, ruta-protegida, ui/ (Button, Input, Sheet, Modal...)
  contexto/          auth-context
  hooks/             use-auth, use-websocket
  funcionalidades/   auth, cliente, empleado, admin/secciones
  i18n/              diccionario + proveedor
  lib/               descargas (QR, texto)
db/init.sql          10 tablas + seeds + migraciones idempotentes
```

## 5. Seguridad

- bcryptjs (12 rounds) para contraseñas; JWT de 30 minutos; RBAC por middleware.
- Rate limiting: 10 intentos/15 min (auth) y 3 reenvíos OTP/15 min.
- Helmet, CORS restringido al origen del frontend, SQL parametrizado.
- AES-256-CBC para teléfonos; OTP almacenado como hash SHA-256 con expiración de 15 minutos.
- Swagger disponible en `/api/docs` (documentación de contratos).

## 6. Referencias

- `README.md` — operación, endpoints y reglas de negocio.
- `docs/formato_ieee830.md` — requisitos y trazabilidad.
- `docs/modelo-datos.md` — modelo ER y diccionario de datos.
- `docs/mockups.md` — interfaz por rol.
- `docs/plan-pruebas.md` — verificación y calidad.
