# AGENTS.md — SGP

Sistema de Gestión de Peluquería: aplicación web fullstack para reservas online, validación QR, cobros, reportes y administración.

## Arquitectura

- Monorepo pnpm workspaces con `frontend/` y `backend/` como paquetes independientes.
- Frontend: React 19 + Vite + JavaScript (sin TypeScript), Tailwind CSS, react-router-dom, Leaflet para mapas.
- Componentes base propios en `frontend/src/componentes/ui/`; no hay shadcn/ui instalado.
- Backend: Node.js 22 + Express (CommonJS), arquitectura feature-based (`routes → controller → service → model`).
- Base de datos: PostgreSQL 17, SQL directo con `pg` (sin ORM), esquema en `db/init.sql`.
- Realtime: WebSocket (`ws`) para notificaciones de disponibilidad.
- Logs: Pino (`logs.txt` actividad, `errores.txt` excepciones).
- QR: `qrcode`; Autenticación: JWT + bcryptjs + AES-256.
- Despliegue: Podman (kube play), dos pods `sgp-db` y `sgp-app` en la red `sgp-net`.

## Diseño de interfaz

Antes de modificar cualquier pantalla del frontend, leer en este orden:

1. `docs/diseno/nueva-interfaz.md`
2. `.agents/skills/diseno-sgp/SKILL.md`
3. `.agents/skills/design-taste-frontend/SKILL.md`
4. `.agents/skills/design-taste-frontend/references/app-screens.md`
5. `.agents/skills/emil-design-eng/SKILL.md`
6. `.agents/skills/apple-design/SKILL.md`
7. `.agents/skills/mobile-native/SKILL.md`
8. `.agents/skills/animate/SKILL.md`
9. `.agents/skills/animation-performance/SKILL.md`
10. `.agents/skills/review-animations/SKILL.md`
11. `.agents/skills/break-ui/SKILL.md`

Skills de apoyo según la tarea:

- `prototype` para explorar variantes de un componente.
- `pick-ui-library` antes de agregar una dependencia de UI.
- `ask-sonner` para toasts.
- `find-animation-opportunities` e `improve-animations` para movimiento.
- `animation-vocabulary` para nombrar efectos.
- `animate-expo` y `write-swift` no aplican al stack web actual.

Reglas que no se negocian:

- Los tokens viven en `frontend/src/index.css`; no usar colores sueltos.
- El shell de empleado/admin es fijo: sidebar y barra superior no scrollean; el contenido sí.
- Los sheets tienen altura automática, `max-height` y scroll interno; no deben dejar bloques blancos.
- Las acciones de formularios, reservas y sheets van en barras sticky.
- No gradientes, glass, sombras en tarjetas, iconos en KPI ni tablas con cebra.
- Usar los componentes de `frontend/src/componentes/ui/` antes de crear variantes nuevas.
- Para listas largas usar `BuscadorSelect`; no dejar un `<select>` con decenas de opciones.
- El catálogo es jerárquico: `servicio_categoria` (título) → `servicio_catalogo` (servicio con imagen, precio y duración).
- Una reserva usa `reserva_servicio`: 1..N segmentos, cada uno con servicio, estilista, horario y precio congelado. `reserva.servicio_id` y `reserva.empleado_id` son solo el primer segmento para compatibilidad.
- El máximo de servicios por reserva vive en `configuracion.max_servicios_reserva` y se edita en Servicios → Configuración (1 a 10).
- No calcular totales desde el navegador: el servidor suma los precios congelados de `reserva_servicio`.
- Revisar ES/EN, móvil, foco visible y `prefers-reduced-motion`.
- Mantener tema claro y oscuro: tokens en `:root[data-theme="dark"]`, preferencia en `sgp_tema`, QR sobre blanco y mapas con filtro solo al tile pane.
- `TemaProvider`, `BotonTema` y `TemaSelect` viven en `frontend/src/contexto/`, `componentes/tema/` y `hooks/use-tema.js`.

Verificación de UI:

```bash
npx pnpm@11 --filter frontend build
pnpm run lint
node .agents/skills/design-taste-frontend/scripts/lint.mjs --app frontend/src
node .agents/skills/design-taste-frontend/scripts/inspect.mjs --app http://localhost:8080/login
```

Además, capturas Chromium a 1440, 768 y 390 en tema claro y oscuro, y revisar que no haya scroll horizontal ni errores de consola. Probar `sistema` con `prefers-color-scheme` en oscuro y claro.

## Convenciones

- Código, archivos, rutas API y tablas de BD en español. Roles: `cliente`, `empleado`, `admin`.
- Sin TypeScript, sin ORM, sin comentarios en código salvo que se pidan.
- Ejecutar `pnpm run lint` después de cambios de código.
- No commitear sin que el usuario lo pida explícitamente.

## Comandos

```bash
pnpm install                          # Instalar dependencias
pnpm --filter backend dev             # Backend en :3000
pnpm --filter frontend dev            # Frontend en :5173
pnpm run lint                         # ESLint
bash tests/api.sh                     # Pruebas de integración (46)
bash tests/datos.sh                   # Integridad del dataset (10)
bash tests/esquema.sh                 # Esquema vs modelo de datos (66)
pnpm run test:unit                    # Unitarias en el contenedor backend (51)
pnpm run test:coverage                # Cobertura (>= 80%)
python3 tests/e2e.py                  # Extremo a extremo (47)
python3 tests/regresion_10x10.py      # Regresión funcional 10x10 (128)
pnpm run seed:pruebas                 # Seed determinista 10 clientes / 10 empleados
pnpm run seed:demo -- --reset         # Datos de demostración
node scripts/generar-drawio.js        # Regenerar diagramas draw.io
podman kube play sgp-db-pod.yaml --network sgp-net
podman kube play sgp-app-pod.yaml --network sgp-net
```

## Más contexto

Leer las carpetas `.agents/`, `docs/` y `plan.md` para entender el proyecto a fondo:

- `plan.md` — plan de desarrollo y estado por fases.
- `docs/formato_ieee830.md` — requisitos, apéndices A/B/C y matriz de trazabilidad.
- `docs/diseno-tecnico.md` y `docs/modelos-uml.drawio` — arquitectura, UML y ER.
- `docs/diseno/nueva-interfaz.md` — dirección visual, tokens, shell, componentes, motion y verificación.
- `docs/mockups.md` y `docs/img/` — capturas por rol (ES/EN, móvil).
- `docs/modelo-datos.md` — diccionario de datos y correspondencia con UML.
- `docs/plan-pruebas.md` — estrategia, matriz RF↔prueba y cobertura.
- `docs/despliegue.md` — guía Podman y operación.
- `docs/manual-tecnico.{es,en}.md` y `docs/manual-usuario.{es,en}.md` — manuales ES/EN.
- `.agents/skills/architecture.md` — arquitectura completa, estructura, seguridad y despliegue.
- `.agents/skills/contexto.md` — reglas de documentación y comportamiento del agente.
- `.agents/skills/diseno-sgp/SKILL.md` — reglas operativas de diseño para el frontend.
- `.agents/notes/memory.md` — memoria de sesiones, decisiones y estado actual.
- `README.md` — documentación completa: endpoints, despliegue y reglas de negocio.
