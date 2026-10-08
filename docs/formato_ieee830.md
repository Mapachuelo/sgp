# Especificación de Requisitos de Software (IEEE 830)

**Sistema de Gestión de Peluquería (SGP)**

| Campo | Valor |
|-------|-------|
| Estándar | IEEE Std 830-1998, *Software Requirements Specification* |
| Versión | 2.0 |
| Estado | Aprobado para implementación y verificación |
| Documentos relacionados | `docs/diseno-tecnico.md`, `docs/modelos-uml.drawio`, `docs/modelo-datos.md`, `docs/plan-pruebas.md`, `README.md` |

---

## 1. Introducción

### 1.1 Propósito

Este documento especifica los requisitos funcionales y no funcionales del **Sistema de Gestión de Peluquería (SGP)**. Es la referencia única para el diseño, la implementación, las pruebas y la verificación del software entregado.

### 1.2 Alcance

El SGP es una aplicación web fullstack desplegable con Podman que permite:

- Registro y gestión de clientes con verificación de cuenta por OTP.
- Gestión de sedes físicas con coordenadas geográficas.
- Reserva de citas en línea con calendario interactivo, selección de sede, estilista, servicio y cantidad de personas, con generación de código QR único.
- Validación de ingreso por QR y registro de cobro en un solo paso atómico.
- Cobro digital con pasarela **Wompi** (tarjeta credito/debito, PSE, Nequi, Boton Bancolombia) mediante widget embebido; pago fisico (efectivo) registrado en el local. El monto se recalcula en el servidor y el webhook valida firma SHA256.
- Paneles diferenciados para cliente, empleado y administrador, incluido un planificador de horarios multi-sede.
- Reportes administrativos de ventas, ocupación y clientes recurrentes.
- Gestión de logs del sistema (`logs.txt` y `errores.txt`).
- Interfaz multilingüe español/inglés.

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

El glosario ampliado está en el Apéndice A.

### 1.4 Referencias

- IEEE Std 830-1998, *Software Requirements Specification*.
- ISO/IEC 18004 (estándar de códigos QR).
- `README.md` — documentación de despliegue, API y reglas de negocio.
- `docs/diseno-tecnico.md` — diseño técnico y modelos UML.
- `docs/modelo-datos.md` — modelo entidad-relación y diccionario de datos.
- `docs/plan-pruebas.md` — estrategia y matriz de pruebas.

### 1.5 Visión general del documento

El documento se estructura en: descripción general del producto (sección 2), requisitos específicos (sección 3) y apéndices (sección 4+). Cada requisito funcional tiene código `RF#` y trazabilidad hacia las funcionalidades `F#` del producto, los módulos del código y las pruebas que lo verifican (Apéndice C).

---

## 2. Descripción general

### 2.1 Perspectiva del producto

El SGP es un producto independiente desplegable con Podman (aplicación + PostgreSQL 17) y sin integraciones externas obligatorias salvo el envío de correo de verificación (Brevo API v3). La arquitectura es de tres capas:

```
┌───────────────────────────────┐
│ Frontend Web (React + Vite)   │  Nginx sirve la SPA y proxya /api
├───────────────────────────────┤
│ API Node.js/Express (REST+WS) │  JWT + RBAC + Pino + WebSocket
├───────────────────────────────┤
│ PostgreSQL 17 (SQL directo)   │  10 tablas, sin ORM
└───────────────────────────────┘
```

### 2.2 Funcionalidades del producto

