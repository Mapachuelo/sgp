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

## Modo oscuro

El tema oscuro es neutro, no azul marino:

| Rol | Valor |
|---|---|
| Fondo | `#0f100f` |
| Superficie | `#161816` |
| Panel | `#1d201d` |
| Activo | `#272b27` |
| Borde | `#2a2e2a` |
| Tinta | `#f2f2ee` |
| Secundario | `#b4b8b3` |
| Acento | `#5cc7d8` |
| Éxito | `#5fd39a` |
| Aviso | `#f0b45c` |
| Error | `#f07a72` |

- La preferencia se guarda en `localStorage` como `sgp_tema`: `claro`, `oscuro` o `sistema`.
- El modo inicial es `sistema`; el `TemaProvider` escucha `prefers-color-scheme`.
- `data-theme="dark"` en `<html>`, `color-scheme: dark` y `meta[name="theme-color"]` actualizado.
- El script inline de `index.html` aplica el tema antes de React para evitar el flash blanco.
- `BotonTema` en cabeceras y auth; `TemaSelect` en perfiles y sidebar para elegir Claro/Oscuro/Sistema.
- Los estados usan tokens de píldora y barras; no colores pastel hardcodeados.
- El QR conserva fondo blanco en ambos temas para que siga siendo escaneable.
- Los mapas aplican un filtro solo al `tile-pane`; marcadores, popups y controles conservan sus tokens.
- El widget de Wompi es externo y mantiene su propio tema; el contenedor sí cambia.

## Shell por rol

- Cliente: barra superior de 56px, contenido centrado de 1120px, navegación inferior en móvil.
- Empleado y administrador: shell de `100dvh` con sidebar fija de 228px, barra superior fija de 48px y hoja blanca con scroll interno.
- El scroll global no mueve el sidebar ni la barra superior.
- Los sheets usan altura automática con `max-height` y scroll interno; no dejan un bloque blanco cuando el contenido es corto.
- Móvil: el sidebar se convierte en menú; las tablas de administración pasan a listas o scroll interno.
- Las acciones de formularios y reservas quedan en barras sticky para no obligar a recorrer toda la página.

## Rutas

- `/cliente`: próxima cita, listas de próximas, historial y canceladas.
- `/cliente/reservar`: flujo de sede, servicios (panel fijo con scroll interno), detalle con carrusel de imágenes, equipo por servicio, horario combinado, confirmación y pago.
- `/cliente/perfil`: datos y eliminación de cuenta.
- `/empleado`: cola con “Ahora”, “En espera” y “Programadas”.
- `/empleado/agenda`: agenda del día con espacios libres y acciones.
- `/empleado/disponibilidad`: semana con una sede por día y editor de horario.
- `/empleado/perfil`: datos del empleado.
- `/admin`: día, KPI, timeline, atención y agenda.
- `/admin/agenda`, `/admin/equipo`, `/admin/servicios`, `/admin/sedes`, `/admin/horarios`, `/admin/clientes`, `/admin/reportes`, `/admin/actividad`: secciones del panel; las acciones de creación y edición se abren en sheet.
- `/login`, `/register`, `/verificar`: autenticación y OTP.

## Componentes

`Button`, `Input`, `Select`, `Textarea`, `BuscadorSelect`, `Card`, `Badge`, `StatusPill`, `Sheet`, `Modal`, `ConfirmDialog`, `PageHeader`, `KpiStrip`, `DataTable`, `EmptyState`, `Skeleton`, `Tabs`, `SegmentedControl`, `Spinner`, `Toast`, `BotonTema`, `TemaSelect`.

Los formularios usan etiquetas arriba, altura de 40px y foco visible de 2px. Los estados vacíos conservan el marco y una acción. Las cargas usan barras planas, sin shimmer. Los errores se muestran dentro del bloque afectado, con reintento.

`BuscadorSelect` es el selector para listas largas: búsqueda sin tildes, teclado (flechas, Enter, Escape), `aria-activedescendant`, lista en portal y estado "Sin resultados". No se usa para listas cortas de 2 a 5 opciones.

## Servicios y reservas multi-servicio

- El catálogo se organiza en **categorías o títulos** (Peluqueada, Planchada, Barba, Color, Peinado, Tratamientos, Otros) y servicios dentro de cada una.
- Cada servicio puede tener de 0 a 6 imágenes, descripción, precio, duración y estado activo/inactivo. Las imágenes se comprimen en el navegador y se guardan como data URLs.
- La primera imagen es la portada (`servicio_catalogo.imagen_url`); la galería completa vive en `servicio_imagen` y se carga bajo demanda.
- Al hacer clic en la tarjeta se abre el detalle: imagen grande, flechas laterales, contador, miniaturas, precio, duración y acción de agregar/quitar.
- El listado de servicios es un panel de altura fija en ordenador y móvil: categorías, buscador y barra de resumen quedan fijos; solo la cuadrícula tiene scroll interno.
- El cliente elige uno o varios servicios; la barra de resumen muestra cantidad, duración y total.
- Cada servicio puede tener un estilista distinto; el sistema propone un equipo y el cliente puede cambiarlo.
- El calendario solo muestra horas donde la secuencia completa cabe y todos los estilistas están libres.
- La confirmación lista cada segmento con su estilista, horario y precio; el pago usa el total calculado por el servidor.
- El admin configura el máximo de servicios por reserva en **Servicios → Configuración**.
- Las imágenes de servicio usan un placeholder neutro con `ImageOff`; no se inventan degradados ni ilustraciones.
- Las tarjetas de servicio son compactas en móvil (miniatura + datos) y muestran una portada de altura fija en escritorio.
- En el paso **Equipo**, si un servicio no tiene estilista en la sede, se muestra un aviso y el botón **Ver sedes**. El modal lista las sedes que sí ofrecen el servicio, las dibuja en el mapa y permite cambiar de sede o quedarse y quitar el servicio.
- El dashboard del cliente muestra el estado de pago (`Pagado`, `Pago pendiente`, `Pago en proceso`, `Pago no completado`) y permite pagar en línea las citas activas impagas.

## Movimiento

- Botones: `scale(0.97)` en press, 120ms `ease-out`.
- Sheets: 280ms con curva de drawer; entrada/salida por el mismo borde; scrim opaco.
- Modales: `scale(0.97)` + opacidad, 200ms.
- Toasts: Sonner, un solo `Toaster` en la raíz, `toast.promise` para operaciones de pago y cola.
- Sin animaciones de entrada en dashboards, sin count-up, sin dibujo de gráficos y sin hover con elevación.
- `prefers-reduced-motion` reduce el movimiento a opacidad.
- El cambio de tema no anima toda la página; solo actualiza tokens y un crossfade corto si se desea.

## Accesibilidad y móvil

- `viewport-fit=cover`, safe areas, `100dvh`, inputs de 16px en táctil, hover solo con puntero fino.
- Foco visible, labels asociados, `aria-live` para cambios de cola, tablas con `scope`.
- `break-ui`: los fixtures de peor caso se prueban en 320, 390, 768 y 1440, con 200% de zoom.
- i18n ES/EN con diccionario por nodo; los datos dinámicos usan `Intl` cuando la pantalla lo permite.
- Tema claro y oscuro, además de `prefers-color-scheme`; contraste AA en textos, estados y mapas.

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
- Playwright/Chromium para capturas 1440, 768 y 390 en tema claro y oscuro; revisar consola y desbordes horizontales.
- Probar `sistema` con `prefers-color-scheme: dark` y `light`, y persistencia al recargar.
- Suites de API, datos, esquema, unitarias, e2e y regresión 10x10.
