# Sistema de Gestion de Peluqueria (SGP)

Aplicacion web para la gestion operativa de una peluqueria, con arquitectura modular por funcionalidades, base de datos PostgreSQL y despliegue con Podman.

## Alcance funcional implementado

- Gestion de clientes.
- Reservas online con QR unico por cita.
- Validacion de ingreso por QR.
- Cobro manual en local.
- Reportes administrativos.

## Requisitos clave solicitados

- Descarga de QR: implementada en la vista de calendario de cliente despues de reservar.
- Numero celular colombiano obligatorio: validado en frontend y backend con formato `+57XXXXXXXXXX`.

## Tecnologias del proyecto

### Backend

- Node.js
- Express
- API REST JSON

### Seguridad y autenticacion

- JWT (`jsonwebtoken`)
- Hash de contrasenas con `bcryptjs`

### Base de datos

- PostgreSQL
- Driver `pg`

### Funcionalidades adicionales

- Generacion de QR (`qrcode`)
- Realtime WebSocket (`ws`)
- Configuracion por entorno (`dotenv`)

### Infraestructura

- Podman
- podman-compose


## Arquitectura y estructura

```text
src/
	app.js
	server.js
	config/
		db.js
		env.js
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
	routes/
		api.routes.js
	shared/
		middlewares/
db/
	init.sql
podman/podman-compose.yml
Containerfile
```

## Modulos funcionales

- `auth`: registro/login, JWT, gestion de empleados por admin.
- `clients`: perfil de cliente y operaciones de administracion.
- `reservations`: agenda, disponibilidad, QR, servicios y horarios.
- `checkin`: validacion de QR en entrada.
- `payments`: cobro manual efectivo por reserva.
- `reports`: ventas diarias, ocupacion y recurrencia.
- `ui`: vistas HTML/CSS/JS por rol (cliente, empleado, admin).

## Ejecucion con Podman

### 1. Requisitos

- Git
- Podman
- podman-compose

En Linux no necesitas `sudo` si usas Podman en modo rootless.

### 2. Clonar repositorio

HTTPS:

```bash
git clone https://github.com/Mapachuelo/prueba.git
```

SSH:

```bash
git clone git@github.com:Mapachuelo/prueba.git
```

### 3. Levantar servicios

```bash
podman-compose up --build -d
```

Servicios levantados:

- `app` (Node.js) en puerto 3000 del contenedor
- `db` (PostgreSQL) en red interna para la app

Si el puerto local esta ocupado, define `APP_PORT` antes de levantar compose.

Tambien puedes usar el atajo del proyecto:

```bash
make up
```

### 4. Acceso rapido

- Inicio: `http://localhost:${APP_PORT:-3000}/`
- Login: `http://localhost:${APP_PORT:-3000}/ui/login`
- Cliente: `http://localhost:${APP_PORT:-3000}/ui/client`
- Empleado: `http://localhost:${APP_PORT:-3000}/ui/empleado`
- Admin: `http://localhost:${APP_PORT:-3000}/ui/admin`
- Health: `http://localhost:${APP_PORT:-3000}/health`

### 5. Usuarios semilla

- Admin: `admin@sgp.local` / `admin123`
- Empleado: `empleado@sgp.local` / `empleado123`

### 6. Detener entorno

```bash
podman-compose stop
```

Eliminar tambien volumen de datos:

```bash
podman-compose down -v
```

Atajos equivalentes:

```bash
make down
```

## Ejecucion local sin contenedores (opcional)

1. Instalar dependencias:

```bash
npm install
```

2. Configurar variables de entorno (`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`).

3. Ejecutar:

```bash
npm run dev
```

## Endpoints API principales

- Auth: `/api/auth/*`
- Clientes: `/api/clients/*`
- Reservas: `/api/reservations/*`
- Check-in: `/api/checkin/validate`
- Pagos: `/api/payments/manual`
- Reportes: `/api/reports/*`

## Documentacion

- [IEEE830 base](Documentacion/formato_ieee830.md)
- [Analisis de cumplimiento y brechas](Documentacion/analisis_cumplimiento.md)
- [Ficha tecnica](Documentacion/ficha_tecnica.md)
- [Estudio de mercado](Documentacion/estudio_mercado.md)
- [Financiacion y costos](Documentacion/financiacion_proyecto.md)
- [Historias de usuario](Documentacion/historias_usuario.md)
- [Manual de usuario](Documentacion/manual_usuario.md)
- [Manual tecnico](Documentacion/manual_tecnico.md)
- [Prompts utilizados](Documentacion/prompts.md)
- [Diagrama de flujo](Documentacion/diagrama.drawio)
- [Tiempo](Documentacion/tiempo.md)
