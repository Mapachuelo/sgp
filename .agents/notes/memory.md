# Memoria del proyecto — SGP

## Sesion inicial — 30 Mayo 2026

### Decisiones tomadas
- Rehacer todo el software desde cero en rama `todo/nuevo` (la rama `main` tiene codigo viejo con frontend+backend acoplados)
- Stack confirmado: React + Vite + shadcn/ui + Tailwind (frontend), Node.js + Express CommonJS (backend), PostgreSQL 17, Podman
- Monorepo con pnpm workspaces: `frontend/` y `backend/` separados
- Idioma en codigo: español (archivos, rutas, tablas, variables)
- Roles: `cliente`, `empleado`, `admin`
- Sin TypeScript. Sin ORM. Sin Docker (solo Podman)

### Cambios al IEEE 830
- `docs/formato_ieee830.md` actualizado con nuevos requisitos (12 funciones F1-F12, 13 RFs RF0-RF12)
- Cambios clave respecto al original:
  - Cliente: max 5 reservas activas, flujo ubicacion->empleado->calendario->ventana flotante
  - Cobro: fisico o digital (empleado elige metodo)
  - Nuevo: kanban + mapa lateral para cliente (RF8, F8)
  - Nuevo: disponibilidad semanal del empleado por sede (RF9, F9)
  - Nuevo: dashboard administrador con ventanas flotantes (RF11, F11)
  - Nuevo: gestor de logs.txt y errores.txt (RF12, F12)
  - Empleado NO genera reportes (solo admin)
  - Ubicaciones con coordenadas lat/lng para mapa Leaflet
  - Tablas renombradas de ingles "employee" a español "empleado"

### Estructura renombrada
- `.agent/` -> `.agents/`
- `Documentacion/` -> `docs/`
- Skill actualizada con stack tecnologico y monorepo

### Archivos creados esta sesion
- `plan.md` (plan completo de desarrollo)
- `.agents/notes/memory.md` (este archivo)
- `.agents/skills/contexto.md` (actualizado)

### Pendientes
- Iniciar Fase 0 (infraestructura: pnpm-workspace, package.json, Podman, Containerfile, db/init.sql)
- Crear `.agents/skills/architecture.md`
- Scaffold frontend (Vite + React + Tailwind + shadcn/ui)
- Crear backend base (Express + pg + JWT + Pino)
- Implementar por fases segun plan.md

### Bugs conocidos
- Ninguno (no hay codigo aun)

---

## Sesion — 1 Junio 2026

### Backend completo implementado (Fases 0-5)

#### Infraestructura
- Monorepo pnpm workspaces con `backend/` y `frontend/` (placeholder)
- Podman: 2 contenedores (`db` postgres:17-alpine + `backend` Node 22 Alpine)
- `podman kube play` con pods `sgp-db` y `sgp-app` funcional
- ESLint + Prettier configurados, lint limpio (0 errores, 0 warnings)

#### Base de datos (db/init.sql)
- 10 tablas: `ubicacion`, `app_user`, `empleado_perfil`, `servicio_catalogo`, `empleado_tiempo_servicio`, `jornada`, `empleado_disponibilidad`, `reserva`, `cobro`, `preferencia_usuario`
- Indices en reserva (inicia_en, cliente_id, empleado_id, estado, ubicacion_id), cobro (cobrado_en), app_user (rol, esta_bloqueado)
- Seed: admin@sgp.local/admin123, empleado@sgp.local/empleado123, Sede Centro, 4 servicios, jornadas demo
- Inicializacion automatica con `CREATE TABLE IF NOT EXISTS` via `config/database-init.js`

#### Nucleo compartido
- `logger.js`: Pino con 2 streams → `backend/logs.txt` (info+) y `backend/errores.txt` (warn+)
- `async-handler.js`: wrapper try/catch para controladores async
- `http-error.js`: clase Error con statusCode
- `encriptacion.js`: AES-256-CBC (encriptar/desencriptar)
- Middlewares: `auth.middleware.js` (authenticate + authorize roles), `error.middleware.js`, `notFound.middleware.js`, `rateLimit.middleware.js` (10 intentos/15min)
- `app.js`: Express con helmet, CORS, JSON, middlewares, rutas
- `server.js`: http.createServer + WebSocket, listen en PORT

#### Features implementados (35+ endpoints)
- **Auth** (RF0, RF1): register (solo cliente), login unificado, /me, CRUD empleados (admin)
- **Clientes** (RF1, RF11): GET|PUT|DELETE /me, GET / (admin), bloquear/desbloquear (admin), DELETE (admin, regla 3+ no-shows)
- **Ubicaciones** (RF6): CRUD con lat/lng
- **Reservas** (RF2, RF8): CRUD servicios, disponibilidad, jornada, empleado-tiempos-servicio, POST reserva (max 5 activas, anticipacion 60min, QR code), GET /me, DELETE /me/:id, GET / (empleado/admin)
- **Checkin** (RF3): POST /validar con validacion QR, ventana +-120min, transaccion atomica (checkin + cobro)
- **Reportes** (RF5): ventas-diarias, ocupacion, clientes-recurrentes
- **Disponibilidad** (RF9): GET|PUT disponibilidad semanal empleado, cancela reservas futuras al cambiar sede
- **Logs** (RF12): GET actividad/errores/exportar con filtros
- **Preferencias**: GET|PUT rango horario, granularidad, tema por usuario

#### Tiempo real (Fase 5)
- WebSocket server en `/ws` via `ws-hub.js`
- Emite `conexion`, `disponibilidad.actualizada`, `reserva.actualizada`

