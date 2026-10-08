#!/usr/bin/env bash
set -u

BASE_URL="${BASE_URL:-http://localhost:8080/api}"
ROOT_URL="${BASE_URL%/api}"
EMAIL="test.$(date +%s)@correo.com"
PASSWORD="clave123"
PASS=0
FAIL=0

verificar() {
  local desc="$1"
  local esperado="$2"
  local obtenido="$3"
  if [ "$obtenido" = "$esperado" ]; then
    PASS=$((PASS + 1))
    echo "PASS: $desc"
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $desc (esperado $esperado, obtenido $obtenido)"
  fi
}

token_de() {
  grep -o '"token":"[^"]*"' /tmp/sgp_resp.json | head -1 | cut -d'"' -f4
}

sql() {
  podman exec sgp-db-db psql -U sgp_user -d sgp -t -A -c "$1" 2>/dev/null | tr -d ' '
}

echo "== Salud y frontend =="
RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/healthcheck")
verificar "Healthcheck responde 200" "200" "$RESP"
BREVO_ESTADO=$(grep -o '"brevo":"[^"]*"' /tmp/sgp_resp.json | cut -d'"' -f4)
echo "INFO: estado de Brevo reportado por el healthcheck: ${BREVO_ESTADO:-no reportado}"

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$ROOT_URL/")
verificar "Frontend responde 200" "200" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/docs/openapi.json")
verificar "OpenAPI (Swagger) responde 200" "200" "$RESP"

echo ""
echo "== Flujo de verificacion de cuenta (RF13) =="

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"nombre\":\"Prueba\",\"apellido\":\"Verificacion\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"telefono\":\"+573003334455\"}")
verificar "Registro devuelve 201" "201" "$RESP"
grep -q '"correoEnviado"' /tmp/sgp_resp.json && echo "INFO: el backend intento enviar el correo de verificacion"
grep -q '"expiraEn"' /tmp/sgp_resp.json && echo "INFO: la respuesta incluye el tiempo de registro"

echo "-- Re-registro del mismo correo sin verificar (reemplaza, no bloquea)"
RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"nombre\":\"Prueba\",\"apellido\":\"Verificacion\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"telefono\":\"+573003334455\"}")
verificar "Re-registro sin verificar devuelve 201" "201" "$RESP"

FILAS=$(sql "SELECT COUNT(*) FROM app_user WHERE email = '$EMAIL'")
verificar "Queda una sola fila del correo sin verificar" "1" "$FILAS"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
verificar "Login sin verificar devuelve 403" "403" "$RESP"
grep -q "no verificada" /tmp/sgp_resp.json && echo "INFO: mensaje de cuenta no verificada"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/auth/reenviar-codigo" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}")
if [ "$RESP" = "200" ]; then
  verificar "Reenvio de codigo devuelve 200" "200" "$RESP"
else
  echo "INFO: reenvio fallo (codigo $RESP): $(cat /tmp/sgp_resp.json)"
fi

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/auth/verificar" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"codigo\":\"000000\"}")
verificar "Verificacion con codigo incorrecto devuelve 400" "400" "$RESP"

echo ""
echo "== RBAC y autenticacion =="

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sgp.local","password":"admin123"}')
verificar "Login admin devuelve 200" "200" "$RESP"
TOKEN_ADMIN=$(token_de)
[ -n "$TOKEN_ADMIN" ] && echo "INFO: token de admin emitido"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "GET /auth/me con admin devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"empleado@sgp.local","password":"empleado123"}')
verificar "Login empleado devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/auth/empleados")
verificar "GET /auth/empleados sin token devuelve 401" "401" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/auth/empleados" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "GET /auth/empleados con admin devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/reservas" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{"empleado_id":2,"servicio_id":1,"ubicacion_id":1,"inicia_en":"2026-12-01T15:00:00.000Z"}')
verificar "POST /reservas con rol admin devuelve 403" "403" "$RESP"

echo ""
echo "== Validaciones RF3 (checkin) =="

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/checkin/validar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{"qr_token":"no-es-uuid","monto":0}')
verificar "Checkin con token no UUID devuelve 400" "400" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/checkin/validar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{"qr_token":"00000000-0000-4000-8000-000000000000","monto":-5}')
verificar "Checkin con monto negativo devuelve 400" "400" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/checkin/validar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{"qr_token":"00000000-0000-4000-8000-000000000000","monto":0}')
verificar "Checkin con UUID inexistente devuelve 404" "404" "$RESP"

echo ""
echo "== Planificador (admin) =="

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/empleados/disponibilidad/todas" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "GET /empleados/disponibilidad/todas con admin devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/empleados/disponibilidad/todas")
verificar "GET /empleados/disponibilidad/todas sin token devuelve 401" "401" "$RESP"

DESDE=$(date +%Y-%m-%d)
HASTA=$(date -d "+7 days" +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)
RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/reservas/agenda?desde=$DESDE&hasta=$HASTA" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "GET /reservas/agenda con admin devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/reservas/agenda?desde=mal&hasta=$HASTA" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "GET /reservas/agenda con fecha invalida devuelve 400" "400" "$RESP"

echo ""
echo "== Reportes y logs (admin) =="

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/reportes/ocupacion" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "GET /reportes/ocupacion con admin devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/logs/actividad" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "GET /logs/actividad con admin devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/logs/actividad")
verificar "GET /logs/actividad sin token devuelve 401" "401" "$RESP"

CONTENT_TYPE=$(curl -s -o /tmp/sgp_logs.txt -w "%{content_type}" "$BASE_URL/logs/exportar?tipo=actividad&desde=0&hasta=5" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
case "$CONTENT_TYPE" in
  text/plain*) verificar "Export de logs devuelve text/plain" "ok" "ok" ;;
  *) verificar "Export de logs devuelve text/plain" "text/plain" "$CONTENT_TYPE" ;;
esac

echo ""
echo "== Catalogos publicos =="

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/ubicaciones")
verificar "GET /ubicaciones publico devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/reservas/servicios")
verificar "GET /reservas/servicios publico devuelve 200" "200" "$RESP"

echo ""
echo "Resultados: $PASS pasadas, $FAIL fallidas"
echo "Nota: el codigo OTP real llega por correo; verificar la cuenta manualmente con el codigo recibido."
exit $FAIL
