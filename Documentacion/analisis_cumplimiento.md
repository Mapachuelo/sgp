# Analisis de Cumplimiento y Brechas del SGP

## 1. Objetivo

Evaluar el estado real del software frente a lo definido en el documento IEEE 830 y frente a los entregables solicitados para el proyecto.

## 2. Fuente de analisis

Se revisaron:

- Documento IEEE830: `Documentacion/formato_ieee830.md`.
- Codigo backend y frontend en `src/`.
- Configuracion de despliegue en Docker y base de datos.
- README actual del proyecto.

## 3. Resultado ejecutivo

- El sistema implementa los modulos nucleares: autenticacion, clientes, reservas con QR, check-in por QR, cobro manual y reportes.
- Existen requisitos implementados que no estaban bien documentados (por ejemplo: descarga de QR y validacion de celular colombiano).
- Existen requisitos con cumplimiento parcial o pendiente (correo de confirmacion, consumo WebSocket en frontend, cobertura de pruebas, Swagger, plan formal de disponibilidad/contingencia, HTTPS/AES-256 en despliegue real).

## 4. Matriz de cumplimiento funcional (RF)

| Requisito | Estado | Evidencia tecnica | Observacion |
|---|---|---|---|
| RF1 Registro de cliente | Parcial | Registro con `POST /api/auth/register` | Se registra cliente con validaciones, pero no se envia correo de confirmacion con QR en el estado actual. |
| RF2 Reserva de cita y QR unico | Cumple | `POST /api/reservations` + generacion `qr_token` y `qr_data_url` | El QR se genera por reserva y se devuelve en la respuesta. |
| RF3 Validacion en entrada por QR | Cumple | `POST /api/checkin/validate` | Se valida estado y ventana horaria de la cita. |
| RF4 Registro de cobro efectivo | Cumple | `POST /api/payments/manual` | Cobro manual por empleado/admin, evita cobro duplicado por reserva. |
| RF5 Reportes administrativos | Cumple | `/api/reports/daily-sales`, `/api/reports/occupancy`, `/api/reports/recurrent-clients` | Reportes disponibles para rol admin. |

## 5. Matriz de cumplimiento no funcional (RNF)

| Requisito | Estado | Evaluacion |
|---|---|---|
| RNF1 Rendimiento (200 concurrentes, <= 5s) | Parcial | No se encontraron pruebas de carga ni metricas formales de desempeno. |
| RNF2 Seguridad (HTTPS + cifrado reposo AES-256) | Parcial | JWT y control de roles implementados; HTTPS/AES-256 dependen del entorno de infraestructura y no estan formalizados en el repo. |
| RNF3 Fiabilidad MTBF >= 99.9% | Pendiente | No hay sistema de observabilidad/SLI/SLO documentado. |
| RNF4 Disponibilidad 24/7 con contingencia | Pendiente | No existe runbook formal de contingencia ni RTO/RPO documentado. |
| RNF5 Mantenibilidad (>80% tests + Swagger) | Parcial | Arquitectura modular si existe; faltan pruebas automatizadas y especificacion Swagger. |
| RNF6 Portabilidad Docker/Kubernetes | Parcial | Docker implementado; manifiestos Kubernetes no incluidos. |

## 6. Requisitos de interfaz y comunicacion

| Requisito | Estado | Evaluacion |
|---|---|---|
| UI1 Responsividad | Parcial alto | La UI tiene layouts responsive por modulo, pendiente auditoria formal multi-dispositivo. |
| UI2 Accesibilidad WCAG 2.1 AA | Parcial | Hay mejoras basicas de estructura, pero no existe auditoria formal de contraste/teclado/lectores. |
| API1 Endpoints REST | Cumple | Endpoints principales implementados por modulo. |
| API2 JWT 30 minutos | Cumple | JWT configurable, valor por defecto 30m. |
| COM1 WebSocket notificaciones | Parcial | Backend emite eventos por `/ws`, pero frontend no consume activamente el canal en su estado actual. |

## 7. Requisitos solicitados adicionales

| Solicitud | Estado | Resultado |
|---|---|---|
| Poder descargar QR | Cumple | Existe flujo de descarga de QR en la vista de calendario cliente despues de reservar. |
| Numero celular colombiano obligatorio | Cumple | Validacion en frontend y backend con formato obligatorio `+57XXXXXXXXXX`. Se recomienda reforzar tambien a nivel DB (incluido en esta entrega). |
| Ficha tecnica | Pendiente documental -> Cubierto | Se crea `Documentacion/ficha_tecnica.md`. |
| Estudio de mercado | Pendiente documental -> Cubierto | Se crea `Documentacion/estudio_mercado.md`. |
| Financiacion/costos/precio | Pendiente documental -> Cubierto | Se crea `Documentacion/financiacion_proyecto.md`. |
| Historias de usuario | Pendiente documental -> Cubierto | Se crea `Documentacion/historias_usuario.md`. |
| Manual de usuario | Pendiente documental -> Cubierto | Se crea `Documentacion/manual_usuario.md`. |
| Manual tecnico | Pendiente documental -> Cubierto | Se crea `Documentacion/manual_tecnico.md`. |
| README con tecnologias | Pendiente documental -> Cubierto | README actualizado en esta entrega. |

## 8. Brechas priorizadas (backlog de cierre)

1. Implementar envio real de correo de confirmacion con QR en el flujo de registro/reserva.
2. Agregar cliente WebSocket en frontend para refresco de disponibilidad en tiempo real.
3. Publicar especificacion Swagger/OpenAPI y coleccion de pruebas.
4. Implementar pruebas automatizadas (unitarias + integracion) y objetivo de cobertura > 80%.
5. Definir y documentar estrategia de despliegue seguro (HTTPS, cifrado en reposo, backups, contingencia).
6. Completar estrategia de internacionalizacion (es/en) y auditoria de accesibilidad WCAG 2.1 AA.

## 9. Conclusion

El SGP se encuentra funcionalmente avanzado y alineado con el flujo principal del negocio (reserva, validacion y cobro manual). Las brechas detectadas son mayoritariamente de calidad, operacion y formalizacion documental. Con las mejoras propuestas, el proyecto puede pasar de un estado academico/funcional a un estado de produccion controlada.
