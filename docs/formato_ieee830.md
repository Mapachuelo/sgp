# Especificación de Requisitos de Software (IEEE 830)

**Sistema de Gestión de Peluquería (SGP)**

| Campo | Valor |
|-------|-------|
| Estándar | IEEE Std 830-1998, *Software Requirements Specification* |
| Versión | 3.0 |
| Fecha | 2026-10-29 |
| Estado | Aprobado para implementación y verificación |
| Documentos relacionados | `docs/diseno-tecnico.md`, `docs/modelos-uml.drawio`, `docs/diagrama.drawio`, `docs/modelo-datos.md`, `docs/plan-pruebas.md`, `README.md` |

---

## 1. Introducción

### 1.1 Propósito

Este documento especifica los requisitos funcionales y no funcionales del **Sistema de Gestión de Peluquería (SGP)**. Es la referencia única para el diseño, la implementación, las pruebas y la verificación del software entregado.

### 1.2 Alcance

El SGP es una aplicación web fullstack desplegable con Podman que permite:

- Registro y gestión de clientes con verificación de cuenta por OTP.
- Portada pública en `/` con presentación del salón, carrusel de servicios, detalle de servicio, sedes y llamadas a la acción para reservar o iniciar sesión.
- Gestión de sedes físicas con nombre, dirección, departamento, ciudad y coordenadas geográficas.
- Reserva de citas en línea con calendario interactivo, selección de sede, categoría, uno o varios servicios, estilista por servicio y cantidad de personas, con generación de código QR único.
- Catálogo jerárquico de servicios: categoría, servicio con portada, precio y duración, y galería de hasta 6 imágenes; el detalle se abre en un modal con carrusel.
- Validación de ingreso por QR, cola de atención y registro de cobro en un solo paso atómico.
- Pago digital con pasarela **Wompi** (tarjeta crédito/débito, PSE, Nequi y Botón Bancolombia) mediante widget embebido o QR en el celular del cliente; pago físico (efectivo) registrado en el local. El monto se recalcula en el servidor, el webhook valida firma SHA256 y la operación es idempotente.
- Reembolso automático de pagos con tarjeta cuando el empleado reporta un imprevisto que cancela el día; los demás métodos quedan pendientes de gestión.
- Cola de atención para citas con hora: llegada por QR, inicio anticipado dentro de la ventana de 30 minutos, finalización y paso al siguiente cliente.
- Teléfonos internacionales en formato E.164, con Colombia (`+57`) como opción por defecto.
- Paneles diferenciados para cliente, empleado y administrador, incluido un planificador de horarios multi-sede.
- Panel del cliente con próxima cita, pestañas de próximas/historial/canceladas, mapa de la sede, QR descargable y pago en línea de reservas activas impagas.
- Reportes administrativos de ventas, ocupación y clientes recurrentes.
- Gestión de logs del sistema (`logs.txt` y `errores.txt`).
- Presentación pública administrable desde Admin → Presentación, con textos, imágenes y videos en una base separada.
- Preferencias de ubicación, rango horario y granularidad del calendario, y tema claro/oscuro/sistema.
- Interfaz siempre en español, sin conmutador de idioma.

### 1.3 Definiciones, acrónimos y abreviaturas

| Sigla | Significado |
|-------|-------------|
| SGP | Sistema de Gestión de Peluquería |
| QR | Quick-Response (código QR) |
| UI | User Interface (interfaz de usuario) |
| API | Application Programming Interface |
| BD | Base de Datos |
| JWT | JSON Web Token |
| OTP | One-Time Password (código de verificación) |
| RBAC | Role-Based Access Control |
| RF | Requisito Funcional |
| RNF | Requisito No Funcional |
| Wompi | Pasarela de pagos en línea usada por el SGP |
| PSE | Pago Seguro en Línea (método de pago de Wompi) |

El glosario ampliado está en el Apéndice A.

### 1.4 Referencias

- IEEE Std 830-1998, *Software Requirements Specification*.
- ISO/IEC 18004 (estándar de códigos QR).
- `README.md` — documentación de despliegue, API y reglas de negocio.
- `docs/diseno-tecnico.md` — diseño técnico y modelos UML.
- `docs/modelo-datos.md` — modelo entidad-relación y diccionario de datos.
- `docs/plan-pruebas.md` — estrategia y matriz de pruebas.
- `docs/diagrama.drawio` — flujo actual, pago Wompi, portada pública y autoservicio del empleado.
- `docs/modelos-uml.drawio` — casos de uso, clases, secuencias, estados, despliegue y modelo ER.

### 1.5 Visión general del documento

El documento se estructura en: descripción general del producto (sección 2), requisitos específicos (sección 3) y apéndices (sección 4+). Cada requisito funcional tiene código `RF#` y trazabilidad hacia las funcionalidades `F#` del producto, los módulos del código y las pruebas que lo verifican (Apéndice C).

