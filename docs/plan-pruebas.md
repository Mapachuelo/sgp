# Plan de pruebas y calidad — SGP

Estrategia de verificación del SGP. Relaciona cada requisito (RF/RNF) con pruebas automatizadas y evidencia, y documenta cómo reproducirlas.

## 1. Niveles de prueba

| Nivel | Herramienta | Alcance | Comando |
|-------|-------------|---------|---------|
| Unitarias | `node:test` (Node 22) | Servicios, modelos y utilidades del backend contra la BD de demo | `pnpm run test:unit` |
| Cobertura | `node --experimental-test-coverage` | Porcentaje de líneas/ramas/funciones del código de negocio | `pnpm run test:coverage` |
| Integración API | `curl` (bash) | Endpoints, RBAC, validaciones, formato de respuestas | `bash tests/api.sh` |
| Datos | SQL (bash + psql) | Integridad del dataset (sin solapes, ≤5 activas, una sede/día, cobro único) | `bash tests/datos.sh` |
| Esquema | SQL (bash + psql) | Tablas, columnas, constraints e índices documentados vs BD real | `bash tests/esquema.sh` |
| Extremo a extremo | Python (urllib + psql) | Flujo completo reserva → QR → check-in/cobro → RF9 → reportes → agenda | `python3 tests/e2e.py` |
| Interfaz | Capturas Chromium/CDP | Pantallas por rol, ES/EN y móvil | `docs/mockups.md` |
| Manual | Casos guiados | Cámara QR y correo OTP real (dependen del entorno) | `docs/manual-usuario.es.md` |

## 2. Resultados actuales

| Suite | Resultado | Fecha |
|-------|-----------|-------|
| `tests/api.sh` | 27/27 | 2026-10-06 |
| `tests/datos.sh` | 6/6 | 2026-10-06 |
| `tests/esquema.sh` | 32/32 | 2026-10-06 |
| `tests/unit/*.test.js` | 36/36 | 2026-10-06 |
| `tests/e2e.py` | 29/29 | 2026-10-06 |
| Cobertura (líneas) | **93.84 %** (ramas 79.04 %, funciones 95.33 %) | 2026-10-06 |

Exclusiones de cobertura: `src/config/**`, `src/docs/**`, `src/integrations/**` (red), `src/server.js` y `src/utils/semillar-*.js` (seeds), por ser infraestructura o utilidades de datos, no lógica de negocio.

### Detalle de cobertura por módulo (líneas)

| Módulo | Cobertura |
|--------|-----------|
| auth.model / auth.service | 95.3 % / 91.4 % |
| purga.service (registros sin verificar) | 100 % |
| checkin.model / checkin.service | 100 % / 92.5 % |
| clientes.model / clientes.service | 74.5 % / 76.2 % |
| disponibilidad.model / service | 78.3 % / 94.1 % |
| logs.service | 73.1 % |
| preferencias.model / service | 100 % / 100 % |
| reportes.model / service | 100 % / 97.7 % |
| reservas.model / reservas.service | 60.2 % / 80.9 % |
| ubicaciones.model / service | 100 % / 100 % |
| shared (http-error, logger) | 100 % |
| utils (encriptacion, telefono) | 100 % / 92.3 % |

> Nota: tras la ampliación de unitarias (36 pruebas) el agregado supera el 80 % exigido por RNF5. Nuevas funcionalidades deben mantener o mejorar este porcentaje.

## 3. Trazabilidad RF/RNF → prueba

| Requisito | Pruebas principales |
|-----------|---------------------|
| RF0 Login | `api.sh` (login admin/empleado), unitarias auth |
| RF1 Registro | `api.sh` (201), unitarias auth (validaciones, duplicado) |
| RF2 Reserva | `e2e.py` (crear, duración, solape), unitarias reservas (validaciones) |
| RF3/RF4 Check-in y cobro | `e2e.py` (cobrado, doble cobro), unitarias checkin |
| RF5 Reportes | `api.sh`, `e2e.py`, unitarias reportes |
| RF6 Ubicaciones | `api.sh` (público), unitarias ubicaciones (rangos) |
| RF7 Perfil empleado | unitarias clientes/auth (identificación) |
| RF8 Kanban/QR | Capturas `docs/mockups.md`, `e2e.py` (`/reservas/me`) |
| RF9 Disponibilidad | `e2e.py` (cancelación y motivo), unitarias disponibilidad, `datos.sh` |
| RF10/RF11 Paneles | Capturas y planner, `api.sh` (agenda) |
| RF12 Logs | `api.sh` (actividad/export), unitarias logs |
| RF13 Verificación OTP | `api.sh` (registro, re-registro, 403, código incorrecto), unitarias auth/purga (reemplazo, purga de expirados, verificar/reenviar) |
| RNF2 Seguridad | unitarias utils (AES/telefono), revisión de middlewares |
| RNF5 Mantenibilidad | cobertura, lint y la propia estructura de pruebas |
| Integración Brevo | unitarias `mailer.test.js` (200→`ok`, 401→`error`, sin key→`no-configurado`) y estado en `/api/healthcheck` |

La matriz completa RF ↔ F ↔ módulo ↔ prueba está en `docs/formato_ieee830.md` (Apéndice C).

## 4. Entornos y datos

- Las pruebas corren contra el stack Podman (`sgp-db` + `sgp-app` en `localhost:8080`).
- Las unitarias se ejecutan **dentro del contenedor backend** (`podman exec -w /app/backend ...`) para disponer de dependencias y red interna hacia la BD.
- Cada suite de unitarias crea sus propios fixtures (usuarios/sedes/servicios con prefijo único) y los elimina al final.
- E2E usa `empleado@sgp.local` (semilla) y crea/elimina su cliente y sede temporal.
- Rate limiting: si se ejecutan muchas suites seguidas, reiniciar el pod de la app para limpiar el limitador (`kube down` + `kube play`).

## 5. Criterios de aceptación

1. Todas las suites automatizadas en verde (0 FAIL).
2. Cobertura de líneas ≥ 80 % en el código de negocio.
3. Lint del backend sin errores (`pnpm run lint`).
4. Build del frontend sin errores (`pnpm --filter frontend build`).
5. Sin doble sede/día, sin solapes, sin doble cobro y ≤5 reservas activas por cliente (`tests/datos.sh`).
6. Esquema real coincide con `docs/modelo-datos.md` (`tests/esquema.sh`).

## 6. Pendientes manuales

- Envío real de OTP con credenciales válidas de Brevo (la key actual falla; el flujo se valida con códigos inyectados en BD en las pruebas).
- Escaneo de QR con cámara en un equipo con webcam (el modal pide permisos y permite entrada manual como respaldo).
