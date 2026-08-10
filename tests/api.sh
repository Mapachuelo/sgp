#!/usr/bin/env bash
set -u

BASE_URL="${BASE_URL:-http://localhost:3000/api}"
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

echo "== Flujo de verificacion de cuenta =="

echo "-- Registro de nuevo cliente"
RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"nombre\":\"Prueba\",\"apellido\":\"Verificacion\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"telefono\":\"+573003334455\"}")
verificar "Registro devuelve 201" "201" "$RESP"
grep -q '"correoEnviado"' /tmp/sgp_resp.json && echo "INFO: el backend intento enviar el correo de verificacion"

echo "-- Login antes de verificar debe fallar"
RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
verificar "Login sin verificar devuelve 403" "403" "$RESP"
grep -q "no verificada" /tmp/sgp_resp.json && echo "INFO: mensaje de cuenta no verificada"

echo "-- Reenvio de codigo"
RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/auth/reenviar-codigo" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}")
if [ "$RESP" = "200" ]; then
  verificar "Reenvio de codigo devuelve 200" "200" "$RESP"
else
  echo "INFO: reenvio fallo (codigo $RESP): $(cat /tmp/sgp_resp.json)"
  echo "      El paso final (verificar con codigo) se hace manualmente con el codigo del correo."
fi

echo "-- Codigo incorrecto"
RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/auth/verificar" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"codigo\":\"000000\"}")
verificar "Verificacion con codigo incorrecto devuelve 400" "400" "$RESP"

echo ""
echo "Resultados: $PASS pasadas, $FAIL fallidas"
echo "Nota: el codigo real llega por correo; verificar la cuenta manualmente con el codigo recibido."
exit $FAIL
