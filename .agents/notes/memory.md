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