---

## 2. Descripción general

### 2.1 Perspectiva del producto

El SGP es un producto independiente desplegable con Podman (aplicación + PostgreSQL 17) y sin integraciones externas obligatorias salvo el envío de correo de verificación (Brevo API v3) y el pago en línea (Wompi). La arquitectura es de tres capas:

```
┌───────────────────────────────────────┐
│ Frontend Web (React + Vite)           │  Nginx sirve la SPA y proxya /api y /ws
├───────────────────────────────────────┤
│ API Node.js/Express (REST + WS)       │  JWT + RBAC + Pino + WebSocket
├───────────────────────────────────────┤
│ PostgreSQL 17 (SQL directo)           │  19 tablas operativas + 3 de presentación
└───────────────────────────────────────┘
```

La base principal `sgp` contiene 19 tablas operativas. La portada pública usa una base separada `sgp_presentacion` con 3 tablas (`presentacion_config`, `presentacion_media` y `presentacion_fuente`) y el volumen `sgp-presentacion-media`; no comparte tablas de reservas, pagos ni usuarios. Las integraciones externas son Brevo (correo OTP y notificaciones de cancelación), Wompi (pago en línea y reembolsos) y OpenStreetMap/Nominatim (mapas y geocodificación inversa).

### 2.2 Funcionalidades del producto

| ID | Función | Descripción |
|----|---------|-------------|
| **F1** | Gestión de Clientes | Registro, verificación OTP, actualización, preferencias, bloqueo/desbloqueo y borrado. |
| **F2** | Reservas en Línea | Selección de sede, categoría, uno o varios servicios, estilista por servicio, fecha/hora y personas; generación de QR. |
| **F3** | Validación en Entrada y Cola | Escaneo/ingreso del token QR con control de estado, ventana horaria, llegada, inicio y finalización. |
| **F4** | Cobro | Registro del cobro en el mismo paso de validación o desde el panel; método `fisico` u `online`; sin doble cobro. |
| **F5** | Reportes Administrativos | Ventas por día, ocupación por sede, clientes recurrentes y nómina con PDF (solo admin). |
| **F6** | Login Unificado | Formulario único en `/login` con redirección según rol. |
| **F7** | Gestión de Ubicaciones | CRUD de sedes con nombre, dirección, departamento, ciudad y coordenadas lat/lng. |
| **F8** | Panel de Citas del Cliente | Próxima cita, pestañas de próximas/historial/canceladas, mapa lateral de la sede, QR, descarga, pago en línea y cancelación. |
| **F9** | Gestión de Disponibilidad | Kanban semanal del empleado por sede (una sede fija por día), horario, descansos múltiples, cambios temporales con retorno automático, festivos de Colombia y opt-in para trabajar. |
| **F10** | Panel del Empleado | Cola de hoy, agenda/timeline de citas, colores por estado, mapa de la sede, resumen del día y acciones rápidas de validación, cobro, inicio y finalización. |
| **F11** | Panel del Administrador | KPIs, timeline general, agenda/planificador de horarios y secciones de gestión en páginas independientes. |
| **F12** | Gestión de Logs | `logs.txt` y `errores.txt` con búsqueda, filtros y exportación `.txt`. |
| **F13** | Verificación de Cuenta | OTP de 6 dígitos enviado por correo; login bloqueado hasta verificar. |
| **F14** | Portada Pública y Presentación | Página pública `/` con textos, imágenes/videos y catálogo; edición desde Admin → Presentación en base separada. |
| **F15** | Pago en Línea Wompi | Intención de pago, widget/QR, webhook firmado, verificación, conciliación y reembolsos. |
| **F16** | Autoservicio del Empleado | Perfil, foto opcional, “Mis servicios” y edición de duración; el precio lo define el administrador. |
| **F17** | Preferencias y Tema | Ubicación preferida, rango horario, granularidad del calendario y tema claro/oscuro/sistema. |
| **F18** | Catálogo Público y Sedes Alternativas | Catálogo público por categoría, detalle con galería y sedes alternativas con mapa cuando no hay estilista. |

### 2.3 Características de los usuarios

| Tipo | Habilidades | Acciones principales |
|------|-------------|----------------------|
| Cliente | Básicas de navegador | Registrarse, reservar (hasta 5 activas), ver próxima cita y pestañas de citas, mapa, descargar QR, pagar en línea, cancelar, editar perfil, definir preferencias y tema. |
| Empleado | Medias | Ver cola/agenda del día, validar QR, registrar cobro, iniciar/finalizar servicio, gestionar su disponibilidad semanal por sede, cambios temporales, festivos, “Mis servicios”, foto, perfil y reportar un imprevisto. |
| Administrador | Altas | KPIs, timeline de todas las sedes, agenda y planificador multi-sede, CRUD de empleados/categorías/servicios/sedes, imágenes de servicio, máximo de servicios por reserva, jornadas, presentación pública, reportes, moderación de clientes y logs. |

