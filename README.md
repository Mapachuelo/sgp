# SGP — Sistema de Gestion de Peluqueria

Aplicacion web fullstack para la gestion operativa de peluquerias: reservas online, validacion QR, cobros, reportes y administracion. Backend Node.js + Express, frontend React + Vite, PostgreSQL 17, desplegado con Podman.

## Stack tecnologico

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 19 + Vite 6 + Tailwind CSS 4 + react-router-dom 7 |
| UI | Componentes propios estilo shadcn/ui + Leaflet (mapas) |
| Backend | Node.js 22 + Express (CommonJS) |
| BD | PostgreSQL 17 Alpine |
| BD driver | pg (raw SQL, sin ORM) |
| Auth | JWT (jsonwebtoken) + bcryptjs + AES-256-CBC (crypto) |
| QR | qrcode |
| Realtime | WebSocket (ws) |
| Logs | Pino (logs.txt + errores.txt) |
| Monorepo | pnpm workspaces |
| Contenedores | Podman (kube play, 2 pods) |
| Lint | ESLint + Prettier |

## Estructura del proyecto

```
sgp/
├── pnpm-workspace.yaml
├── package.json              # Root: scripts dev, lint, start, test
├── sgp-db-pod.yaml           # Pod PostgreSQL + PVC persistente
├── sgp-app-pod.yaml          # Pod backend + frontend
├── .env / .env.example
├── db/
│   └── init.sql              # 11 tablas + seed data
├── backend/
│   ├── Containerfile         # Backend (Node 22 Alpine + pnpm)
│   └── src/
│       ├── server.js / app.js
│       ├── config/           # env, db, database-init
│       ├── features/         # auth, clientes, reservas, checkin, reportes,
│       │                       ubicaciones, disponibilidad, logs, preferencias
│       ├── integrations/realtime/ws-hub.js
│       ├── routes/api.routes.js
│       └── shared/           # logger, async-handler, http-error, middlewares, utils
│   └── src/utils/semillar-demo.js   # Seed masivo de demostracion
├── frontend/
│   ├── Containerfile         # Frontend (build Vite + Nginx Alpine)
│   ├── nginx.conf            # Proxy reverso /api → backend, SPA fallback
│   └── src/
│       ├── main.jsx / app.jsx
│       ├── api/cliente.js           # Fetch wrapper con JWT
│       ├── contexto/auth-context.jsx
│       ├── hooks/use-auth.js, use-websocket.js
│       ├── componentes/             # Layout, RutaProtegida, ui/ (Button, Input, Card, Badge, Sheet, Modal, Select, Toast)
│       └── funcionalidades/
│           ├── auth/                # login-page, registro-page
│           ├── cliente/             # dashboard kanban + mapa, nueva-reserva (stepper 6 pasos, multi-servicio), mi-perfil
│           ├── empleado/            # dashboard, validar-qr, mi-disponibilidad, mi-perfil
│           ├── admin/               # dashboard + secciones/ (empleados, servicios, sedes,
│           │                        #   horarios con planificador, reportes, clientes, logs) + modales QR/Cobro
└── tests/
    ├── api.sh                # 28 pruebas de integracion curl
    ├── datos.sh              # Integridad del dataset demo (6)
    ├── esquema.sh            # Esquema vs modelo de datos (32)
    └── e2e.py                # Extremo a extremo (29)
```

## Ejecucion con Podman

### Requisitos
- Podman

### Arquitectura de pods

Dos pods independientes conectados via red `sgp-net`:

| Pod | Contenido | Acceso host |
|-----|-----------|-------------|
| `sgp-db` | PostgreSQL 17 Alpine + PVC `sgp-pgdata` | Solo interno (`sgp-db:5432`) |
| `sgp-app` | Backend Node.js (:3000) + Frontend Nginx (:80) | `http://localhost:8080` |

Al eliminar el pod `sgp-app` para actualizar, la base de datos sigue corriendo en `sgp-db` y los datos persisten en el volumen.

Los archivos `sgp-app-pod.yaml` y `sgp-db-pod.yaml` (gitignored) se crean a partir de los ejemplos `example.sgp-*-pod.yaml` y se rellenan manualmente con los valores reales. No se usan scripts ni inyeccion automatica.

### Levantar entorno

