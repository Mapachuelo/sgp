#!/usr/bin/env python3
"""Verificacion funcional de una semana completa contra el pod SGP.

Requiere el seed 10x10 cargado y el stack Podman en http://localhost:8080.
Crea reservas de miercoles a domingo; lunes y martes ya vienen del seed.
Tambien exporta un backup/CSV y reimporta el CSV en una tabla temporal.
"""
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BASE = os.environ.get('BASE_URL', 'http://localhost:8080/api')
DB = os.environ.get('DB_CONTENEDOR', 'sgp-db-db')
DB_USER = os.environ.get('DB_USUARIO', 'sgp_user')
DB_NAME = os.environ.get('DB_NOMBRE', 'sgp')
BOGOTA = ZoneInfo('America/Bogota')
EXPORT_DIR = os.environ.get(
    'EXPORT_DIR',
    f"/tmp/opencode/sgp-verificacion-{datetime.now(BOGOTA).strftime('%Y%m%d-%H%M%S')}",
)

PASS = 0
FAIL = 0
ERRORES = []


def check(descripcion, condicion, detalle=''):
    global PASS, FAIL
    if condicion:
        PASS += 1
        print(f'PASS: {descripcion}')
    else:
        FAIL += 1
        ERRORES.append(descripcion)
        print(f'FAIL: {descripcion} {detalle}')


