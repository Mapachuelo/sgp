## 1. Introducción

### 1.1 Propósito  
Este documento describe los requisitos funcionales y no‑funcionales del **Sistema de Gestión de Peluquería** (SGP). Su objetivo es proporcionar una referencia única para el diseño, la implementación y las pruebas del software.

### 1.2 Alcance  
El SGP permitirá:

- Registro y gestión de clientes.
- Gestión de ubicaciones (sedes físicas).
- Reserva de citas vía web con calendario interactivo y programación automática.
- Generación de códigos QR únicos por cita para validación en la entrada.
- **Registro de pagos en local (físico o digital).** *(Eliminado: pasarela de pagos online automatizada)*
- Emisión de reportes administrativos.
- Gestión de logs del sistema (actividad y errores).

### 1.3 Definiciones, Acrónimos y Abreviaturas  

| Sigla | Significado |
|-------|-------------|
| SGP   | Sistema de Gestión de Peluquería |
| QR    | Quick‑Response (código QR) |
| UI    | User Interface (interfaz de usuario) |
| API   | Application Programming Interface |
| DB    | Base de Datos |

### 1.4 Referencias  
- IEEE Std 830‑1998, *Software Requirements Specification*.
- Documentos internos: "Plan de Proyecto – Peluquería" (v1.2), "Requisitos de Seguridad Web" (v0.9).

### 1.5 Visión General del Documento  
El SGP se compone de tres capas principales: **Web Front‑End**, **API Back‑End** y **Base de Datos**. El documento está estructurado en:

- Sección de descripción general para contextualizar el producto.
- Requisitos específicos (interfaces, funcionales y no‑funcionales).

---

## 2. Descripción General

### 2.1 Perspectiva del Producto  
El SGP es un **producto independiente** desplegable con Podman (app + PostgreSQL) y sin integraciones externas obligatorias en el MVP. El correo de confirmacion y otras integraciones quedan como mejoras futuras.

```
┌───────────────────────┐
│    Frontend Web UI    │
├───────────────────────┤
│   API Node.js/Express │
├───────────────────────┤
│   PostgreSQL (última LTS) │
└───────────────────────┘
```

> *Diagrama completo a incluir en la entrega final.*

### 2.2 Funcionalidades del Producto  
| ID | Función | Descripción |
|----|---------|-------------|
| **F1** | Gestión de Clientes | Registro, actualización y borrado de datos personales. |
| **F2** | Reservas Online | Selección de ubicación, empleado, servicio, fecha/hora mediante calendario interactivo y generación de QR. |
| **F3** | Validación en Entrada | Escaneo del QR con control de horarios. |
| **F4** | **Cobro en Local** | Pago físico (efectivo) o digital (transferencia/Nequi) con registro por empleado. El empleado elige el método al cobrar. |
| **F5** | Reportes Administrativos | Ventas, ocupación y métricas de uso (exclusivo administrador). |
| **F6** | Login Unificado | Inicio de sesion unico en `/login` y redireccion por rol segun respuesta del backend. |
| **F7** | Gestión de Ubicaciones | CRUD de sedes físicas con nombre, dirección y coordenadas (lat/lng) para alimentar el mapa interactivo. |
| **F8** | Panel de Reservas | Vista kanban de reservas del cliente por columnas de estado + mapa lateral con ubicación de la sede. |
| **F9** | Gestión de Disponibilidad | El empleado autogestiona su calendario semanal: asigna qué sede y horario cubre cada día de la semana. Al cambiar de sede, las reservas futuras en la sede anterior se cancelan automáticamente. |
| **F10** | Panel del Empleado | Dashboard del empleado con timeline de citas del día, mapa de la sede donde trabaja hoy, botones de validación QR y cobro. |
| **F11** | Panel del Administrador | Dashboard con KPIs, timeline de citas de todas las sedes, y barra de botones que abren ventanas flotantes (modales/sheets) para cada sección: validar QR, cobro, empleados, servicios, sedes, horarios, reportes, moderar clientes y logs. |
| **F12** | Gestión de Logs | El administrador accede a dos archivos desde el panel: `logs.txt` (actividad general del sistema) y `errores.txt` (errores y excepciones). Permite buscar, filtrar por fecha/severidad y exportar. |