#### 1. Crear los archivos reales desde los ejemplos
```
cp example.sgp-app-pod.yaml sgp-app-pod.yaml
cp example.sgp-db-pod.yaml sgp-db-pod.yaml
```
#### 2. Rellenar valores reales
- En `sgp-app-pod.yaml`: `DATABASE_URL`, `PRESENTACION_DATABASE_URL` (host `sgp-db`, base `sgp_presentacion`), `PRESENTACION_MEDIA_DIR`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `JWT_SECRET`, `AES_SECRET` (opcional; si se omite usa `JWT_SECRET`), `WOMPI_BASE_URL`, `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` (llaves sandbox `pub_test_`/`test_integrity_`/`test_events_` para pruebas; `pub_prod_`/`prod_*` para dinero real) (y `hostPort` del frontend si el `8080` esta ocupado).
- En dominio, ajusta `WOMPI_REDIRECT_URL` a `https://<tu-dominio>/cliente/reservar` y verifica que el proxy reenvie `/api/` y `/ws`.
- En `sgp-db-pod.yaml`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
- Si cambias usuario/contraseña de la BD, ajustar `DATABASE_URL` en `sgp-app-pod.yaml` para que coincida.
- Sin estos valores el backend arranca pero Brevo falla (no llegan correos de verificacion) y Wompi queda `no-configurado` (los pagos en linea no se procesan).
- Para recibir webhooks de Wompi configura la URL de eventos en el dashboard de comercios (`https://<tu-dominio>/api/pagos/webhook`); en local el pago se sincroniza con `POST /api/pagos/{id}/verificar`.

#### 3. Build de imagenes (solo la primera vez o al cambiar codigo)
```bash
podman build -t localhost/sgp-backend:latest -f backend/Containerfile .
podman build -t localhost/sgp-frontend:latest -f frontend/Containerfile .
```
#### 4. Crear red compartida (una sola vez)
```
podman network create sgp-net
```
#### 5. Creación de los contenedores
```
# Levantar PRIMERO la base de datos (el backend falla si sgp-db no resuelve)
podman kube play sgp-db-pod.yaml --network sgp-net
# Levantar backend + frontend
podman kube play sgp-app-pod.yaml --network sgp-net
```

### Acceso

- **Frontend:** `http://localhost:8080`
- **Healthcheck:** `http://localhost:8080/api/healthcheck` (incluye el estado de Brevo y Wompi: `ok`, `error` o `no-configurado`)
- **Nginx:** `index.html` y `/api/` sin cache, `/assets/` inmutable y `client_max_body_size 512m` para imagenes de servicios, sedes y presentacion.
- **API directa:** no expuesta al host; el frontend la proxya a `127.0.0.1:3000` dentro del pod `sgp-app`

### Actualizar la app tras cambios de imagen (sin tocar la base de datos)

```bash
podman build -t localhost/sgp-backend:latest -f backend/Containerfile .
podman build -t localhost/sgp-frontend:latest -f frontend/Containerfile .
podman kube down sgp-app-pod.yaml
podman kube play sgp-app-pod.yaml --network sgp-net
```

O en un solo paso con `--replace` (reemplaza el pod existente):

```bash
podman kube play sgp-app-pod.yaml --network sgp-net --replace
```

Sin reemplazo, el pod sigue corriendo la imagen anterior.

### Detener

```bash
podman kube down sgp-app-pod.yaml
podman kube down sgp-db-pod.yaml
```

Para eliminar tambien los datos:

```bash
podman volume rm sgp-pgdata
```

### Usuarios semilla

| Rol | Email | Password |
|-----|-------|----------|
| Admin | admin@sgp.local | admin123 |
| Empleado | empleado@sgp.local | empleado123 |
| Cliente (pruebas) | cliente@sgp.local | cliente123 |

## Base de datos (21 tablas)