def req(metodo, ruta, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    solicitud = urllib.request.Request(BASE + ruta, data=data, method=metodo, headers=headers)
    try:
        with urllib.request.urlopen(solicitud, timeout=30) as respuesta:
            texto = respuesta.read().decode()
            return respuesta.status, json.loads(texto) if texto else {}
    except urllib.error.HTTPError as error:
        texto = error.read().decode()
        try:
            return error.code, json.loads(texto)
        except json.JSONDecodeError:
            return error.code, {'error': texto}


def sql(consulta):
    resultado = subprocess.run(
        ['podman', 'exec', DB, 'psql', '-U', DB_USER, '-d', DB_NAME, '-t', '-A', '-F', '|', '-c', consulta],
        capture_output=True,
        text=True,
    )
    if resultado.returncode != 0:
        raise RuntimeError(resultado.stderr.strip() or 'Error ejecutando SQL')
    return resultado.stdout.strip()


def env_backend(nombre):
    resultado = subprocess.run(
        ['podman', 'exec', 'sgp-app-backend', 'printenv', nombre],
        capture_output=True,
        text=True,
    )
    return resultado.stdout.strip()


def evento_wompi(transaccion, secreto):
    timestamp = int(time.time())
    propiedades = ['transaction.id', 'transaction.status', 'transaction.reference']
    valores = ''.join(str(transaccion[prop.split('.')[-1]]) for prop in propiedades)
    checksum = hashlib.sha256(f'{valores}{timestamp}{secreto}'.encode()).hexdigest()
    return {
        'event': 'transaction.updated',
        'data': {'transaction': transaccion},
        'signature': {'properties': propiedades, 'checksum': checksum},
        'timestamp': timestamp,
    }


def login(email, password):
    status, data = req('POST', '/auth/login', {'email': email, 'password': password})
    if status != 200:
        raise RuntimeError(f'No se pudo iniciar sesion con {email}: {status} {data}')
    return data['data']['token']


def iso_bogota(fecha, minutos):
    hora = 9 * 60 + minutos
    local = datetime(
        fecha.year, fecha.month, fecha.day, hora // 60, hora % 60, tzinfo=BOGOTA
    )
    return local.astimezone(ZoneInfo('UTC')).isoformat().replace('+00:00', 'Z')


def guardar(nombre, contenido):
    ruta = os.path.join(EXPORT_DIR, nombre)
    with open(ruta, 'w', encoding='utf-8') as archivo:
        archivo.write(contenido)
    return ruta


def main():
    os.makedirs(EXPORT_DIR, exist_ok=True)
    hoy = datetime.now(BOGOTA).date()
    lunes = hoy - timedelta(days=hoy.weekday())
    domingo = lunes + timedelta(days=6)
    fechas = [lunes + timedelta(days=i) for i in range(7)]

    print(f'Semana verificada: {lunes} a {domingo}')
    print(f'Exportaciones: {EXPORT_DIR}')

    status, _ = req('GET', '/healthcheck')
    check('Healthcheck responde 200', status == 200, status)

    token_admin = login('admin@sgp.local', 'admin123')
    secret = env_backend('WOMPI_EVENTS_SECRET')
    check('Secreto de eventos Wompi disponible', bool(secret), '')

    servicios = json.loads(sql(
        "SELECT COALESCE(json_agg(json_build_object('id', id, 'nombre', nombre, "
        "'duracion', duracion_base_minutos) ORDER BY id), '[]')::text "
        "FROM servicio_catalogo WHERE activo = TRUE"
    ))
    check('Catalogo con servicios activos', len(servicios) >= 5, len(servicios))

    ubicacion = json.loads(sql(
        "SELECT json_build_object('id', id, 'ciudad', ciudad, 'departamento', departamento)::text "
        "FROM ubicacion ORDER BY id LIMIT 1"
    ))
    check(
        'Sede con departamento y ciudad',
        bool(ubicacion.get('ciudad')) and bool(ubicacion.get('departamento')),
        ubicacion,
    )
    status, _ = req('GET', f"/reservas/empleados-por-sede?ubicacion_id={ubicacion['id']}")
    check('Empleados por sede responde 200', status == 200, status)
    status, _ = req('GET', f"/reservas/servicios?ubicacion_id={ubicacion['id']}")
    check('Servicios por sede responde 200', status == 200, status)

    clientes = json.loads(sql(
        "SELECT COALESCE(json_agg(json_build_object('id', id, 'email', email) ORDER BY email), '[]')::text "
        "FROM app_user WHERE rol = 'cliente' AND email LIKE 'cliente%@sgp.local'"
    ))
    empleados = json.loads(sql(
        "SELECT COALESCE(json_agg(json_build_object('id', id, 'email', email) ORDER BY email), '[]')::text "
        "FROM app_user WHERE rol = 'empleado' AND email LIKE 'empleado%@sgp.local'"
    ))
    check('10 clientes de prueba disponibles', len(clientes) == 10, len(clientes))
    check('10 empleados de prueba disponibles', len(empleados) == 10, len(empleados))

    disponibilidad = json.loads(sql(
        "SELECT COALESCE(json_agg(json_build_object('empleado_id', empleado_id, "
        "'ubicacion_id', ubicacion_id, 'dia', dia_semana)), '[]')::text "
        "FROM empleado_disponibilidad"
    ))
    mapa_disponibilidad = {
        (fila['empleado_id'], fila['dia']): fila['ubicacion_id'] for fila in disponibilidad
    }

    valores_jornada = ', '.join(
        f"('{fecha.isoformat()}'::date, '08:00'::time, '20:00'::time)" for fecha in fechas
    )
    sql(
        f"""
        INSERT INTO jornada (ubicacion_id, fecha, hora_inicio, hora_fin)
        SELECT u.id, v.fecha, v.hora_inicio, v.hora_fin
        FROM ubicacion u
        CROSS JOIN (VALUES {valores_jornada}) AS v(fecha, hora_inicio, hora_fin)
        WHERE u.nombre LIKE 'Pruebas Sede %'
        ON CONFLICT (ubicacion_id, fecha) DO NOTHING
        """
    )
    check('Jornadas de la semana preparadas', True)

    tokens_clientes = {}
    for cliente in clientes:
        tokens_clientes[cliente['email']] = login(cliente['email'], 'cliente123')

    nuevas = []
    futuras = [fecha for fecha in fechas if fecha > hoy]
    check('Hay dias futuros de la semana para crear por API', len(futuras) > 0, futuras)

    for indice_dia, fecha in enumerate(futuras):
        dia_semana = fecha.isoweekday()
        for slot in range(3):
            empleado = empleados[(indice_dia * 3 + slot) % len(empleados)]
            ubicacion_id = mapa_disponibilidad.get((empleado['id'], dia_semana))
            if not ubicacion_id:
                check(f'Disponibilidad {empleado["email"]} {fecha}', False, dia_semana)
                continue
            cliente = clientes[(indice_dia * 3 + slot) % len(clientes)]
            servicio = servicios[(indice_dia + slot) % len(servicios)]
            seleccionados = [servicio]
            if indice_dia == 3 and slot == 1 and len(servicios) > 1:
                seleccionados.append(servicios[(indice_dia + slot + 1) % len(servicios)])

            body = {
                'empleado_id': empleado['id'],
                'ubicacion_id': ubicacion_id,
                'inicia_en': iso_bogota(fecha, slot * 90),
                'cantidad_personas': 1,
                'servicios': [
                    {'servicio_id': item['id'], 'empleado_id': empleado['id']}
                    for item in seleccionados
                ],
            }
            status, data = req('POST', '/reservas', body, tokens_clientes[cliente['email']])
            reserva = (data.get('data') or {})
            check(
                f'Crear reserva {fecha} slot {slot}',
                status == 201 and bool(reserva.get('id')),
                f'{status} {data.get("error", "")}',
            )
            if status != 201:
                continue
            nuevas.append({
                'id': reserva['id'],
                'fecha': fecha,
                'slot': slot,
                'cliente': cliente,
                'empleado': empleado,
                'estado_esperado': ['cancelada', 'pagada', 'pendiente'][slot],
                'servicios': len(seleccionados),
            })

            if slot == 0:
                status, data = req('DELETE', f"/reservas/me/{reserva['id']}", token=tokens_clientes[cliente['email']])
                check(f'Cancelar reserva {reserva["id"]}', status == 200, status)
            elif slot == 1:
                status, intencion = req(
                    'POST', '/pagos/intencion', {'reserva_id': reserva['id']},
                    tokens_clientes[cliente['email']],
                )
                referencia = (intencion.get('data') or {}).get('referencia')
                check(f'Crear intencion de pago {reserva["id"]}', status == 201 and bool(referencia), status)
                if status == 201:
                    evento = evento_wompi(
                        {'id': f'TX-WEEK-{reserva["id"]}', 'status': 'APPROVED', 'reference': referencia},
                        secret,
                    )
                    status, data = req('POST', '/pagos/webhook', evento)
                    check(f'Webhook aprobado {reserva["id"]}', status == 200, f'{status} {data}')
            elif indice_dia == 2:
                status, intencion = req(
                    'POST', '/pagos/intencion', {'reserva_id': reserva['id']},
                    tokens_clientes[cliente['email']],
                )
                referencia = (intencion.get('data') or {}).get('referencia')
                if status == 201:
                    evento = evento_wompi(
                        {'id': f'TX-WEEK-DECL-{reserva["id"]}', 'status': 'DECLINED', 'reference': referencia},
                        secret,
                    )
                    req('POST', '/pagos/webhook', evento)

    check('Se crearon reservas para los dias futuros', len(nuevas) >= len(futuras) * 3, len(nuevas))

    filas_estado = sql(
        f"""
        SELECT inicia_en::date, estado, COUNT(*)
        FROM reserva
        WHERE inicia_en::date BETWEEN '{lunes}' AND '{domingo}'
        GROUP BY 1, 2 ORDER BY 1, 2
        """
    )
    estados = {}
    dias = set()
    for linea in filas_estado.splitlines():
        fecha_texto, estado, cantidad = linea.split('|')
        dias.add(fecha_texto)
        estados.setdefault(estado, 0)
        estados[estado] += int(cantidad)
    check(
        'La semana tiene reservas en los dias futuros del seed',
        all(fecha.isoformat() in dias for fecha in futuras) and len(dias) >= 2,
        sorted(dias),
    )
    check('Hay reservas canceladas en la semana', estados.get('cancelada', 0) > 0, estados)
    check('Hay reservas cobradas/pagadas en la semana', estados.get('cobrado', 0) > 0, estados)
    check('Hay reservas pendientes en la semana', estados.get('pendiente', 0) > 0, estados)

    pagos = json.loads(sql(
        f"""
        SELECT COALESCE(json_agg(json_build_object(
          'reserva_id', r.id, 'estado', p.estado, 'metodo', p.metodo,
          'cobro', c.metodo, 'total', p.monto
        ) ORDER BY r.id), '[]')::text
        FROM reserva r
        JOIN pago p ON p.reserva_id = r.id
        LEFT JOIN cobro c ON c.reserva_id = r.id
        WHERE r.inicia_en::date BETWEEN '{lunes}' AND '{domingo}'
        """
    ))
    check('Pagos aprobados con cobro online', any(
        p['estado'] == 'aprobado' and p['cobro'] == 'online' for p in pagos
    ), pagos[:3])
    check('Pagos declinados en la semana', any(p['estado'] == 'declinado' for p in pagos), pagos[:3])

    if nuevas:
        segmentos_nuevos = sql(
            'SELECT COUNT(*) FROM reserva_servicio WHERE reserva_id IN ('
            + ','.join(str(r['id']) for r in nuevas) + ')'
        )
        check('Segmentos de reserva_servicio creados', int(segmentos_nuevos) >= len(nuevas), segmentos_nuevos)
    else:
        check('Segmentos de reserva_servicio creados', False, 'sin reservas nuevas')

    solapes = sql(
        f"""
        SELECT COUNT(*) FROM reserva a
        JOIN reserva b ON a.empleado_id = b.empleado_id AND a.id < b.id
        WHERE a.estado <> 'cancelada' AND b.estado <> 'cancelada'
          AND a.inicia_en < b.termina_en AND b.inicia_en < a.termina_en
          AND a.inicia_en::date BETWEEN '{lunes}' AND '{domingo}'
        """
    )
    check('Sin solapes de empleado en la semana', int(solapes) == 0, solapes)

    status, data = req(
        'GET', f'/reservas/agenda?desde={lunes}&hasta={domingo}', token=token_admin
    )
    agenda = data.get('data') or []
    check('Agenda semanal admin responde 200', status == 200, status)
    check('Agenda semanal incluye segmentos', len(agenda) >= len(nuevas), len(agenda))

    for fecha in fechas:
        status, _ = req('GET', f'/reportes/ventas-diarias?fecha={fecha}', token=token_admin)
        check(f'Reporte ventas {fecha}', status == 200, status)
        status, _ = req('GET', f'/reportes/ocupacion?fecha={fecha}', token=token_admin)
        check(f'Reporte ocupacion {fecha}', status == 200, status)

    status, _ = req('GET', '/reportes/clientes-recurrentes', token=token_admin)
    check('Reporte clientes recurrentes', status == 200, status)
    status, _ = req('GET', '/logs/actividad', token=token_admin)
    check('Logs de actividad', status == 200, status)

    status, data = req('GET', '/reservas/servicios')
    check('Catalogo publico responde 200', status == 200, status)
    status, data = req('GET', '/reservas/categorias')
    check('Categorias publicas responden 200', status == 200, status)
    status, data = req('GET', '/reservas/configuracion')
    check('Configuracion publica responde 200', status == 200, status)
    status, data = req('GET', '/reservas/sedes-por-servicio?servicio_id=1')
    check('Sedes por servicio responde 200', status == 200, status)
    status, data = req('GET', '/reservas/servicios/1/imagenes')
    check('Galeria de servicio responde 200', status == 200, status)

    # Verificacion de cliente con pago y pendiente.
    cliente_ui = None
    for candidato in clientes:
        status, data = req('GET', '/reservas/me', token=tokens_clientes[candidato['email']])
        if status != 200:
            continue
        reservas_cliente = data.get('data') or []
        pagada = any(r.get('pago_estado') == 'aprobado' for r in reservas_cliente)
        pendiente = any(
            r.get('pago_estado') in (None, 'pendiente', 'declinado')
            and r.get('estado') in ('pendiente', 'confirmada')
            for r in reservas_cliente
        )
        if pagada and pendiente:
            cliente_ui = candidato
            check('Cliente tiene pago aprobado y pendiente', True)
            break
    check('Cliente UI encontrado', bool(cliente_ui), cliente_ui)

    # Verificacion de agente/empleado.
    if nuevas:
        empleado_ui = nuevas[0]['empleado']
        token_empleado = login(empleado_ui['email'], 'empleado123')
        fecha_empleado = nuevas[0]['fecha']
        status, data = req('GET', f'/reservas?fecha={fecha_empleado}', token=token_empleado)
        check('Agenda de empleado responde 200', status == 200, status)
        check('Agenda de empleado incluye su semana', bool(data.get('data')), len(data.get('data') or []))

    # Exportacion: backup, CSV y lectura del dump.
    dump_container = '/tmp/sgp-verificacion-semana.dump'
    subprocess.run(
        ['podman', 'exec', DB, 'pg_dump', '-U', DB_USER, '-d', DB_NAME, '-Fc', '-f', dump_container],
        check=True,
        capture_output=True,
    )
    dump_local = os.path.join(EXPORT_DIR, 'sgp-semana.dump')
    subprocess.run(['podman', 'cp', f'{DB}:{dump_container}', dump_local], check=True, capture_output=True)
    check('Backup pg_dump exportado', os.path.getsize(dump_local) > 0, dump_local)
    listado = subprocess.run(
        ['podman', 'exec', DB, 'pg_restore', '-l', dump_container],
        capture_output=True,
        text=True,
    )
    check('Backup legible por pg_restore', listado.returncode == 0 and 'reserva' in listado.stdout, listado.stderr[:120])

    consulta_csv = f"""
      COPY (
        SELECT id, cliente_id, empleado_id, servicio_id, ubicacion_id,
               inicia_en, termina_en, estado, cantidad_personas, qr_token::text
        FROM reserva
        WHERE inicia_en::date BETWEEN '{lunes}' AND '{domingo}'
        ORDER BY id
      ) TO STDOUT WITH CSV HEADER
    """
    csv_resultado = subprocess.run(
        ['podman', 'exec', DB, 'psql', '-U', DB_USER, '-d', DB_NAME, '-q', '-c', consulta_csv],
        capture_output=True,
        text=True,
    )
    check('CSV semanal exportado', csv_resultado.returncode == 0 and 'id,cliente_id' in csv_resultado.stdout, csv_resultado.stderr[:120])
    csv_local = guardar('reservas-semana.csv', csv_resultado.stdout)
    filas_csv = max(0, len(csv_resultado.stdout.strip().splitlines()) - 1)
    check('CSV semanal tiene filas', filas_csv >= 20, filas_csv)

    subprocess.run(['podman', 'cp', csv_local, f'{DB}:/tmp/reservas-semana.csv'], check=True, capture_output=True)
    sql_import = """
      DROP TABLE IF EXISTS verificacion_reservas_semana;
      CREATE TABLE verificacion_reservas_semana (
        id integer, cliente_id integer, empleado_id integer, servicio_id integer,
        ubicacion_id integer, inicia_en timestamptz, termina_en timestamptz,
        estado varchar(20), cantidad_personas integer, qr_token text
      );
      \\copy verificacion_reservas_semana FROM '/tmp/reservas-semana.csv' CSV HEADER
    """
    ruta_sql = guardar('importar-reservas.sql', sql_import)
    subprocess.run(['podman', 'cp', ruta_sql, f'{DB}:/tmp/importar-reservas.sql'], check=True, capture_output=True)
    importacion = subprocess.run(
        ['podman', 'exec', DB, 'psql', '-U', DB_USER, '-d', DB_NAME, '-f', '/tmp/importar-reservas.sql'],
        capture_output=True,
        text=True,
    )
    check('CSV reimportado al contenedor', importacion.returncode == 0, importacion.stderr[:160])
    importadas = sql('SELECT COUNT(*) FROM verificacion_reservas_semana')
    check('Filas importadas coinciden con el CSV', int(importadas) == filas_csv, f'{importadas} vs {filas_csv}')
    sql('DROP TABLE IF EXISTS verificacion_reservas_semana')

    # Guardar una salida JSON de la verificacion.
    resumen = {
        'semana': {'desde': str(lunes), 'hasta': str(domingo)},
        'nuevas_reservas': [
            {
                'id': r['id'],
                'fecha': str(r['fecha']),
                'slot': r['slot'],
                'cliente': r['cliente']['email'],
                'empleado': r['empleado']['email'],
                'estado_esperado': r['estado_esperado'],
                'servicios': r['servicios'],
            }
            for r in nuevas
        ],
        'estados_semana': estados,
        'pagos': pagos,
        'cliente_ui': cliente_ui,
        'csv': csv_local,
        'backup': dump_local,
        'pass': PASS,
        'fail': FAIL,
    }
    guardar('resumen.json', json.dumps(resumen, indent=2, ensure_ascii=False))

    print('')
    print(f'Resultados verificacion semanal: {PASS} pasadas, {FAIL} fallidas')
    if cliente_ui:
        print(f'Cliente para revisar en UI: {cliente_ui["email"]} / cliente123')
    if nuevas:
        print(f'Empleado para revisar en UI: {nuevas[0]["empleado"]["email"]} / empleado123')
    print(f'Exportaciones: {EXPORT_DIR}')
    if ERRORES:
        print('Fallos: ' + '; '.join(ERRORES))
    return 1 if FAIL else 0


if __name__ == '__main__':
    sys.exit(main())
