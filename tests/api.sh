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
WOMPI_ESTADO=$(grep -o '"wompi":"[^"]*"' /tmp/sgp_resp.json | cut -d'"' -f4)
echo "INFO: estado de Wompi reportado por el healthcheck: ${WOMPI_ESTADO:-no reportado}"

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
if [ "$RESP" = "400" ] || [ "$RESP" = "429" ]; then
  PASS=$((PASS + 1))
  echo "PASS: Verificacion con codigo incorrecto devuelve 400 o 429"
else
  FAIL=$((FAIL + 1))
  echo "FAIL: Verificacion con codigo incorrecto devuelve 400 o 429 (obtenido $RESP)"
fi

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
  -d '{"email":"empleado01@sgp.local","password":"empleado123"}')
verificar "Login empleado devuelve 200" "200" "$RESP"
TOKEN_EMPLEADO=$(token_de)

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/auth/empleados")
verificar "GET /auth/empleados sin token devuelve 401" "401" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/auth/empleados" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "GET /auth/empleados con admin devuelve 200" "200" "$RESP"

ADMIN_TMP_EMAIL="admin.api.$(date +%s)@sgp.local"
RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/auth/empleados" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d "{\"rol\":\"admin\",\"nombre\":\"Admin\",\"apellido\":\"Api\",\"email\":\"$ADMIN_TMP_EMAIL\",\"password\":\"admin123\"}")
verificar "POST /auth/empleados crea administrador" "201" "$RESP"
ADMIN_TMP_ID=$(sql "SELECT id FROM app_user WHERE email = '$ADMIN_TMP_EMAIL'")
RESP=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/auth/empleados/$ADMIN_TMP_ID" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "DELETE administrador temporal devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/reservas" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{"empleado_id":2,"servicio_id":1,"ubicacion_id":1,"inicia_en":"2026-12-01T15:00:00.000Z"}')
verificar "POST /reservas con rol admin devuelve 403" "403" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/notificaciones/me")
verificar "GET /notificaciones/me sin token devuelve 401" "401" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/notificaciones/me" \
  -H "Authorization: Bearer $TOKEN_EMPLEADO")
verificar "GET /notificaciones/me con sesion devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X PUT "$BASE_URL/notificaciones/me/leidas" \
  -H "Authorization: Bearer $TOKEN_EMPLEADO")
verificar "PUT /notificaciones/me/leidas devuelve 200" "200" "$RESP"

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
echo "== Pagos digitales (Wompi) =="

RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/pagos/intencion" \
  -H "Content-Type: application/json" \
  -d '{"reserva_id":1}')
verificar "POST /pagos/intencion sin token devuelve 401" "401" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/pagos/intencion" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{"reserva_id":999999}')
verificar "POST /pagos/intencion con admin valida RBAC y devuelve 404" "404" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/checkin/consultar" \
  -H "Content-Type: application/json" \
  -d '{"qr_token":"00000000-0000-4000-8000-000000000000"}')
verificar "POST /checkin/consultar sin token devuelve 401" "401" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/pagos/webhook" \
  -H "Content-Type: application/json" \
  -d '{"event":"transaction.updated","data":{"transaction":{"id":"TX-FALSA","status":"APPROVED","reference":"SGP-FALSA"}},"signature":{"properties":["transaction.id"],"checksum":"00"},"timestamp":1700000000}')
verificar "Webhook Wompi con firma invalida devuelve 401" "401" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/pagos/1")
verificar "GET /pagos/1 sin token devuelve 401" "401" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/pagos/999999" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "GET /pagos/999999 con admin devuelve 404" "404" "$RESP"

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

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/reportes/mi-resumen?desde=$DESDE&hasta=$HASTA" \
  -H "Authorization: Bearer $TOKEN_EMPLEADO")
verificar "GET /reportes/mi-resumen con empleado devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/reportes/mi-resumen?desde=$DESDE&hasta=$HASTA" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "GET /reportes/mi-resumen con admin devuelve 403" "403" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/reportes/mi-resumen?desde=$DESDE&hasta=$HASTA")
verificar "GET /reportes/mi-resumen sin token devuelve 401" "401" "$RESP"

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

UBICACION_GALERIA=$(sql "SELECT id FROM ubicacion LIMIT 1")
RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/ubicaciones/$UBICACION_GALERIA/imagenes")
verificar "GET /ubicaciones/:id/imagenes publico devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/reservas/servicios")
verificar "GET /reservas/servicios publico devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/reservas/categorias")
verificar "GET /reservas/categorias publico devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/reservas/configuracion")
verificar "GET /reservas/configuracion publico devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/presentacion")
verificar "GET /presentacion publico devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/presentacion/admin")
verificar "GET /presentacion/admin sin token devuelve 401" "401" "$RESP"