### 2.4 Restricciones

- Navegadores soportados: Chrome ≥ 80, Firefox ≥ 75.
- Backend sobre Linux (contenedor Node 22 Alpine); base PostgreSQL 17.
- API RESTful con JSON; autenticación JWT (expiración 30 minutos).
- QR conforme a ISO/IEC 18004 (librería `qrcode`).
- Despliegue exclusivamente con Podman (`kube play`), sin Docker.
- Sin ORM: SQL directo con `pg`.
- Sin TypeScript: JavaScript (React) y CommonJS (Express).
- Interfaz siempre en español; no hay conmutador de idioma ni preferencia de idioma por usuario.
- El pago en línea depende de Wompi y de los métodos habilitados en la cuenta del comercio; la demo local puede usar sandbox.
- La cámara para leer QR requiere HTTPS o `localhost`.
- La portada pública usa una base y un volumen separados del resto del sistema.

### 2.5 Suposiciones y dependencias

- El establecimiento dispone de conexión a internet para el envío de OTP y notificaciones por correo (Brevo).
- El cliente presenta el QR (imagen o token) al llegar; el empleado puede ingresarlo manualmente.
- El cobro digital depende de Wompi (sandbox o producción según las llaves configuradas) y de que el comercio tenga habilitados los métodos de pago en su cuenta.
- El administrador configura sedes, jornadas, servicios, precios, duraciones, disponibilidad y presentación antes de operar.
- Zona horaria de operación: `America/Bogota`.
- Los festivos de Colombia se calculan con el calendario oficial y se cierran por defecto salvo apertura del admin y opt-in del empleado.

### 2.6 Evolución previsible

1. Aplicación móvil nativa.
2. Reembolso automático para métodos de pago distintos de tarjeta (PSE, Nequi y Botón Bancolombia); hoy el reembolso automático cubre tarjeta y los demás quedan pendientes de gestión.
3. Notificaciones por WhatsApp.
4. Búsqueda avanzada de clientes/empleados.
5. Bloqueo automático de cuentas por mal uso.

---

## 3. Requisitos específicos

### 3.1 Requisitos de interfaces externas

#### 3.1.1 Interfaz de usuario (UI)

| ID | Requisito | Descripción |
|----|-----------|-------------|
| UI1 | Responsividad | Usable en móvil (≥320 px), tablet y escritorio; menú hamburguesa, tablas con scroll interno y planificador con scroll horizontal. |
| UI2 | Accesibilidad | Diálogos con `role="dialog"`, `aria-modal`, cierre con Escape, foco atrapado y retorno; labels asociados, aria-labels en iconos, `aria-live` en avisos y contraste AA. |
| UI3 | Idioma | Interfaz siempre en español; no hay conmutador de idioma ni preferencia por usuario. |
| UI4 | Tema | Tema claro, oscuro o “sistema”, persistido en `localStorage` (`sgp_tema`) y con soporte de `prefers-color-scheme`; el QR siempre se muestra sobre fondo blanco. |
| UI5 | Preferencias de interfaz | El usuario puede definir departamento/ciudad preferidos, rango horario y granularidad del calendario (15/30/60 min); se usan para prefiltrar sedes y slots. |

#### 3.1.2 Interfaz de hardware

| ID | Requisito | Descripción |
|----|-----------|-------------|
| HW1 | Lectura QR | Entrada manual del token y vista de cámara con solicitud de permisos; procesamiento de validación en menos de 0.5 s (consulta indexada por `qr_token`). |

#### 3.1.3 Interfaz de software (API)

| ID | Requisito | Descripción |
|----|-----------|-------------|
| API1 | Endpoints REST | `/api/auth/*`, `/api/clientes/*`, `/api/ubicaciones/*`, `/api/reservas/*` (catálogo, categorías, servicios, imágenes, disponibilidad, disponibilidad-combo, empleados por servicio/sede, jornada, festivos, configuración, agenda, `me`, empleado/día, cancelar-día y empleado-tiempos-servicio), `/api/checkin/*` (consultar, llegada, cobro-efectivo, confirmar-pago, iniciar, finalizar y validar), `/api/pagos/*` (intención, consulta, verificación y webhook), `/api/reportes/*` (incluido `/mi-resumen` del empleado), `/api/empleados/disponibilidad/*` (todas, temporales, festivos y `/descansos`), `/api/logs/*`, `/api/preferencias`, `/api/presentacion/*` (pública, admin, configuración, media, orden y fuentes) y `/api/healthcheck`. La especificación OpenAPI de `/api/docs` cubre auth, clientes, ubicaciones, reservas, checkin, pagos, reportes, disponibilidad básica, logs y preferencias; presentación y las extensiones de disponibilidad se documentan en `README.md` y en este SRS. |
| API2 | Autenticación JWT | Tokens con expiración de 30 minutos (`JWT_EXPIRES_IN=30m`). |
| API3 | Contrato de respuesta | `{ "ok": true, "data": {...} }` o `{ "ok": false, "error": "mensaje" }`. |

