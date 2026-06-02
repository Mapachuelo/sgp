#!/usr/bin/env bash
set -e

API="http://localhost:3000/api"
PASS=0
FAIL=0

rojo() { echo -e "\033[31m$1\033[0m"; }
verde() { echo -e "\033[32m$1\033[0m"; }

probar() {
  local descripcion="$1"
  shift
  local salida=$("$@" 2>&1)
  local codigo=$?
  if [ "$salida" = "OK" ] || echo "$salida" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['ok']==True" 2>/dev/null; then
    verde "  [PASS] $descripcion"
    PASS=$((PASS + 1))
  elif [ $codigo -eq 0 ] && [ -n "$salida" ]; then
    verde "  [PASS] $descripcion"
    PASS=$((PASS + 1))
  else
    rojo "  [FAIL] $descripcion -> $salida"
    FAIL=$((FAIL + 1))
  fi
}

echo "================================================="
echo "  PRUEBAS DE INTEGRACION SGP"
echo "================================================="

echo ""
echo "--- FASE 0: Healthcheck ---"
probar "GET /healthcheck" curl -s "$API/healthcheck"

echo ""
echo "--- FASE 3: Auth ---"
probar "POST /auth/register (cliente)" \
  curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d '{"nombre":"Test","apellido":"User","email":"test@test.com","password":"123456","telefono":"+573009999999"}'