| Tabla | Proposito |
|-------|-----------|
| `ubicacion` | Sedes fisicas con departamento, ciudad, lat/lng e imagen de portada opcional |
| `ubicacion_imagen` | Galeria ordenada de hasta 6 imagenes por sede |
| `app_user` | Usuarios con roles: cliente, empleado, admin |
| `empleado_perfil` | Datos extra de empleados |
| `servicio_categoria` | Titulos del menu: Peluqueada, Planchada, Barba, Color, Peinado, Tratamientos, Otros |
| `servicio_catalogo` | Catalogo de servicios con categoria, portada, precio, duracion y estado |
| `servicio_imagen` | Galeria ordenada de hasta 6 imagenes por servicio |
| `empleado_tiempo_servicio` | Duracion personalizada empleado/servicio |
| `reserva_servicio` | Segmentos de una reserva: servicio, estilista, horario y precio congelado |
| `configuracion` | Parametros del negocio, como el maximo de servicios por reserva |
| `jornada` | Excepciones de horario por sede y fecha (incluye cierres y festivos) |
| `jornada_plantilla` | Plantilla semanal fija por sede |
| `empleado_disponibilidad` | Disponibilidad semanal por empleado/sede con descansos y días de descanso |
| `empleado_sede_temporal` | Cambios temporales de sede con retorno automático |
| `empleado_festivo` | Opt-in del empleado para trabajar un festivo abierto |
| `empleado_bloqueo_fecha` | Bloqueo de una fecha por imprevisto del empleado |
| `reserva` | Citas con QR token y estados |
| `cobro` | Pagos fisicos/online, vinculados a `pago` cuando aplica |
| `pago` | Intentos de pago digital Wompi, referencias, transacciones, estado y reembolso |
| `notificacion` | Buzon persistente por usuario para cancelaciones y avisos de citas |
| `preferencia_usuario` | Rango horario, granularidad, tema y ubicacion preferida |
| `empleado_perfil` | Identificacion, sede base y foto opcional del empleado |

Seed: Sede Centro (Bogota), 7 categorias, 4 servicios (Corte clasico, Barba, Tinte, Corte+Barba), jornadas L-V 09-18 + S 09-14, tiempos de servicio del empleado semilla y disponibilidad semanal L-V/S. Las reservas existentes se backfillean a `reserva_servicio` y las portadas a `servicio_imagen` al arrancar.
`app_user.telefono` se almacena cifrado con AES-256 (TEXT), en formato E.164 internacional; Colombia usa `+57` + 10 digitos y es la opcion por defecto en la interfaz. `preferencia_usuario` guarda departamento y ciudad preferidos.

El formulario de sedes incluye departamento, ciudad y un mapa Leaflet/OpenStreetMap: al hacer clic, arrastrar el marcador o usar la ubicacion actual se llenan latitud, longitud y, cuando es posible, ciudad y departamento automaticamente. Tambien permite subir hasta 6 imagenes; la primera es la portada y la galeria se abre en un modal con carrusel.

## Datos de demostracion (seed masivo)

Genera un dataset grande y reproducible para demos y pruebas de carga:

```bash
# dentro del contenedor del backend (la BD no esta expuesta al host)
podman exec -w /app/backend sgp-app-backend node src/utils/semillar-demo.js --reset
# o via npm/pnpm
pnpm run seed:demo -- --reset
```

Crea por defecto **6 sedes, 10 servicios, 15 empleados, 80 clientes, ~1270 reservas y ~725 cobros** en un rango de -30 a +30 dias:

- Empleados `estilista01..15@demo.sgp` con 1-3 sedes asignadas y rotacion semanal: **nunca dos sedes el mismo dia**, turnos de manana/tarde/completo. El cambio de sede de un dia lo puede hacer el admin y dispara la cancelacion de reservas futuras de ese dia (RF9).
- Clientes `cliente01..80@demo.sgp` (password `demo1234`, verificados, telefono cifrado), con maximo 4 reservas activas por cliente.
- Reservas pasadas con su `cobro` (fisico/online) para reportes, algunas canceladas con motivo (`Cancelada por el cliente`, `no-show`, `El empleado cambió de sede`) y futuras `pendiente/confirmada` con QR.
- Al final ejecuta un flujo real por API (login + reserva + check-in) para generar `logs.txt` y eventos WebSocket.

Salida de datos: `backend/exports/` con `reservas.csv`, `cobros.csv`, `disponibilidad.csv` y `resumen.json` (copiable con `podman cp`). Validaciones automaticas con `bash tests/datos.sh` (sin doble sede/dia, sin solapes, maximo 5 activas, un cobro por reserva, citas dentro de disponibilidad).

