## 1. Introducción

### 1.1 Propósito  
Este documento describe los requisitos funcionales y no‑funcionales del **Sistema de Gestión de Peluquería** (SGP). Su objetivo es proporcionar una referencia única para el diseño, la implementación y las pruebas del software.

### 1.2 Alcance  
El SGP permitirá:

- Registro y gestión de clientes.
- Reserva de citas vía web con programación automática.
- Generación de códigos QR únicos por cita para validación en la entrada.
- **Registro de pagos manuales en local.** *(Eliminado: Gestión de pagos online)*
- Emisión de reportes administrativos.

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
El SGP es un **producto independiente** que se integrará con los sistemas externos existentes: **servidor de correo y sistema de facturación**. *(Eliminado: pasarela de pagos)*

```
┌───────────────────────┐
│   Servidor de Correo  │
├───────────────────────┤
│      Sistema Web      │
├───────────────────────┤
│      Cobro Manual     │
└───────────────────────┘
```

> *Diagrama completo a incluir en la entrega final.*

### 2.2 Funcionalidades del Producto  
| ID | Función | Descripción |
|----|---------|-------------|
| **F1** | Gestión de Clientes | Registro, actualización y borrado de datos personales. |
| **F2** | Reservas Online | Selección de servicio, hora y generación de QR. |
| **F3** | Validación en Entrada | Escaneo del QR con control de horarios. |
| **F4** | **Cobro Manual en Local** | Pago en efectivo con registro por estilista. *(Cambiado: Pagos en efectivo)* |
| **F5** | Reportes Administrativos | Ventas, ocupación y métricas de uso. |

### 2.3 Características de los Usuarios  
| Tipo de Usuario | Habilidades | Acciones Principales |
|-----------------|-------------|----------------------|
| Cliente         | Básica (navegador web) | Reservar, **cobrar en local**, recibir QR. *(Cambiado: "pagar" → "cobrar en local")* |
| Empleado        | Media (uso de terminales) | Validar entrada, gestionar citas, registrar cobro efectivo, generar reportes. |
| Administrador   | Alta (gestión del sistema) | Configurar servicios, usuarios y parámetros. |

### 2.4 Restricciones  
- Navegadores soportados: Chrome ≥ 80, Firefox ≥ 75.
- Sistema operativo de backend: Linux Ubuntu 20.04 LTS.
- API debe ser RESTful con JSON.
- Generación del QR debe cumplir el estándar **ISO/IEC 18004**.

### 2.5 Suposiciones y Dependencias  
- Se dispone de infraestructura web (servidor, dominio).
- El cliente dispone de cámara de lectura de códigos QR en la entrada.
- *(Eliminado: La pasarela de pagos aceptará tarjetas Visa/MasterCard/PayPal)*

### 2.6 Evolución Previsible  
1. Integración con sistemas de fidelización (puntos y recompensas).
2. Módulo móvil nativo para iOS/Android.

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
| API1 | Endpoints REST | `/api/clients`, `/api/reservations`, **`/api/payments/manual`**. *(Cambiado: payments → manual)* |
| API2 | Autenticación JWT | Tokens con expiración 30 minutos. |

#### 3.1.4 Interfaz de Comunicación  
| ID | Requisito | Descripción |
|----|-----------|-------------|
| COM1 | WebSocket | Notificaciones en tiempo real de disponibilidad de citas. |

### 3.2 Requisitos Funcionales

| RF# | Nombre | Prioridad | Descripción |
|-----|--------|-----------|-------------|
| **RF1** | Registro de Cliente | Alta | El cliente ingresa nombre, email y teléfono; se envía un email de confirmación con código QR. |
| **RF2** | Reserva de Cita | Alta | Selección de servicio, fecha/hora; el sistema valida disponibilidad y genera QR único. |
| **RF3** | Validación en Entrada | Alta | El empleado escanea el QR; el sistema verifica hora y estado (cita válida dentro ventana horaria). *(Cambiado: "pago confirmado" → "cita válida")* |
| **RF4*** | **Registro de Cobro Efectivo** | Alta | **Estilista registra monto del servicio en local, fecha, y captura pago en efectivo**. *(Cambiado: RF4 Pago Online → RF5)* |
| **RF5** | Generación de Reportes | Baja | El administrador visualiza ventas por día, ocupación y clientes recurrentes. |

> *Para cada RF se debe crear una tabla de trazabilidad (RF ↔ F) en el documento final.*

### 3.3 Requisitos No Funcionales

| RNF# | Área | Descripción |
|------|------|-------------|
| **RNF1** | Rendimiento | El sistema debe procesar hasta 200 solicitudes concurrentes sin degradación > 5 s. |
| **RNF2** | Seguridad | Todos los endpoints deben requerir HTTPS; datos sensibles cifrados en reposo (AES‑256). |
| **RNF3** | Fiabilidad | Tiempo medio entre fallos (MTBF) ≥ 99.9 % durante operación normal. |
| **RNF4** | Disponibilidad | Sistema disponible 24/7 con un plan de contingencia que garantice < 1 h de downtime anual. |
| **RNF5** | Mantenibilidad | Código modular, pruebas unitarias > 80 % cobertura; documentación API auto‑generada (Swagger). |
| **RNF6** | Portabilidad | Backend basado en Node.js/Express, compatible con Docker y Kubernetes. |

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
| **RF1** | Registro de Cliente | F1 | Gestión de Clientes | ✅ Vinculado |
| **RF2** | Reserva de Cita | F2 | Reservas Online | ✅ Vinculado |
| **RF3** | Validación en Entrada | F3 | Validación en Entrada | ✅ Vinculado |
| **RF4** | Registro de Cobro Efectivo | F4* | Cobro Manual en Local | ✅ Vinculado |
| **RF5** | Generación de Reportes | F5 | Reportes Administrativos | ✅ Vinculado |
