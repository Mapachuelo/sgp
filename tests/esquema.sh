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

for tabla in ubicacion app_user empleado_perfil servicio_categoria servicio_catalogo servicio_imagen empleado_tiempo_servicio jornada jornada_plantilla empleado_disponibilidad empleado_sede_temporal empleado_festivo empleado_bloqueo_fecha reserva reserva_servicio cobro pago preferencia_usuario configuracion; do
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

validar "reserva.llego_en existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reserva' AND column_name='llego_en' AND data_type='timestamp with time zone')"

validar "reserva.inicio_servicio existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reserva' AND column_name='inicio_servicio' AND data_type='timestamp with time zone')"

validar "reserva.fin_servicio existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reserva' AND column_name='fin_servicio' AND data_type='timestamp with time zone')"

validar "cobro.pago_id existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cobro' AND column_name='pago_id')"

validar "cobro.pagado_antes existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cobro' AND column_name='pagado_antes' AND data_type='boolean')"

validar "FK cobro.pago_id -> pago ON DELETE SET NULL" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='cobro'::regclass AND contype='f' AND confrelid='pago'::regclass AND confdeltype='n')"

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

validar "jornada.cerrado existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jornada' AND column_name='cerrado' AND data_type='boolean')"

validar "jornada_plantilla UNIQUE (ubicacion, dia)" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='jornada_plantilla' AND indexdef LIKE '%UNIQUE%ubicacion_id%dia_semana%')"

validar "empleado_disponibilidad.descansos existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleado_disponibilidad' AND column_name='descansos' AND data_type='jsonb')"

validar "empleado_disponibilidad.descanso existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleado_disponibilidad' AND column_name='descanso' AND data_type='boolean')"

validar "empleado_sede_temporal.dias_semana existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleado_sede_temporal' AND column_name='dias_semana' AND data_type='ARRAY')"

validar "empleado_festivo UNIQUE (empleado, fecha)" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='empleado_festivo' AND indexdef LIKE '%UNIQUE%empleado_id%fecha%')"

validar "empleado_bloqueo_fecha UNIQUE (empleado, fecha)" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='empleado_bloqueo_fecha' AND indexdef LIKE '%UNIQUE%empleado_id%fecha%')"

validar "empleado_perfil.comision_porcentaje existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleado_perfil' AND column_name='comision_porcentaje' AND data_type='numeric')"

validar "pago.reembolso_estado existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pago' AND column_name='reembolso_estado')"

validar "cobro.reembolsado_en existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cobro' AND column_name='reembolsado_en' AND data_type='timestamp with time zone')"

validar "empleado_tiempo_servicio UNIQUE (empleado, servicio)" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='empleado_tiempo_servicio' AND indexdef LIKE '%UNIQUE%empleado_id%servicio_id%')"

validar "ubicacion.departamento existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ubicacion' AND column_name='departamento')"

validar "ubicacion.ciudad existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ubicacion' AND column_name='ciudad')"

validar "ubicacion.imagen_url existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ubicacion' AND column_name='imagen_url' AND data_type='text')"

validar "ubicacion_imagen existe" \
  "SELECT to_regclass('public.ubicacion_imagen') IS NOT NULL"

validar "ubicacion_imagen.ubicacion_id existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ubicacion_imagen' AND column_name='ubicacion_id')"

validar "ubicacion_imagen.imagen_url existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ubicacion_imagen' AND column_name='imagen_url' AND data_type='text')"

validar "empleado_descanso_temporal existe" \
  "SELECT to_regclass('public.empleado_descanso_temporal') IS NOT NULL"

validar "empleado_descanso_temporal.fecha existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleado_descanso_temporal' AND column_name='fecha' AND data_type='date')"

validar "empleado_descanso_temporal.descansos existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleado_descanso_temporal' AND column_name='descansos' AND data_type='jsonb')"

validar "notificacion existe" \
  "SELECT to_regclass('public.notificacion') IS NOT NULL"

validar "notificacion.usuario_id existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificacion' AND column_name='usuario_id')"

