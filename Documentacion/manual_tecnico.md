# Manual Tecnico - SGP

## 1. Objetivo

Documentar la arquitectura, configuracion y operacion tecnica del Sistema de Gestion de Peluqueria (SGP).

## 2. Arquitectura

- Patron: Monolito modular con arquitectura por funcionalidades (feature-based)
- Capas:
  - UI Web servida por Express (`src/features/ui`)
  - API REST (`src/routes` + `src/features/*`)
  - Persistencia PostgreSQL (`db/init.sql`, `src/config/db.js`)
  - Canal realtime WebSocket (`src/integrations/realtime/wsHub.js`)

## 3. Estructura relevante

```text
src/
  app.js
  server.js
  config/
    env.js
    db.js
  routes/
    api.routes.js
  features/
    auth/
    clients/
    reservations/
    checkin/
    payments/
    reports/
    ui/
  integrations/realtime/
    wsHub.js
  shared/
    middlewares/

db/
  init.sql
```

## 4. Stack y dependencias

- Node.js 20
- Express 4
- PostgreSQL 16
- pg
- jsonwebtoken
- bcryptjs
- qrcode
- ws
- dotenv

## 5. Variables de entorno

| Variable | Obligatoria | Ejemplo | Uso |
|---|---|---|---|
| PORT | No | `3000` | Puerto HTTP |
| DATABASE_URL | Si | `postgresql://user:pass@host:5432/sgp` | Conexion a DB |
| JWT_SECRET | Si (en produccion) | `sgp_super_secret` | Firma de tokens |
| JWT_EXPIRES_IN | No | `30m` | Vigencia JWT |

## 6. Ejecucion

### 6.1 Docker

```bash
docker compose up --build
```

### 6.2 Local

```bash
npm install
npm run dev
```

## 7. Seguridad aplicada

- JWT para autenticacion.
- Middleware de autorizacion por rol (`client`, `empleado`, `admin`).
- Password con hash bcrypt.
- Validaciones de entrada en servicios.
- Restriccion de telefono colombiano (`+57XXXXXXXXXX`) en flujos de negocio.

## 8. Endpoints principales

### 8.1 Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/stylists`
- `GET/POST/PUT/DELETE /api/auth/employees` (admin)

### 8.2 Clientes

- `GET /api/clients` (admin)
- `GET /api/clients/me` (client)
- `PUT /api/clients/me` (client)
- `DELETE /api/clients/me` (client)
- `DELETE /api/clients/:id` (admin/empleado, con regla no-show)

### 8.3 Reservas

- `POST /api/reservations` (client)
- `GET /api/reservations/me` (client)
- `DELETE /api/reservations/me/:reservationId` (client)
- `GET /api/reservations` (empleado/admin)
- `GET /api/reservations/availability`
- `GET/PUT/DELETE /api/reservations/work-schedule`
- `GET/POST/DELETE /api/reservations/services`

### 8.4 Check-in

- `POST /api/checkin/validate` (empleado/admin)

### 8.5 Pagos

- `POST /api/payments/manual` (empleado/admin)

### 8.6 Reportes

- `GET /api/reports/daily-sales` (admin)
- `GET /api/reports/occupancy` (admin)
- `GET /api/reports/recurrent-clients` (admin)

## 9. Modelo de datos principal

### app_user

- Datos de usuario y rol
- Unicidad por correo
- Telefono en formato colombiano

### reservation

- Reserva por cliente
- Servicio, estilista, fecha/hora
- `qr_token` unico y `qr_data_url`
- Estado (`booked`, `checked_in`, `cancelled`)

### payment

- Un pago por reserva (unico)
- Metodo `manual_cash`
- Monto y fecha de pago

### service_catalog / employee_service_time

- Catalogo de servicios
- Duracion por empleado/servicio

## 10. Realtime

- Servidor WebSocket en ruta `/ws`
- Emision backend cuando cambia disponibilidad (`availability.updated`)
- Estado actual: frontend aun no suscribe activamente este canal

## 11. Operacion y mantenimiento

### 11.1 Recomendaciones tecnicas

1. Activar HTTPS en reverse proxy (Nginx/Traefik).
2. Configurar backups automaticos de PostgreSQL.
3. Implementar monitoreo y alertas (CPU, memoria, errores API).
4. Rotar secretos JWT en despliegues productivos.

### 11.2 Mejoras pendientes

1. Swagger/OpenAPI para toda la API.
2. Pruebas automatizadas (unitarias/integracion) con cobertura objetivo > 80%.
3. Integracion de correo para confirmaciones.
4. Internacionalizacion ES/EN.

## 12. Troubleshooting rapido

- Error `DATABASE_URL is required`: validar variables de entorno.
- Error de conexion DB en Docker: verificar estado `db` con healthcheck.
- `401/403` en API: revisar token/rol.
- Conflictos de reserva (`409`): horario ocupado o reglas de agenda.