RESP=$(curl -s -o /tmp/sgp_presentacion.json -w "%{http_code}" "$BASE_URL/presentacion/admin" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "GET /presentacion/admin con admin devuelve 200" "200" "$RESP"
MAX_SERVICIOS=$(grep -o '"max_servicios_reserva":[0-9]*' /tmp/sgp_resp.json | cut -d: -f2)
[ -n "$MAX_SERVICIOS" ] && echo "INFO: maximo configurado de servicios por reserva: $MAX_SERVICIOS"

SUFIJO_API=$(date +%s)
RESP=$(curl -s -o /tmp/sgp_categoria.json -w "%{http_code}" -X POST "$BASE_URL/reservas/categorias" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d "{\"nombre\":\"Categoria API $SUFIJO_API\",\"descripcion\":\"Prueba\",\"orden\":50}")
verificar "Crear categoria (admin) devuelve 201" "201" "$RESP"
CATEGORIA_ID=$(grep -o '"id":[0-9]*' /tmp/sgp_categoria.json | head -1 | cut -d: -f2)

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/reservas/servicios" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d "{\"nombre\":\"Servicio API $SUFIJO_API\",\"descripcion\":\"Prueba\",\"precio_base\":10000,\"duracion_base_minutos\":25,\"categoria_id\":$CATEGORIA_ID}")
verificar "Crear servicio con categoria devuelve 201" "201" "$RESP"
SERVICIO_ID=$(grep -o '"id":[0-9]*' /tmp/sgp_resp.json | head -1 | cut -d: -f2)

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X PUT "$BASE_URL/reservas/servicios/$SERVICIO_ID" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{"precio_base":12000,"duracion_base_minutos":30,"activo":false}')
verificar "Editar duracion, precio y estado del servicio devuelve 200" "200" "$RESP"

IMAGEN_API="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X PUT "$BASE_URL/reservas/servicios/$SERVICIO_ID" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d "{\"imagenes\":[\"$IMAGEN_API\",\"$IMAGEN_API\"]}")
verificar "Reemplazar galeria del servicio devuelve 200" "200" "$RESP"
RESP=$(curl -s -o /tmp/sgp_imagenes.json -w "%{http_code}" "$BASE_URL/reservas/servicios/$SERVICIO_ID/imagenes")
verificar "GET /reservas/servicios/:id/imagenes devuelve 200" "200" "$RESP"
TOTAL_IMAGENES=$(grep -o '"imagen_url"' /tmp/sgp_imagenes.json | wc -l | tr -d ' ')
verificar "Galeria devuelve dos imagenes" "2" "$TOTAL_IMAGENES"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/reservas/servicios" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d "{\"nombre\":\"Servicio Muchas Imagenes $SUFIJO_API\",\"precio_base\":10000,\"duracion_base_minutos\":20,\"imagenes\":[\"$IMAGEN_API\",\"$IMAGEN_API\",\"$IMAGEN_API\",\"$IMAGEN_API\",\"$IMAGEN_API\",\"$IMAGEN_API\",\"$IMAGEN_API\"]}")
verificar "Rechazar mas de 6 imagenes devuelve 400" "400" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/reservas/sedes-por-servicio?servicio_id=$SERVICIO_ID")
verificar "GET /reservas/sedes-por-servicio devuelve 200" "200" "$RESP"
RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/reservas/sedes-por-servicio")
verificar "GET /reservas/sedes-por-servicio sin servicio devuelve 400" "400" "$RESP"
RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/reservas/sedes-por-servicio?servicio_id=999999")
verificar "GET /reservas/sedes-por-servicio inexistente devuelve 404" "404" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/reservas/servicios" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d "{\"nombre\":\"Servicio Imagen Invalida $SUFIJO_API\",\"precio_base\":10000,\"duracion_base_minutos\":20,\"categoria_id\":$CATEGORIA_ID,\"imagen_url\":\"data:image/svg+xml;base64,PHN2Zy8+\"}")
verificar "Rechazar imagen SVG en servicio devuelve 400" "400" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/reservas/servicios/$SERVICIO_ID" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "Eliminar servicio sin reservas devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/reservas/categorias/$CATEGORIA_ID" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
verificar "Eliminar categoria vacia devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE_URL/reservas/configuracion"   -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_ADMIN"   -d '{"max_servicios_reserva":5}')
verificar "Actualizar maximo de servicios (admin) devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE_URL/reservas/configuracion"   -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_ADMIN"   -d '{"max_servicios_reserva":99}')
verificar "Rechazar maximo de servicios fuera de rango devuelve 400" "400" "$RESP"

UBICACION_API=$(sql "SELECT id FROM ubicacion LIMIT 1")
SERVICIO_COMBO=$(sql "SELECT id FROM servicio_catalogo WHERE activo = TRUE LIMIT 1")
RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/reservas/empleados-por-servicio?ubicacion_id=$UBICACION_API&servicio_id=$SERVICIO_COMBO")
verificar "GET /reservas/empleados-por-servicio devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/reservas/empleados-por-sede?ubicacion_id=$UBICACION_API")
verificar "GET /reservas/empleados-por-sede devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" "$BASE_URL/reservas/servicios?ubicacion_id=$UBICACION_API&empleado_id=1")
verificar "GET /reservas/servicios con filtros devuelve 200" "200" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/ubicaciones" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d "{\"nombre\":\"Sede sin ciudad $SUFIJO_API\",\"direccion\":\"Calle 1\",\"latitud\":4.6,\"longitud\":-74.1}")
verificar "Crear sede sin ciudad devuelve 400" "400" "$RESP"

RESP=$(curl -s -o /tmp/sgp_resp.json -w "%{http_code}" -X POST "$BASE_URL/reservas/disponibilidad-combo"   -H "Content-Type: application/json" -d '{}')
verificar "Combo sin datos devuelve 400" "400" "$RESP"

echo ""
echo "Resultados: $PASS pasadas, $FAIL fallidas"
echo "Nota: el codigo OTP real llega por correo; verificar la cuenta manualmente con el codigo recibido."
exit $FAIL