| ID | Función | Descripción |
|----|---------|-------------|
| **F1** | Gestión de Clientes | Registro, verificación OTP, actualización, bloqueo/desbloqueo y borrado. |
| **F2** | Reservas en Línea | Selección de sede, estilista, servicio, fecha/hora y personas; generación de QR. |
| **F3** | Validación en Entrada | Escaneo/ingreso del token QR con control de estado y ventana horaria. |
| **F4** | Cobro | Registro del cobro en el mismo paso de validación; método `fisico` u `online`; sin doble cobro. |
| **F5** | Reportes Administrativos | Ventas por día, ocupación por sede y clientes recurrentes (solo admin). |
| **F6** | Login Unificado | Formulario único en `/login` con redirección según rol. |
| **F7** | Gestión de Ubicaciones | CRUD de sedes con nombre, dirección y coordenadas lat/lng. |
| **F8** | Panel de Reservas | Kanban del cliente por estado + mapa lateral de la sede + descarga de QR. |
| **F9** | Gestión de Disponibilidad | Disponibilidad semanal del empleado por sede (una sede por día) con cancelación y notificación al cambiar de sede. |
| **F10** | Panel del Empleado | Timeline de citas del día, colores por estado, mapa de la sede y acciones rápidas de validación y cobro. |
| **F11** | Panel del Administrador | KPIs, timeline general, planificador de horarios por empleado y ventanas flotantes de gestión. |
| **F12** | Gestión de Logs | `logs.txt` y `errores.txt` con búsqueda, filtros y exportación `.txt`. |
| **F13** | Verificación de Cuenta | OTP de 6 dígitos enviado por correo; login bloqueado hasta verificar. |

### 2.3 Características de los usuarios

| Tipo | Habilidades | Acciones principales |
|------|-------------|----------------------|
| Cliente | Básicas de navegador | Registrarse, reservar (hasta 5 activas), ver kanban+mapa, descargar QR, cancelar y editar perfil. |
| Empleado | Medias | Ver citas del día, validar QR, registrar cobro, gestionar su disponibilidad semanal por sede y editar su perfil. |
| Administrador | Altas | KPIs, timeline de todas las sedes, planificador de horarios multi-sede, CRUD de empleados/servicios/sedes, jornadas, reportes, moderación de clientes y logs. |

### 2.4 Restricciones

- Navegadores soportados: Chrome ≥ 80, Firefox ≥ 75.
- Backend sobre Linux (contenedor Node 22 Alpine); base PostgreSQL 17.
- API RESTful con JSON; autenticación JWT (expiración 30 minutos).
- QR conforme a ISO/IEC 18004 (librería `qrcode`).
- Despliegue exclusivamente con Podman (`kube play`), sin Docker.
- Sin ORM: SQL directo con `pg`.
- Sin TypeScript: JavaScript (React) y CommonJS (Express).

### 2.5 Suposiciones y dependencias

- El establecimiento dispone de conexión a internet para el envío de OTP (Brevo).
- El cliente presenta el QR (imagen o token) al llegar; el empleado puede ingresarlo manualmente.
- El cobro digital depende de Wompi (sandbox o produccion segun las llaves configuradas) y de que el comercio tenga habilitados los metodos de pago en su cuenta.
- Zona horaria de operación: `America/Bogota`.

### 2.6 Evolución previsible

1. Aplicación móvil nativa.
2. Reembolsos/anulación automática de pagos Wompi al cancelar una reserva pagada (hoy se gestiona manualmente desde el dashboard de Wompi).
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
| UI3 | Idioma | Conmutador ES/EN en la barra de navegación; preferencia persistida por usuario (`preferencia_usuario.idioma`). |

#### 3.1.2 Interfaz de hardware

| ID | Requisito | Descripción |
|----|-----------|-------------|
| HW1 | Lectura QR | Entrada manual del token y vista de cámara con solicitud de permisos; procesamiento de validación en menos de 0.5 s (consulta indexada por `qr_token`). |

#### 3.1.3 Interfaz de software (API)