Opciones: `--append` (no borra), `--sin-export`, `--sin-api`, `--reservas=2000`, `--empleados=20`, `--clientes=100`, `--diasPasados=60`, `--diasFuturos=60`.

## Dataset de regresion 10x10

Para pruebas funcionales deterministas existe un seed separado:

```bash
podman exec -w /app/backend sgp-app-backend node src/utils/semillar-pruebas.js
# o via pnpm
pnpm run seed:pruebas
```

Crea exactamente **10 clientes, 10 empleados, 3 sedes, 7 categorias, 5 servicios y 30 reservas** (hoy, +10 dias y ayer), con pagos aprobados/declinados/pendientes, cobros fisicos/online, cola de atencion, algunas reservas con dos servicios en secuencia y un manifiesto en `tests/fixtures/seed-10x10.json`.

Credenciales:

- `admin@sgp.local` / `admin123`
- `cliente01..10@sgp.local` / `cliente123`
- `empleado01..10@sgp.local` / `empleado123`

La suite `python3 tests/regresion_10x10.py` recorre autenticacion de los 20 usuarios, CRUD, reservas, cola, pagos, webhooks, reportes, logs, preferencias e integridad de datos.

## Panel del empleado

- **Cola y agenda:** citas del día, llegada por QR, cobro, inicio y finalización del servicio, mapa de la sede y resumen diario.
- **Mi desempeño:** tarjeta con **Cortes realizados** y **Ganado** del mes seleccionado, navegable con ←/→. Incluye todos los servicios cobrados y no reembolsados y aplica el porcentaje de comisión del empleado.
- **Mi disponibilidad:** kanban semanal; se pueden configurar uno o más descansos por día (día completo o varios rangos) y se guardan automáticamente al tocar el día. Si una modificación se cruza con citas futuras, se muestra el listado y se confirma la cancelación antes de notificar al cliente. El calendario del cliente muestra esas franjas como **Descanso** y no permite reservarlas.

## Panel de administracion

El panel (`/admin`) fue redisenado y modularizado en `frontend/src/funcionalidades/admin/`:

- **Dashboard:** acciones rapidas (Validar QR, Registrar cobro, actualizar), tarjeta de **Gestion** con los accesos, 4 KPIs (recaudacion, reservas del dia, ocupacion promedio por sede, clientes activos) y timeline de reservas con filtros por fecha y sede.
- **Secciones (páginas independientes):** empleados, servicios, presentación, sedes, horarios/agenda, reportes, moderación de clientes y logs se abren en su propia ruta dentro del shell de administración.
- **Sedes:** CRUD con dirección, ubicación y hasta 6 imágenes del local; solo el admin las edita y clientes/empleados pueden abrir la galería en un modal. **Equipo** permite al admin crear empleados o administradores, y subir o quitar la foto del empleado; si no existe, se muestran sus iniciales.
- **Mensajes del cliente:** buzón persistente en `/cliente/mensajes` con avisos de cancelación, motivo, fecha y estado del reembolso; el dashboard muestra cuántos mensajes hay sin leer.
- **Acciones rápidas:** Validar QR y Cobro siguen como ventanas flotantes; las confirmaciones y la carga de medios usan modales de acción.
- **Nómina:** pestaña en Reportes con filtro por empleado, sede y período (mes, quincena o rango), cálculo sobre servicios completados y pagados, y PDF descargable.
- **Planificador de horarios** (página completa, pestaña por defecto): matriz **empleados x LUN-DOM** con una sede por dia (colores por sede), **citas superpuestas** por estado (clic en una cita pendiente/confirmada abre el modal de validacion), filtros por empleado/sede, navegacion por semanas y editor lateral por celda.
- Al cambiar la sede de un dia se advierte y, al guardar, se cancelan las reservas futuras de ese dia con el motivo `"El empleado cambió de sede"` (RF9) mostrando el conteo en un toast. La pestaña **Jornada por sede** conserva la edicion de `jornada` (horario de la sede).
- Interfaz con iconos (lucide-react), textos en español y accesibilidad mantenida (dialogos, foco, Escape, labels).

## API — Endpoints completos

