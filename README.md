# Sistema de Gestion de Peluqueria (SGP)

Backend Node.js con estructura por funcionalidad (feature-based), base de datos PostgreSQL y despliegue con Docker.

Implementa lo definido en IEEE830 para:

- Gestion de clientes.
- Reservas online con QR.
- Validacion de ingreso por QR.
- Cobro manual en local.
- Reportes administrativos.

## Arquitectura

Estructura principal:

```text
src/
	config/
	features/
		auth/
		clients/
		reservations/
		checkin/
		payments/
		reports/
		ui/
	integrations/realtime/
	routes/
	shared/
db/init.sql
docker-compose.yml
Dockerfile
```

### Modulos por funcionalidad

- auth: registro/login con JWT (expiracion 30 minutos).
- clients: perfil cliente (consultar, actualizar, eliminar) y listado para personal.
- reservations: reserva de cita, disponibilidad y QR unico.
- checkin: validacion de QR en entrada.
- payments: cobro manual efectivo por empleado/administrador.
- reports: ventas diarias, ocupacion y clientes recurrentes.
- ui: interfaz HTML simple sin CSS para probar todo por rol.

## Interfaz HTML sin CSS

Pantallas:

- /ui/client
- /ui/employee
- /ui/admin

Estas paginas permiten ejecutar las operaciones y ver respuesta JSON en pantalla para validar la logica de cada modulo.

## Ejecucion con Docker en Linux

### 1. Requisitos

- Docker Engine
- Docker Compose Plugin

### 2. Levantar servicios

En la raiz del proyecto:

```bash
export APP_PORT=3001
docker compose up --build
```

Esto levanta:

- app (Node.js) en puerto 3000
- db (PostgreSQL) en red interna de Docker para la app

Si el puerto 3000 ya esta ocupado en tu Linux, cambia APP_PORT al valor que necesites antes de ejecutar Docker Compose.

### 3. Acceder a la aplicacion

- Inicio: http://localhost:${APP_PORT:-3000}/
- Cliente: http://localhost:${APP_PORT:-3000}/ui/client
- Empleado: http://localhost:${APP_PORT:-3000}/ui/employee
- Administrador: http://localhost:${APP_PORT:-3000}/ui/admin
- Health check: http://localhost:${APP_PORT:-3000}/health

### 4. Usuarios semilla

El script db/init.sql crea:

- Admin: admin@sgp.local
- Empleado: empleado@sgp.local

Las contrasenas estan definidas con hash bcrypt en la base inicial.

- Password admin: admin123
- Password empleado: empleado123

### 5. Detener el entorno

```bash
docker compose down
```

Para eliminar tambien los datos de PostgreSQL:

```bash
docker compose down -v
```

## Ejecucion local sin Docker (opcional)

1. Copiar variables:

```bash
cp .env.example .env
```

2. Instalar dependencias:

```bash
npm install
```

3. Ejecutar:

```bash
npm run dev
```

## Referencia funcional

- [Documento IEEE830](Documentacion/formato_ieee830.md)
- [Diagrama de flujo:](Documentacion/diagrama.drawio)