| ID | Requisito | Descripción |
|----|-----------|-------------|
| API1 | Endpoints REST | `/api/auth/*`, `/api/clientes/*`, `/api/ubicaciones/*`, `/api/reservas/*` (incluye `/agenda`), `/api/checkin/validar`, `/api/reportes/*`, `/api/empleados/disponibilidad` (incluye `/todas`), `/api/logs/*`, `/api/preferencias`. Documentados en `/api/docs` (OpenAPI 3). |
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
| **RF1** | Registro de Cliente | Alta | El cliente se registra con nombre, apellido, celular colombiano (`+57` + 10 dígitos), correo y contraseña. Validación de formato de correo y teléfono en backend; teléfono cifrado en reposo. |
| **RF2** | Reserva de Cita | Alta | Flujo: (1) sede, (2) estilista disponible en los próximos 6 días, (3) calendario con slots disponible/ocupado/no disponible/pasado/antelación, (4) ventana flotante con servicio, **duración estimada entrada→salida** y **personas (1–5)** que se abre al hacer clic en un horario libre, (5) confirmación con QR. Validaciones de servidor: máximo 5 activas, anticipación ≥60 min, disponibilidad semanal del empleado, duración desde `empleado_tiempo_servicio`, solape con bloqueo por `pg_advisory_xact_lock` (409 con sugerencia de otro horario) y cálculo de `termina_en`. |
| **RF3** | Validación en Entrada | Alta | `POST /api/checkin/validar` recibe `{ qr_token, monto }`; valida token UUID, estado activo y ventana ±120 min; en una transacción con `SELECT ... FOR UPDATE` registra el cobro y deja la reserva en estado `cobrado`; `monto=0` ⇒ `online`, `monto>0` ⇒ `fisico`; un segundo intento responde 409. |
| **RF4** | Registro de Cobro | Alta | El cobro se registra en el mismo paso atómico del RF3 (`cobro` con `UNIQUE(reserva_id)`), con monto numérico ≥0 y `registrado_por`. El administrador y el empleado disponen de modal de cobro con selector de método. |
| **RF5** | Generación de Reportes | Media | El administrador visualiza ventas por día (total y desglose por servicio), ocupación con porcentaje por sede y clientes recurrentes. Acceso restringido a rol `admin`. |
| **RF6** | Gestión de Ubicaciones | Alta | CRUD de sedes con nombre, dirección y lat/lng (validación de rangos); las coordenadas alimentan los mapas Leaflet de cliente y empleado; la sede es obligatoria al reservar. |
| **RF7** | Perfil de Empleado | Media | El empleado ve y edita nombre, apellido, teléfono, correo e **identificación**; el administrador gestiona todos los empleados (CRUD, sedes, horarios y servicios con duración). |
| **RF8** | Panel de Reservas (Kanban + Mapa) | Media | El cliente ve sus reservas en columnas por estado (`pendiente`, `confirmada`, `en_curso`, `completada`=`cobrado`, `cancelada`); al seleccionar una reserva, el panel lateral muestra el mapa Leaflet de la sede, el detalle, el QR y la descarga; permite cancelar. |
| **RF9** | Disponibilidad del Empleado | Alta | El empleado autogestiona su semana: por cada día asigna **una sola sede** y un horario. Al cambiar la sede de un día, el sistema advierte y cancela las reservas futuras de ese día en la sede anterior con motivo `"El empleado cambió de sede"`, notificando por WebSocket; el administrador puede reasignar sedes/días desde el planificador. |
| **RF10** | Dashboard del Empleado | Alta | El empleado ve las citas del día de la(s) sede(s) donde trabaja, en timeline con color por estado (`pendiente` gris, `en curso` azul, `cobrado` verde, `cancelada` rojo), botones rápidos `[Validar QR]` y `[Registrar cobro]`, resumen del día y mapa Leaflet de la sede. |
| **RF11** | Dashboard del Administrador | Alta | Pantalla fija con: (a) 4 KPIs (recaudación del día, reservas del día, tasa de ocupación promedio por sede, clientes recurrentes), (b) timeline de todas las citas del día filtrable por sede y fecha, (c) tarjeta **Gestión** con 9 accesos que abren ventanas flotantes (una a la vez): `[Validar QR]` y `[Cobro]` como modales centrados; `[Empleados]`, `[Servicios]`, `[Sedes]`, `[Horarios]`, `[Reportes]`, `[Moderar clientes]` y `[Logs]` como sheets laterales. El sheet **Horarios** integra el **Planificador por empleado** (matriz empleados × LUN–DOM con una sede por día, citas superpuestas y editor por celda) y la pestaña **Jornada por sede**. El dashboard permanece visible de fondo. |
| **RF12** | Gestión de Logs | Media | El administrador accede a `logs.txt` (actividad) y `errores.txt` (fallos) con: búsqueda por palabra clave, filtro por fecha (día Bogotá), filtro por severidad exacta (`INFO`, `WARN`, `ERROR`), visor con nivel/formato y exportación `.txt` por rango de líneas. El logger Pino escribe ambos archivos automáticamente. |
| **RF13** | Verificación de Cuenta | Alta | Al registrarse se crea la cuenta, se genera un OTP de 6 dígitos (hash SHA-256) y se envía por correo (Brevo API v3). El registro **no** emite JWT: `POST /api/auth/verificar` con `{ email, codigo }` emite el token. El tiempo de registro es **5 minutos** (`REGISTRO_TTL_MINUTOS`, reiniciable con `POST /api/auth/reenviar-codigo`, máx. 3 cada 15 min); al expirar, la cuenta sin verificar se **elimina** (purga periódica cada 60 s y al arrancar) y el correo queda libre para un nuevo registro. Si el correo ya existe **sin verificar**, un nuevo registro lo reemplaza (no responde 409); si está verificado, responde 409. Si el envío del OTP falla, la cuenta se conserva para reintentar con reenvío. El login de una cuenta sin verificar responde 403. Empleados creados por el admin nacen verificados. |