### Auth (RF0, RF1)
| Metodo | Ruta | Rol |
|--------|------|-----|
| POST | `/api/auth/register` | Publico (crea cuenta y envia OTP, sin JWT) |
| POST | `/api/auth/login` | Publico (403 si la cuenta no esta verificada) |
| POST | `/api/auth/verificar` | Publico (`{ email, codigo }` → JWT) |
| POST | `/api/auth/reenviar-codigo` | Publico (max 3 cada 15 min) |
| GET | `/api/auth/me` | Autenticado |
| GET | `/api/auth/empleados?rol=empleado` | Admin (empleados y administradores) |
| POST | `/api/auth/empleados` | Admin (`rol`: `empleado` o `admin`) |
| PUT | `/api/auth/empleados/:id` | Admin |
| DELETE | `/api/auth/empleados/:id` | Admin (no el propio ni el ultimo admin) |

### Clientes (RF1, RF11)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/clientes/me` | Cliente |
| PUT | `/api/clientes/me` | Cliente |
| DELETE | `/api/clientes/me` | Cliente |
| GET | `/api/clientes` | Admin |
| PUT | `/api/clientes/:id/bloquear` | Admin |
| PUT | `/api/clientes/:id/desbloquear` | Admin |
| DELETE | `/api/clientes/:id` | Admin (3+ no-shows) |

### Presentacion publica
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/presentacion` | Publico |
| GET | `/api/presentacion/archivos/:archivo` | Publico |
| GET | `/api/presentacion/admin` | Admin |
| PUT | `/api/presentacion/config` | Admin |
| POST | `/api/presentacion/media` | Admin (multipart) |
| POST | `/api/presentacion/media/:id/fuentes` | Admin |
| PUT | `/api/presentacion/media/:id` y `/media/orden` | Admin |
| DELETE | `/api/presentacion/media/:id` | Admin |

La presentacion usa una base separada `sgp_presentacion` y el volumen `sgp-presentacion-media`; no toca las tablas de reservas, pagos o usuarios.

### Ubicaciones (RF6)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/ubicaciones?departamento=&ciudad=` | Publico (portada y total de imagenes) |
| GET | `/api/ubicaciones/:id/imagenes` | Publico |
| POST | `/api/ubicaciones` | Admin (hasta 6 imagenes) |
| PUT | `/api/ubicaciones/:id` | Admin |
| DELETE | `/api/ubicaciones/:id` | Admin |

### Notificaciones (RF8)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/notificaciones/me?solo_no_leidas=1` | Autenticado |
| GET | `/api/notificaciones/me/contador` | Autenticado |
| PUT | `/api/notificaciones/me/:id/leida` | Autenticado |
| PUT | `/api/notificaciones/me/leidas` | Autenticado |

### Reservas (RF2, RF8)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/reservas/servicios?categoria_id&ubicacion_id&empleado_id` | Publico (portada, total de imagenes y estilistas) |
| GET | `/api/reservas/servicios/:id/imagenes` | Publico (galeria bajo demanda) |
| POST | `/api/reservas/servicios` | Admin |
| PUT | `/api/reservas/servicios/:id` | Admin |
| DELETE | `/api/reservas/servicios/:id` | Admin |
| GET | `/api/reservas/categorias` | Publico |
| POST | `/api/reservas/categorias` | Admin |
| PUT | `/api/reservas/categorias/:id` | Admin |
| DELETE | `/api/reservas/categorias/:id` | Admin |
| GET | `/api/reservas/configuracion` | Publico |
| PUT | `/api/reservas/configuracion` | Admin |
| GET | `/api/reservas/empleados-por-servicio?ubicacion_id&servicio_id` | Publico |
| GET | `/api/reservas/empleados-por-sede?ubicacion_id` | Publico |
| GET | `/api/reservas/sedes-por-servicio` | Publico |
| POST | `/api/reservas/disponibilidad-combo` | Publico |
| GET | `/api/reservas/disponibilidad` | Autenticado |
| GET | `/api/reservas/jornada` | Publico |
| PUT | `/api/reservas/jornada` | Admin |
| GET | `/api/reservas/jornada/plantilla` | Publico |
| PUT | `/api/reservas/jornada/plantilla` | Admin |
| PUT | `/api/reservas/jornada/plantilla/todas` | Admin (aplica a todas las sedes) |
| POST | `/api/reservas/jornada/festivo` | Admin |
| GET | `/api/reservas/festivos?desde&hasta` | Publico |
| GET | `/api/reservas/empleado-tiempos-servicio` | Admin |
| PUT | `/api/reservas/empleado-tiempos-servicio` | Admin |
| POST | `/api/reservas` | Cliente |
| GET | `/api/reservas/empleado/dia?fecha` | Empleado |
| POST | `/api/reservas/empleado/cancelar-dia` | Empleado |
| GET | `/api/reservas/me` | Cliente |
| DELETE | `/api/reservas/me/:id` | Cliente |
| GET | `/api/reservas/agenda?desde&hasta&departamento&ciudad` | Admin (rango de citas para el planificador) |
| GET | `/api/reservas` | Empleado/Admin |

