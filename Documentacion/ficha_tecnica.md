# Ficha Tecnica del Proyecto

## 1. Identificacion

- Nombre del sistema: Sistema de Gestion de Peluqueria (SGP)
- Tipo de solucion: Aplicacion web full-stack
- Dominio: Gestion operativa de citas, check-in, cobro y reportes para peluqueria
- Estado actual: MVP funcional con modulos principales implementados

## 2. Objetivo del producto

Digitalizar y centralizar el ciclo operativo de una peluqueria:

- Registro y gestion de clientes
- Reserva de citas online con QR unico
- Validacion de ingreso por QR
- Cobro manual en local
- Reportes administrativos

## 3. Alcance funcional implementado

- Autenticacion y autorizacion por roles (cliente, empleado, admin)
- Login unificado en `/ui/login` con redireccion automatica por rol
- Reserva con seleccion de servicio, estilista, fecha y hora
- Generacion de QR unico por reserva
- Descarga de QR desde interfaz de cliente
- Check-in por token QR con ventana de validacion (±120 minutos)
- Registro de pago manual en efectivo por reserva
- Reportes de ventas diarias, ocupacion y recurrencia de clientes
- Gestion de empleados por administrador
- Configuracion de catalogo de servicios y horarios
- Moderacion de clientes (bloquear/desbloquear por admin/empleado)

## 4. Arquitectura tecnica

- Estilo: Monolito modular feature-based
- Backend: Node.js + Express (CommonJS)
- Base de datos: PostgreSQL
- Tiempo real: WebSocket (`ws`)
- Infraestructura: Podman + podman-compose
- UI: HTML + CSS + JavaScript vanilla servidos por Express

## 5. Stack tecnologico

- Runtime: Node.js 20 (contenedor)
- Framework API: Express 4
- Base de datos: PostgreSQL 16
- Driver DB: `pg`
- Seguridad: `jsonwebtoken`, `bcryptjs`
- QR: `qrcode`
- Realtime: `ws`
- Configuracion: `dotenv`

## 6. Requisitos minimos de despliegue

- Podman
- podman-compose
- 2 contenedores: app + db
- Puerto app configurable por `APP_PORT` (host)

## 7. Roles y permisos

- Cliente:
  - Gestion de su perfil
  - Reserva de citas
  - Consulta y cancelacion de reservas propias
- Empleado:
  - Validacion de clientes/QR
  - Registro de cobro manual
  - Consulta operativa segun permisos
- Administrador:
  - Gestion de empleados
  - Configuracion de servicios/horarios
  - Acceso a reportes

## 8. Integraciones y dependencias

- Integracion interna WebSocket para eventos de disponibilidad
- Sin integracion SMTP activa en la version actual
- Sin pasarela de pago online (cobro manual en local)

## 9. Restricciones conocidas

- El MVP no incluye flujo de correo (registro y reserva operan sin SMTP)
- No se incluye especificacion Swagger/OpenAPI
- No se incluyen pruebas automatizadas en el repositorio actual

## 10. Cumplimiento de requisitos clave solicitados

- Descarga de QR: Implementada
- Numero celular colombiano obligatorio (`+57XXXXXXXXXX`): Implementado en frontend y backend; reforzado a nivel DB para datos nuevos
- Registro exclusivo para cliente: Implementado (`/api/auth/register` solo crea rol `client`)
- Token de sesion unificado en frontend: Implementado (`sgp_token`)

## 11. Indicadores sugeridos para siguiente fase

- Tasa de reservas completadas por semana
- Tasa de no-show
- Tiempo promedio de validacion QR
- Ingresos por dia/servicio/estilista
- Errores de validacion por formulario