### 3.3 Requisitos no funcionales

| RNF | Área | Descripción |
|-----|------|-------------|
| **RNF1** | Rendimiento | Consultas indexadas (`qr_token`, `inicia_en`, `empleado_id`, etc.) y paginación implícita por fecha; validación QR en menos de 0.5 s. |
| **RNF2** | Seguridad | Contraseñas con bcrypt (12 rounds); teléfono cifrado en reposo con AES-256-CBC (`AES_SECRET`); JWT 30 min; RBAC; rate limiting (10 intentos/15 min en auth, 3 reenvíos OTP/15 min); Helmet; CORS restringido; SQL parametrizado. HTTPS obligatorio en producción (la demo local usa HTTP y `localhost` para la cámara). |
| **RNF3** | Fiabilidad | Transacciones (`withTransaction`) y locks por empleado/día evitan dobles cobros y solapes; manejo centralizado de errores PostgreSQL (23505/23503/23514/22P02). |
| **RNF4** | Disponibilidad | Despliegue por pods independientes (`sgp-db`, `sgp-app`) con volumen persistente; reinicio del backend sin perder datos. |
| **RNF5** | Mantenibilidad | Arquitectura feature-based (`routes → controller → service → model`), frontend modular por funcionalidad y secciones; ESLint limpio; pruebas de integración, datos, unitarias con cobertura y E2E; documentación API auto-generada (Swagger en `/api/docs`). |
| **RNF6** | Portabilidad | Backend Node.js/Express compatible con Podman y Kubernetes (manifiestos YAML de pods). |

### 3.4 Otros requisitos

- **Legales:** tratamiento de datos personales acorde a prácticas GDPR (minimización y cifrado del teléfono); aplicabilidad sujeta a la ubicación del negocio.
- **Culturales:** interfaz bilingüe español/inglés implementada (conmutador y preferencia por usuario).

---

## 4. Apéndice A — Glosario

| Término | Definición |
|---------|------------|
| Activas (reservas) | Reservas en estado `pendiente`, `confirmada` o `en_curso`. |
| Cobro | Registro de pago asociado 1:1 a una reserva (`fisico` u `online`). |
| Disponibilidad | Bloques semanales `(empleado, sede, día, hora_inicio, hora_fin)`; una sede por día por empleado. |
| Jornada | Horario de atención de una sede en una fecha (`jornada`). |
| Kanban | Tablero del cliente con columnas por estado de reserva. |
| Planificador | Matriz administrador empleados × días con sede, turno y citas. |
| QR token | UUID único por reserva usado para validar el ingreso. |
| Seed demo | Dataset masivo reproducible (`semillar-demo.js`) con sedes, empleados, clientes, reservas y cobros. |
| Ventana de validación | Intervalo ±120 minutos alrededor de la hora de la cita. |

## 5. Apéndice B — Modelos UML y diagramas

Los diagramas se encuentran en formato draw.io (editables) y describen el diseño del sistema:

| Diagrama | Archivo | Página |
|----------|---------|--------|
| Flujo de trabajo (actualizado) | `docs/diagrama.drawio` | Flujo actual |
| Casos de uso | `docs/modelos-uml.drawio` | Casos de uso |
| Clases / dominio | `docs/modelos-uml.drawio` | Clases |
| Secuencia Reserva → QR | `docs/modelos-uml.drawio` | Secuencia reserva |
| Secuencia Validación → Cobro | `docs/modelos-uml.drawio` | Secuencia check-in |
| Estados de la reserva | `docs/modelos-uml.drawio` | Estados |
| Despliegue (pods) | `docs/modelos-uml.drawio` | Despliegue |
| Modelo entidad-relación | `docs/modelos-uml.drawio` | Modelo ER |