### Checkin y cola de atencion (RF3)
| Metodo | Ruta | Rol |
|--------|------|-----|
| POST | `/api/checkin/consultar` | Empleado/Admin |
| POST | `/api/checkin/llegada` | Empleado/Admin |
| POST | `/api/checkin/cobro-efectivo` | Empleado/Admin |
| POST | `/api/checkin/confirmar-pago` | Empleado/Admin (QR o reserva, sin finalizar) |
| POST | `/api/checkin/iniciar` | Empleado/Admin |
| POST | `/api/checkin/finalizar` | Empleado/Admin |
| POST | `/api/checkin/validar` | Empleado/Admin (atajo legacy) |

La cola se deriva de las citas del dia y de `reserva.llego_en`, `inicio_servicio` y `fin_servicio`:

- `llegada`: el empleado escanea el QR y el cliente pasa a **En espera**.
- `iniciar`: exige pago en linea aprobado o cobro en efectivo; pasa a **En atencion** y permite iniciar antes de la hora si el cliente ya llego.
- `finalizar`: deja la reserva en **Atendido** y habilita al siguiente cliente; si el servicio termino antes, no se espera la hora.
- `cobro-efectivo`: registra el pago fisico antes de iniciar.
- `consultar`: devuelve cliente, servicio, hora, estado de pago y total.

`POST /api/checkin/validar` se conserva como atajo atomico: si hay pago Wompi `aprobado` registra el cobro online con el monto real; si no, exige `monto > 0` para efectivo. Un `monto = 0` sin pago aprobado responde 409.

### Pagos digitales (Wompi)
| Metodo | Ruta | Rol |
|--------|------|-----|
| POST | `/api/pagos/intencion` | Cliente (dueno) / Empleado (dueno) / Admin |
| GET | `/api/pagos/:id` | Cliente (dueno) / Empleado (dueno) / Admin |
| POST | `/api/pagos/:id/verificar` | Cliente (dueno) / Empleado (dueno) / Admin |
| POST | `/api/pagos/webhook` | Publico (firma Wompi) |

Flujo: el cliente elige "Pago en linea" en el paso 5 y el frontend abre el **Widget de Wompi**; en recepcion, el empleado puede generar un **QR de pago** para que el cliente pague desde su celular. `POST /api/pagos/intencion` devuelve la configuracion del widget, `checkout_url` y `qr_data_url` con referencia unica, monto en centavos recalculado en el servidor y firma SHA256 de integridad. El checkout procesa tarjeta, PSE, Nequi y Boton Bancolombia. Al aprobarse, `POST /api/pagos/:id/verificar` (o el webhook con checksum SHA256) marca el pago `aprobado`, crea el `cobro` vinculado y confirma la reserva; un pago `declinado`/`error` deja la reserva `pendiente` para reintentar o pagar en efectivo. El webhook es idempotente y responde 200 a eventos autenticos; firma invalida responde 401. Las claves privada/secreta nunca se exponen al frontend; el monto siempre se recalcula en el backend (suma de `reserva_servicio.precio` × `cantidad_personas`). No se usa NFC en esta version: el cobro presencial con tarjeta se hace por el checkout/QR de Wompi.

### Documentacion API (RNF5)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/docs` | Publico (Swagger UI) |
| GET | `/api/docs/openapi.json` | Publico (spec OpenAPI 3) |

### Reportes (RF5)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/reportes/ventas-diarias` | Admin |
| GET | `/api/reportes/ocupacion` | Admin |
| GET | `/api/reportes/clientes-recurrentes` | Admin |
| GET | `/api/reportes/mi-resumen?desde&hasta` | Empleado |
| GET | `/api/reportes/nomina?empleado_id&ubicacion_id&desde&hasta` | Admin |
| GET | `/api/reportes/nomina/pdf?empleado_id&ubicacion_id&desde&hasta` | Admin |

