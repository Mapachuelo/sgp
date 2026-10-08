# Guía de despliegue — SGP

Despliegue del SGP con Podman (`kube play`), dos pods sobre una red privada y volumen persistente.

## 1. Requisitos

- Podman ≥ 4 (probado con Podman en Fedora).
- `python3` para las pruebas E2E y validaciones.
- Archivos `.yaml` reales de los pods (gitignored) creados desde los ejemplos.

## 2. Archivos y variables

| Archivo | Propósito |
|---------|-----------|
| `Containerfile` | Imagen backend (Node 22 Alpine + pnpm). |
| `Containerfile.nginx` | Imagen frontend (build Vite + Nginx Alpine). |
| `sgp-db-pod.yaml` | Pod PostgreSQL 17 + PVC `sgp-pgdata`. |
| `sgp-app-pod.yaml` | Pod backend + Nginx (hostPort 8080). |
| `example.sgp-db-pod.yaml` / `example.sgp-app-pod.yaml` | Plantillas seguras (placeholders). |
| `.env.example` | Variables para desarrollo local. |

Variables del pod de la app: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN=30m`, `AES_SECRET` (opcional; si falta usa `JWT_SECRET`), `PORT=3000`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`.

```bash
cp example.sgp-db-pod.yaml sgp-db-pod.yaml
cp example.sgp-app-pod.yaml sgp-app-pod.yaml
# editar credenciales de BD, JWT/AES y Brevo en los archivos reales
```

## 3. Construcción de imágenes

```bash
podman build -t localhost/sgp-backend:latest -f Containerfile .
podman build -t localhost/sgp-frontend:latest -f Containerfile.nginx .
```

## 4. Levantar el entorno

```bash
podman network create sgp-net          # solo la primera vez
# 1) Base de datos PRIMERO (el backend falla si sgp-db no resuelve)
podman kube play sgp-db-pod.yaml --network sgp-net
# esperar readiness
podman exec sgp-db-db pg_isready -U sgp_user -d sgp
# 2) Aplicación
podman kube play sgp-app-pod.yaml --network sgp-net
```

Acceso: `http://localhost:8080` · Healthcheck: `http://localhost:8080/api/healthcheck` · Swagger: `http://localhost:8080/api/docs`.

## 5. Actualizar tras cambios de código

```bash
podman build -t localhost/sgp-backend:latest -f Containerfile .
podman build -t localhost/sgp-frontend:latest -f Containerfile.nginx .
podman kube down sgp-app-pod.yaml
podman kube play sgp-app-pod.yaml --network sgp-net
# o en un paso:
podman kube play sgp-app-pod.yaml --network sgp-net --replace
```

## 6. Datos de demostración

```bash
# dentro del contenedor del backend (la BD no está expuesta al host)
podman exec -w /app/backend sgp-app-backend node src/utils/semillar-demo.js --reset
# opciones: --append, --sin-export, --sin-api, --reservas=2000, --empleados=20...
```

Genera 6 sedes, 15 empleados, 80 clientes y ~1270 reservas/cobros, con rotación multi-sede y validaciones. Exportes en `/app/backend/exports` (copiar con `podman cp sgp-app-backend:/app/backend/exports ./exports`).

Usuarios semilla: `admin@sgp.local` / `admin123`, `empleado@sgp.local` / `empleado123` y el cliente de pruebas `cliente@sgp.local` / `cliente123`. Cuentas demo: `clienteXX@demo.sgp` y `estilistaXX@demo.sgp` con contraseña `demo1234`.

El registro de clientes usa verificación por OTP con una ventana de 5 minutos configurable (`REGISTRO_TTL_MINUTOS` en el pod); al expirar, el registro sin verificar se elimina y el correo queda libre.

## 7. Pruebas

```bash
bash tests/api.sh          # integración API (28)
bash tests/datos.sh        # integridad del dataset (6)
bash tests/esquema.sh      # esquema vs modelo de datos (32)
pnpm run test:unit         # unitarias en el contenedor backend (36)
pnpm run test:coverage     # reporte de cobertura
python3 tests/e2e.py       # extremo a extremo (29)
```

## 8. Detener y limpiar

```bash
podman kube down sgp-app-pod.yaml
podman kube down sgp-db-pod.yaml
podman volume rm sgp-pgdata   # elimina también los datos
```

## 9. Problemas conocidos

| Síntoma | Causa / solución |
|---------|------------------|
| Backend en crash-loop con `getaddrinfo ENOTFOUND sgp-db` | La BD no estaba lista; levantar `sgp-db` primero. |
| `429 Too Many Requests` en auth | Rate limit (10/15 min). Reiniciar el pod de la app. |
| OTP no llega (502) | Credenciales Brevo inválidas; rotar `BREVO_API_KEY` y verificar remitente. El healthcheck informa `"brevo":"error"` si la clave es inválida o es una SMTP key (`xsmtpsib-…`): el backend usa la API v3, así que debe ser una API key (`xkeysib-…`). |
| Puerto 8080 ocupado | Cambiar `hostPort` en `sgp-app-pod.yaml`. |
| Cámara no abre | `getUserMedia` requiere `localhost` o HTTPS; revisar permisos del navegador. |
| Cambios de esquema no aplican | `database-init.js` ejecuta `init.sql` (idempotente) al arrancar el backend. |

## 10. Producción (notas)

- Servir todo por HTTPS mediante un proxy externo (Nginx/Let's Encrypt) para habilitar cámara y proteger credenciales.
- Rotar `JWT_SECRET`, `AES_SECRET` y la API key de Brevo; no reutilizar los valores del repositorio.
- Considerar respaldos del volumen `sgp-pgdata` (`podman volume export`).