#### Pruebas
- `tests/api.sh`: 38 pruebas de integracion, todas pasan (38 PASS, 0 FAIL)
- Rate limiting verificado (bloquea tras 7 intentos de login)

#### Rutas de import corregidas
- Todos los modelos usan `require('../../config/db')` (2 niveles, no 3)

### Decisiones importantes
- `.env` excluido del contenedor via `.containerignore`; variables se pasan via `environment:` en sgp-app-pod.yaml
- `db/init.sql` copiado al contenedor via `COPY db/ ./db/` en Containerfile
- PostgreSQL 17 requiere volumen limpio si habia PG16 previo
- Imagen postgres debe ser `docker.io/library/postgres:17-alpine` (fully qualified)

### Bugs conocidos
- Ninguno

### Proximos pasos (Fases 5-10 segun plan.md)
- Fase 5 ya completada (WebSocket)
- Pendiente: Frontend (React + Vite + shadcn/ui) — NO iniciar hasta que se pida
- Pendiente: Containerfile.nginx para frontend
- Pendiente: Pruebas unitarias >80% cobertura
- Pendiente: HTTPS con Nginx + Let's Encrypt

---

## Sesion — 11 Junio 2026

### Optimizaciones de Frontend y Diseño de Grillas

#### Disponibilidad del Empleado (mi-disponibilidad.jsx)
- Se restauró el bloque JSX principal de la pantalla de planificación semanal.
- Se reestructuró el layout del planeador para presentar un diseño de doble columna: a la izquierda la grilla de turnos (`lg:w-3/4`) y a la derecha los componentes de "Mis Servicios Asignados" y "Leyenda de Disponibilidad" (`lg:w-1/4`), para coincidir exactamente con el diseño estructural e interactivo del prototipo demo2.html.

#### Flujo de Reserva del Cliente (nueva-reserva.jsx)
- Se rediseñó el Paso 3 (Calendario) del cliente, reemplazando las 6 columnas de días independientes por una grilla/tabla unificada similar al planeador del empleado (horas sticky a la izquierda y días de la semana como columnas en la cabecera).
- Los slots se presentan de forma compacta y cohesionada con las clases de estado (.slot-libre, .slot-ocupado, .slot-antelacion) definidas en el tema HSL premium.
- Se centró la tabla de disponibilidad (`max-w-4xl mx-auto`) y se limitó su altura a un scroll interno fijo (`max-h-[42vh]`) para mejorar la ergonomía visual y permitir al usuario ver la leyenda y el botón de navegación sin necesidad de hacer scroll en toda la página.

#### Navegación Responsiva (layout.jsx)
- Se implementó un menú hamburguesa interactivo en el navbar principal de la aplicación (`layout.jsx`).
- En dispositivos móviles (`md:hidden`), todos los enlaces del menú del rol correspondiente, el nombre del usuario y la opción de cerrar sesión se colapsan dentro del botón hamburguesa que se expande hacia abajo suavemente. En pantallas de portátiles y superiores, se conserva el navbar horizontal limpio.

#### Ergonomía y Resistencia a la Saturación
- En `empleado-dashboard.jsx` (citas de hoy) se reordenaron las columnas para dispositivos móviles usando flexbox grid orders (`order-1` y `order-2` / `lg:order-*`). De esta manera, el listado de citas (Timeline) se renderiza arriba (primero) y el mapa con el resumen de sede hoy se sitúa abajo, mejorando significativamente la usabilidad en pantallas pequeñas.
- Se limitó la altura de los listados de citas/reservas en `empleado-dashboard.jsx` (`max-h-[70vh]`) y `admin-dashboard.jsx` (`max-h-[55vh]`), añadiendo scrollbars verticales internos. Esto evita el estiramiento kilométrico de la página vertical en escenarios de alta saturación.
- Se implementó un script de pruebas de estrés/saturación de datos en `backend/src/utils/semillar-saturacion.js` que inserta directamente en base de datos 60 citas de prueba en intervalos de 15 minutos para el día de hoy, y se vinculó al comando global `pnpm run seed:saturacion` en `package.json` para facilitar las pruebas del frontend frente a grandes volúmenes de usuarios.

#### Verificación y Pruebas
- Se ejecutó `pnpm --filter frontend build` para asegurar la compilación en limpio del proyecto.
- Se ejecutó `pnpm run lint` sobre el backend para validar el estándar de codificación.
- Se recrearon los contenedores con `podman compose up --build -d` para verificar el correcto despliegue local de la aplicación.

---

## Sesion — 15 Junio 2026

### Mejoras de Usabilidad en Dashboard de Clientes y Agendamiento