### 2.3 Características de los Usuarios  
| Tipo de Usuario | Habilidades | Acciones Principales |
|-----------------|-------------|----------------------|
| Cliente         | Básica (navegador web) | Registrarse, seleccionar ubicación y empleado, reservar cita en calendario, recibir/descargar QR, ver panel kanban de sus reservas con mapa de la sede, gestionar sus reservas (hasta 5 activas), cancelar reservas. |
| Empleado        | Media (uso de terminales) | Ver panel de citas del día, validar entrada por QR (cámara + manual), registrar cobro (físico o digital), ver mapa de la sede donde trabaja hoy, autogestionar su disponibilidad semanal por sede, editar su perfil. |
| Administrador   | Alta (gestión del sistema) | Dashboard con KPIs y citas de todas las sedes. Barra de botones que abren ventanas flotantes (no navegación entre páginas): validar QR, cobro, CRUD de empleados, CRUD de servicios, CRUD de ubicaciones, horarios globales, reportes, moderar clientes. Acceso al gestor de logs (`logs.txt` y `errores.txt`) con búsqueda, filtro y exportación. |

### 2.4 Restricciones  
- Navegadores soportados: Chrome ≥ 80, Firefox ≥ 75.
- Sistema operativo de backend: Linux Ubuntu 24.04 LTS.
- API debe ser RESTful con JSON.
- Generación del QR debe cumplir el estándar **ISO/IEC 18004**.

### 2.5 Suposiciones y Dependencias  
- Se dispone de infraestructura web (servidor, dominio).
- El cliente dispone de cámara de lectura de códigos QR en la entrada.
- *(Pagos digitales registrados manualmente por el empleado, sin integración con pasarela externa.)*

### 2.6 Evolución Previsible  
1. Módulo móvil nativo para iOS/Android.
2. Módulo de pago online.
3. Módulo de descripción de bloqueo de cuenta.
4. Restricciones de módulos a empleados especificos.
5. Mejorar una busqueda de empleados y clientes (Cuando hay muchos clientes y empleados).
6. Mensaje a whatsapp para los clientes con sus reservas.

---

## 3. Requisitos Específicos

> **Nota:** Cada requisito se identifica con un código (`RF#`) y tiene trazabilidad hacia la descripción general.

### 3.1 Requisitos de Interfaz Externa

#### 3.1.1 Interfaz de Usuario (UI)  
| ID | Requisito | Descripción |
|----|-----------|-------------|
| UI1 | Responsividad | La web debe ser usable en dispositivos móviles y escritorio. |
| UI2 | Accesibilidad | Cumplir WCAG 2.1 AA (contraste, navegación por teclado). |

#### 3.1.2 Interfaz de Hardware  
| ID | Requisito | Descripción |
|----|-----------|-------------|
| HW1 | Lectura QR | El lector debe soportar códigos generados por el sistema y procesarlos en < 0.5 s. |

#### 3.1.3 Interfaz de Software (API)  
| ID | Requisito | Descripción |
|----|-----------|-------------|
| API1 | Endpoints REST | `/api/auth/*`, `/api/clients/*`, `/api/reservations/*`, `/api/checkin/validate`, `/api/payments/*`, `/api/reports/*`, `/api/ubicaciones/*`, `/api/empleados/disponibilidad/*`, `/api/logs/*`. |
| API2 | Autenticación JWT | Tokens con expiración 30 minutos. |

#### 3.1.4 Interfaz de Comunicación  
| ID | Requisito | Descripción |
|----|-----------|-------------|
| COM1 | WebSocket | Notificaciones en tiempo real de disponibilidad de citas. |

### 3.2 Requisitos Funcionales

