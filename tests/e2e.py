#!/usr/bin/env python3
"""Pruebas de extremo a extremo del SGP (API + BD).

Requiere el stack desplegado (pod sgp-db y sgp-app). Variables opcionales:
  BASE_URL      (default http://localhost:8080/api)
  DB_CONTENEDOR (default sgp-db-db)
  DB_USUARIO    (default sgp_user)
  DB_NOMBRE     (default sgp)
"""
import json
import os
import subprocess
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


def check(desc, condicion, detalle=''):
    global PASS, FAIL
    if condicion:
        PASS += 1
        print(f'PASS: {desc}')
    else:
        FAIL += 1
        print(f'FAIL: {desc} {detalle}')


def req(metodo, ruta, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    request = urllib.request.Request(f'{BASE}{ruta}', data=data, headers=headers, method=metodo)
    try:
        with urllib.request.urlopen(request) as res:
            return res.status, json.loads(res.read().decode() or '{}')
    except urllib.error.HTTPError as err:
        try:
            return err.code, json.loads(err.read().decode() or '{}')
        except Exception:
            return err.code, {}


def sql(consulta):
    resultado = subprocess.run(
        ['podman', 'exec', DB_CONTENEDOR, 'psql', '-U', DB_USUARIO, '-d', DB_NOMBRE, '-t', '-A', '-c', consulta],
        capture_output=True, text=True,
    )
    return resultado.stdout


email = f'e2e.{int(time.time())}@correo.com'
password = 'clave123'

status, data = req('POST', '/auth/register', {
    'nombre': 'E2E', 'apellido': 'Cliente', 'email': email,
    'password': password, 'telefono': '+573001234567',
})
check('Registro cliente E2E', status == 201 and 'expiraEn' in (data.get('data') or {}), status)

status, _ = req('POST', '/auth/login', {'email': email, 'password': password})
check('Login sin verificar devuelve 403', status == 403, status)

status, data = req('POST', '/auth/register', {
    'nombre': 'E2E', 'apellido': 'Cliente', 'email': email,
    'password': password, 'telefono': '+573001234567',
})
check('Re-registro sin verificar reemplaza (201)', status == 201, status)
filas = sql(f"SELECT COUNT(*) FROM app_user WHERE email = '{email}'").strip()
check('Solo queda una fila del correo', filas == '1', filas)

sql(f"UPDATE app_user SET verificado = TRUE WHERE email = '{email}'")

_, data = req('POST', '/auth/login', {'email': email, 'password': password})
token_cli = data.get('data', {}).get('token')
check('Login cliente verificado', bool(token_cli))

_, data = req('POST', '/auth/login', {'email': 'admin@sgp.local', 'password': 'admin123'})
token_admin = data.get('data', {}).get('token')
check('Login admin', bool(token_admin))

_, data = req('POST', '/auth/login', {'email': 'empleado@sgp.local', 'password': 'empleado123'})
token_emp = data.get('data', {}).get('token')
check('Login empleado', bool(token_emp))

hoy_bogota = datetime.now(BOGOTA)
dias_hasta_lunes = (7 - hoy_bogota.weekday()) % 7 or 7
lunes = (hoy_bogota + timedelta(days=dias_hasta_lunes)).date()
inicio_local = datetime(lunes.year, lunes.month, lunes.day, 10, 0, tzinfo=BOGOTA)
inicia_en = inicio_local.astimezone(ZoneInfo('UTC')).isoformat().replace('+00:00', 'Z')

status, data = req('POST', '/reservas', {
    'empleado_id': 2, 'servicio_id': 1, 'ubicacion_id': 1,
    'inicia_en': inicia_en, 'cantidad_personas': 2,
}, token_cli)
reserva = data.get('data') or {}
check('Crear reserva RF2 (con QR)', status == 201 and bool(reserva.get('qr_token')), f'{status} {data}')
inicio_dt = datetime.fromisoformat(reserva.get('inicia_en', '').replace('Z', '+00:00'))
fin_dt = datetime.fromisoformat(reserva.get('termina_en', '').replace('Z', '+00:00'))
check('Duracion estimada = 30 min del servicio', (fin_dt - inicio_dt) == timedelta(minutes=30), (fin_dt - inicio_dt))
qr = reserva.get('qr_token')

status, data = req('POST', '/reservas', {
    'empleado_id': 2, 'servicio_id': 1, 'ubicacion_id': 1,
    'inicia_en': inicia_en, 'cantidad_personas': 1,
}, token_cli)
check('Solape de reserva rechazado (409)', status == 409, status)

status, data = req('GET', '/reservas/me', token=token_cli)
check('GET /reservas/me devuelve la reserva', status == 200 and len(data.get('data', [])) == 1, status)

inicio2_local = datetime(lunes.year, lunes.month, lunes.day, 11, 0, tzinfo=BOGOTA)
inicia2 = inicio2_local.astimezone(ZoneInfo('UTC')).isoformat().replace('+00:00', 'Z')
status, data = req('POST', '/reservas', {
    'empleado_id': 2, 'servicio_id': 2, 'ubicacion_id': 1,
    'inicia_en': inicia2, 'cantidad_personas': 1,
}, token_cli)
reserva2 = data.get('data') or {}
check('Segunda reserva creada (RF9)', status == 201 and bool(reserva2.get('id')), f'{status} {data}')

sql(f"UPDATE reserva SET inicia_en = NOW() - INTERVAL '10 minutes', termina_en = NOW() + INTERVAL '20 minutes' WHERE id = {reserva.get('id')}")

status, data = req('POST', '/checkin/validar', {'qr_token': qr, 'monto': 25000}, token_emp)
resultado = data.get('data') or {}
check('Check-in + cobro deja estado cobrado', status == 200 and resultado.get('estado') == 'cobrado', f'{status} {data}')
check('Metodo fisico con monto > 0', resultado.get('metodo') == 'fisico', resultado.get('metodo'))
check('Nombre de cliente en respuesta', bool(resultado.get('cliente_nombre')), resultado)

status, data = req('POST', '/checkin/validar', {'qr_token': qr, 'monto': 25000}, token_emp)
check('Doble cobro rechazado (409)', status == 409, f'{status} {data}')

status, data = req('POST', '/ubicaciones', {
    'nombre': f'Sede E2E {int(time.time())}', 'direccion': 'Calle 1 #2-3, Bogota',
    'latitud': 4.65, 'longitud': -74.05,
}, token_admin)
sede2 = (data.get('data') or {}).get('id')
check('Crear sede adicional', status == 201 and bool(sede2), f'{status} {data}')

status, data = req('GET', '/empleados/2/disponibilidad', token=token_admin)
bloques = data.get('data') or []
check('Disponibilidad actual del empleado', status == 200 and len(bloques) >= 5, len(bloques))

iso_lunes = lunes.isoweekday()
nuevos = []
for b in bloques:
    if b['dia_semana'] == iso_lunes:
        nuevos.append({'dia_semana': iso_lunes, 'ubicacion_id': sede2, 'hora_inicio': '09:00', 'hora_fin': '18:00'})
    else:
        nuevos.append({'dia_semana': b['dia_semana'], 'ubicacion_id': b['ubicacion_id'], 'hora_inicio': b['hora_inicio'], 'hora_fin': b['hora_fin']})

status, data = req('PUT', '/empleados/2/disponibilidad', nuevos, token_admin)
resultado = data.get('data') or {}
check('Cambio de sede cancela solo la reserva pendiente', status == 200 and resultado.get('reservas_canceladas') == [reserva2.get('id')], f'{status} {data}')
check('Motivo de cancelacion exacto', resultado.get('motivo_cancelacion') == 'El empleado cambió de sede', resultado.get('motivo_cancelacion'))

out = sql(f"SELECT motivo_cancelacion FROM reserva WHERE id = {reserva2.get('id')}")
check('Motivo persistido en BD', 'El empleado cambió de sede' in out, out.strip())

status, data = req('PUT', '/empleados/2/disponibilidad', bloques, token_admin)
check('Restaurar disponibilidad del seed', status == 200, status)

status, data = req('GET', f"/reportes/ocupacion?fecha={datetime.now(BOGOTA).date().isoformat()}", token=token_admin)
filas = data.get('data') or []
con_datos = next((f for f in filas if f.get('total')), None)
check('Reporte ocupacion con total y porcentaje', bool(con_datos) and float(con_datos.get('porcentaje', 0)) > 0, filas)

hoy = datetime.now(BOGOTA).date().isoformat()
status, data = req('GET', f'/reportes/ventas-diarias?fecha={hoy}', token=token_admin)
check('Reporte ventas del dia con total', status == 200 and float((data.get('data') or {}).get('total', 0)) >= 25000, data.get('data'))

status, data = req('GET', '/reportes/ocupacion', token=token_admin)
check('Ocupacion sin fecha usa hoy', status == 200, status)

status, data = req('GET', f"/reservas/agenda?desde={hoy}&hasta={hoy}", token=token_admin)
check('Agenda admin responde 200', status == 200, status)
status, _ = req('GET', '/reservas/agenda?desde=mal&hasta=mal', token=token_admin)
check('Agenda con fecha invalida responde 400', status == 400, status)

status, data = req('GET', '/empleados/disponibilidad/todas', token=token_admin)
check('Disponibilidad completa admin responde 200', status == 200, status)

sql(f"DELETE FROM app_user WHERE email = '{email}'")
sql(f"DELETE FROM ubicacion WHERE id = {sede2}")
status, data = req('DELETE', f'/ubicaciones/{sede2}', token=token_admin)
check('Eliminar sede E2E', status == 200 or status == 404, status)

print(f'\nResultados E2E: {PASS} pasadas, {FAIL} fallidas')
raise SystemExit(FAIL)