#### 3.1.4 Interfaz de comunicación

| ID | Requisito | Descripción |
|----|-----------|-------------|
| COM1 | WebSocket | Canal `/ws` con eventos `conexion`, `disponibilidad.actualizada` y `reserva.actualizada` para refrescar paneles y notificar cancelaciones. |

### 3.2 Requisitos funcionales

| RF | Nombre | Prioridad | Descripción |
|----|--------|-----------|-------------|
| **RF0** | Login Unificado | Alta | Formulario único en `/login` (correo y contraseña); el backend responde `rol` y el frontend redirige a `/cliente`, `/empleado` o `/admin`. |
| **RF1** | Registro y Perfil de Cliente | Alta | El cliente se registra con nombre, apellido, teléfono internacional en formato E.164 (Colombia `+57` + 10 dígitos por defecto), correo y contraseña. Validación de formato de correo y teléfono en backend; teléfono cifrado en reposo. El registro no emite JWT hasta verificar el OTP. Desde su perfil puede actualizar nombre, apellido y teléfono, definir preferencias y eliminar su cuenta; el correo de acceso no se edita. |
| **RF2** | Reserva de Cita | Alta | Flujo: (1) sede, con filtro por departamento/ciudad y preferencias del cliente; (2) categorías y servicios con búsqueda, precio y duración; cada tarjeta abre un detalle con carrusel de hasta 6 imágenes y flechas laterales; carrito de 1..N servicios (máximo configurable), (3) equipo propuesto por servicio con posibilidad de cambiar estilista, (4) calendario combinado con slots donde la secuencia completa cabe y cada estilista está libre, (5) confirmación con desglose de servicios, estilistas, horarios, personas (1–5) y total, (6) pago con QR único. Si no hay estilista en la sede, se muestran sedes alternativas con mapa y se permite cambiar de sede o quitar el servicio. Validaciones de servidor: máximo configurable de servicios, máximo 5 reservas activas, anticipación ≥60 min, cada estilista ofrece su servicio, disponibilidad semanal, duración desde `empleado_tiempo_servicio`, solape por segmento con locks por estilista/día y precios/duraciones congelados en `reserva_servicio`. |
| **RF3** | Validación en Entrada y Cola | Alta | `POST /api/checkin/consultar` devuelve cliente, servicio, hora, estado de pago y total. `POST /api/checkin/llegada` registra la llegada por QR y pone al cliente en la cola. `POST /api/checkin/cobro-efectivo` registra el pago físico antes de iniciar. `POST /api/checkin/confirmar-pago` concilia un pago en línea sin finalizar. `POST /api/checkin/iniciar` exige pago aprobado o efectivo, llegada registrada y que falten **30 minutos o menos** para la cita; valida turno, jornada, descansos, duración y cruces. `POST /api/checkin/finalizar` deja la reserva en `cobrado` y habilita al siguiente cliente. Se conserva `POST /api/checkin/validar` como atajo atómico. |
| **RF4** | Registro de Cobro | Alta | El cobro se registra con `UNIQUE(reserva_id)`, monto ≥0 y `registrado_por`; si es online queda vinculado a `pago_id` y `pagado_antes`. El empleado puede cobrar por QR (cliente paga en su celular) o efectivo antes de iniciar; el administrador conserva su modal de cobro. No se permite doble cobro ni iniciar sin pago aprobado o efectivo registrado. |
| **RF5** | Generación de Reportes | Media | El administrador visualiza ventas por día (total y desglose proporcional por servicio en reservas multi-servicio), ocupación con porcentaje por sede, clientes recurrentes y nómina por empleado o consolidada, con filtro de sede y período, porcentaje de comisión y PDF descargable. La nómina usa solo servicios completados y pagados. Acceso restringido a rol `admin`. |
| **RF6** | Gestión de Ubicaciones | Alta | CRUD de sedes con nombre, dirección, departamento, ciudad y lat/lng (validación de rangos); las coordenadas alimentan los mapas Leaflet de cliente y empleado; la sede es obligatoria al reservar. Cada sede admite una imagen opcional del local, editable solo por el admin y visible para clientes y empleados; al hacer clic se amplía en un modal. |
| **RF7** | Perfil de Empleado | Media | El empleado ve y edita nombre, apellido y teléfono; el correo de acceso no se edita desde el perfil. Puede subir o quitar una foto opcional. El administrador también puede subir, cambiar o quitar la foto desde Equipo. La foto se muestra al cliente en la selección de estilista, la cita próxima y el detalle; si no existe, se usan iniciales. La **identificación** y los datos laborales los gestiona el administrador, que además administra todos los empleados (CRUD, sedes, horarios y servicios con duración). |
| **RF8** | Panel de Citas del Cliente | Media | El cliente ve su próxima cita y sus reservas en pestañas `Próximas`, `Historial` y `Canceladas`; la tarjeta principal muestra estado, estado de pago, fecha, servicios, estilista, sede, personas, duración y total. Al abrir el detalle se muestra el mapa Leaflet de la sede, el QR y la descarga; permite cancelar y pagar en línea las reservas activas impagas. |
| **RF9** | Disponibilidad del Empleado | Alta | El empleado autogestiona su semana en un kanban de 7 columnas: por cada día asigna **una sola sede fija**, un horario y uno o más descansos. Los descansos se guardan automáticamente al tocar el día, con modo **todo el día** o **rango de horas**, y se repiten cada semana. Si el descanso se cruza con citas futuras, se listan las citas afectadas, se confirma la cancelación, se notifica al cliente y se reutiliza el flujo de reembolso. El calendario público del cliente recibe los descansos y muestra esas franjas como **Descanso** deshabilitadas. Puede crear cambios temporales de sede por un rango de fechas; al terminar vuelve automáticamente a la sede base salvo que elija otra. Los festivos de Colombia se cierran por defecto; el admin puede abrir una o varias sedes y cada empleado decide si trabaja mediante opt-in. Al cambiar la sede de un día, el sistema advierte y cancela las reservas futuras de ese día en la sede anterior con motivo `"El empleado cambió de sede"`. También puede reportar un imprevisto de un día: se cancela la cita completa de cada cliente, se bloquea la fecha, se notifica por correo y se intenta reembolsar el pago online. |
| **RF10** | Panel del Empleado | Alta | El empleado ve la **Cola de hoy** con citas en servicio, en espera y programadas, y una agenda/timeline del día con color por estado (`pendiente` gris, `en curso` azul, `cobrado` verde, `cancelada` rojo). Dispone de botones rápidos `[Escanear QR]`, `[Validar]`, `[Cobrar]`, `[Atender]` y `[Finalizar]`, resumen del día y mapa Leaflet de la sede. La tarjeta **Mi desempeño** muestra, para el mes navegable, los **cortes realizados** (servicios cobrados y no reembolsados) y **ganado** (parte del empleado según su comisión), con el mismo cálculo que la nómina. |
| **RF11** | Panel del Administrador | Alta | Pantalla fija con: (a) 4 KPIs (ingresos del día, citas del día, ocupación promedio por sede y citas sin pago), (b) timeline **“El día en el salón”** por sede con filtros de departamento, ciudad, sede y fecha, (c) agenda del día con acciones de validación y cobro, (d) tarjetas **Requiere atención**, **Resumen por sede** y **Pagos del día**, y (e) navegación por sidebar a las páginas independientes: `Hoy`, `Agenda`, `Equipo`, `Servicios`, `Presentación`, `Sedes`, `Horarios`, `Clientes`, `Reportes` y `Actividad`. La página **Servicios** gestiona catálogo, categorías/títulos, hasta 6 imágenes por servicio (portada y galería), duraciones y máximo de servicios por reserva. La página **Horarios** integra el **Planificador por empleado** (matriz empleados × LUN–DOM con una sede por día, segmentos por estilista, citas superpuestas y editor por celda) y la pestaña **Jornada por sede**. |
| **RF12** | Gestión de Logs | Media | El administrador accede a `logs.txt` (actividad) y `errores.txt` (fallos) con: búsqueda por palabra clave, filtro por fecha (día Bogotá), filtro por severidad exacta (`INFO`, `WARN`, `ERROR`), visor con nivel/formato y exportación `.txt` por rango de líneas. El logger Pino escribe ambos archivos automáticamente. |
| **RF13** | Verificación de Cuenta | Alta | Al registrarse se crea la cuenta, se genera un OTP de 6 dígitos (hash SHA-256) y se envía por correo (Brevo API v3). El registro **no** emite JWT: `POST /api/auth/verificar` con `{ email, codigo }` emite el token. El tiempo de registro es **5 minutos** (`REGISTRO_TTL_MINUTOS`, reiniciable con `POST /api/auth/reenviar-codigo`, máx. 3 cada 15 min); al expirar, la cuenta sin verificar se **elimina** (purga periódica cada 60 s y al arrancar) y el correo queda libre para un nuevo registro. Si el correo ya existe **sin verificar**, un nuevo registro lo reemplaza (no responde 409); si está verificado, responde 409. Si el envío del OTP falla, la cuenta se conserva para reintentar con reenvío. El login de una cuenta sin verificar responde 403. Empleados creados por el admin nacen verificados. |
| **RF14** | Portada Pública y Presentación | Alta | La ruta pública `/` muestra hero, “cómo funciona”, carrusel de servicios con detalle, galería de imágenes/videos del salón, sedes y cierre con CTA. El contenido se obtiene de `/api/presentacion` y del catálogo público. El administrador edita textos y medios en Admin → Presentación, con vista previa, orden, visibilidad, carga de imágenes/videos y varias fuentes por video. La información vive en la base `sgp_presentacion` y el volumen `sgp-presentacion-media`; no afecta reservas ni pagos. |
| **RF15** | Pago en Línea Wompi | Alta | El cliente puede pagar en línea desde el paso final de la reserva o desde el panel de citas; el empleado puede generar un QR de pago para que el cliente pague desde su celular. `POST /api/pagos/intencion` recalcula el monto en el servidor, genera referencia única, firma de integridad, `checkout_url`, `qr_data_url` y configuración del widget. El pago se procesa con tarjeta, PSE, Nequi o Botón Bancolombia. `POST /api/pagos/webhook` valida firma SHA256 y es idempotente; `POST /api/pagos/:id/verificar` permite conciliar en local. Un pago aprobado crea/actualiza el `cobro` vinculado y confirma la reserva; uno declinado o con error deja la reserva `pendiente` para reintentar o pagar en efectivo. Las llaves privadas nunca se exponen al frontend. En un imprevisto del empleado se anula la transacción con tarjeta y se marca el reembolso; para otros métodos queda pendiente de gestión. |
| **RF16** | Autoservicio del Empleado | Media | El empleado puede gestionar su perfil (nombre, apellido, teléfono y foto opcional), elegir los servicios que realiza en **Mis servicios** y ajustar su duración entre 5 y 480 minutos; el precio solo lo modifica el administrador. La asignación se guarda en `empleado_tiempo_servicio` y alimenta la duración de las reservas. |
| **RF17** | Preferencias y Tema | Media | El cliente y el empleado pueden definir departamento/ciudad preferidos, rango horario (`rango_hora_desde`, `rango_hora_hasta`) y granularidad del calendario (15/30/60 min). Las preferencias se usan para prefiltrar sedes y slots. El tema claro/oscuro/sistema se persiste en `localStorage` (`sgp_tema`) y el modelo `preferencia_usuario` conserva el campo `tema`; el QR siempre se muestra sobre blanco. |
| **RF18** | Catálogo Público y Sedes Alternativas | Media | El catálogo público permite consultar categorías y servicios con portada, precio, duración y total de imágenes; el detalle se abre en modal con carrusel de hasta 6 imágenes y flechas laterales. La galería se carga bajo demanda con `GET /api/reservas/servicios/:id/imagenes`. Si la sede elegida no tiene estilista para el servicio, se muestran sedes alternativas con mapa y se permite cambiar de sede o quitar el servicio. |

