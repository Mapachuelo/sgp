# Manual de usuario — SGP

Guía de uso del Sistema de Gestión de Peluquería para clientes, empleados y administradores. Capturas en `docs/img/` (ver también `docs/mockups.md`).

## 1. Acceso

1. Abrir `http://localhost:8080`.
2. En **Iniciar sesión** ingresar correo y contraseña. El sistema reconoce el rol y redirige automáticamente.
3. Para cambiar el idioma usar el botón **EN/ES** de la barra superior; la preferencia queda guardada por usuario.

![Inicio de sesión](img/login.png)

### 1.1 Crear cuenta (solo clientes)

1. En el login, pulsar **Regístrate**.
2. Completar nombre, apellido, celular (empieza con `+57`, completar los 10 dígitos), correo y contraseña.
3. Se envía un código OTP de 6 dígitos al correo; la cuenta queda activa al verificarla.

![Registro](img/registro.png)

### 1.2 Verificar cuenta

1. Abrir **/verificar** (el registro redirige automáticamente).
2. Escribir el código de 6 dígitos. La pantalla muestra una cuenta regresiva: **tienes 5 minutos para verificar**.
3. Si el registro expira, la cuenta se elimina y el correo queda libre: usa "Registrarme de nuevo".
4. Si no llegó el código, usar **Reenviar código** (máximo 3 veces cada 15 minutos); el reenvío reinicia el tiempo de registro.
5. Sin verificar, el login responde "Cuenta no verificada".

![Verificación](img/verificar.png)

## 2. Cliente

### 2.1 Agendar una cita

1. **Paso 1 — Sede:** buscar por nombre/ciudad y elegir en la lista o el mapa.
2. **Paso 2 — Estilista:** se listan los disponibles en esa sede en los próximos 6 días.
3. **Paso 3 — Calendario:** elegir día y hora. Colores: verde disponible, rojo ocupado, gris pasado, azul no disponible, ámbar con menos de 60 minutos de anticipación.
4. **Paso 4 — Confirmar:** se abre una ventana flotante con servicio, **duración estimada (hora de entrada → hora de salida)**, personas (1–5) y total.
5. **Paso 5 — Pago y QR:** se genera el código QR de ingreso y el botón **Descargar QR**. Elige **Efectivo en Local** (pagas al llegar) o **Pago en línea**, que abre el checkout seguro de **Wompi** con tarjeta crédito/débito, PSE, Nequi o Botón Bancolombia; al aprobarse, la reserva queda **Confirmada** con la insignia "Pagado". Si el pago se rechaza puedes reintentar o pagar en el local.

Si el horario se ocupa mientras decides, verás un error y el calendario se actualizará para elegir otro horario. Límite: 5 reservas activas.

![Reserva paso 1](img/cliente-reservar-paso1.png)

![Calendario](img/cliente-calendario.png)

![Confirmar reserva](img/cliente-modal-paso4.png)

### 2.2 Mis reservas (kanban)

En **Inicio** se muestran columnas por estado: Pendiente, Confirmada, En curso, Completada y Cancelada. Al seleccionar una reserva se ve el detalle, el **mapa de la sede**, el QR y su descarga. Desde ahí puedes **cancelar** reservas pendientes o confirmadas.

![Kanban cliente](img/cliente-kanban.png)

### 2.3 Mi perfil

Editar nombre, apellido, teléfono, correo y contraseña.

![Perfil](img/cliente-perfil.png)

## 3. Empleado

### 3.1 Citas de hoy

Timeline con color por estado y acciones rápidas:
- `[Validar QR]`: abre el modal para ingresar el token o usar la cámara.
- `[Registrar cobro]`: para cobros con token; elegir "Pago online ($0)" o "Efectivo en local".

El panel lateral muestra el mapa de la sede donde trabajas hoy y el resumen del día.

![Citas empleado](img/empleado-citas.png)

### 3.2 Validar ingreso y cobro

1. Pulsar **Validar QR** y pegar el token, o activar la cámara y apuntar al QR.
2. Elegir método y monto (0 para pago online) y confirmar.
3. El sistema valida estado y ventana ±120 minutos; si todo está bien muestra "Check-in y cobro registrados". Un segundo intento avisa "La reserva ya fue cobrada".

