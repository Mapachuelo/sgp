const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

let modoFetch = 'error';
global.fetch = async () =>
  modoFetch === 'error'
    ? { ok: false, status: 502, text: async () => 'sin red en pruebas' }
    : { ok: true, json: async () => ({ messageId: 'test' }) };

const {
  pool, crearUsuario, crearSede, crearServicio, asignarServicio, crearDisponibilidad,
  limpiar, proximoLunes, sufijo,
} = require('./helpers');
const reservasService = require('../../src/features/reservas/reservas.service');
const authService = require('../../src/features/auth/auth.service');
const clientesService = require('../../src/features/clientes/clientes.service');
const { leerArchivo, exportarLineas, filtrarLogs } = require('../../src/features/logs/logs.service');

const ids = { usuarios: [], sedes: [], servicios: [] };

function instanteBogota(objetivo, hora) {
  const [h, m] = hora.split(':').map(Number);
  return new Date(Date.UTC(objetivo.getFullYear(), objetivo.getMonth(), objetivo.getDate(), h + 5, m, 0)).toISOString();
}

test('reservas: CRUD de servicios y validaciones del catalogo', async () => {
  await assert.rejects(() => reservasService.createServicio({}), /requeridos/);
  const servicio = await reservasService.createServicio({ nombre: `Cat ${sufijo()}`, precio_base: 10000, duracion_base_minutos: 20 });
  ids.servicios.push(servicio.id);

  const listado = await reservasService.getServicios();
  assert.ok(listado.some((s) => s.id === servicio.id));

  const actualizado = await reservasService.updateServicio(servicio.id, { precio_base: 12000 });
  assert.equal(Number(actualizado.precio_base), 12000);
  await assert.rejects(() => reservasService.updateServicio(999999, { nombre: 'x' }), /no encontrado/);

  await reservasService.deleteServicio(servicio.id);
  await assert.rejects(() => reservasService.deleteServicio(servicio.id), /no encontrado/);
});

test('reservas: jornada por sede', async () => {
  const sede = await crearSede();
  ids.sedes.push(sede.id);

  assert.deepEqual(await reservasService.getJornada(sede.id), []);

  await reservasService.updateJornada(sede.id, [
    { fecha: '2026-11-02', hora_inicio: '09:00', hora_fin: '18:00' },
    { fecha: '2026-11-03', hora_inicio: '10:00', hora_fin: '19:00' },
  ]);
  const jornadas = await reservasService.getJornada(sede.id);
  assert.equal(jornadas.length, 2);
});

test('reservas: tiempos de servicio por empleado', async () => {
  const empleadoId = await crearUsuario({ rol: 'empleado' });
  const servicio = await crearServicio('Cat Tiempos', 30, 30000);
  ids.usuarios.push(empleadoId);
  ids.servicios.push(servicio.id);

  await reservasService.updateEmpleadoTiemposServicio(empleadoId, [
    { servicio_id: servicio.id, duracion_minutos: 35 },
  ]);
  const tiempos = await reservasService.getEmpleadoTiemposServicio(empleadoId);
  assert.equal(tiempos.length, 1);
  assert.equal(tiempos[0].duracion_minutos, 35);

  const todos = await reservasService.getEmpleadoTiemposServicio(null);
  assert.ok(todos.length >= 1);
});

test('reservas: getAllReservas con filtros y agenda por rango', async () => {
  const clienteId = await crearUsuario({ rol: 'cliente' });
  const empleadoId = await crearUsuario({ rol: 'empleado' });
  const sede = await crearSede();
  const servicio = await crearServicio('Cat Agenda', 30, 30000);
  ids.usuarios.push(clienteId, empleadoId);
  ids.sedes.push(sede.id);
  ids.servicios.push(servicio.id);

  await asignarServicio(empleadoId, servicio.id, 30);
  await crearDisponibilidad(empleadoId, sede.id, 1, '09:00', '18:00');

  const lunes = proximoLunes();
  const fecha = `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`;
  const reserva = await reservasService.createReserva(clienteId, {
    empleado_id: empleadoId, servicio_id: servicio.id, ubicacion_id: sede.id,
    inicia_en: instanteBogota(lunes, '09:30'), cantidad_personas: 1,
  });

  const filtradas = await reservasService.getAllReservas({ fecha, empleado_id: empleadoId, ubicacion_id: sede.id, estado: 'pendiente' });
  assert.ok(filtradas.some((r) => r.id === reserva.id));

  const agenda = await reservasService.getAgenda({ desde: fecha, hasta: fecha, empleado_id: empleadoId });
  assert.ok(agenda.some((r) => r.id === reserva.id));
  assert.equal(agenda[0].ubicacion_nombre, sede.nombre);

  await assert.rejects(() => reservasService.getAgenda({ desde: '2026-99-99', hasta: fecha }), /formato/);
  await assert.rejects(() => reservasService.getAgenda({ desde: fecha, hasta: 'x' }), /formato/);
  await assert.rejects(() => reservasService.getAgenda({ desde: '2099-01-02', hasta: '2099-01-01' }), /mayor/);
});