### 3.3 Requisitos no funcionales

| RNF | Área | Descripción |
|-----|------|-------------|
| **RNF1** | Rendimiento | Consultas indexadas (`qr_token`, `inicia_en`, `empleado_id`, etc.) y paginación implícita por fecha; validación QR en menos de 0.5 s. La portada pública carga catálogo y presentación en paralelo y tolera fallos parciales. |
| **RNF2** | Seguridad | Contraseñas con bcrypt (12 rounds); teléfono cifrado en reposo con AES-256-CBC (`AES_SECRET`); JWT 30 min; RBAC; rate limiting (10 intentos fallidos/15 min en auth, 3 reenvíos OTP/15 min); Helmet; CORS restringido; SQL parametrizado; webhook Wompi con firma SHA256; llaves privadas solo en backend. HTTPS obligatorio en producción (la demo local usa HTTP y `localhost` para la cámara). |
| **RNF3** | Fiabilidad | Transacciones (`withTransaction`), locks por empleado/día y `UNIQUE(reserva_id)` evitan dobles cobros y solapes; webhook Wompi idempotente; manejo centralizado de errores PostgreSQL (23505/23503/23514/22P02). |
| **RNF4** | Disponibilidad | Despliegue por pods independientes (`sgp-db`, `sgp-app`) con volumen persistente; reinicio del backend sin perder datos. La base y el volumen de presentación son independientes de la operación de reservas y pagos. |
| **RNF5** | Mantenibilidad | Arquitectura feature-based (`routes → controller → service → model`), frontend modular por funcionalidad y secciones; ESLint limpio; pruebas de integración (58), datos (15), esquema (90), unitarias (57), E2E (47), regresión 10x10 (129), verificación semanal (70) y presentación (6); cobertura actual ≥85 % de líneas; documentación API auto-generada (Swagger en `/api/docs`). |
| **RNF6** | Portabilidad | Backend Node.js/Express compatible con Podman y Kubernetes (manifiestos YAML de pods); dos bases PostgreSQL 17 y un volumen de medios independiente. |