| RF# | Nombre | Prioridad | Descripción |
|-----|--------|-----------|-------------|
| **RF0** | Login Unificado | Alta | El sistema ofrece un unico formulario de inicio de sesion en `/login` (correo y password) y redirige segun rol (`cliente`, `empleado`, `admin`). |
| **RF1** | Registro de Cliente | Alta | El cliente crea cuenta con nombre, apellido, numero celular colombiano (+57), correo y password. |
| **RF2** | Reserva de Cita | Alta | Flujo completo: (1) el cliente elige ubicación (sede), (2) selecciona empleado disponible, (3) el calendario marca visualmente la disponibilidad del empleado, (4) al hacer clic en un horario disponible se abre ventana flotante con: tipo de servicio a elegir, duración estimada (hora entrada → hora salida), cantidad de personas (1-5). Al confirmar se crea la reserva y se genera QR único. Si el horario se ocupa mientras el cliente decide, el sistema muestra mensaje de error y sugiere elegir otro horario. Máximo 5 reservas activas por cliente. |
| **RF3** | Validación en Entrada | Alta | El empleado/admin escanea el QR; el sistema valida estado activo (`booked`) y ventana horaria de validacion (±120 minutos respecto a la cita). |
| **RF4** | Registro de Cobro | Alta | El empleado registra el cobro de una reserva en estado `checked_in`. Elige el método de pago: **físico** (efectivo) o **digital** (transferencia, Nequi, Daviplata). Ingresa el monto y confirma. No se permite doble cobro. |
| **RF5** | Generación de Reportes | Media | El administrador visualiza ventas por día, ocupación y clientes recurrentes. Acceso restringido a rol admin. |
| **RF6** | Gestión de Ubicaciones | Alta | El administrador puede crear, editar y eliminar sedes físicas con nombre, dirección y coordenadas geográficas (latitud/longitud). Las coordenadas alimentan el mapa interactivo visible para empleados y clientes. Las ubicaciones son requeridas al crear una reserva. |
| **RF7** | Perfil de Empleado | Media | El empleado puede ver y editar sus datos de perfil (nombre, identificación). El administrador puede gestionar todos los empleados (CRUD). |
| **RF8** | Panel de Reservas (Kanban + Mapa) | Media | El cliente visualiza sus reservas activas en columnas por estado (`pendiente`, `confirmada`, `en curso`, `completada`, `cancelada`). Al seleccionar una reserva, en el panel lateral se muestra un mapa interactivo con la ubicación exacta de la sede asignada, usando las coordenadas configuradas por el administrador. Desde este panel el cliente también puede cancelar reservas y descargar el QR. |
| **RF9** | Disponibilidad del Empleado | Alta | El empleado autogestiona su calendario semanal: por cada día de la semana (L-V, S, D) asigna en qué sede trabaja y en qué horario (ej. L-M en Sede A de 09:00 a 18:00, X-V en Sede B de 10:00 a 19:00). Al cambiar un día de sede, el sistema advierte que las reservas futuras en la sede anterior para ese día serán canceladas y notifica a los clientes afectados. Las reservas canceladas quedan con motivo "El empleado cambió de sede". |
| **RF10** | Dashboard del Empleado | Alta | El empleado, al iniciar sesión, ve el panel de citas del día de la(s) sede(s) donde trabaja hoy. Cada cita se muestra como tarjeta con: hora, cliente, servicio, estado y sede. El estado se distingue por color (`pendiente` gris, `en curso` azul, `cobrado` verde, `cancelada` rojo). Incluye botones de acción rápida: `[Validar QR]` y `[Registrar cobro]`. En el panel lateral se muestra el mapa Leaflet con la ubicación de la sede del día. |
| **RF11** | Dashboard del Administrador | Alta | El administrador ve una pantalla fija con: (a) 4 tarjetas KPI (ventas del día, citas del día, % ocupación, clientes activos del mes), (b) timeline de todas las citas de hoy filtrable por sede, (c) barra inferior con 9 botones que abren ventanas flotantes (una sola a la vez): `[Validar QR]` y `[Cobro]` como modales chicos centrados; `[Empleados]`, `[Servicios]`, `[Sedes]`, `[Horarios]`, `[Reportes]`, `[Moderar clientes]` y `[Logs]` como sheets laterales que se deslizan desde la derecha. El dashboard siempre permanece visible de fondo. |
| **RF12** | Gestión de Logs | Media | El administrador accede al gestor de logs desde el botón `[Logs]` del dashboard. Visualiza dos archivos: `logs.txt` (actividad general: inicios de sesión, reservas creadas, check-ins, cobros) y `errores.txt` (excepciones, fallos de conexión, validaciones fallidas). Funcionalidades: (a) buscar por palabra clave, (b) filtrar por fecha, (c) filtrar por severidad (`INFO`, `WARN`, `ERROR`), (d) exportar rango de líneas a `.txt`. Acceso restringido a rol admin. El backend registra automáticamente eventos en ambos archivos mediante el logger Pino. |