La correspondencia entre el modelo ER y el esquema real se documenta en `docs/modelo-datos.md` y se verifica con `tests/esquema.sh`.

## 6. Apéndice C — Matriz de trazabilidad (RF ↔ F ↔ módulo ↔ prueba)

| RF | F | Módulo backend | Módulo frontend | Prueba |
|----|---|----------------|-----------------|--------|
| RF0 | F6 | `features/auth/*` | `funcionalidades/auth/login-page.jsx` | `tests/api.sh` (login admin/empleado), `tests/e2e.py` |
| RF1 | F1 | `features/auth/*`, `shared/utils/telefono.js` | `auth/registro-page.jsx` | `tests/api.sh` (registro 201), E2E |
| RF2 | F2 | `features/reservas/*` | `cliente/nueva-reserva.jsx` | E2E (reserva, duración, solape 409) |
| RF3 | F3 | `features/checkin/*` | `empleado/empleado-dashboard.jsx` | `tests/api.sh` (UUID/monto/404), E2E (cobrado y doble cobro) |
| RF4 | F4 | `features/checkin/*` | `admin/secciones/cobro-modal.jsx` | E2E (método físico, monto) |
| RF5 | F5 | `features/reportes/*` | `admin/secciones/reportes-seccion.jsx` | `tests/api.sh` (ocupación admin), E2E (ventas/ocupación) |
| RF6 | F7 | `features/ubicaciones/*` | `admin/secciones/sedes-seccion.jsx` | `tests/api.sh` (catálogo público), E2E (crear/eliminar sede) |
| RF7 | F6, F1 | `features/clientes/*`, `features/auth/*` | `empleado/mi-perfil.jsx` | Unitarias (`clientes.service`), manual |
| RF8 | F8 | `features/reservas/*` (me) | `cliente/cliente-dashboard.jsx` | Capturas (`docs/mockups.md`), E2E (`/reservas/me`) |
| RF9 | F9 | `features/disponibilidad/*` | `admin/secciones/planificador-horarios.jsx`, `empleado/mi-disponibilidad.jsx` | E2E (cancelación con motivo exacto), `tests/datos.sh` |
| RF10 | F10 | `features/reservas/*` | `empleado/empleado-dashboard.jsx` | Capturas, E2E |
| RF11 | F11 | `features/*` | `admin/admin-dashboard.jsx` + `admin/secciones/*` | Capturas (planificador/dashboard), `tests/api.sh` (agenda) |
| RF12 | F12 | `features/logs/*` | `admin/secciones/logs-seccion.jsx` | `tests/api.sh` (actividad 200/401, export text/plain) |
| RF13 | F13 | `features/auth/*`, `integrations/email/mailer.js` | `auth/verificar-page.jsx` | `tests/api.sh` (registro, re-registro sin verificar, 403, código incorrecto), unitarias (reemplazo y purga de expirados) |
| UI1/UI2/UI3 | F1–F13 | — | `componentes/*`, `i18n/*` | Capturas ES/EN y móvil (`docs/mockups.md`) |
| API1/API2 | — | `routes/api.routes.js`, `docs/openapi.js` | — | `tests/api.sh` (docs/openapi 200, RBAC) |
| COM1 | — | `integrations/realtime/ws-hub.js` | `hooks/use-websocket.js` | E2E (RF9 emite `reserva.actualizada`) |
| RNF2 | — | `shared/utils/*`, middlewares | — | `tests/unit/*` (encriptación/telefono), revisión de cabeceras |
| RNF5 | — | — | — | `tests/unit/*` con cobertura, `tests/api.sh`, `tests/datos.sh`, `tests/esquema.sh` |

> Estado general: todos los RF de la tabla están implementados y verificados por al menos un tipo de prueba. Ver `docs/plan-pruebas.md` para la estrategia y el reporte de cobertura.
