#!/usr/bin/env bash
set -u

CONTENEDOR_DB="${CONTENEDOR_DB:-sgp-db-db}"
DB_USUARIO="${DB_USUARIO:-sgp_user}"
DB_NOMBRE="${DB_NOMBRE:-sgp}"
PASS=0
FAIL=0

consulta() {
  podman exec "$CONTENEDOR_DB" psql -U "$DB_USUARIO" -d "$DB_NOMBRE" -t -A -c "$1" 2>/dev/null | tr -d '[:space:]'
}

validar() {
  local descripcion="$1"
  local sql="$2"
  local resultado
  resultado=$(consulta "$sql")
  if [ "$resultado" = "t" ]; then
    PASS=$((PASS + 1))
    echo "PASS: $descripcion"
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $descripcion (resultado: ${resultado:-vacio})"
  fi
}

esperar_tabla() {
  consulta "SELECT to_regclass('public.$1') IS NOT NULL"
}

echo "== Validacion del esquema (docs/modelo-datos.md) =="

for tabla in ubicacion app_user empleado_perfil servicio_catalogo empleado_tiempo_servicio jornada empleado_disponibilidad reserva cobro pago preferencia_usuario; do
  validar "Tabla $tabla existe" "SELECT to_regclass('public.$tabla') IS NOT NULL"
done

validar "app_user.telefono es TEXT" \
  "SELECT data_type = 'text' FROM information_schema.columns WHERE table_name='app_user' AND column_name='telefono'"

validar "app_user.email es UNIQUE" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='app_user' AND indexdef LIKE '%UNIQUE%email%')"

validar "app_user.rol restringido por CHECK" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='app_user'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%rol%')"

validar "reserva.estado restringido por CHECK" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='reserva'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%estado%')"

validar "reserva.cantidad_personas entre 1 y 5" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='reserva'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%cantidad_personas%')"

validar "reserva.qr_token uuid con default" \
  "SELECT column_default LIKE 'gen_random_uuid%' FROM information_schema.columns WHERE table_name='reserva' AND column_name='qr_token'"

validar "cobro.reserva_id es UNIQUE (un cobro por reserva)" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='cobro' AND indexdef LIKE '%UNIQUE%reserva_id%')"

validar "cobro.metodo restringido por CHECK" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='cobro'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%metodo%')"

validar "pago.referencia es UNIQUE" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='pago' AND indexdef LIKE '%UNIQUE%referencia%')"

validar "pago.transaction_id es UNIQUE" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='pago' AND indexdef LIKE '%UNIQUE%transaction_id%')"

validar "pago.estado restringido por CHECK" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='pago'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%estado%')"

validar "FK pago.reserva_id -> reserva ON DELETE CASCADE" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='pago'::regclass AND contype='f' AND confrelid='reserva'::regclass AND confdeltype='c')"

validar "empleado_disponibilidad UNIQUE (empleado, ubicacion, dia)" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='empleado_disponibilidad' AND indexdef LIKE '%UNIQUE%empleado_id%ubicacion_id%dia_semana%')"

validar "empleado_disponibilidad.dia_semana entre 1 y 7" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='empleado_disponibilidad'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%dia_semana%')"

validar "jornada UNIQUE (ubicacion, fecha)" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='jornada' AND indexdef LIKE '%UNIQUE%ubicacion_id%fecha%')"

validar "empleado_tiempo_servicio UNIQUE (empleado, servicio)" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='empleado_tiempo_servicio' AND indexdef LIKE '%UNIQUE%empleado_id%servicio_id%')"

validar "preferencia_usuario.idioma existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='preferencia_usuario' AND column_name='idioma')"

validar "FK empleado_perfil.usuario_id -> app_user ON DELETE CASCADE" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='empleado_perfil'::regclass AND contype='f' AND confdeltype='c')"

validar "FK reserva.servicio_id -> servicio_catalogo" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='reserva'::regclass AND contype='f' AND confrelid='servicio_catalogo'::regclass)"

for indice in idx_reserva_inicia_en idx_reserva_cliente_id idx_reserva_empleado_id idx_reserva_estado idx_reserva_ubicacion_id idx_cobro_cobrado_en idx_pago_reserva_id idx_pago_estado idx_pago_referencia idx_app_user_rol_bloqueado; do
  validar "Indice $indice existe" "SELECT to_regclass('public.$indice') IS NOT NULL"
done

echo ""
echo "Resultados: $PASS pasadas, $FAIL fallidas"
exit "$FAIL"
