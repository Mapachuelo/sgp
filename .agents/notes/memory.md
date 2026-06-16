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
- `podman-compose up -d --build` funcional
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
- `.env` excluido del contenedor via `.containerignore`; variables se pasan via `environment:` en podman-compose.yml
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



