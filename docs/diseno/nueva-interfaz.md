# Nueva interfaz SGP

Documento de referencia de la interfaz implementada en `frontend/`. La fuente de verdad de los tokens es `frontend/src/index.css`; los componentes base viven en `frontend/src/componentes/ui/`.

Antes de cambiar una pantalla, leer también `.agents/skills/diseno-sgp/SKILL.md` y las skills de diseño indicadas en `AGENTS.md`.

## Dirección

- Estilo: `framed-sheet`, marco de piedra, hoja blanca, borde de 1px y sin sombra en reposo.
- Idea: la fila de turnos es el riel que ordena cliente, empleado y administrador.
- Tipografía: Archivo Variable para interfaz y títulos; IBM Plex Mono solo para tokens QR e identificadores.
- Acento: teal `#1b6c80` en datos y estados activos; el botón primario es tinta `#161716`.
- Sin gradientes, glass, sombras en tarjetas, iconos en KPI ni tablas con cebra.

## Tokens principales

| Rol | Valor |
|---|---|
| Fondo | `#f1f1ee` |
| Superficie | `#ffffff` |
| Panel | `#f5f5f2` |
| Activo | `#e8e8e3` |
| Borde | `#e1e1dc` |
| Control | `#cfcfc9` |
| Tinta | `#161716` |
| Secundario | `#5e625f` |
| Acento | `#1b6c80` |
| Acento suave | `#e6f1f3` |
| Éxito | `#1e7b4f` |
| Aviso | `#92400e` |
| Error | `#c4242a` |

Radios: tarjeta 8px, control 6px, sheet 16px. Rejilla base de 4px; gap 16-24px; sidebar 228px; barra superior 48px.

## Shell por rol

- Cliente: barra superior de 56px, contenido centrado de 1120px, navegación inferior en móvil.
- Empleado y administrador: shell de `100dvh` con sidebar fija de 228px, barra superior fija de 48px y hoja blanca con scroll interno.
- El scroll global no mueve el sidebar ni la barra superior.
- Los sheets usan altura automática con `max-height` y scroll interno; no dejan un bloque blanco cuando el contenido es corto.
- Móvil: el sidebar se convierte en menú; las tablas de administración pasan a listas o scroll interno.
- Las acciones de formularios y reservas quedan en barras sticky para no obligar a recorrer toda la página.

## Rutas

- `/cliente`: próxima cita, listas de próximas, historial y canceladas.
- `/cliente/reservar`: flujo de sede, estilista, horario, confirmación y pago.
- `/cliente/perfil`: datos y eliminación de cuenta.
- `/empleado`: cola con “Ahora”, “En espera” y “Programadas”.
- `/empleado/agenda`: agenda del día con espacios libres y acciones.
- `/empleado/disponibilidad`: semana con una sede por día y editor de horario.
- `/empleado/perfil`: datos del empleado.
- `/admin`: día, KPI, timeline, atención y agenda.
- `/admin/agenda`, `/admin/equipo`, `/admin/servicios`, `/admin/sedes`, `/admin/horarios`, `/admin/clientes`, `/admin/reportes`, `/admin/actividad`: secciones del panel; las acciones de creación y edición se abren en sheet.
- `/login`, `/register`, `/verificar`: autenticación y OTP.

## Componentes

`Button`, `Input`, `Select`, `Textarea`, `Card`, `Badge`, `StatusPill`, `Sheet`, `Modal`, `ConfirmDialog`, `PageHeader`, `KpiStrip`, `DataTable`, `EmptyState`, `Skeleton`, `Tabs`, `SegmentedControl`, `Spinner`, `Toast`.

Los formularios usan etiquetas arriba, altura de 40px y foco visible de 2px. Los estados vacíos conservan el marco y una acción. Las cargas usan barras planas, sin shimmer. Los errores se muestran dentro del bloque afectado, con reintento.

## Movimiento

- Botones: `scale(0.97)` en press, 120ms `ease-out`.
- Sheets: 280ms con curva de drawer; entrada/salida por el mismo borde; scrim opaco.
- Modales: `scale(0.97)` + opacidad, 200ms.
- Toasts: Sonner, un solo `Toaster` en la raíz, `toast.promise` para operaciones de pago y cola.
- Sin animaciones de entrada en dashboards, sin count-up, sin dibujo de gráficos y sin hover con elevación.
- `prefers-reduced-motion` reduce el movimiento a opacidad.

## Accesibilidad y móvil

- `viewport-fit=cover`, safe areas, `100dvh`, inputs de 16px en táctil, hover solo con puntero fino.
- Foco visible, labels asociados, `aria-live` para cambios de cola, tablas con `scope`.
- `break-ui`: los fixtures de peor caso se prueban en 320, 390, 768 y 1440, con 200% de zoom.
- i18n ES/EN con diccionario por nodo; los datos dinámicos usan `Intl` cuando la pantalla lo permite.

## Skills de diseño

Lectura obligatoria antes de tocar UI:

- `.agents/skills/diseno-sgp/SKILL.md`
- `.agents/skills/design-taste-frontend/SKILL.md` y `references/app-screens.md`
- `.agents/skills/emil-design-eng/SKILL.md`
- `.agents/skills/apple-design/SKILL.md`
- `.agents/skills/mobile-native/SKILL.md`
- `.agents/skills/animate/SKILL.md`
- `.agents/skills/animation-performance/SKILL.md`
- `.agents/skills/review-animations/SKILL.md`
- `.agents/skills/break-ui/SKILL.md`

Apoyo: `prototype`, `pick-ui-library`, `ask-sonner`, `find-animation-opportunities`, `improve-animations`, `animation-vocabulary`. `animate-expo` y `write-swift` no aplican al stack web actual.

## Verificación

- `npx pnpm@11 --filter frontend build`.
- `node .agents/skills/design-taste-frontend/scripts/lint.mjs --app frontend/src`.
- `node .agents/skills/design-taste-frontend/scripts/inspect.mjs --app <url>` sobre build de producción.
- Playwright/Chromium para capturas 1440, 768 y 390; revisar consola y desbordes horizontales.
- Suites de API, datos, esquema, unitarias, e2e y regresión 10x10.