### 3.4 Otros requisitos

- **Legales:** tratamiento de datos personales acorde a prácticas GDPR (minimización y cifrado del teléfono); aplicabilidad sujeta a la ubicación del negocio.
- **Culturales:** interfaz siempre en español; no hay conmutador de idioma ni preferencia por usuario.
- **Operativos:** tema claro/oscuro/sistema, preferencias de ubicación/calendario y portada pública administrable; la información de presentación no se mezcla con la base operativa.

---

## 4. Apéndice A — Glosario

| Término | Definición |
|---------|------------|
| Activas (reservas) | Reservas en estado `pendiente`, `confirmada` o `en_curso`. |
| Cobro | Registro de pago asociado 1:1 a una reserva (`fisico` u `online`). |
| Disponibilidad | Plantilla semanal `(empleado, sede, día, hora_inicio, hora_fin, descansos)`; una sede por día por empleado, cambios temporales y opt-in de festivos. |
| Imprevisto | Cancelación de un día reportada por el empleado; bloquea la fecha, cancela las citas, notifica y gestiona el reembolso. |
| Jornada | Horario de atención de una sede en una fecha (`jornada`). |
| Kanban de disponibilidad | Tablero semanal del empleado con 7 columnas (LUN–DOM), una sede fija por día, horario y descansos. |
| Panel de citas | Vista del cliente con próxima cita y pestañas de próximas, historial y canceladas. |
| Pago Wompi | Intento de pago digital con referencia única, estado, monto, método y transacción; se concilia con webhook o verificación. |
| Planificador | Matriz administrador empleados × días con sede, turno y citas. |
| Portada pública | Página `/` con presentación del salón, servicios, sedes y CTA; se edita en Admin → Presentación. |
| Preferencias | Departamento/ciudad, rango horario y granularidad del calendario por usuario. |
| QR token | UUID único por reserva usado para validar el ingreso. |
| Reembolso | Anulación o devolución de un pago Wompi; automática para tarjeta en imprevisto y pendiente para otros métodos. |
| Seed demo | Dataset masivo reproducible (`semillar-demo.js`) con sedes, empleados, clientes, reservas y cobros. |
| Tema | Preferencia visual claro/oscuro/sistema, persistida en `sgp_tema`. |
| Ventana de validación | Intervalo ±120 minutos alrededor de la hora de la cita; el inicio se permite hasta 30 minutos antes. |

