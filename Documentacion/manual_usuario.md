# Manual de Usuario - SGP

## 1. Introduccion

Este manual describe el uso funcional del Sistema de Gestion de Peluqueria (SGP) para los tres perfiles del sistema:

- Cliente
- Empleado
- Administrador

## 2. Acceso al sistema

Rutas principales:

- Dashboard principal: `/`
- Login: `/ui/login`
- Cliente: `/ui/client`
- Calendario cliente: `/ui/client/calendar`
- Empleado: `/ui/empleado`
- Administrador: `/ui/admin`

Nota: la ruta `/` redirige al dashboard de cliente y muestra las acciones "Ver calendario" e "Iniciar sesion".

## 3. Flujo para cliente

### 3.1 Crear cuenta

1. Ir a `/ui/login`.
2. Clic en "Crear nueva cuenta de cliente".
3. Completar:
   - Nombre
   - Apellido
   - Numero celular colombiano (obligatorio): formato `+57XXXXXXXXXX`
   - Correo
   - Contraseña (minimo 6 caracteres)
4. Confirmar creacion.

### 3.2 Iniciar sesion

1. Ingresar correo y contraseña.
2. Clic en "Entrar".
3. El sistema redirige automaticamente segun rol de la cuenta (`client`, `empleado`, `admin`).

Nota: el login unificado no solicita selector manual de rol.

### 3.3 Reservar cita

1. Ir a calendario (`/ui/client/calendar`).
2. Seleccionar fecha/hora disponible.
3. Seleccionar servicio.
4. Seleccionar peluquero (o "cualquier peluquero").
5. Definir cantidad de clientes.
6. Clic en "Confirmar reserva".

Reglas aplicadas por el sistema:

- La reserva debe hacerse con al menos 60 minutos de anticipacion.
- Solo se permite una reserva activa por servicio para el mismo cliente.
- La cantidad de clientes por reserva debe estar entre 1 y 5.

### 3.4 Descargar QR

1. Luego de confirmar la reserva, se muestra el QR.
2. Clic en "Descargar QR".
3. Se descarga imagen del codigo QR para presentacion en local.

### 3.5 Gestionar reservas

1. Clic en "Ver mis reservas".
2. Revisar estado de reservas.
3. Si una reserva esta activa, usar "Eliminar activa" para cancelarla.

### 3.6 Editar perfil

1. Desde dashboard/calendario, clic en "Editar cuenta".
2. Actualizar datos.
3. Guardar cambios.

Nota: el numero de telefono mantiene validacion colombiana obligatoria.

## 4. Flujo para empleado

### 4.1 Iniciar sesion

1. Entrar por `/ui/login` con cuenta de empleado.
2. El sistema redirige a `/ui/empleado`.

### 4.2 Validar clientes y QR

- Ir a "Verificar cliente" para revisar reservas/clientes de trabajo.
- Ir a "Validacion QR" para validar ingreso de cita.

### 4.3 Registrar cobro manual

- Usar el flujo operativo para registrar pago en efectivo asociado a reserva.
- Si la reserva ya tiene cobro, el sistema bloquea duplicados.

### 4.4 Editar cuenta

- Desde panel empleado, usar "Editar cuenta".
- Debe ingresar telefono colombiano valido, correo y contraseña.

## 5. Flujo para administrador

### 5.1 Iniciar sesion

1. Entrar por `/ui/login` con cuenta admin.
2. El sistema redirige a `/ui/admin`.

### 5.2 Gestion de empleados

- Crear empleados/admins.
- Actualizar datos de cuentas.
- Eliminar cuentas segun reglas de negocio.

### 5.3 Configuracion operativa

- Configurar servicios.
- Configurar horarios laborales globales y por empleado.

### 5.4 Reportes

- Consultar reportes diarios de ventas.
- Consultar ocupacion.
- Consultar clientes recurrentes.

## 6. Mensajes de error comunes

- "Credenciales invalidas": correo o contraseña incorrectos.
- "El numero debe tener formato +57XXXXXXXXXX": telefono invalido.
- "Solo puedes tener una reserva activa por servicio": ya existe una reserva activa del mismo servicio.
- "Fuera de tiempo": la reserva fue solicitada con menos de 60 minutos de anticipacion.
- "La reserva ya tiene cobro registrado": intento de cobro duplicado.
- "Cliente bloqueado por mal uso de la aplicacion": cuenta bloqueada por empleado/admin.

## 7. Buenas practicas de uso

1. Confirmar servicio y horario antes de registrar reserva.
2. Descargar y guardar QR de cada reserva activa.
3. Mantener datos de contacto actualizados.
4. Validar QR en el momento de ingreso para evitar rechazos por ventana horaria.