validar "notificacion.leida_en existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificacion' AND column_name='leida_en' AND data_type='timestamp with time zone')"

validar "preferencia_usuario.ciudad_preferida existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='preferencia_usuario' AND column_name='ciudad_preferida')"

validar "empleado_perfil.foto_url existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleado_perfil' AND column_name='foto_url' AND data_type='text')"

validar "servicio_catalogo.categoria_id existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicio_catalogo' AND column_name='categoria_id')"

validar "servicio_catalogo.imagen_url existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicio_catalogo' AND column_name='imagen_url' AND data_type='text')"

validar "servicio_catalogo.activo existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicio_catalogo' AND column_name='activo' AND data_type='boolean')"

validar "FK servicio_catalogo.categoria_id -> servicio_categoria ON DELETE RESTRICT" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='servicio_catalogo'::regclass AND contype='f' AND confrelid='servicio_categoria'::regclass AND confdeltype='r')"

validar "servicio_imagen.servicio_id existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicio_imagen' AND column_name='servicio_id')"

validar "servicio_imagen.imagen_url existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicio_imagen' AND column_name='imagen_url' AND data_type='text')"

validar "servicio_imagen.orden existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicio_imagen' AND column_name='orden' AND data_type='integer')"

validar "FK servicio_imagen.servicio_id -> servicio_catalogo ON DELETE CASCADE" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='servicio_imagen'::regclass AND contype='f' AND confrelid='servicio_catalogo'::regclass AND confdeltype='c')"

validar "servicio_imagen UNIQUE (servicio, orden)" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='servicio_imagen' AND indexdef LIKE '%UNIQUE%servicio_id%orden%')"

validar "Portadas sin fila en servicio_imagen" \
  "SELECT NOT EXISTS (SELECT 1 FROM servicio_catalogo s WHERE s.imagen_url IS NOT NULL AND NOT EXISTS (SELECT 1 FROM servicio_imagen si WHERE si.servicio_id = s.id))"

validar "reserva_servicio.empleado_id existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reserva_servicio' AND column_name='empleado_id')"

validar "reserva_servicio.precio existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reserva_servicio' AND column_name='precio' AND data_type='numeric')"

validar "reserva_servicio.inicia_en existe" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reserva_servicio' AND column_name='inicia_en' AND data_type='timestamp with time zone')"

validar "FK reserva_servicio.reserva_id -> reserva ON DELETE CASCADE" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='reserva_servicio'::regclass AND contype='f' AND confrelid='reserva'::regclass AND confdeltype='c')"

validar "reserva_servicio UNIQUE (reserva, orden)" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='reserva_servicio' AND indexdef LIKE '%UNIQUE%reserva_id%orden%')"

validar "configuracion.max_servicios_reserva existe" \
  "SELECT EXISTS (SELECT 1 FROM configuracion WHERE clave='max_servicios_reserva')"

validar "FK empleado_perfil.usuario_id -> app_user ON DELETE CASCADE" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='empleado_perfil'::regclass AND contype='f' AND confdeltype='c')"

validar "FK reserva.servicio_id -> servicio_catalogo" \
  "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='reserva'::regclass AND contype='f' AND confrelid='servicio_catalogo'::regclass)"

for indice in idx_reserva_inicia_en idx_reserva_cliente_id idx_reserva_empleado_id idx_reserva_estado idx_reserva_ubicacion_id idx_reserva_llego_en idx_reserva_servicio_reserva_id idx_reserva_servicio_empleado_inicia idx_reserva_servicio_servicio_id idx_servicio_catalogo_categoria_id idx_servicio_imagen_servicio idx_servicio_categoria_nombre idx_cobro_cobrado_en idx_cobro_pago_id idx_pago_reserva_id idx_pago_estado idx_pago_referencia idx_app_user_rol_bloqueado; do
  validar "Indice $indice existe" "SELECT to_regclass('public.$indice') IS NOT NULL"
done

echo ""
echo "Resultados: $PASS pasadas, $FAIL fallidas"
exit "$FAIL"
