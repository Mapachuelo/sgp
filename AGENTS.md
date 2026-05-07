# Guía de Desarrollo Frontend - SGP

## Stack Tecnológico
- **CSS**: Puro, sin frameworks. Archivos separados por feature.
- **JavaScript**: Vanilla JS (no TypeScript).
- **Backend**: Node.js con Express.
- **Base de datos**: PostgreSQL.
- **Contenedores**: Podman (podman-compose).

## Estructura de Archivos

```
src/features/
├── ui/
│   ├── ui.routes.js        # Rutas del frontend
│   ├── ui.view.js          # Vistas HTML (template strings)
│   ├── scripts/            # Scripts por vista
│   │   ├── main-dashboard.js
│   │   ├── client-dashboard.js
│   │   ├── client-calendar.js
│   │   └── ...
│   └── styles/             # CSS por vista
│       ├── client-dashboard.css
│       ├── client-calendar.css
│       └── ...
├── auth/
│   └── auth.service.js     # Lógica de autenticación
└── ...
```

## Convenciones de Desarrollo

### CSS
- **Archivos separados**: Cada vista tiene su propio archivo CSS.
- **Variables CSS**: Usar variables para colores, sombras, radios y transiciones.
- **Nomenclatura**: BEM simplificado (`.block__element--modifier`).
- **Responsive**: Mobile-first con `@media (min-width: ...)`.
- **No duplicar**: Si un estilo es compartido, usar imports o definir en un solo lugar.

### JavaScript
- **IIFE**: Envolver scripts en funciones autoejecutables `(function () { ... })();`.
- **TOKEN_KEY**: Usar `sgp_token` como única clave de sesión.
- **byId()**: Helper para `document.getElementById()`.
- **callApi()**: Función centralizada para peticiones HTTP.

### Vistas (ui.view.js)
- **Template strings**: Usar backticks para HTML.
- **Funciones por vista**: `clientCalendarView()`, `adminCalendarView()`, etc.
- **clientDocument()**: Helper para envolver vistas con estructura base.

## Flujo de Autenticación

### Login Automático de Rol
El rol se detecta automáticamente con el correo y contraseña del usuario. No hay selector de rol en el frontend.

```javascript
// Frontend: main-dashboard.js
async function login() {
  const email = byId("loginEmail").value;
  const password = byId("loginPassword").value;
  
  const payload = await callApi("/api/auth/login", "POST", {
    email: email,
    password: password
  });
  
  // El backend devuelve user.role automáticamente
  window.location.href = getHomeByRole(user.role);
}
```

### Token de Sesión
- **Clave**: `sgp_token` (único para todos los roles).
- **Almacenamiento**: `localStorage`.
- **Envío**: Header `Authorization: Bearer <token>`.

## Calendario de Reservas

### Layout
- **Selector de peluquero**: Arriba, compacto.
- **Disponibilidad por hora**: Debajo del selector.
- **Layout vertical**: En todos los tamaños de pantalla.

### Modal de Reserva
- **Servicio**: Selector obligatorio.
- **Peluquero**: NO está en el modal (se selecciona arriba).
- **Cantidad de personas**: Input numérico (1-5).

### Estilos Clave
```css
/* Selector compacto */
.employee-selector-section {
  padding: 0.85rem 1rem;
  gap: 0.5rem;
}

.employee-selector-section select {
  padding: 0.55rem 0.7rem;
  font-size: 0.88rem;
}

/* Layout vertical */
.calendar-layout {
  grid-template-columns: 1fr;
}
```

## Comandos de Desarrollo

### Iniciar con Podman
```bash
podman-compose up --build -d
```

### Ver logs
```bash
podman-compose logs -f app
```

### Detener
```bash
podman-compose stop
```

### Rebuild
```bash
podman-compose down
podman-compose up --build -d
```

## Endpoints Principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (email + password) |
| POST | `/api/auth/register_client` | Registro de cliente |
| GET | `/api/employees` | Lista de peluqueros |
| GET | `/api/services` | Lista de servicios |
| GET | `/api/slots` | Cupos disponibles |
| POST | `/api/reservations` | Crear reserva |

## Debugging

### Health Check
```bash
curl http://localhost:3000/health
```

### Verificar Rutas
```bash
curl -o /dev/null -w "%{http_code}" http://localhost:3000/ui/login
```

## Problemas Comunes

### Token no válido
- Verificar que el script usa `sgp_token`.
- Limpiar localStorage: `localStorage.clear()`.

### CSS no aplica
- Verificar nombre del archivo en `clientDocument()`.
- Revisar que no haya conflictos de selectores.

### Modal no cierra
- Verificar que los botones tienen los IDs correctos.
- Revisar que `closeBookingModal()` se llama correctamente.
