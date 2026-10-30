#!/usr/bin/env bash
set -u
BASE_URL="${BASE_URL:-http://localhost:8080/api}"
DB="${DB_CONTENEDOR:-sgp-db-db}"
PASS=0
FAIL=0

validar() {
  local descripcion="$1" consulta="$2" esperado="${3:-1}"
  local resultado
  resultado=$(podman exec "$DB" psql -U sgp_user -d sgp_presentacion -t -A -c "$consulta" 2>/dev/null | tr -d ' ')
  if [ "$resultado" = "$esperado" ]; then
    PASS=$((PASS + 1)); echo "PASS: $descripcion"
  else
    FAIL=$((FAIL + 1)); echo "FAIL: $descripcion (esperado $esperado, obtenido $resultado)"
  fi
}

validar "Tabla presentacion_config existe" "SELECT to_regclass('public.presentacion_config') IS NOT NULL" "t"
validar "Tabla presentacion_media existe" "SELECT to_regclass('public.presentacion_media') IS NOT NULL" "t"
validar "Tabla presentacion_fuente existe" "SELECT to_regclass('public.presentacion_fuente') IS NOT NULL" "t"
validar "Configuracion singleton existe" "SELECT COUNT(*) FROM presentacion_config WHERE id = 1" "1"

status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/presentacion")
if [ "$status" = "200" ]; then PASS=$((PASS + 1)); echo "PASS: GET /presentacion publico"; else FAIL=$((FAIL + 1)); echo "FAIL: GET /presentacion publico ($status)"; fi
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/presentacion/admin")
if [ "$status" = "401" ]; then PASS=$((PASS + 1)); echo "PASS: GET /presentacion/admin sin token"; else FAIL=$((FAIL + 1)); echo "FAIL: GET /presentacion/admin sin token ($status)"; fi

echo ""
echo "Resultados: $PASS pasadas, $FAIL fallidas"
exit "$FAIL"