### Disponibilidad (RF9)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/empleados/disponibilidad` | Empleado |
| PUT | `/api/empleados/disponibilidad` | Empleado |
| PUT | `/api/empleados/disponibilidad/descansos` | Empleado |
| GET | `/api/empleados/disponibilidad/todas` | Admin |
| GET | `/api/empleados/disponibilidad/temporales` | Empleado/Admin |
| POST | `/api/empleados/disponibilidad/temporales` | Empleado/Admin |
| PATCH | `/api/empleados/disponibilidad/temporales/:id/finalizar` | Empleado/Admin |
| GET | `/api/empleados/disponibilidad/festivos` | Empleado/Admin |
| POST | `/api/empleados/disponibilidad/festivos` | Empleado/Admin |
| DELETE | `/api/empleados/disponibilidad/festivos/:fecha` | Empleado/Admin |
| GET | `/api/empleados/disponibilidad/bloqueos?desde&hasta` | Admin |
| GET | `/api/empleados/disponibilidad/festivos/admin?fecha` | Admin |
| GET | `/api/empleados/:empleadoId/disponibilidad` | Admin |
| PUT | `/api/empleados/:empleadoId/disponibilidad` | Admin |

### Logs (RF12)
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/logs/actividad` | Admin |
| GET | `/api/logs/errores` | Admin |
| GET | `/api/logs/exportar` | Admin |

### Preferencias
| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/api/preferencias` | Autenticado |
| PUT | `/api/preferencias` | Autenticado |

### WebSocket
| Path | Evento |
|------|--------|
| `/ws` | `conexion`, `disponibilidad.actualizada`, `reserva.actualizada` |

Formato de respuesta: `{ "ok": true, "data": {...} }` o `{ "ok": false, "error": "mensaje" }`.

## Reglas de negocio

- Maximo 5 reservas activas por cliente
- Anticipacion minima: 60 minutos
- Ventana validacion QR: +-120 minutos
- Check-in y cobro son atomicos; al validar la reserva queda `cobrado`
- Un solo cobro por reserva (restriccion UNIQUE + transaccion)
- La reserva valida que el empleado ofrezca el servicio y este dentro de su disponibilidad semanal en esa sede; la duracion se toma de `empleado_tiempo_servicio` y se multiplica por la cantidad de personas
- Creacion de reserva con advisory lock por empleado/dia (evita carreras de horario)
- Cantidad de personas: 1 a 5; la cita debe caber completa antes del cierre de la sede y del turno del estilista
- Cliente bloqueado no inicia sesion ni reserva
- Un solo cobro por reserva
- Cambio de sede cancela las reservas futuras del dia cambiado en la sede anterior, con motivo `"El empleado cambió de sede"` y notificacion WebSocket `reserva.actualizada`
- Eliminar cliente solo con 3+ no-shows
- Eliminar empleado solo sin cobros asociados
- Metodos de cobro: `fisico` (efectivo) o `online`
- Estados BD: pendiente → confirmada → en_curso → cobrado (cancelada)
- Una reserva puede tener 1..N servicios; cada uno puede tener un estilista distinto y se agenda en secuencia. El total y la duracion son la suma de los segmentos.
- El maximo de servicios por reserva es configurable por el admin (1 a 10; por defecto 5).
- El precio y la duracion de cada servicio se congelan en `reserva_servicio` al reservar; los cambios posteriores del catalogo no alteran reservas existentes.
- Las categorias con servicios no se pueden eliminar; los servicios con reservas se desactivan en lugar de borrarse.
- El cliente busca servicios por texto y puede filtrar por categoria; los selectores largos del admin usan busqueda incremental.
- Un servicio puede tener hasta 6 imagenes; la primera es la portada. El cliente abre el detalle con carrusel y flechas laterales; el listado solo carga la portada.
- El dashboard del cliente muestra el estado de pago de cada cita y permite pagar en linea las reservas activas impagas, sin volver al flujo de reserva.
- Rango horario default: 06:00-22:00, granularidad default: 30 min
- Registro: un correo sin verificar se reemplaza si el cliente vuelve a registrarse; la cuenta sin verificar se elimina a los **5 minutos** (configurable con `REGISTRO_TTL_MINUTOS`) y el correo queda libre; si el envio del OTP falla se puede usar `Reenviar codigo` (reinicia el tiempo de registro)