### 3.3 Mi disponibilidad

Planificador semanal: por día elegir la sede (solo una por día) y marcar los bloques de trabajo. "Mis Servicios Asignados" lista los servicios habilitados con su duración.

Al cambiar la sede de un día con reservas futuras se pide confirmación: las reservas de ese día en la sede anterior se cancelan con el motivo **"El empleado cambió de sede"** y el cliente es notificado en su panel.

![Disponibilidad](img/empleado-disponibilidad.png)

## 4. Administrador

### 4.1 Dashboard

- **KPIs:** recaudación del día, reservas del día, tasa de ocupación promedio y clientes recurrentes.
- **Timeline:** todas las citas del día, filtrable por fecha y sede; botón Validar por cita.
- **Gestión:** 9 accesos en ventanas flotantes: Validar QR, Cobro, Empleados, Servicios, Sedes, Horarios, Reportes, Moderación clientes y Logs.

![Dashboard admin](img/admin-dashboard.png)

### 4.2 Planificador de horarios

1. Abrir **Horarios** (pestaña "Planificador por empleado").
2. La matriz muestra empleados (filas) por LUN–DOM (columnas) con la sede y turno de cada día, y las citas reales encima.
3. Hacer clic en una celda para editar: sede del día, hora inicio/fin o descanso.
4. Si cambias la sede de un día con reservas futuras, se advierte y al guardar se cancelan con el motivo correspondiente; verás el conteo en un aviso.
5. Usar búsqueda, filtro por sede, "Solo con horario" y navegación de semanas (Hoy/←/→). Clic en una cita pendiente abre el modal de validación.

![Planificador](img/admin-planificador.png)

![Editor de horario](img/admin-planificador-editor.png)

La pestaña **Jornada por sede** permite editar el horario de atención por fecha.

![Jornada](img/admin-jornada.png)

### 4.3 Empleados, servicios y sedes

- **Empleados:** crear/editar con sedes asignadas, horarios por sede/día, servicios y duraciones; eliminar solo sin cobros asociados.
- **Servicios:** CRUD y tiempos por empleado.
- **Sedes:** CRUD con dirección y coordenadas (alimentan los mapas).

![Empleados](img/admin-empleados.png)

### 4.4 Reportes, clientes y logs

- **Reportes:** ventas diarias con desglose, ocupación con porcentaje por sede y clientes recurrentes.
- **Moderación de clientes:** bloquear con motivo, desbloquear y eliminar (solo con 3+ no-shows).
- **Logs:** `logs.txt` (actividad) y `errores.txt` (fallos) con búsqueda, fecha, severidad y exportación `.txt`.

![Reportes](img/admin-reportes.png)

![Logs](img/admin-logs.png)

## 5. Uso en móvil e inglés

La interfaz es responsiva (menú hamburguesa, tablas con scroll y planificador con desplazamiento horizontal). El botón EN/ES traduce toda la interfaz.

![Móvil](img/cliente-kanban-movil.png)

![Inglés](img/cliente-kanban-en.png)

## 6. Preguntas frecuentes

| Pregunta | Respuesta |
|----------|-----------|
| ¿Por qué no puedo reservar en menos de 60 minutos? | Es la anticipación mínima para preparar el servicio. |
| ¿Qué pasa si el estilista cambia de sede? | Las reservas futuras de ese día en la sede anterior se cancelan y lo verás en tu kanban con el motivo. |
| ¿Cómo pago en línea? | Al reservar elige **Pago en línea** y completa el checkout de Wompi (tarjeta, PSE, Nequi o Bancolombia). Si se aprueba, la reserva queda confirmada y pagada; si se rechaza, puedes reintentar o pagar en el local. |
| ¿No me llegó el código? | Usa "Reenviar código" (máx. 3 cada 15 min) o revisa spam. |
| ¿Por qué desapareció mi registro? | Los registros sin verificar se eliminan a los 5 minutos; el correo queda libre para registrarte otra vez. |
| ¿Puedo tener muchas reservas? | Máximo 5 activas por cliente. |