## 5. Apéndice B — Modelos UML y diagramas

Los diagramas se encuentran en formato draw.io (editables) y describen el diseño del sistema:

| Diagrama | Archivo | Página |
|----------|---------|--------|
| Flujo actual | `docs/diagrama.drawio` | Flujo actual |
| Pago Wompi | `docs/diagrama.drawio` | Pago Wompi |
| Portada pública | `docs/diagrama.drawio` | Portada pública |
| Autoservicio del empleado | `docs/diagrama.drawio` | Autoservicio del empleado |
| Casos de uso | `docs/modelos-uml.drawio` | Casos de uso |
| Clases / dominio | `docs/modelos-uml.drawio` | Clases |
| Secuencia Reserva → QR | `docs/modelos-uml.drawio` | Secuencia reserva |
| Secuencia Validación → Cobro | `docs/modelos-uml.drawio` | Secuencia check-in |
| Estados de la reserva | `docs/modelos-uml.drawio` | Estados |
| Despliegue (pods) | `docs/modelos-uml.drawio` | Despliegue |
| Modelo entidad-relación | `docs/modelos-uml.drawio` | Modelo ER |

La página `Histórico` de `docs/diagrama.drawio` conserva el flujo anterior; la referencia vigente es la página `Flujo actual`, complementada con `Pago Wompi`, `Portada pública` y `Autoservicio del empleado`.

La correspondencia entre el modelo ER y el esquema real se documenta en `docs/modelo-datos.md` y se verifica con `tests/esquema.sh`.

## 6. Apéndice C — Matriz de trazabilidad (RF ↔ F ↔ módulo ↔ prueba)