> *Para cada RF se debe crear una tabla de trazabilidad (RF ↔ F) en el documento final.*

### 3.3 Requisitos No Funcionales

| RNF# | Área | Descripción |
|------|------|-------------|
| **RNF1** | Rendimiento | El sistema debe procesar hasta 200 solicitudes concurrentes sin degradación > 5 s. |
| **RNF2** | Seguridad | Todos los endpoints deben requerir HTTPS; datos sensibles cifrados en reposo (AES‑256). |
| **RNF3** | Fiabilidad | Tiempo medio entre fallos (MTBF) ≥ 99.9 % durante operación normal. |
| **RNF4** | Disponibilidad | Sistema disponible 24/7 con un plan de contingencia que garantice < 1 h de downtime anual. |
| **RNF5** | Mantenibilidad | Código modular, pruebas unitarias > 80 % cobertura; documentación API auto‑generada (Swagger). |
| **RNF6** | Portabilidad | Backend basado en Node.js/Express, compatible con Podman y Kubernetes. |

### 3.4 Otros Requisitos

- **Legales:** Cumplir la normativa GDPR para datos personales de clientes europeos *(Verificar aplicabilidad según ubicación del negocio)*.
- **Culturales:** Interfaz multilingüe (español e inglés).

---

## 4. Apéndices

| Apéndice | Contenido |
|----------|-----------|
| A | Glosario de términos técnicos. |
| B | Diagramas UML: Caso de uso, secuencia y entidad‑relación *(Incluir flujo Reserva→QR y Validación→Cobro)*. |
| C | Matriz de trazabilidad (RF ↔ F) *(Ver Apéndice C a continuación)*. |

---

## 5. Apéndice C: Matriz de Trazabilidad (RF ↔ F)

| Código RF | Requisito Funcional | Código F | Función Asociada | Estado Trazabilidad |
|------------|---------------------|----------|------------------|---------------------|
| **RF0** | Login Unificado | F6 | Login Unificado | ✅ Vinculado |
| **RF1** | Registro de Cliente | F1 | Gestión de Clientes | ✅ Vinculado |
| **RF2** | Reserva de Cita | F2 | Reservas Online | ✅ Vinculado |
| **RF3** | Validación en Entrada | F3 | Validación en Entrada | ✅ Vinculado |
| **RF4** | Registro de Cobro | F4 | Cobro en Local | ✅ Vinculado |
| **RF5** | Generación de Reportes | F5 | Reportes Administrativos | ✅ Vinculado |
| **RF6** | Gestión de Ubicaciones | F7 | Gestión de Ubicaciones | ✅ Vinculado |
| **RF7** | Perfil de Empleado | F6, F1 | Auth + Clientes | ✅ Vinculado |
| **RF8** | Panel de Reservas (Kanban + Mapa) | F8 | Panel de Reservas | ✅ Vinculado |
| **RF9** | Disponibilidad del Empleado | F9 | Gestión de Disponibilidad | ✅ Vinculado |
| **RF10** | Dashboard del Empleado | F10 | Panel del Empleado | ✅ Vinculado |
| **RF11** | Dashboard del Administrador | F11 | Panel del Administrador | ✅ Vinculado |
| **RF12** | Gestión de Logs | F12 | Gestión de Logs | ✅ Vinculado |