## Seguridad

- Contrasenas: bcryptjs 12 rounds
- Datos sensibles: telefono cifrado en reposo con AES-256-CBC via crypto nativo (`AES_SECRET`, fallback a `JWT_SECRET`); migracion automatica de telefonos en claro al iniciar el backend
- JWT con expiracion 30 minutos
- RBAC: admin, empleado, cliente
- Rate limiting: 10 intentos/15 min en auth; 3 reenvios de OTP/15 min
- Helmet para headers HTTP
- CORS configurado para origen del frontend
- SQL injection prevenido con consultas parametrizadas (pg)
- Documentacion API en `/api/docs` (Swagger UI + OpenAPI 3)
- Interfaz siempre en español, sin selector de idioma.
- Portada pública `/` con carrusel de imágenes y videos administrable desde Admin → Presentación.
- Fotos opcionales de empleados y pestaña Mis servicios con duración editable (precio solo admin).
- Tema claro/oscuro con opcion Sistema, persistencia local (`sgp_tema`) y soporte de `prefers-color-scheme`

Cubre: healthcheck, docs Swagger, auth (register/verificar/login/me), ubicaciones CRUD, categorias y servicios CRUD con imagen, configuracion de maximo de servicios, disponibilidad simple y combinada, empleados por servicio, reservas multi-servicio con varios estilistas, checkin y cola (llegada, efectivo, inicio, finalizacion), pagos Wompi (intencion RBAC, QR, webhook con firma invalida, estado), reportes (incluido mi-resumen del empleado), disponibilidad automática de descansos, clientes (perfil/bloquear/desbloquear), empleados CRUD, logs (filtros fecha/severidad y export .txt), preferencias (incluye departamento y ciudad), rate limiting.
Complementan: `tests/datos.sh` (integridad), `tests/esquema.sh` (esquema), `pnpm run test:unit`/`test:coverage` (unitarias y cobertura), `tests/e2e.py` (flujo completo) y `tests/regresion_10x10.py` (10 clientes x 10 empleados).

## Desarrollo local

```bash
pnpm install
pnpm --filter backend dev      # Backend en :3000
pnpm --filter frontend dev     # Frontend en :5173 con proxy /api → :3000
pnpm run lint                  # ESLint
pnpm run seed:pruebas          # Dataset determinista 10 clientes / 10 empleados
pnpm run test:regresion        # Suite funcional 10x10
```

## Documentacion

### Proyecto
- [Plan de desarrollo](plan.md)
- [Requisitos IEEE 830](docs/formato_ieee830.md) — funcionalidades, RF/RNF, apendices y matriz RF↔F↔modulo↔prueba
- [Diseno tecnico](docs/diseno-tecnico.md) — arquitectura, decisiones y estructura del codigo
- [Modelos UML](docs/modelos-uml.drawio) — casos de uso, clases, secuencias, estados, despliegue y ER (+ [flujo actual](docs/diagrama.drawio))
- [Mockups e interfaz](docs/mockups.md) — capturas reales por rol (español, movil)
- [Nueva interfaz](docs/diseno/nueva-interfaz.md) — direccion, tokens, rutas, componentes y verificacion visual
- [Modelo de datos](docs/modelo-datos.md) — ER y diccionario de las 11 tablas
- [Plan de pruebas](docs/plan-pruebas.md) — estrategia, matriz, regresion 10x10 y cobertura
- [Guia de despliegue](docs/despliegue.md) — Podman, datos demo, operacion y problemas conocidos
- [Manual tecnico (ES)](docs/manual-tecnico.es.md) | [Manual tecnico (EN)](docs/manual-tecnico.en.md)
- [Manual de usuario (ES)](docs/manual-usuario.es.md) | [Manual de usuario (EN)](docs/manual-usuario.en.md)
- [Swagger UI](http://localhost:8080/api/docs) — API en ejecucion

### Agentes
- [Arquitectura y convenciones](.agents/skills/architecture.md)
- [Reglas de comportamiento](.agents/skills/contexto.md)
- [Memoria de sesiones](.agents/notes/memory.md)