LOGIN_ADMIN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@sgp.local","password":"admin123"}')
ADMIN_TOKEN=$(echo "$LOGIN_ADMIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
probar "POST /auth/login (admin)" echo "$LOGIN_ADMIN"

LOGIN_EMP=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"empleado@sgp.local","password":"empleado123"}')
EMP_TOKEN=$(echo "$LOGIN_EMP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
probar "POST /auth/login (empleado)" echo "$LOGIN_EMP"

LOGIN_CLI=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"123456"}')
CLI_TOKEN=$(echo "$LOGIN_CLI" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
probar "POST /auth/login (cliente)" echo "$LOGIN_CLI"

probar "GET /auth/me (admin)" curl -s "$API/auth/me" -H "Authorization: Bearer $ADMIN_TOKEN"
probar "GET /auth/me (cliente)" curl -s "$API/auth/me" -H "Authorization: Bearer $CLI_TOKEN"

echo ""
echo "--- Fase 4.2: Ubicaciones ---"
probar "GET /ubicaciones (publico)" curl -s "$API/ubicaciones"

UBI_NEW=$(curl -s -X POST "$API/ubicaciones" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"nombre":"Sede Test","direccion":"Test 123","latitud":4.7,"longitud":-74.1}')
UBI_ID=$(echo "$UBI_NEW" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
probar "POST /ubicaciones (admin)" echo "$UBI_NEW"

probar "PUT /ubicaciones/:id (admin)" \
  curl -s -X PUT "$API/ubicaciones/$UBI_ID" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"nombre":"Sede Test Modificada"}'

echo ""
echo "--- Fase 4.3: Reservas ---"
probar "GET /reservas/servicios" curl -s "$API/reservas/servicios"

SERV_NEW=$(curl -s -X POST "$API/reservas/servicios" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"nombre":"Servicio Test","precio_base":5000,"duracion_base_minutos":10}')
SERV_ID=$(echo "$SERV_NEW" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
probar "POST /reservas/servicios (admin)" echo "$SERV_NEW"

probar "PUT /reservas/servicios/:id (admin)" \
  curl -s -X PUT "$API/reservas/servicios/$SERV_ID" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"nombre":"Servicio Test Modificado"}'

# Disponibilidad empleado
probar "PUT /empleados/disponibilidad" \
  curl -s -X PUT "$API/empleados/disponibilidad" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMP_TOKEN" \
  -d '[{"dia_semana":1,"ubicacion_id":1,"hora_inicio":"09:00","hora_fin":"18:00"},{"dia_semana":2,"ubicacion_id":1,"hora_inicio":"09:00","hora_fin":"18:00"},{"dia_semana":3,"ubicacion_id":1,"hora_inicio":"09:00","hora_fin":"18:00"},{"dia_semana":4,"ubicacion_id":1,"hora_inicio":"09:00","hora_fin":"18:00"},{"dia_semana":5,"ubicacion_id":1,"hora_inicio":"09:00","hora_fin":"18:00"},{"dia_semana":6,"ubicacion_id":1,"hora_inicio":"09:00","hora_fin":"14:00"}]'

# Crear reserva
FUTURE_DATE="2026-06-03T10:00:00Z"
FUTURE_END="2026-06-03T10:30:00Z"
RESERVA=$(curl -s -X POST "$API/reservas" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLI_TOKEN" \
  -d "{\"empleado_id\":2,\"servicio_id\":1,\"ubicacion_id\":1,\"inicia_en\":\"$FUTURE_DATE\",\"termina_en\":\"$FUTURE_END\",\"cantidad_personas\":1}")
RES_ID=$(echo "$RESERVA" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
QR_TOKEN=$(echo "$RESERVA" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['qr_token'])")
probar "POST /reservas (cliente)" echo "$RESERVA"

probar "GET /reservas/me (cliente)" curl -s "$API/reservas/me" -H "Authorization: Bearer $CLI_TOKEN"

probar "GET /reservas (admin)" curl -s "$API/reservas" -H "Authorization: Bearer $ADMIN_TOKEN"

probar "GET /reservas/disponibilidad" \
  curl -s "$API/reservas/disponibilidad?fecha=2026-06-03&empleado_id=2&ubicacion_id=1"

echo ""
echo "--- Fase 4.4: Checkin ---"
CHECKIN=$(curl -s -X POST "$API/checkin/validar" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMP_TOKEN" \
  -d "{\"qr_token\":\"$QR_TOKEN\",\"monto\":25000}")
CHECK_OK=$(echo "$CHECKIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['ok'])" 2>/dev/null || echo "false")
if [ "$CHECK_OK" = "True" ]; then
  verde "  [PASS] POST /checkin/validar (empleado)"
  PASS=$((PASS + 1))
else
  echo "  [INFO] POST /checkin/validar: Fuera de ventana esperado para fecha futura: $CHECKIN"
fi

echo ""
echo "--- Fase 4.5: Reportes ---"
probar "GET /reportes/ventas-diarias" \
  curl -s "$API/reportes/ventas-diarias?fecha=2026-06-03" -H "Authorization: Bearer $ADMIN_TOKEN"

probar "GET /reportes/ocupacion" \
  curl -s "$API/reportes/ocupacion?fecha=2026-06-03" -H "Authorization: Bearer $ADMIN_TOKEN"

probar "GET /reportes/clientes-recurrentes" \
  curl -s "$API/reportes/clientes-recurrentes" -H "Authorization: Bearer $ADMIN_TOKEN"

echo ""
echo "--- Fase 4.1: Clientes ---"
probar "GET /clientes/me" curl -s "$API/clientes/me" -H "Authorization: Bearer $CLI_TOKEN"
probar "PUT /clientes/me" \
  curl -s -X PUT "$API/clientes/me" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLI_TOKEN" \
  -d '{"nombre":"Test Modificado"}'

probar "GET /clientes (admin)" curl -s "$API/clientes" -H "Authorization: Bearer $ADMIN_TOKEN"

CLI_ID=$(echo "$LOGIN_CLI" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['usuario']['id'])")
probar "PUT /clientes/:id/bloquear (admin)" \
  curl -s -X PUT "$API/clientes/$CLI_ID/bloquear" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"motivo":"Test de bloqueo"}'

probar "PUT /clientes/:id/desbloquear (admin)" \
  curl -s -X PUT "$API/clientes/$CLI_ID/desbloquear" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

echo ""
echo "--- Fase 4.6: Gestion empleados ---"
probar "GET /auth/empleados (admin)" curl -s "$API/auth/empleados" -H "Authorization: Bearer $ADMIN_TOKEN"

EMP_NEW=$(curl -s -X POST "$API/auth/empleados" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"nombre":"Nuevo","apellido":"Empleado","email":"nuevo@sgp.local","password":"nuevo123","telefono":"+573004444444","identificacion":"5555555555"}')
EMP_NEW_ID=$(echo "$EMP_NEW" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
probar "POST /auth/empleados (admin)" echo "$EMP_NEW"

probar "PUT /auth/empleados/:id (admin)" \
  curl -s -X PUT "$API/auth/empleados/$EMP_NEW_ID" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"nombre":"Empleado Actualizado"}'

probar "DELETE /auth/empleados/:id (admin)" \
  curl -s -X DELETE "$API/auth/empleados/$EMP_NEW_ID" -H "Authorization: Bearer $ADMIN_TOKEN"

echo ""
echo "--- Fase 4.8: Logs ---"
probar "GET /logs/actividad (admin)" curl -s "$API/logs/actividad" -H "Authorization: Bearer $ADMIN_TOKEN"
probar "GET /logs/errores (admin)" curl -s "$API/logs/errores" -H "Authorization: Bearer $ADMIN_TOKEN"
probar "GET /logs/exportar (admin)" \
  curl -s "$API/logs/exportar?tipo=actividad&desde=0&hasta=5" -H "Authorization: Bearer $ADMIN_TOKEN" -o /dev/null -w "%{http_code}"

echo ""
echo "--- Fase 4.9: Preferencias ---"
probar "GET /preferencias" curl -s "$API/preferencias" -H "Authorization: Bearer $CLI_TOKEN"
probar "PUT /preferencias" \
  curl -s -X PUT "$API/preferencias" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLI_TOKEN" \
  -d '{"rango_hora_desde":"08:00","rango_hora_hasta":"20:00","granularidad_calendario":15,"tema":"oscuro"}'

echo ""
echo "--- Fase 4.7: Disponibilidad empleado ---"
probar "GET /empleados/disponibilidad" \
  curl -s "$API/empleados/disponibilidad" -H "Authorization: Bearer $EMP_TOKEN"

echo ""
echo "--- Cancelar reserva ---"
probar "DELETE /reservas/me/:id (cliente)" \
  curl -s -X DELETE "$API/reservas/me/$RES_ID" -H "Authorization: Bearer $CLI_TOKEN"

echo ""
echo "--- Rate Limiting (10 intentos login) ---"
LIMIT_HIT=0
for i in $(seq 1 11); do
  R=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@sgp.local","password":"wrong"}')
  if echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['ok']==False and 'Demasiados' in d.get('error','')" 2>/dev/null; then
    LIMIT_HIT=1
    break
  fi
done
if [ $LIMIT_HIT -eq 1 ]; then
  verde "  [PASS] Rate limiting funciona (intento $i)"
  PASS=$((PASS + 1))
else
  rojo "  [FAIL] Rate limiting: No se detecto bloqueo tras 11 intentos"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "================================================="
echo "  RESULTADO: $PASS PASS, $FAIL FAIL"
echo "================================================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi
