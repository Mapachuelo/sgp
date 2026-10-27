---
name: diseno-sgp
description: >-
  Reglas de diseno de la interfaz SGP para cualquier cambio visual en cliente, empleado o administrador.
  Activa esta skill antes de tocar pantallas, componentes, tokens, motion, responsive o i18n visual.
---

# Diseno SGP

Esta skill fija la direccion visual del SGP y el orden de lectura para no reconstruir el diseno desde cero.

## Lectura obligatoria

Antes de editar cualquier pantalla del frontend, leer:

1. `docs/diseno/nueva-interfaz.md`
2. `.agents/skills/design-taste-frontend/SKILL.md`
3. `.agents/skills/design-taste-frontend/references/app-screens.md`
4. `.agents/skills/emil-design-eng/SKILL.md`
5. `.agents/skills/apple-design/SKILL.md`
6. `.agents/skills/mobile-native/SKILL.md`
7. `.agents/skills/animate/SKILL.md`
8. `.agents/skills/animation-performance/SKILL.md`
9. `.agents/skills/review-animations/SKILL.md`
10. `.agents/skills/break-ui/SKILL.md`

Skills de apoyo segun la tarea:

- `prototype` para explorar variantes de un componente.
- `pick-ui-library` antes de agregar una dependencia de UI.
- `ask-sonner` para toasts.
- `find-animation-opportunities` para decidir si algo debe animarse.
- `improve-animations` para auditar movimiento existente.
- `animation-vocabulary` para nombrar un efecto.
- `animate-expo` y `write-swift` no aplican al stack web actual; no instalar Reanimated ni escribir Swift para este frontend.

## Direccion visual

- Estilo `framed-sheet`: marco piedra, hoja blanca, borde de 1px y sin sombra en reposo.
- Tipografia: Archivo Variable para UI y titulos; IBM Plex Mono solo para tokens QR e IDs.
- Acento teal `#1b6c80` en datos, foco y estados activos; boton primario tinta `#161716`.
- Sin gradientes, glass, sombras en tarjetas, iconos dentro de KPI, tablas con cebra ni etiquetas en mayusculas con tracking.
- Radios: tarjeta 8px, control 6px, sheet 16px. Rejilla base 4px; gap 16-24px.

La fuente de verdad de los tokens es `frontend/src/index.css`. Los componentes base estan en `frontend/src/componentes/ui/index.jsx`. No crear tokens paralelos.

## Shell

- Cliente: barra superior sticky, contenido de maximo 1120px y barra inferior fija en movil.
- Empleado/admin: `h-[100dvh] overflow-hidden`; sidebar de 228px y barra superior de 48px fijas; solo scrollea el contenido blanco.
- El scroll global no debe mover el sidebar ni la barra superior.
- Sheets de escritorio con altura automatica, `max-height` y scroll interno; no dejar huecos blancos.
- Acciones de formularios, reservas y sheets en barras sticky, visibles sin recorrer toda la pagina.
- Movil: el sidebar se convierte en menu; el contenido tiene scroll y safe areas.

## Datos y tablas

- Numeros tabulares y alineados a la derecha; dinero COP sin decimales.
- Cero se imprime como `0`; dato faltante como raya gris.
- Una sola marca de estado por fila; el pago va como texto/linea, no como segundo badge.
- Tablas de administracion: cabecera sticky, scroll interno, columnas secundarias ocultas en pantallas estrechas.
- No usar paginacion en un overview corto: limitar filas y enlazar a la vista completa.

## Tema claro y oscuro

- `TemaProvider` en `frontend/src/contexto/tema-context.jsx`; hook en `hooks/use-tema.js`.
- Preferencias: `claro`, `oscuro`, `sistema`; clave `sgp_tema`.
- Tema inicial: `sistema`; escuchar `prefers-color-scheme`.
- `data-theme="dark"` en `<html>`, `color-scheme` y `theme-color` actualizados.
- Script inline en `index.html` para evitar flash blanco.
- `BotonTema` en cabeceras/auth y `TemaSelect` en perfiles/sidebar.
- Estados con tokens de píldora/barras; no colores pastel hardcodeados.
- QR siempre sobre blanco; mapas con filtro solo al tile pane.
- Probar ambos temas en 1440, 768 y 390, y el modo sistema en oscuro y claro.

## Catálogo y reservas multi-servicio

- Jerarquía: `servicio_categoria` (título) → `servicio_catalogo` (servicio). El admin crea ambos.
- Cada servicio tiene imagen opcional, descripción, precio, duración y estado activo/inactivo.
- El cliente elige 1..N servicios; el máximo se configura en el admin (`configuracion.max_servicios_reserva`).
- Cada servicio puede tener un estilista distinto; el calendario valida la secuencia completa.
- `reserva_servicio` guarda servicio, estilista, horario y precio/duración congelados. No mostrar precios actuales del catálogo en reservas existentes.
- Las listas largas (empleados, servicios, categorías) usan `BuscadorSelect`; la búsqueda de servicios del cliente filtra tarjetas en vivo.
- Las imágenes de servicio se comprimen antes de subirlas y se muestran con placeholder `ImageOff` cuando faltan.

## Movimiento

- Press: `scale(0.97)`, 120ms, `--ease-out`.
- Sheets: 280ms, curva de drawer; modales: 200ms.
- Sin animaciones de entrada en dashboards, sin count-up, sin dibujar graficos, sin hover con elevacion.
- Solo `transform` y `opacity`; `prefers-reduced-motion` conserva opacidad y elimina desplazamiento.
- Toasts con Sonner, un solo `Toaster` en la raiz.

## Verificacion

```bash
npx pnpm@11 --filter frontend build
pnpm run lint
node .agents/skills/design-taste-frontend/scripts/lint.mjs --app frontend/src
node .agents/skills/design-taste-frontend/scripts/inspect.mjs --app http://localhost:8080/login
```

Ademas, revisar en Chromium a 1440, 768 y 390:

- sidebar y barra superior fijas;
- sheets sin huecos;
- acciones sticky visibles;
- sin scroll horizontal;
- consola sin errores;
- tema claro y oscuro, y persistencia de `sgp_tema`;
- carrito multi-servicio, equipo por servicio y calendario combinado sin desbordes.

## Cierre

Al terminar un cambio visual, actualizar `.agents/notes/memory.md` con el estado de diseno y los pendientes. No cambiar logica de negocio, endpoints ni esquema de BD para resolver un problema visual.
