#!/usr/bin/env bash
set -u

PASS=0
FAIL=0
CONTENEDOR_DB="${CONTENEDOR_DB:-sgp-db-db}"

validar() {
  local descripcion="$1"
  local consulta="$2"
  local resultado
  resultado=$(podman exec "$CONTENEDOR_DB" psql -U sgp_user -d sgp -t -A -c "$consulta" 2>/dev/null | tr -d ' ')
  if [ "$resultado" = "0" ]; then
    PASS=$((PASS + 1))
    echo "PASS: $descripcion"
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $descripcion (resultado: $resultado)"
  fi
}

echo "== Validaciones del dataset demo =="

validar "Empleado disponible en 2 sedes el mismo dia" \
  "SELECT COUNT(*) FROM (SELECT empleado_id, dia_semana FROM empleado_disponibilidad GROUP BY empleado_id, dia_semana HAVING COUNT(DISTINCT ubicacion_id) > 1) t"

validar "Reservas solapadas por empleado" \
  "SELECT COUNT(*) FROM reserva a JOIN reserva b ON a.empleado_id = b.empleado_id AND a.id < b.id WHERE a.estado <> 'cancelada' AND b.estado <> 'cancelada' AND a.inicia_en < b.termina_en AND b.inicia_en < a.termina_en"

validar "Clientes con mas de 5 reservas activas" \
  "SELECT COUNT(*) FROM (SELECT cliente_id FROM reserva WHERE estado IN ('pendiente','confirmada','en_curso') GROUP BY cliente_id HAVING COUNT(*) > 5) t"

validar "Cobros duplicados por reserva" \
  "SELECT COUNT(*) FROM (SELECT reserva_id FROM cobro GROUP BY reserva_id HAVING COUNT(*) > 1) t"

validar "Reservas cobradas sin registro de cobro" \
  "SELECT COUNT(*) FROM reserva r LEFT JOIN cobro c ON c.reserva_id = r.id WHERE r.estado = 'cobrado' AND c.id IS NULL"

validar "Citas fuera de la disponibilidad del empleado" \
  "SELECT COUNT(*) FROM reserva r JOIN app_user u ON u.id = r.empleado_id WHERE u.email LIKE '%@demo.sgp' AND r.estado IN ('pendiente','confirmada') AND NOT EXISTS (SELECT 1 FROM empleado_disponibilidad ed WHERE ed.empleado_id = r.empleado_id AND ed.ubicacion_id = r.ubicacion_id AND ed.dia_semana = EXTRACT(ISODOW FROM (r.inicia_en AT TIME ZONE 'America/Bogota'))::int AND (r.inicia_en AT TIME ZONE 'America/Bogota')::time >= ed.hora_inicio AND (r.termina_en AT TIME ZONE 'America/Bogota')::time <= ed.hora_fin)"

echo ""
echo "Datos actuales:"
podman exec "$CONTENEDOR_DB" psql -U sgp_user -d sgp -c \
  "SELECT (SELECT COUNT(*) FROM app_user WHERE email LIKE '%@demo.sgp') AS usuarios_demo,
          (SELECT COUNT(*) FROM ubicacion WHERE nombre LIKE 'Demo %') AS sedes_demo,
          (SELECT COUNT(*) FROM servicio_catalogo WHERE nombre LIKE 'Demo %') AS servicios_demo,
          (SELECT COUNT(*) FROM empleado_disponibilidad) AS bloques_disponibilidad,
          (SELECT COUNT(*) FROM reserva) AS reservas,
          (SELECT COUNT(*) FROM cobro) AS cobros;"

echo ""
echo "Resultados: $PASS pasadas, $FAIL fallidas"
exit "$FAIL"
