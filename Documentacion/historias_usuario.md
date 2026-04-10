# Historias de Usuario (Backlog Funcional)

## Convenciones

- Prioridad: Alta, Media, Baja
- Roles: Cliente, Empleado, Administrador

## HU-01 Registro de cliente

- Como cliente
- Quiero registrarme con mis datos personales
- Para poder reservar citas en linea
- Prioridad: Alta

### Criterios de aceptacion

1. Dado que estoy en pantalla de registro, cuando envio nombre, apellido, correo valido, celular colombiano y password valida, entonces la cuenta se crea.
2. El celular debe cumplir el formato `+57XXXXXXXXXX`.
3. Si el correo ya existe, el sistema informa conflicto.

## HU-02 Inicio de sesion

- Como usuario registrado
- Quiero iniciar sesion con correo y password
- Para acceder a funcionalidades de mi rol
- Prioridad: Alta

### Criterios de aceptacion

1. Si las credenciales son correctas, el sistema entrega token JWT y redirige segun rol.
2. Si las credenciales son invalidas, se muestra mensaje de error.

## HU-03 Reserva de cita

- Como cliente
- Quiero seleccionar servicio, horario y estilista
- Para agendar una cita
- Prioridad: Alta

### Criterios de aceptacion

1. La reserva solo se confirma en horarios disponibles.
2. El sistema limita reservas activas por cliente segun regla del negocio.
3. El sistema genera token QR unico por reserva.

## HU-04 Descarga de QR

- Como cliente
- Quiero descargar el codigo QR de mi reserva
- Para presentarlo en la entrada
- Prioridad: Alta

### Criterios de aceptacion

1. Tras confirmar reserva, el QR se visualiza en pantalla.
2. Existe boton de descarga para guardar el QR en formato imagen.

## HU-05 Validacion de ingreso por QR

- Como empleado
- Quiero validar el QR del cliente al llegar
- Para confirmar su ingreso en el horario correcto
- Prioridad: Alta

### Criterios de aceptacion

1. Si el QR corresponde a una reserva activa en ventana de validacion, se registra check-in.
2. Si el QR no existe o esta fuera de ventana, se rechaza.

## HU-06 Cobro manual de servicio

- Como empleado
- Quiero registrar el pago en efectivo de una reserva
- Para dejar trazabilidad de ingresos
- Prioridad: Alta

### Criterios de aceptacion

1. El pago requiere reserva valida.
2. No se permite registrar dos pagos para la misma reserva.
3. Se guarda monto y fecha de pago.

## HU-07 Reportes administrativos

- Como administrador
- Quiero ver reportes de ventas, ocupacion y recurrencia
- Para tomar decisiones operativas
- Prioridad: Media

### Criterios de aceptacion

1. El acceso a reportes esta restringido a rol admin.
2. Los reportes responden por fecha y/o limite segun endpoint.

## HU-08 Gestion de empleados

- Como administrador
- Quiero crear, actualizar y eliminar cuentas de empleados
- Para operar la peluqueria con control de acceso
- Prioridad: Media

### Criterios de aceptacion

1. El sistema valida correo y celular en formato permitido.
2. No se permite eliminar empleado con pagos asociados.

## HU-09 Configuracion de servicios y horarios

- Como administrador
- Quiero configurar servicios y horarios laborales
- Para controlar disponibilidad de agenda
- Prioridad: Media

### Criterios de aceptacion

1. Se pueden crear/eliminar servicios.
2. Se puede configurar jornada global y por empleado.
3. La reserva respeta la configuracion vigente.

## HU-10 Consulta de reservas propias

- Como cliente
- Quiero listar y cancelar mis reservas activas
- Para autogestionar mi agenda
- Prioridad: Media

### Criterios de aceptacion

1. El cliente solo ve sus reservas.
2. Solo reservas activas pueden cancelarse.
3. Al cancelar, la disponibilidad se actualiza.