#### Dashboard de Clientes (cliente-dashboard.jsx)
- Se añadieron botones de filtro por separado para filtrar reservas por estado de manera interactiva en tiempo real.
- Se cambió el grid rígido horizontal de 5 columnas por un grid responsivo (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`), limitando su altura a `max-h-[55vh]` con scroll vertical interno (`overflow-y-auto pr-2`) para evitar estiramientos.
- Se aplicó la clase `break-all` al `qr_token` para solucionar el desbordamiento de letras ("Token") en pantallas móviles reducidas.

#### Agendar Cita (nueva-reserva.jsx)
- **Paso 1 (Sedes):** Se añadió un buscador de texto y un selector de filtrado por ciudad (las ciudades se obtienen de forma dinámica de la dirección de cada sede). El listado de sedes tiene ahora una altura máxima fija (`max-h-[300px]`) con scroll vertical y los marcadores en el mapa Leaflet se filtran dinámicamente.
- **Paso 3 (Calendario):** Se removió el bloque condicional responsivo que mostraba `"Días: 15 jun - 16 jun"` y los botones Anterior/Siguiente en móviles, limitando la visualización a exactamente 2 días en móviles (`diasVisibles = isMobile ? semana.slice(0, 2) : semana`) y 6 días en escritorio, para un diseño responsive y limpio delegando el cambio de fecha al selector de calendario superior.
- **Paso 5 (Pago):** Se implementó una función formateadora para agregar automáticamente la barra `/` en el campo "Expiración" (`MM/AA`), restringiendo a solo dígitos y permitiendo borrar de forma natural con backspace.
- **Cuadros QR Fijos:** Se limitó el ancho del cuadro blanco del código QR a `w-48` en confirmación y `w-40` en paso 5, aplicando `break-all` al texto del token para evitar que el hash distorsione o ensanche la caja en pantallas móviles.
- **Stepper (Indicador de Progreso):** Se removió el scroll horizontal y se ajustó para ser 100% fijo y responsivo (se ocultan las etiquetas de texto en móviles y las líneas conectoras se expanden proporcionalmente vía `flex-grow`).

#### Verificación y Pruebas
- Se ejecutó `pnpm --filter frontend build` y compiló correctamente.
- Se verificó lint en backend sin novedades críticas.

#### Dashboard de Administrador (admin-dashboard.jsx)
- **Reubicación de Sección de Gestión:** Se removió la barra fija flotante del extremo inferior de la pantalla.
- **Contenedor Premium Integrado:** Se insertó un nuevo bloque inline para "Gestión del Sistema" situado justo encima de las tarjetas de KPI ("Recaudación hoy"). Este bloque mantiene el estilo del dashboard con un contenedor premium (`bg-superficie border border-borde rounded-2xl p-4 shadow-premium`) y flexbox responsivo para que los botones se distribuyan de forma fluida en todo tipo de pantallas.

#### Navegación y Etiquetas (layout.jsx y nueva-reserva.jsx)
- **Cambio de 'Dashboard' a 'Inicio':** Se renombraron las etiquetas de navegación del Administrador y del Cliente a "Inicio" en `layout.jsx`.
- **Botón de retorno al Inicio:** Se actualizó el texto del botón al finalizar una reserva en `nueva-reserva.jsx` para que diga "Ir al inicio".

#### Responsividad en el Dashboard del Administrador (admin-dashboard.jsx)
- **Adaptabilidad de KPI y Formularios:** Se configuró la grilla de KPI para apilarse en móviles y los formularios de creación/edición para usar `grid-cols-1 sm:grid-cols-2`, logrando un uso óptimo del espacio.
- **Scroll Horizontal en Tablas:** Se añadieron anchos mínimos a las tablas de reportes, clientes, sedes, servicios y empleados, evitando el colapso visual del texto y habilitando un scroll horizontal suave dentro de cada hoja.
- **Controles Adaptables:** Se rediseñaron filtros, selectores y botones de exportación de logs/reportes para apilarse verticalmente en móviles y alinearse horizontalmente en escritorio (`flex-col sm:flex-row`).

#### Asignación de Múltiples Sedes y Horarios (admin-dashboard.jsx y disponibilidad en backend)
- **Backend multi-sede:** Se habilitó el soporte para la asignación y limpieza de disponibilidad multi-sede mediante un nuevo enrutador de administrador (`GET` / `PUT` `/api/empleados/:empleadoId/disponibilidad`), y se flexibilizó la validación del servicio para admitir asignaciones vacías.
- **Frontend interactivo de horarios:** Se implementó una sección en el formulario de empleados con checkboxes para seleccionar múltiples sedes, y un visualizador de horarios semanales (Lunes a Domingo) para configurar cuándo está disponible el empleado y cuándo en descanso para cada una de ellas de manera independiente.
- **Filtro de Sede Base:** Se restringieron las opciones del selector de Sede Base en el formulario para mostrar exclusivamente aquellas sedes que hayan sido marcadas previamente.

---

## Sesión — 15 Junio 2026 (Segunda Parte)

### Remoción de "Sede base" y Bloqueo de Disponibilidad Duplicada

#### Remoción de "Sede base"
- Se removió completamente el selector obsoleto "Sede base" del formulario de empleados en [admin-dashboard.jsx](file:///home/mapachuelo/Documentos/github/trabajos/sgp/frontend/src/funcionalidades/admin/admin-dashboard.jsx).
- Se eliminó la columna "Sede" de la tabla de listado de empleados en el frontend.
- Se omitió el campo `ubicacion_base_id` en las llamadas de guardado del empleado para limpiar la lógica.

#### Bloqueo de Disponibilidad Duplicada
- **Frontend (admin-dashboard.jsx):**
  - Se introdujo `crearHorarioVacio()` para que al asignar ubicaciones adicionales no se autogeneren horarios en conflicto.
  - Se modificó `updateDiaConfig` para impedir que se asigne disponibilidad a un empleado en más de una sede el mismo día, mostrando un Toast de error.
- **Backend (disponibilidad.service.js):**
  - Se añadió validación en `updateDisponibilidad` que arroja `HttpError(400)` si la payload de disponibilidad contiene días repetidos (`dia_semana` duplicados) para diferentes sedes.

#### Pruebas y Despliegue
- Se corrigió [api.sh](file:///home/mapachuelo/Documentos/github/trabajos/sgp/tests/api.sh) para calcular fechas futuras de forma dinámica y evitar fallos por fechas pasadas.
- Se añadió un caso de prueba para el bloqueo de duplicidad de disponibilidad en el mismo día.
- Se reiniciaron los contenedores de Podman y todas las pruebas de integración pasaron con éxito (`39 PASS, 0 FAIL`).

---

## Sesión — 18 Junio 2026

### Corrección de Disponibilidad de Empleados y Asignación de Servicios

#### Flujo de Reserva del Cliente (nueva-reserva.jsx)
- **Servicios Específicos por Estilista**: Se reemplazó la carga de todos los servicios del catálogo por la consulta a los servicios asociados individualmente al estilista seleccionado en el paso anterior (`api.reservas.empleadoTiempos.get`). El dropdown en el paso 4 ahora solo despliega dichos servicios específicos con sus respectivas duraciones y precios personalizados.
- **Validación y Visualización de Disponibilidad en Calendario**:
  - Implementado el helper `esSlotFueraDeDisponibilidad` que valida si cada bloque horario está fuera de la jornada de trabajo registrada del empleado para ese día de la semana y sede.
  - Se definieron nuevos estados y clases de visualización para las celdas horarias:
    - **Pasado**: franjas que ya pasaron de la hora actual. Se muestran como "Pasado" en gris neutro (`slot-pasado`) y deshabilitadas.
    - **No disponible**: franjas fuera de la jornada de trabajo del empleado en ese día. Se muestran como "No disponible" en gris azulado (`slot-no-disponible`) y deshabilitadas.
    - **Ocupado**: franjas reservadas por otros clientes en su jornada laboral activa. Se muestran como "Ocupado" en rojo suave (`slot-ocupado`) y deshabilitadas.
    - **Disponible**: franjas dentro de la jornada y no reservadas. Se muestran en verde suave (`slot-libre`) y son seleccionables.
  - La leyenda al pie de la tabla del calendario fue actualizada para documentar los nuevos colores y significados de los estados.

#### Panel de Administración (admin-dashboard.jsx y backend)
- **Asignación Interactiva de Servicios en Empleados**:
  - Se agregó una nueva sección de "Servicios y Duraciones" al formulario de creación/edición de empleados dentro del panel administrativo. Presenta todos los servicios del catálogo con un checkbox y un input de número para que el administrador pueda asociarlos directamente al empleado con su duración en minutos.
  - Al editar un empleado, se recuperan automáticamente sus servicios individuales.
- **Asignación Interactiva de Servicios en Servicios**:
  - Se modificó la tarjeta "Tiempos de servicio por empleado" en la pestaña de servicios para mostrar una lista editable completa con checkboxes y duraciones customizadas para el empleado seleccionado, con su respectivo botón "Guardar Tiempos de Servicio".
- **Backend (reservas.model.js y reservas.service.js)**:
  - Modificado el método `findEmpleadoTiemposServicio` para que también retorne el campo `precio_base` de la tabla de servicios.
  - Modificado `upsertEmpleadoTiempoServicio` para realizar una limpieza completa previa de servicios mediante `DELETE` y evitar la persistencia de servicios desmarcados.
  - Añadida consulta `findEmpleadoDisponibilidadDia` en el modelo y adaptada la función `getDisponibilidad` del servicio para devolver la información de disponibilidad específica del estilista (`disponibilidad_empleado`) a las peticiones del frontend.

#### Corrección de Desfase de Zona Horaria (Sábado/Domingo)
- Se solucionó el problema de sincronía del calendario en el frontend con respecto a los días laborables del empleado: la fecha en formato string se parseaba usando la zona horaria del servidor (Bogotá, UTC-5), lo que desfasaba el cálculo en fines de semana. Se modificó el uso de `.getDay()` por `.getUTCDay()` tanto en el modelo `findEmpleadosDisponibles` ([reservas.model.js](file:///home/sena/Documentos/github/sgp/backend/src/features/reservas/reservas.model.js)) como en el servicio `getDisponibilidad` ([reservas.service.js](file:///home/sena/Documentos/github/sgp/backend/src/features/reservas/reservas.service.js)).

#### Ocultación del Campo de Duración Global de Servicios
- En el panel del Administrador, se ocultó la duración del formulario global de creación/edición de servicios en [admin-dashboard.jsx](file:///home/sena/Documentos/github/sgp/frontend/src/funcionalidades/admin/admin-dashboard.jsx) y se removió la columna `Duración` de la tabla de servicios generales, delegando esta configuración a los tiempos de servicio específicos por empleado.
- Se adaptó la función de guardado `handleSrvSave` para enviar `duracion_base_minutos` con un valor por defecto de 30 minutos a la API.
- Se mapearon los nombres de las columnas devueltas por PostgreSQL (`precio_base`, `duracion_base_minutos`) a las propiedades del frontend (`precio`, `duracion`) en `cargarServicios` para un renderizado correcto.

#### Verificación y Pruebas
- Se ejecutó `pnpm run lint` validando que el código backend y frontend esté libre de errores.
- Se corrigió un problema adicional de desfase horario en el frontend reemplazando el uso de `.toISOString().split('T')[0]` por un helper `formatearFechaLocal` en `nueva-reserva.jsx`, `admin-dashboard.jsx` y `empleado-dashboard.jsx`.
- Se insertaron los servicios de prueba para el empleado Carlos Gómez (ID: 2) directamente en la base de datos de Podman:
  - Corte clásico (30 min)
  - Barba (20 min)
- Se recompiló el frontend y se reconstruyeron las imágenes de los contenedores de Podman sin caché para aplicar todos los cambios de forma definitiva.
- **Correcciones Adicionales**:
  - Se autorizó el rol `cliente` para el endpoint `GET /api/reservas/empleado-tiempos-servicio` en `reservas.routes.js`, lo que elimina el error "No tiene permisos para esta accion" al renderizar el calendario del estilista seleccionado.
  - Se configuró la carga de empleados (`cargarEmpleados()`) al abrir la pestaña de Servicios en `admin-dashboard.jsx` (`activeSheet === 'servicios'`), resolviendo el dropdown vacío en la tarjeta "Tiempos de servicio por empleado".



---

## Sesion — 2 Agosto 2026

### Verificacion de cuenta por correo OTP (Brevo SMTP)

#### Que se hizo
- Nueva columna `verificado`, `token_verificacion`, `token_verificacion_expiracion` en `app_user` (db/init.sql, con ALTER IF NOT EXISTS para BD existentes).
- Backfill al final de init.sql: usuarios sin token quedan verificados (migra cuentas previas). Empleados creados por admin nacen `verificado = TRUE` (createEmpleado).
- `register` ya NO emite JWT: genera codigo OTP de 6 digitos (hash SHA-256 en BD), expiracion 15 min, lo envia por correo y devuelve `{ usuario, correoEnviado }`.
- Nuevos endpoints: `POST /api/auth/verificar` (email + codigo → JWT), `POST /api/auth/reenviar-codigo` (max 3 cada 15 min, limiter `verificacionLimiter`).
- `login` rechaza con 403 "Cuenta no verificada..." si `verificado = FALSE`.
- `backend/src/integrations/email/mailer.js`: nodemailer + SMTP Brevo (`smtp-relay.sendinblue.com:587`). El host `smtp-relay.brevo.com` NO funciona (cert mismatch), usar sendinblue.
- Script de prueba: `pnpm --filter backend exec node scripts/enviar-correo-prueba.js [email]`.
- Frontend: nueva pagina `/verificar` (verificar-page.jsx) con input 6 digitos + reenvio con contador 60s; registro redirige a /verificar sin sesion; login muestra enlace "Verificar mi cuenta" ante 403.
- `env.js` ahora carga `.env` desde la raiz del repo (path absoluto) porque dotenv lee desde el cwd.
- `sgp-config.yaml` (gitignored) con SMTP_* para `podman kube play --configmap`. Pod yaml publico NO lleva credenciales.
- `tests/api.sh` reescrito: registro 201, login sin verificar 403, codigo incorrecto 400, reenvio.

#### Decisiones
- OTP almacenado como SHA-256 (no legible en BD); expiracion 15 min.
- Registro siempre crea la cuenta aunque el correo falle (correoEnviado=false) para no bloquear cuentas; reenviar-codigo reintenta el envio.
- Usuarios pre-existentes y seeds (admin/empleado) verificados por backfill para no romper logins.

#### Estado actual
- Flujo completo validado en contenedores (pod de prueba sgp-app-test en hostPort 8081, red sgp-net): registro, 403 sin verificar, verificacion con codigo correcto → JWT, login posterior OK, rate limiter 429 OK.
- PENDIENTE (bloquea envio real): credenciales SMTP de Brevo invalidas — `Invalid login 535` con SMTP_USER=ajulianc47@gmail.com y key `xkeysib-0b75...`. El usuario debe revisar en Brevo (SMTP & API) la SMTP key correcta y el email de login. En el panel de Brevo ademas hay que verificar el remitente (sender) para produccion.
- PENDIENTE: rotar la key (se compartio por chat). `.env` y `sgp-config.yaml` contienen la key real (gitignored, verificado con git check-ignore).
- PENDIENTE: pod normal sgp-app no puede desplegarse en 8080 mientras corra el proyecto parqueadero (conflicto de puertos).

#### Bugs conocidos
- Ninguno en el flujo de verificacion.

#### Proximos pasos
- Conseguir credenciales SMTP validas y probar `node scripts/enviar-correo-prueba.js`.
- Reconstruir imagen frontend (ya hecho) y desplegar pod normal cuando 8080 este libre.

### Actualizacion: mailer cambiado a Brevo API v3 (SMTP descartado)
- La key de Brevo funciona con la API v3 (`POST /v3/smtp/email`) pero NO como SMTP (`535 Invalid login` con el email de cuenta). Se reescribio `backend/src/integrations/email/mailer.js` usando `fetch` nativo de Node 22 (sin nodemailer, dependencia removida).
- Variables: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (remitente verificado), `BREVO_SENDER_NAME` en `.env`, `.env.example` (placeholders) y `sgp-config.yaml` (gitignored).
- `sgp-app-pod.yaml` referencia las variables con `valueFrom.configMapKeyRef` (sin valores, seguro para repo publico). `podman kube play --configmap sgp-config.yaml` las inyecta (probado en contenedor: 3 vars presentes).
- Envio real verificado: script y flujo completo (registro, reenvio 200) enviaron correos OTP correctamente via API Brevo (MessageId devuelto).
- `tests/api.sh`: 4/4 PASS en contenedor (registro 201, login 403 sin verificar, reenvio 200, codigo incorrecto 400).
- Pendiente: rotar la key (se compartio por chat) y verificar remitente oficial en Brevo para produccion.

### Actualizacion: pods parametrizados con .env (eliminado el configmap)
- Se eliminaron los archivos de configuracion independientes: borrado `example.sgp-config.pod.yaml` y el flujo `--configmap sgp-config.yaml`.
- `example.sgp-app-pod.yaml` y `example.sgp-db-pod.yaml` se renombraron a `sgp-app-pod.yaml` y `sgp-db-pod.yaml` (git mv, commitables: solo placeholders `${VARIABLE}`, sin secretos) y se quitaron del `.gitignore`.
- Los pods se ejecutan con `set -a && source .env && set +a; envsubst < sgp-*.yaml | podman kube play --network sgp-net -` (envsubst de gettext; `kube play` y `kube down` aceptan stdin con `-`; `kube play` no expande variables ni acepta `--env-file`).
- Variables nuevas en `.env`/`example.env`: `DB_USER`, `DB_PASSWORD`, `DB_NAME` (alimentan POSTGRES_* y componen DATABASE_URL hacia `sgp-db`) y `FRONTEND_PORT` (default 8080, hostPort del frontend).
- Red `sgp-net`: bridge privado con salida a internet (necesario para Brevo API), creada con `podman network create sgp-net`; los pods se hablan por nombre. Backend sin puerto host (nginx proxya a 127.0.0.1:3000 en el mismo pod).

### Actualizacion: revertido a flujo 100% manual (sin envsubst, sin configmap)
- El usuario decidio que todo sea manual: nada de scripts ni `envsubst`; el mismo rellena los valores reales directamente en los archivos `.yaml`.
- Se restauraron `example.sgp-app-pod.yaml` y `example.sgp-db-pod.yaml` (valores de muestra, commitables) con `cp` desde los actuales + contenido original de `HEAD~1`. Los `sgp-app-pod.yaml`/`sgp-db-pod.yaml` reales quedan en disco pero `git rm --cached` + `.gitignore` (los rellena el usuario).
- Comandos directos: `podman kube play sgp-db-pod.yaml --network sgp-net` (PRIMERO la BD) y luego `podman kube play sgp-app-pod.yaml --network sgp-net`. Actualizar imagen: build + `kube down` + `kube play` (o `--replace`).
- `.env`/`example.env`: se quitaron `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `FRONTEND_PORT` (solo dev).
- CRASH-LOOP CONOCIDO: si `sgp-db` no esta corriendo, el backend muere con `getaddrinfo ENOTFOUND sgp-db` en `initDatabase` (server.js → process.exit(1)). Levantar la BD primero, o el backend se recupera en el siguiente restart del crash-loop.

---

## Sesion — 26 Septiembre 2026

### Verificacion completa contra IEEE 830 (docs/formato_ieee830.md) y correcciones

#### Backend
- **RF3 check-in:** `POST /api/checkin/validar` ahora es transaccional (`withTransaction` + `SELECT ... FOR UPDATE`), valida `qr_token` UUID y `monto` numerico >= 0, registra cobro y deja la reserva en `cobrado`; doble cobro responde 409. `en_curso` queda como estado transitorio no usado.
- **RF2 reservas:** creacion con transaccion + `pg_advisory_xact_lock(empleado, dia)`; valida entidades existentes, que el empleado ofrezca el servicio (`empleado_tiempo_servicio`), disponibilidad semanal en la sede (`estaDentroDeDisponibilidad`, TZ America/Bogota) y calcula `termina_en` con la duracion del servicio (se ignora el `termina_en` del cliente).
- **RF9:** el diff de disponibilidad detecta dias cambiados de sede y cancela solo las reservas futuras de ese dia en la sede anterior, con motivo literal `"El empleado cambió de sede"`; controller emite `reserva.actualizada` por cada cancelada.
- **RF12 logs:** filtro por fecha convertida a dia Bogota (Pino emite epoch ms), severidad exacta INFO/WARN/ERROR (`level` numerico), export aplica filtros y responde `.txt`.
- **RF7:** `GET/PUT /api/clientes/me` incluye y actualiza `identificacion` (join/upsert en `empleado_perfil`).
- **RNF2:** telefono cifrado en reposo con AES-256-CBC (`shared/utils/telefono.js`, llave `AES_SECRET` con fallback a `JWT_SECRET`); `database-init.js` migra telefonos en claro al iniciar.
- **RNF5:** Swagger UI en `/api/docs` + spec OpenAPI 3 en `/api/docs/openapi.json` (`src/docs/`), montado antes de Helmet para que la CSP no bloquee el CDN de swagger-ui.
- **Hardening:** `error.middleware` mapea 23505→409, 23503→400, 23514/22P02→400; validacion de lat/lng; `updateEmpleado` filtra `rol='empleado'`; reportes sin fecha usan hoy (Bogota) y ocupacion calcula `total` + `porcentaje`; filtros de fecha de reservas/reportes/slots en TZ Bogota.
- **Seed:** `empleado_tiempo_servicio` para el empleado semilla (los 4 servicios) — sin esto el calendario de reserva quedaba vacio en volumen nuevo.

#### Frontend
- **RF8:** dashboard cliente convertido a kanban real (pendiente/confirmada/en_curso/completada/cancelada) con panel lateral sticky, mapa Leaflet de la sede y descarga de QR.
- **RF2:** paso 4 ahora es `Modal` flotante con duracion estimada `entrada → salida`, personas 1-5 y total; ante 409 por solape vuelve al calendario, refresca y sugiere otro horario; calendario movil con paginacion de 2 dias.
- **RF10/RF11:** empleado con botones `[Validar QR]` y `[Registrar cobro]` y selector explicito online($0)/efectivo; admin mantiene el bloque inline (decision del usuario) ahora con los 9 accesos, incluidos modales centrados de `[Validar QR]` y `[Cobro]`; KPIs reales (sin textos falsos), badges `en_curso/cobrado`, timeline con montos.
- **RF9 frontend:** advertencia/confirmacion al cambiar sede y toast con reservas canceladas; arreglo de "Mis Servicios Asignados" (antes siempre vacio).
- **RF12 frontend:** input de fecha + export `.txt` via `api.logs.exportarTexto`.
- **UI2:** `Modal`/`Sheet` con `role="dialog"`, `aria-modal`, Escape, focus trap y retorno de foco; `Input`/`Select` con `useId`+`htmlFor`; aria-labels en iconos; `aria-live` en Toast; skip-link; contraste de tokens ajustado; foco visible.
- **C7 i18n:** proveedor propio (`i18n/`) con diccionario ES→EN (~200 frases), traduccion de nodos de texto/atributos por `MutationObserver` y toggle ES/EN en el navbar; persiste en `preferencia_usuario.idioma` + localStorage.
- **Bugs encontrados en verificacion web:** los `children` del `Modal` se evaluaban aunque estuviera cerrado (crash en `/cliente/reservar` al leer `diaSeleccionado.fecha`) → guard con render condicional; `findAllReservas` no traia `cobro.monto` (Total del dia del empleado mostraba $0) → LEFT JOIN cobro.

#### Infra y datos
- Volumen `sgp-pgdata` recreado (init.sql limpio); `app_user.telefono` pasa a TEXT sin CHECK y `preferencia_usuario.idioma` agregado con ALTER idempotente.
- Nuevo `.env.example` con placeholders (incluye `AES_SECRET`); `example.sgp-app-pod.yaml` con `AES_SECRET`.
- `tests/api.sh` reescrito (21 pruebas: healthcheck, docs, RF13, RBAC, validaciones RF3, reportes/logs, catalogos).

#### Verificacion
- `bash tests/api.sh` → 21 PASS, 0 FAIL.
- E2E API (`/tmp/opencode/e2e.py`) → 23 PASS, 0 FAIL (RF2 reserva/solape, RF3 check-in/cobro/doble cobro, RF9 cambio de sede con motivo exacto, reportes con ocupacion y ventas del dia).
- 12 capturas Chromium headless vía CDP de todas las pantallas (login, registro, verificar, kanban cliente, reserva, perfil, empleado citas, disponibilidad, admin, ingles, movil, Swagger): todas correctas.
- Lint backend limpio; build de frontend OK; imagenes `localhost/sgp-backend` y `localhost/sgp-frontend` reconstruidas y pod `sgp-app` redesplegado.

#### Pendientes / riesgos
- **Brevo:** la `BREVO_API_KEY` actual responde 535/502; el OTP real no se envia. Los clientes de prueba se verifican por SQL. Rotar la key (se compartio por chat) y verificar remitente.
- **HW1 camara:** el usuario probara el escaneo real; el modal ya soporta entrada manual y vista de camara.
- `sgp-app-pod.yaml` (gitignored) contiene la API key real; rotar tambien `JWT_SECRET`/`AES_SECRET` antes de produccion.
- i18n: traduccion por diccionario DOM; cadenas dinamicas con datos (fechas `toLocaleString`) permanecen en espanol.

---

## Sesion — 26 Septiembre 2026 (segunda parte)

### Plan de entrada/salida de datos masivos + fix del calendario

#### Fase 0: calendario y estilistas
- `irAPaso2` en `nueva-reserva.jsx` ahora consulta la disponibilidad de los **6 dias** que muestra el calendario y une estilistas por id (antes solo consultaba hoy: los domingos no aparecia nadie aunque trabajaran el lunes).
- El paso 3 del calendario quedo verificado en navegador (grid, estados, modal del paso 4).

#### Seed masivo `backend/src/utils/semillar-demo.js`
- Parametrizable por CLI (`--reset`/`--append`, `--sedes`, `--empleados`, `--clientes`, `--reservas`, `--diasPasados`, `--diasFuturos`, `--sin-export`, `--sin-api`) y RNG determinista.
- Volumen por defecto "Grande": 6 sedes, 10 servicios, 15 empleados `estilistaXX@demo.sgp`, 80 clientes `clienteXX@demo.sgp` (password `demo1234`, verificados, telefono cifrado AES), ~1270 reservas y ~725 cobros en -30..+30 dias, 366 jornadas.
- **Dinamica multi-sede:** cada empleado tiene 1-3 sedes y 4-6 dias de trabajo; cada dia laboral se asigna una unica sede (rotacion) garantizando **una sola sede por dia**; turnos variados (manana/tarde/completo/late). Se guardo el patron ejemplo estilista01 -> Lun Suba, Mie Kennedy, Jue Suba...; estilista05 -> solo Kennedy.
- Reservas con estados por fecha (pasadas cobrado/cancelada con motivos `Cancelada por el cliente`, `no-show`, `El empleado cambió de sede`; futuras pendiente/confirmada; 2 forzadas `en_curso` para los colores), QR para activas, `cobro` unico por reserva (70% fisico con monto, 30% online en 0) y maximo 4 activas por cliente para dejar cupo.
- **Flujo hibrido por API** al final: elige empleado con turno y ranura libre, login de cliente/empleado demo, crea reserva y hace check-in si la ventana +-120 min lo permite (si no, crea para el dia siguiente) para generar `logs.txt` y eventos WS reales.
- **Salida de datos:** `backend/exports/{reservas,cobros,disponibilidad}.csv` + `resumen.json` (ruta gitignored con `exports/`), resumen en consola y validaciones SQL automaticas.
- Scripts: `pnpm run seed:demo` (raiz y backend) y `pnpm run test:datos`; `tests/datos.sh` valida doble sede/dia, solapes, >5 activas, cobros duplicados, cobrado sin cobro y citas fuera de disponibilidad.

#### Bugs corregidos durante el desarrollo del seed
- Reset: `cobro.registrado_por` no tiene ON DELETE, ahora se borran primero los cobros de empleados demo (`cobro_registrado_por_fkey`).
- `minutosBogota()`: el calculo previo sumaba 300 min al UTC y fallaba en la madrugada (UTC ya es el dia siguiente); ahora se desplaza el instante -5h y se usan horas UTC.
- Cobro mapeado por `id` devuelto del INSERT de reservas (antes por orden fragil).

#### Bugs extra encontrados en la verificacion web (corregidos)
- KPI "Reservas del dia" mostraba `0557542`: `COUNT` de pg llega como string y el `reduce` concatenaba; se usa `Number(d.total)`.
- Elegir estilista no avanzaba al calendario: `irAPaso3`/`cargarCalendario` leian el estado `empleadoSeleccionado` (aun `null` en el closure del `setTimeout`); ahora se pasa el empleado por parametro (`irAPaso3(emp)`, `cargarCalendario(base, emp)`).
- Captura CDP: setear `localStorage` en `about:blank` no persiste; navegar primero a `/login`.

#### Verificacion final
- Imagenes reconstruidas y pod redesplegado; `bash tests/api.sh` 21/21 y `bash tests/datos.sh` 6/6 (estado final: 95 usuarios demo, 6 sedes, 10 servicios, 85 bloques de disponibilidad, 1274 reservas, 725 cobros).
- Capturas Chromium: empleado hoy (Natalia, Demo Sede Suba, Cancelada + Cobrado online $0), disponibilidad multi-sede (rotacion), kanban cliente (4 activas con mapa y QR), admin KPIs (33 citas hoy, $2.933.000, 27.5% ocupacion, 20 clientes), reportes con desglose por servicio, logs con actividad real, calendario paso 3 con "Disponible" (lunes 15:00-21:00) y modal paso 4 con duracion `15:00 → 15:45`.
- RF9 dinamico: mover el lunes de `estilista01` de la sede 47 a la sede 1 cancelo 4 reservas futuras con motivo exacto `El empleado cambió de sede` (respuesta API + BD) y se restauro la disponibilidad.
- Exports del seed en `backend/exports/` (gitignored): `reservas.csv` (~1270 filas), `cobros.csv`, `disponibilidad.csv`, `resumen.json`; copiados a `/tmp/opencode/exports` para inspeccion.

---

## Sesion — 26 Septiembre 2026 (tercera parte)

### Rediseño del panel admin + Planificador de Horarios

#### Backend (endpoints batch para el planificador)
- `GET /api/empleados/disponibilidad/todas` (admin): disponibilidad semanal de todos los empleados con nombre de empleado y sede.
- `GET /api/reservas/agenda?desde&hasta[&empleado_id]` (admin): citas del rango en TZ Bogota con cliente/servicio/sede/estado/qr_token; valida formato de fechas.
- OpenAPI actualizado y `tests/api.sh` ampliado a **25 pruebas** (nuevas: disponibilidad/todas 200 y 401, agenda 200, agenda con fecha invalida 400).

#### Frontend (rediseño desde 0 conservando funcionalidad)
- `admin-dashboard.jsx` reescrito (1971 → ~330 lineas) y modularizado (alineado con `architecture.md`):
  - `admin/utils.js` (estados, fechas Bogota, paleta de sedes, colores de cita).
  - `admin/secciones/`: `validar-qr-modal`, `cobro-modal`, `empleados-seccion`, `servicios-seccion`, `sedes-seccion`, `horarios-seccion` (tabs), `planificador-horarios`, `jornada-sede`, `reportes-seccion`, `clientes-seccion`, `logs-seccion`.
  - Cada seccion carga sus propios datos y es self-contained; los sheets se cierran recargando KPIs/timeline.
- **Planificador de horarios** (pestaña por defecto del sheet Horarios, `size="wide"` 95vw):
  - Matriz empleados x LUN-DOM con una sede por dia (colores por sede), filtros (busqueda, sede, solo con horario) y navegacion de semanas (Hoy/±7 dias).
  - **Citas superpuestas** por dia/empleado (chips por estado); clic en pendiente/confirmada abre el modal de validacion con su token (RF11: una ventana flotante a la vez).
  - Editor lateral por celda (sede, hora inicio/fin o descanso) con confirmacion RF9 al cambiar sede y toast con `reservas_canceladas`; guarda la semana completa del empleado via `PUT /empleados/:id/disponibilidad`.
  - Pestaña "Jornada por sede": CRUD de jornadas por fecha con agregar/quitar.
- Dashboard: acciones rapidas, tarjeta de Gestion con 9 accesos con iconos (lucide-react), KPIs con iconos y barra, timeline con cabecera sticky.
- `Sheet` acepta `size="wide"`; i18n ampliado (~80 cadenas nuevas); accesibilidad mantenida (role dialog, Escape, foco, labels, aria-pressed).

#### Verificacion
- `tests/api.sh` **25/25**, `tests/datos.sh` **6/6**, e2e **23/23**; lint backend limpio; build de frontend OK; imagenes reconstruidas y pod redesplegado.
- Capturas Chromium: dashboard redisenado, planificador con 207 citas de la semana, editor de celda, jornada por sede, empleados, reportes, logs y **RF9 desde el planificador** (cambio de sede de un dia con cita pendiente → toast "5 reserva(s) cancelada(s) por cambio de sede" y `reservas_canceladas` en API).
- Fixes de la verificacion: la pestaña de Horarios se resetea al reabrir (`useEffect` sobre `open`); las validaciones de datos exigen disponibilidad solo a citas activas (`pendiente/confirmada`), porque RF9 deja historicas y `en_curso` fuera de la nueva disponibilidad; rutas relativas de `admin/secciones/` (un nivel mas).
- Dataset demo regenerado limpio tras la demo RF9 (`semillar-demo.js --reset`).
