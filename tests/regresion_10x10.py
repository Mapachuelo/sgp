#!/usr/bin/env python3
"""Regresion funcional 10x10 del SGP.

Requiere:
  - Stack desplegado (sgp-app y sgp-db).
  - Seed: pnpm run seed:pruebas
  - Manifiesto en tests/fixtures/seed-10x10.json
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
DB_CONTENEDOR = os.environ.get('DB_CONTENEDOR', 'sgp-db-db')
DB_USUARIO = os.environ.get('DB_USUARIO', 'sgp_user')
DB_NOMBRE = os.environ.get('DB_NOMBRE', 'sgp')
BOGOTA = ZoneInfo('America/Bogota')
PASS = 0
FAIL = 0
ERRORES = []


def check(desc, condicion, detalle=''):
    global PASS, FAIL
    if condicion:
        PASS += 1
        print(f'PASS: {desc}')
    else:
        FAIL += 1
        ERRORES.append(desc)
        print(f'FAIL: {desc} {detalle}')


def req(metodo, ruta, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    solicitud = urllib.request.Request(BASE + ruta, data=data, method=metodo, headers=headers)
    try:
        with urllib.request.urlopen(solicitud, timeout=30) as respuesta:
            contenido = respuesta.read()
            try:
                return respuesta.status, json.loads(contenido)
            except json.JSONDecodeError:
                return respuesta.status, {'raw': contenido.decode('utf-8', errors='replace')}
    except urllib.error.HTTPError as err:
        try:
            return err.code, json.loads(err.read())
        except Exception:
            return err.code, {}


def sql(consulta):
    resultado = subprocess.run(
        ['podman', 'exec', DB_CONTENEDOR, 'psql', '-U', DB_USUARIO, '-d', DB_NOMBRE, '-t', '-A', '-c', consulta],
        capture_output=True, text=True,
    )
    return resultado.stdout.strip()


def env_backend(nombre):
    resultado = subprocess.run(
        ['podman', 'exec', 'sgp-app-backend', 'printenv', nombre],
        capture_output=True, text=True,
    )
    return resultado.stdout.strip()


def login(email, password):
    status, data = req('POST', '/auth/login', {'email': email, 'password': password})
    return status, (data.get('data') or {}).get('token')


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


def iso_bogota(fecha, hora, minuto=0):
    local = datetime(fecha.year, fecha.month, fecha.day, hora, minuto, tzinfo=BOGOTA)
    return local.astimezone(ZoneInfo('UTC')).isoformat().replace('+00:00', 'Z')


manifiesto = json.load(open('tests/fixtures/seed-10x10.json', encoding='utf-8'))
clientes = manifiesto['clientes']
empleados = manifiesto['empleados']
reservas = manifiesto['reservas']
hoy = datetime.now(BOGOTA).date()
fecha_futura = hoy + timedelta(days=14)
secreto = env_backend('WOMPI_EVENTS_SECRET')

print('== Autenticacion 10 clientes / 10 empleados ==')
tokens_clientes = {}
for cliente in clientes:
    status, token = login(cliente['email'], 'cliente123')
    tokens_clientes[cliente['email']] = token
    check(f"Login cliente {cliente['email']}", status == 200 and bool(token), status)

tokens_empleados = {}
for empleado in empleados:
    status, token = login(empleado['email'], 'empleado123')
    tokens_empleados[empleado['email']] = token
    check(f"Login empleado {empleado['email']}", status == 200 and bool(token), status)

status, token_admin = login('admin@sgp.local', 'admin123')
check('Login admin', status == 200 and bool(token_admin), status)
admin = token_admin

status, data = req('GET', '/clientes/me', token=tokens_clientes[clientes[0]['email']])
check('GET /clientes/me cliente', status == 200 and data.get('data', {}).get('rol') == 'cliente', data)
status, data = req('GET', '/auth/me', token=tokens_empleados[empleados[0]['email']])
check('GET /auth/me empleado', status == 200 and data.get('data', {}).get('rol') == 'empleado', data)

print('== Telefonos internacionales ==')
cliente_final = clientes[-1]
token_final = tokens_clientes[cliente_final['email']]
status, data = req('PUT', '/clientes/me', {'telefono': '+14155550123'}, token_final)
check('Actualizar telefono internacional +1', status == 200 and data.get('data', {}).get('telefono') == '+14155550123', data)
status, _ = req('PUT', '/clientes/me', {'telefono': '3001234567'}, token_final)
check('Rechazar telefono sin prefijo', status == 400, status)
status, _ = req('PUT', '/clientes/me', {'telefono': '+573000000010'}, token_final)
check('Restaurar telefono colombiano', status == 200, status)

email_registro = f"regresion.{int(time.time())}@sgp.local"
status, data = req('POST', '/auth/register', {
    'nombre': 'Registro', 'apellido': 'Internacional',
    'email': email_registro, 'password': 'clave123', 'telefono': '+14155550124',
})
check('Registro con telefono internacional', status == 201, f'{status} {data}')
sql(f"UPDATE app_user SET verificado = TRUE WHERE email = '{email_registro}'")
status, token_registro = login(email_registro, 'clave123')
check('Login del registro internacional', status == 200 and bool(token_registro), status)
status, data = req('DELETE', '/clientes/me', token=token_registro)
check('Eliminar cuenta de prueba', status == 200, status)

print('== Clientes, sedes, servicios y empleados ==')
status, data = req('GET', '/clientes', token=admin)
check('Admin lista 10 clientes', status == 200 and len(data.get('data', [])) >= 10, len(data.get('data', [])))
cliente_bloqueo = clientes[-2]
status, _ = req('PUT', f"/clientes/{cliente_bloqueo['id']}/bloquear", {'motivo': 'Prueba de bloqueo'}, admin)
check('Bloquear cliente', status == 200, status)
status, _ = req('PUT', f"/clientes/{cliente_bloqueo['id']}/desbloquear", token=admin)
check('Desbloquear cliente', status == 200, status)

status, data = req('GET', '/ubicaciones')
check('Listar sedes', status == 200 and len(data.get('data', [])) >= 3, len(data.get('data', [])))
status, data = req('POST', '/ubicaciones', {
    'nombre': 'Sede Regresion', 'direccion': 'Calle 1 # 2-3', 'latitud': 4.65, 'longitud': -74.05,
}, admin)
sede_id = (data.get('data') or {}).get('id')
check('Crear sede', status == 201 and bool(sede_id), f'{status} {data}')
status, _ = req('POST', '/ubicaciones', {'nombre': 'Mala', 'direccion': 'X', 'latitud': 100, 'longitud': 0}, admin)
check('Rechazar latitud invalida', status == 400, status)
status, data = req('PUT', f'/ubicaciones/{sede_id}', {'nombre': 'Sede Regresion Editada'}, admin)
check('Editar sede', status == 200 and data.get('data', {}).get('nombre') == 'Sede Regresion Editada', data)
status, _ = req('DELETE', f'/ubicaciones/{sede_id}', token=admin)
check('Eliminar sede', status == 200, status)

status, data = req('GET', '/reservas/servicios')
check('Listar servicios', status == 200 and len(data.get('data', [])) >= 5, len(data.get('data', [])))
status, data = req('POST', '/reservas/servicios', {
    'nombre': 'Servicio Regresion', 'descripcion': 'Prueba', 'precio_base': 10000, 'duracion_base_minutos': 20,
}, admin)
servicio_id = (data.get('data') or {}).get('id')
check('Crear servicio', status == 201 and bool(servicio_id), f'{status} {data}')
status, data = req('PUT', f'/reservas/servicios/{servicio_id}', {'precio_base': 12000}, admin)
check('Editar servicio', status == 200 and float(data.get('data', {}).get('precio_base', 0)) == 12000, data)
status, _ = req('DELETE', f'/reservas/servicios/{servicio_id}', token=admin)
check('Eliminar servicio', status == 200, status)

status, data = req('GET', '/auth/empleados', token=admin)
check('Admin lista 10 empleados', status == 200 and len(data.get('data', [])) >= 10, len(data.get('data', [])))
status, data = req('POST', '/auth/empleados', {
    'nombre': 'Empleado', 'apellido': 'Regresion', 'email': f'emp.reg.{int(time.time())}@sgp.local',
    'password': 'empleado123', 'telefono': '+573001234567', 'identificacion': 'REG-001',
    'ubicacion_base_id': 1,
}, admin)
empleado_temporal = (data.get('data') or {}).get('id')
check('Crear empleado temporal', status == 201 and bool(empleado_temporal), f'{status} {data}')
status, _ = req('PUT', f'/auth/empleados/{empleado_temporal}', {'nombre': 'Empleado Editado'}, admin)
check('Editar empleado temporal', status == 200, status)
status, _ = req('GET', f'/empleados/{empleado_temporal}/disponibilidad', token=admin)
check('Consultar disponibilidad de empleado', status == 200, status)
status, _ = req('PUT', f"/empleados/{empleado_temporal}/disponibilidad", [
    {'dia_semana': 1, 'ubicacion_id': 1, 'hora_inicio': '09:00', 'hora_fin': '18:00'},
], admin)
check('Actualizar disponibilidad de empleado', status == 200, status)
status, _ = req('GET', '/empleados/disponibilidad/todas', token=admin)
check('Disponibilidad completa admin', status == 200, status)
status, _ = req('GET', '/empleados/disponibilidad', token=tokens_empleados[empleados[0]['email']])
check('Disponibilidad propia empleado', status == 200, status)
status, _ = req('DELETE', f'/auth/empleados/{empleado_temporal}', token=admin)
check('Eliminar empleado temporal', status == 200, status)
status, _ = req('DELETE', f"/auth/empleados/{empleados[4]['id']}", token=admin)
check('No eliminar empleado con cobros (409)', status == 409, status)

print('== Reservas 10 clientes ==')
status, disponibilidad = req('GET', f"/empleados/{empleados[0]['id']}/disponibilidad", token=admin)
bloque_futuro = next(
    (b for b in (disponibilidad.get('data') or []) if b.get('dia_semana') == fecha_futura.isoweekday()),
    None,
)
sede_futura = bloque_futuro['ubicacion_id'] if bloque_futuro else 1
check('Disponibilidad del empleado para la fecha futura', bool(bloque_futuro), disponibilidad)
nuevas = []
for indice, cliente in enumerate(clientes):
    body = {
        'empleado_id': empleados[0]['id'],
        'servicio_id': 1,
        'ubicacion_id': sede_futura,
        'inicia_en': iso_bogota(fecha_futura, 9 + indice, 0),
        'cantidad_personas': 1,
    }
    status, data = req('POST', '/reservas', body, tokens_clientes[cliente['email']])
    reserva = data.get('data') or {}
    nuevas.append(reserva)
    check(f"Crear reserva futura cliente {indice + 1}", status == 201 and bool(reserva.get('id')), f'{status} {data}')

status, _ = req('POST', '/reservas', {
    'empleado_id': empleados[0]['id'], 'servicio_id': 1, 'ubicacion_id': sede_futura,
    'inicia_en': iso_bogota(fecha_futura, 10, 0), 'cantidad_personas': 1,
}, tokens_clientes[clientes[0]['email']])
check('Rechazar reserva solapada', status == 409, status)

status, _ = req('POST', '/reservas', {
    'empleado_id': empleados[0]['id'], 'servicio_id': 1, 'ubicacion_id': sede_futura,
    'inicia_en': iso_bogota(fecha_futura, 10, 0), 'cantidad_personas': 1,
}, admin)
check('Admin no puede crear reserva (403)', status == 403, status)

status, _ = req('DELETE', f"/reservas/me/{nuevas[0]['id']}", token=tokens_clientes[clientes[1]['email']])
check('Cliente no puede cancelar reserva ajena (403)', status == 403, status)
status, _ = req('DELETE', f"/reservas/me/{nuevas[0]['id']}", token=tokens_clientes[clientes[0]['email']])
check('Cliente cancela su reserva', status == 200, status)

for cliente in clientes:
    status, data = req('GET', '/reservas/me', token=tokens_clientes[cliente['email']])
    check(f"Cliente {cliente['email']} tiene reservas", status == 200 and len(data.get('data', [])) >= 1, len(data.get('data', [])))

status, _ = req('GET', f'/reservas?fecha={hoy.isoformat()}', token=tokens_empleados[empleados[0]['email']])
check('Empleado ve solo su agenda del dia', status == 200, status)
status, _ = req('GET', f'/reservas/agenda?desde={hoy.isoformat()}&hasta={hoy.isoformat()}', token=admin)
check('Agenda admin responde 200', status == 200, status)
status, _ = req('GET', f'/reservas/disponibilidad?fecha={hoy.isoformat()}&empleado_id={empleados[0]["id"]}&ubicacion_id=1', token=tokens_empleados[empleados[0]['email']])
check('Consultar disponibilidad de reserva', status == 200, status)
status, _ = req('GET', f'/reservas/empleados-disponibles?fecha={fecha_futura.isoformat()}&ubicacion_id=1')
check('Empleados disponibles responde 200', status == 200, status)

print('== Check-in y cola ==')
reserva_pagada = reservas[0]
reserva_pendiente = reservas[4]
token_emp_pagada = tokens_empleados[reserva_pagada['empleado']]
token_emp_pendiente = tokens_empleados[reserva_pendiente['empleado']]

status, data = req('POST', '/checkin/consultar', {'qr_token': reserva_pagada['qr_token']}, token_emp_pagada)
check('Consultar reserva pagada', status == 200 and (data.get('data') or {}).get('pagado') is True, data)
status, data = req('POST', '/checkin/iniciar', {'reserva_id': reserva_pagada['id']}, token_emp_pagada)
check('Iniciar servicio pagado', status == 200 and (data.get('data') or {}).get('estado') == 'en_curso', f'{status} {data}')
status, data = req('POST', '/checkin/finalizar', {'reserva_id': reserva_pagada['id']}, token_emp_pagada)
check('Finalizar servicio pagado', status == 200 and (data.get('data') or {}).get('estado') == 'cobrado', f'{status} {data}')

status, data = req('POST', '/checkin/llegada', {'qr_token': reserva_pendiente['qr_token']}, token_emp_pendiente)
check('Registrar llegada de cliente sin pago', status == 200 and bool((data.get('data') or {}).get('llego_en')), f'{status} {data}')
status, _ = req('POST', '/checkin/iniciar', {'reserva_id': reserva_pendiente['id']}, token_emp_pendiente)
check('No iniciar sin pago (409)', status == 409, status)
status, data = req('POST', '/checkin/cobro-efectivo', {'reserva_id': reserva_pendiente['id'], 'monto': 30000}, token_emp_pendiente)
check('Registrar cobro en efectivo', status == 200 and (data.get('data') or {}).get('pagado') is True, f'{status} {data}')
status, data = req('POST', '/checkin/iniciar', {'reserva_id': reserva_pendiente['id']}, token_emp_pendiente)
check('Iniciar servicio con efectivo', status == 200, f'{status} {data}')
status, data = req('POST', '/checkin/finalizar', {'reserva_id': reserva_pendiente['id']}, token_emp_pendiente)
check('Finalizar servicio con efectivo', status == 200, f'{status} {data}')

status, _ = req('POST', '/checkin/consultar', {'qr_token': reserva_pendiente['qr_token']}, token_emp_pagada)
check('Empleado no accede a reserva de otro (403)', status == 403, status)
status, _ = req('POST', '/checkin/consultar', {'qr_token': 'no-es-uuid'}, token_emp_pagada)
check('Check-in con QR invalido (400)', status == 400, status)
status, _ = req('POST', '/checkin/consultar', {'qr_token': '00000000-0000-4000-8000-000000000000'}, token_emp_pagada)
check('Check-in con QR inexistente (404)', status == 404, status)

print('== Pagos y webhook ==')
reserva_pago = reservas[5]
token_cliente_pago = tokens_clientes[reserva_pago['cliente']]
status, data = req('POST', '/pagos/intencion', {'reserva_id': reserva_pago['id']}, token_cliente_pago)
intencion = data.get('data') or {}
check('Crear intencion con QR', status == 201 and intencion.get('qr_data_url', '').startswith('data:image/png') and 'checkout.wompi.co' in intencion.get('checkout_url', ''), f'{status} {data}')
pago_id = intencion.get('pago_id')
referencia = intencion.get('referencia')

status, _ = req('GET', f'/pagos/{pago_id}', token=tokens_clientes[clientes[1]['email']])
check('Otro cliente no ve el pago (403)', status == 403, status)
status, _ = req('GET', f'/pagos/{pago_id}', token=tokens_empleados[reserva_pago['empleado']])
check('Empleado dueno consulta el pago', status == 200, status)

transaccion = {'id': f'TX-REG-{int(time.time())}-1', 'status': 'APPROVED', 'reference': referencia, 'amount_in_cents': intencion.get('monto_en_centavos'), 'payment_method_type': 'CARD'}
evento = evento_wompi(transaccion, secreto)
status, data = req('POST', '/pagos/webhook', evento)
check('Webhook aprobado', status == 200 and (data.get('data') or {}).get('estado') == 'aprobado', f'{status} {data}')
estado_pago = sql(f'SELECT estado FROM pago WHERE id = {pago_id}')
check('Pago aprobado en BD', estado_pago == 'aprobado', estado_pago)
cobro_pago = sql(f'SELECT pago_id FROM cobro WHERE reserva_id = {reserva_pago["id"]}')
check('Cobro vinculado al pago', cobro_pago == str(pago_id), cobro_pago)
status, data = req('POST', '/pagos/webhook', evento)
check('Webhook idempotente', status == 200 and (data.get('data') or {}).get('idempotente') is True, f'{status} {data}')
status, _ = req('POST', '/pagos/webhook', {'event': 'transaction.updated', 'data': {'transaction': {'id': 'X', 'status': 'APPROVED', 'reference': 'X'}}, 'signature': {'properties': ['transaction.id'], 'checksum': '00'}, 'timestamp': 1})
check('Webhook con firma invalida (401)', status == 401, status)

reserva_declinada = reservas[7]
status, data = req('POST', '/pagos/intencion', {'reserva_id': reserva_declinada['id']}, tokens_clientes[reserva_declinada['cliente']])
intencion2 = data.get('data') or {}
evento2 = evento_wompi({'id': f'TX-REG-{int(time.time())}-2', 'status': 'DECLINED', 'reference': intencion2.get('referencia')}, secreto)
status, data = req('POST', '/pagos/webhook', evento2)
check('Webhook declinado', status == 200 and (data.get('data') or {}).get('estado') == 'declinado', f'{status} {data}')
estado_decl = sql(f"SELECT estado FROM pago WHERE id = {intencion2.get('pago_id')}")
check('Pago declinado en BD', estado_decl == 'declinado', estado_decl)
status, _ = req('POST', '/pagos/intencion', {'reserva_id': reserva_pago['id']}, tokens_clientes[reserva_pago['cliente']])
check('No repetir intencion con pago existente (409)', status == 409, status)

reserva_emp = reservas[9]
status, data = req('POST', '/pagos/intencion', {'reserva_id': reserva_emp['id']}, tokens_empleados[reserva_emp['empleado']])
check('Empleado crea intencion de su reserva', status == 201, f'{status} {data}')
status, _ = req('POST', '/pagos/intencion', {'reserva_id': reserva_pago['id']}, tokens_empleados[empleados[0]['email']])
check('Empleado no cobra reserva ajena (403)', status == 403, status)
status, _ = req('POST', '/pagos/intencion', {'reserva_id': 999999}, token=admin)
check('Intencion de reserva inexistente (404)', status == 404, status)

print('== Check-in legacy y reportes ==')
reserva_legacy = nuevas[9]
sql(f"UPDATE reserva SET inicia_en = NOW() - INTERVAL '5 minutes', termina_en = NOW() + INTERVAL '20 minutes' WHERE id = {reserva_legacy['id']}")
status, data = req('POST', '/checkin/validar', {'qr_token': reserva_legacy['qr_token'], 'monto': 30000}, token=tokens_empleados[empleados[0]['email']])
check('Check-in legacy con cobro fisico', status == 200 and (data.get('data') or {}).get('estado') == 'cobrado', f'{status} {data}')

hoy_iso = hoy.isoformat()
status, data = req('GET', f'/reportes/ventas-diarias?fecha={hoy_iso}', token=admin)
total_reporte = float((data.get('data') or {}).get('total', 0)) if status == 200 else -1
total_bd = float(sql(f"SELECT COALESCE(SUM(monto), 0) FROM cobro WHERE (cobrado_en AT TIME ZONE 'America/Bogota')::date = '{hoy_iso}'") or 0)
check('Ventas diarias coinciden con la BD', status == 200 and abs(total_reporte - total_bd) < 1, f'{total_reporte} vs {total_bd}')
status, data = req('GET', f'/reportes/ocupacion?fecha={hoy_iso}', token=admin)
check('Reporte de ocupacion', status == 200 and isinstance(data.get('data'), list), status)
status, data = req('GET', '/reportes/clientes-recurrentes', token=admin)
check('Reporte de clientes recurrentes', status == 200, status)

print('== Logs, preferencias y salud ==')
status, data = req('GET', '/logs/actividad', token=admin)
check('Logs de actividad', status == 200 and isinstance(data.get('data'), list), status)
status, data = req('GET', '/logs/errores', token=admin)
check('Logs de errores', status == 200 and isinstance(data.get('data'), list), status)
status, data = req('GET', '/logs/exportar?tipo=actividad', token=admin)
check('Exportar logs', status == 200, status)
status, data = req('PUT', '/preferencias', {'tema': 'oscuro', 'idioma': 'en', 'rango_hora_desde': '07:00', 'rango_hora_hasta': '21:00', 'granularidad_calendario': 15}, token_final)
check('Actualizar preferencias', status == 200, status)
status, data = req('GET', '/preferencias', token=token_final)
check('Consultar preferencias', status == 200 and (data.get('data') or {}).get('idioma') == 'en', data)
status, data = req('GET', '/healthcheck')
check('Healthcheck', status == 200 and (data.get('data') or {}).get('ok', data.get('ok')) is True, data)
status, data = req('GET', '/docs/openapi.json')
check('OpenAPI JSON', status == 200 and data.get('openapi') == '3.0.3', status)

print('== Integridad de datos 10x10 ==')
check('10 clientes en BD', sql("SELECT COUNT(*) FROM app_user WHERE rol='cliente'") == '10', sql("SELECT COUNT(*) FROM app_user WHERE rol='cliente'"))
check('10 empleados en BD', sql("SELECT COUNT(*) FROM app_user WHERE rol='empleado'") == '10', sql("SELECT COUNT(*) FROM app_user WHERE rol='empleado'"))
check('Telefonos cifrados', sql("SELECT COUNT(*) FROM app_user WHERE telefono IS NOT NULL AND telefono NOT LIKE '%:%'") == '0', sql("SELECT COUNT(*) FROM app_user WHERE telefono IS NOT NULL AND telefono NOT LIKE '%:%'"))
check('Sin cobros duplicados', sql('SELECT COUNT(*) FROM (SELECT reserva_id FROM cobro GROUP BY reserva_id HAVING COUNT(*) > 1) t') == '0')
check('Pagos aprobados con cobro', sql("SELECT COUNT(*) FROM pago p LEFT JOIN cobro c ON c.pago_id = p.id WHERE p.estado = 'aprobado' AND c.id IS NULL") == '0')
check('Cobro con pago de otra reserva', sql('SELECT COUNT(*) FROM cobro c JOIN pago p ON p.id = c.pago_id WHERE p.reserva_id <> c.reserva_id') == '0')
check('Reservas cobradas con fin de servicio', sql("SELECT COUNT(*) FROM reserva WHERE estado = 'cobrado' AND fin_servicio IS NULL") == '0')

print('')
print(f'Resultados 10x10: {PASS} pasadas, {FAIL} fallidas')
if ERRORES:
    print('Fallidas:')
    for error in ERRORES:
        print(f' - {error}')
sys.exit(1 if FAIL else 0)