test('reservas: getDisponibilidad exige parametros', async () => {
  await assert.rejects(() => reservasService.getDisponibilidad({}), /requeridos/);
});

test('auth: empleados CRUD y verificacion/reenevio exitosos', async () => {
  const email = `emp.${sufijo()}@unit.local`;
  const empleado = await authService.createEmpleado({
    email, nombre: 'Emp', apellido: 'Unit', telefono: '+573001112244', identificacion: '123',
  });
  ids.usuarios.push(empleado.id);
  assert.equal(empleado.rol, 'empleado');

  await assert.rejects(() => authService.createEmpleado({ email, nombre: 'Dup' }), /ya esta registrado/);
  await assert.rejects(() => authService.updateEmpleado(empleado.id, { telefono: '300' }), /telefono/);
  await assert.rejects(() => authService.updateEmpleado(999999, { nombre: 'x' }), /no encontrado/);

  const actualizado = await authService.updateEmpleado(empleado.id, { identificacion: '999', nombre: 'Emp2', password: 'nueva123' });
  assert.equal(actualizado.identificacion, '999');
  assert.equal(actualizado.nombre, 'Emp2');

  const nuevosEmpleados = await authService.getMe(empleado.id);
  assert.equal(nuevosEmpleados.email, email);

  const { rows: listado } = await pool.query("SELECT id FROM app_user WHERE rol = 'empleado' AND email = $1", [email]);
  assert.equal(listado.length, 1);

  await assert.rejects(() => authService.deleteEmpleado(999999), /no encontrado/);

  const emailOtp = `otp.${sufijo()}@unit.local`;
  const registro = await authService.register({ email: emailOtp, password: 'test1234', nombre: 'Otp', apellido: 'Unit', telefono: '+573001112255' });
  ids.usuarios.push(registro.usuario.id);
  const hash = crypto.createHash('sha256').update('123456').digest('hex');
  await pool.query('UPDATE app_user SET token_verificacion = $2, token_verificacion_expiracion = NOW() + INTERVAL \'10 minutes\' WHERE id = $1', [registro.usuario.id, hash]);

  const verificado = await authService.verificar({ email: emailOtp, codigo: '123456' });
  assert.ok(verificado.token);
  assert.equal(verificado.usuario.verificado, true);
  await assert.rejects(() => authService.verificar({ email: emailOtp, codigo: '123456' }), /ya esta verificada/);
  await assert.rejects(() => authService.reenviarCodigo(emailOtp), /ya esta verificada/);

  const emailReenvio = `reenvio.${sufijo()}@unit.local`;
  const registro2 = await authService.register({ email: emailReenvio, password: 'test1234', nombre: 'Re', apellido: 'Unit', telefono: '+573001112266' });
  ids.usuarios.push(registro2.usuario.id);
  modoFetch = 'ok';
  const reenviado = await authService.reenviarCodigo(emailReenvio);
  modoFetch = 'error';
  assert.equal(reenviado.reenviado, true);

  await authService.deleteEmpleado(empleado.id);
  ids.usuarios = ids.usuarios.filter((id) => id !== empleado.id);
});

test('clientes: identificacion de empleado y borrado propio', async () => {
  const empleadoId = await crearUsuario({ rol: 'empleado' });
  const clienteId = await crearUsuario({ rol: 'cliente' });
  ids.usuarios.push(empleadoId, clienteId);

  const perfil = await clientesService.updateMe(empleadoId, { identificacion: 'ABC-123' });
  assert.equal(perfil.identificacion, 'ABC-123');

  const eliminado = await clientesService.deleteMe(clienteId);
  assert.equal(eliminado.eliminado, true);
  await assert.rejects(() => clientesService.deleteMe(clienteId), /no encontrado/);
});

test('logs: leer archivo real, inexistente y export con limites', () => {
  const lineas = leerArchivo('logs.txt');
  assert.ok(Array.isArray(lineas));

  assert.deepEqual(leerArchivo('archivo-inexistente.txt'), []);
  assert.deepEqual(exportarLineas([], 0, 5), []);

  const muestra = [
    { level: 30, time: Date.now(), msg: 'uno' },
    { level: 40, time: Date.now(), msg: 'dos' },
  ];
  assert.equal(exportarLineas(muestra, 0, 1).length, 1);
  assert.equal(filtrarLogs(muestra, { severidad: 'WARN' }).length, 1);
});

test.after(async () => {
  await limpiar(ids);
  await pool.end();
});