| RF | F | Módulo backend | Módulo frontend | Prueba |
|----|---|----------------|-----------------|--------|
| RF0 | F6 | `features/auth/*` | `funcionalidades/auth/login-page.jsx` | `tests/api.sh` (login admin/empleado), `tests/e2e.py` |
| RF1 | F1 | `features/auth/*`, `shared/utils/telefono.js` | `auth/registro-page.jsx` | `tests/api.sh` (registro 201), E2E, unitarias auth |
| RF2 | F2 | `features/reservas/*` | `cliente/nueva-reserva.jsx` | E2E (reserva, duración, solape 409), unitarias reservas, regresión 10x10, verificación semanal |
| RF3 | F3 | `features/checkin/*` | `empleado/empleado-dashboard.jsx` | `tests/regresion_10x10.py` (llegada, inicio, finalización, acceso por empleado), E2E (cobrado y doble cobro), unitarias checkin |
| RF4 | F4 | `features/checkin/*`, `features/pagos/*` | `empleado/empleado-dashboard.jsx`, `componentes/pagos/*` | `tests/regresion_10x10.py` (QR, webhook, efectivo, pago vinculado), E2E, unitarias pagos/checkin |
| RF5 | F5 | `features/reportes/*` | `admin/secciones/reportes-seccion.jsx` | `tests/api.sh` (ocupación admin), E2E (ventas/ocupación), unitarias reportes |
| RF6 | F7 | `features/ubicaciones/*` | `admin/secciones/sedes-seccion.jsx`, `cliente/nueva-reserva.jsx`, `empleado/empleado-dashboard.jsx` | `tests/api.sh` (catálogo público), E2E (crear/eliminar sede), unitarias ubicaciones y pruebas de imagen de sede |
| RF7 | F6, F1 | `features/clientes/*`, `features/auth/*` | `empleado/mi-perfil.jsx`, `admin/secciones/empleados-seccion.jsx`, `cliente/nueva-reserva.jsx` | Unitarias (`auth.service`, `clientes.service`), manual |
| RF8 | F8 | `features/reservas/*` (me) | `cliente/cliente-dashboard.jsx` | Capturas (`docs/mockups.md`), E2E (`/reservas/me`) |
| RF9 | F9 | `features/disponibilidad/*` | `admin/secciones/planificador-horarios.jsx`, `empleado/mi-disponibilidad.jsx` | E2E (cancelación con motivo exacto), `tests/datos.sh`, unitarias disponibilidad, verificación semanal |
| RF10 | F10 | `features/reservas/*` | `empleado/empleado-dashboard.jsx` | Capturas, E2E |
| RF11 | F11 | `features/*` | `admin/admin-dashboard.jsx` + `admin/secciones/*` | Capturas (dashboard/planificador), `tests/api.sh` (agenda), verificación semanal |
| RF12 | F12 | `features/logs/*` | `admin/secciones/logs-seccion.jsx` | `tests/api.sh` (actividad 200/401, export text/plain), unitarias logs |
| RF13 | F13 | `features/auth/*`, `integrations/email/mailer.js` | `auth/verificar-page.jsx` | `tests/api.sh` (registro, re-registro sin verificar, 403, código incorrecto), unitarias (reemplazo y purga de expirados) |
| RF14 | F14 | `features/presentacion/*` | `presentacion/presentacion-page.jsx`, `admin/secciones/presentacion-seccion.jsx` | `tests/presentacion.sh`, `tests/verificacion_semana.py`, capturas |
| RF15 | F15 | `features/pagos/*`, `features/checkin/*`, `features/reservas/*` | `componentes/pagos/*`, `cliente/cliente-dashboard.jsx`, `empleado/empleado-dashboard.jsx` | `tests/api.sh` (RBAC, webhook firma inválida), `tests/e2e.py`, `tests/regresion_10x10.py`, unitarias `wompi`/`pagos` |
| RF16 | F16 | `features/reservas/*`, `features/clientes/*` | `empleado/mis-servicios.jsx`, `empleado/mi-perfil.jsx` | Unitarias (`reservas`, `clientes`), manual |
| RF17 | F17 | `features/preferencias/*` | `cliente/mi-perfil.jsx`, `cliente/nueva-reserva.jsx`, `contexto/tema-context.jsx` | `tests/regresion_10x10.py` (preferencias), unitarias preferencias, manual/capturas |
| RF18 | F18 | `features/reservas/*` | `cliente/nueva-reserva.jsx`, `componentes/servicios/*` | Unitarias reservas, `tests/api.sh` (catálogo/galería), `tests/verificacion_semana.py` |
| UI1/UI2/UI3/UI4/UI5 | F1–F18 | — | `componentes/*`, `contexto/tema-context.jsx` | Capturas en español y móvil (`docs/mockups.md`), revisión manual |
| API1/API2/API3 | — | `routes/api.routes.js`, `backend/src/docs/openapi.js` | — | `tests/api.sh` (docs/openapi 200, RBAC, contrato) |
| COM1 | — | `integrations/realtime/ws-hub.js` | `hooks/use-websocket.js` | E2E (RF9 emite `reserva.actualizada`) |
| RNF2 | — | `shared/utils/*`, middlewares | — | `tests/unit/*` (encriptación/telefono), revisión de cabeceras |
| RNF5 | — | — | — | `tests/unit/*` con cobertura, `tests/api.sh`, `tests/datos.sh`, `tests/esquema.sh`, `tests/e2e.py`, `tests/regresion_10x10.py`, `tests/verificacion_semana.py`, `tests/presentacion.sh` |

> Estado general: todos los RF0–RF18 de la tabla están implementados y verificados por al menos un tipo de prueba; las funciones sin prueba automatizada se validan manualmente o con capturas. Ver `docs/plan-pruebas.md` para la estrategia y el reporte de cobertura.
