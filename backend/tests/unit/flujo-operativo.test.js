const test = require('node:test');
const assert = require('node:assert/strict');

global.fetch = async () => ({ ok: false, status: 502, text: async () => 'sin red en pruebas' });

const {
  pool, crearUsuario, crearSede, crearServicio, asignarServicio,
  crearDisponibilidad, limpiar, proximoLunes, sufijo,
} = require('./helpers');
const authService = require('../../src/features/auth/auth.service');
const clientesService = require('../../src/features/clientes/clientes.service');
const reservasService = require('../../src/features/reservas/reservas.service');
const disponibilidadService = require('../../src/features/disponibilidad/disponibilidad.service');
const checkinService = require('../../src/features/checkin/checkin.service');
const { purgarNoVerificados } = require('../../src/features/auth/purga.service');

const ids = { usuarios: [], sedes: [], servicios: [] };

function instanteBogota(objetivo, hora) {
  const [h, m] = hora.split(':').map(Number);
  return new Date(Date.UTC(objetivo.getFullYear(), objetivo.getMonth(), objetivo.getDate(), h + 5, m, 0)).toISOString();
}

test('auth: registro valida formato, evita duplicados y bloquea sin verificar', async () => {
  await assert.rejects(
    () => authService.register({ email: 'mal', password: 'x', nombre: 'A', apellido: 'B', telefono: '+573001112233' }),
    /correo/
  );
  await assert.rejects(
    () => authService.register({ email: `t.${sufijo()}@unit.local`, password: 'x', nombre: 'A', apellido: 'B', telefono: '300' }),
    /telefono/
  );

  const email = `auth.${sufijo()}@unit.local`;
  const registro = await authService.register({
    email, password: 'test1234', nombre: 'Ana', apellido: 'Unit', telefono: '+573001112233',
  });
  assert.equal(registro.correoEnviado, false);
  assert.ok(registro.expiraEn);
  ids.usuarios.push(registro.usuario.id);

  const reemplazo = await authService.register({
    email, password: 'test1234', nombre: 'Ana', apellido: 'Unit', telefono: '+573001112233',
  });
  assert.equal(reemplazo.correoEnviado, false);
  assert.notEqual(reemplazo.usuario.id, registro.usuario.id);
  ids.usuarios = ids.usuarios.filter((id) => id !== registro.usuario.id);
  ids.usuarios.push(reemplazo.usuario.id);

  const emailVerificado = `verificado.${sufijo()}@unit.local`;
  const verificadoId = await crearUsuario({ email: emailVerificado, password: 'test1234' });
  ids.usuarios.push(verificadoId);
  await assert.rejects(
    () => authService.register({ email: emailVerificado, password: 'test1234', nombre: 'A', apellido: 'B', telefono: '+573001112233' }),
    /ya esta registrado/
  );

  await assert.rejects(() => authService.login(email, 'test1234'), /no verificada/);
  await assert.rejects(() => authService.verificar({ email, codigo: '000000' }), /incorrecto/);
  await assert.rejects(() => authService.reenviarCodigo(`nadie.${sufijo()}@unit.local`), /no encontrado/);
});

test('registro: reemplaza correos sin verificar y purga los expirados', async () => {
  const email = `purga.${sufijo()}@unit.local`;
  const primero = await authService.register({
    email, password: 'test1234', nombre: 'Purga', apellido: 'Unit', telefono: '+573001112277',
  });
  assert.equal(primero.correoEnviado, false);

  const segundo = await authService.register({
    email, password: 'test1234', nombre: 'Purga', apellido: 'Unit', telefono: '+573001112277',
  });
  assert.notEqual(segundo.usuario.id, primero.usuario.id);
  const { rows: filas } = await pool.query('SELECT COUNT(*)::int AS n FROM app_user WHERE email = $1', [email]);
  assert.equal(filas[0].n, 1);

  await pool.query(
    "UPDATE app_user SET token_verificacion_expiracion = NOW() - INTERVAL '1 minute' WHERE email = $1",
    [email]
  );
  const eliminados = await purgarNoVerificados();
  assert.ok(eliminados >= 1);
  const { rows: restantes } = await pool.query('SELECT COUNT(*)::int AS n FROM app_user WHERE email = $1', [email]);
  assert.equal(restantes[0].n, 0);

  const vigente = await authService.register({
    email: `vigente.${sufijo()}@unit.local`,
    password: 'test1234', nombre: 'Vigente', apellido: 'Unit', telefono: '+573001112288',
  });
  ids.usuarios.push(vigente.usuario.id);
  await purgarNoVerificados();
  const { rows: vivos } = await pool.query('SELECT COUNT(*)::int AS n FROM app_user WHERE id = $1', [vigente.usuario.id]);
  assert.equal(vivos[0].n, 1);
});

test('auth: login, me y sesion de usuario verificado', async () => {
  const email = `login.${sufijo()}@unit.local`;
  const id = await crearUsuario({ email, password: 'test1234' });
  ids.usuarios.push(id);

  const sesion = await authService.login(email, 'test1234');
  assert.ok(sesion.token);
  assert.equal(sesion.rol, 'cliente');

  await assert.rejects(() => authService.login(email, 'incorrecta'), /Credenciales/);

  const perfil = await authService.getMe(id);
  assert.equal(perfil.email, email);
});

test('clientes: perfil cifrado, moderacion y eliminacion', async () => {
  const adminId = await crearUsuario({ rol: 'admin' });
  const clienteId = await crearUsuario({ rol: 'cliente' });
  ids.usuarios.push(adminId, clienteId);

  await assert.rejects(() => clientesService.updateMe(clienteId, { telefono: '300' }), /telefono/);
  await assert.rejects(() => clientesService.updateMe(clienteId, { email: 'mal' }), /correo/);

  const actualizado = await clientesService.updateMe(clienteId, { telefono: '+573009998877', nombre: 'Nuevo' });
  assert.equal(actualizado.telefono, '+573009998877');
  assert.equal(actualizado.nombre, 'Nuevo');

  const leido = await clientesService.getMe(clienteId);
  assert.equal(leido.telefono, '+573009998877');

  const bloqueado = await clientesService.bloquear(clienteId, 'spam', adminId);
  assert.equal(bloqueado.esta_bloqueado, true);
  const desbloqueado = await clientesService.desbloquear(clienteId);
  assert.equal(desbloqueado.esta_bloqueado, false);

  await assert.rejects(() => clientesService.deleteCliente(clienteId), /no-shows/);

  const listado = await clientesService.findAll();
  assert.ok(Array.isArray(listado));
});

test('reservas: validaciones, creacion, disponibilidad y cancelacion', async () => {
  const clienteId = await crearUsuario({ rol: 'cliente' });
  const otroCliente = await crearUsuario({ rol: 'cliente' });
  const empleadoId = await crearUsuario({ rol: 'empleado', nombre: 'Estilista', apellido: 'Unit' });
  const sedeA = await crearSede();
  const servicio = await crearServicio('Unit Corte', 30, 30000);
  const servicioSinAsignar = await crearServicio('Unit Tinte', 60, 60000);
  ids.usuarios.push(clienteId, otroCliente, empleadoId);
  ids.sedes.push(sedeA.id);
  ids.servicios.push(servicio.id, servicioSinAsignar.id);

  await asignarServicio(empleadoId, servicio.id, 30);
  await crearDisponibilidad(empleadoId, sedeA.id, 1, '09:00', '18:00');

  const lunes = proximoLunes();

  await assert.rejects(() => reservasService.createReserva(clienteId, {}), /requeridos/);
  await assert.rejects(
    () => reservasService.createReserva(clienteId, {
      empleado_id: empleadoId, servicio_id: servicio.id, ubicacion_id: sedeA.id,
      inicia_en: new Date(Date.now() + 10 * 60000).toISOString(), cantidad_personas: 1,
    }),
    /60 minutos/
  );
  await assert.rejects(
    () => reservasService.createReserva(clienteId, {
      empleado_id: empleadoId, servicio_id: servicio.id, ubicacion_id: sedeA.id,
      inicia_en: instanteBogota(lunes, '10:00'), cantidad_personas: 9,
    }),
    /cantidad_personas/
  );
  await assert.rejects(
    () => reservasService.createReserva(clienteId, {
      empleado_id: empleadoId, servicio_id: servicioSinAsignar.id, ubicacion_id: sedeA.id,
      inicia_en: instanteBogota(lunes, '10:00'), cantidad_personas: 1,
    }),
    /no ofrece/
  );
  await assert.rejects(
    () => reservasService.createReserva(clienteId, {
      empleado_id: empleadoId, servicio_id: servicio.id, ubicacion_id: sedeA.id,
      inicia_en: instanteBogota(lunes, '07:00'), cantidad_personas: 1,
    }),
    /fuera de la disponibilidad/
  );

  const reserva = await reservasService.createReserva(clienteId, {
    empleado_id: empleadoId, servicio_id: servicio.id, ubicacion_id: sedeA.id,
    inicia_en: instanteBogota(lunes, '10:00'), cantidad_personas: 2,
  });
  assert.ok(reserva.qr_token);
  const duracion = new Date(reserva.termina_en) - new Date(reserva.inicia_en);
  assert.equal(duracion, 30 * 60000);

  await assert.rejects(
    () => reservasService.createReserva(clienteId, {
      empleado_id: empleadoId, servicio_id: servicio.id, ubicacion_id: sedeA.id,
      inicia_en: instanteBogota(lunes, '10:00'), cantidad_personas: 1,
    }),
    /se superpone/
  );

  const mias = await reservasService.getReservasByCliente(clienteId);
  assert.equal(mias.length, 1);

  await assert.rejects(() => reservasService.cancelReserva(reserva.id, otroCliente), /No puede cancelar/);
  const cancelada = await reservasService.cancelReserva(reserva.id, clienteId);
  assert.equal(cancelada.estado, 'cancelada');
  await assert.rejects(() => reservasService.cancelReserva(reserva.id, clienteId), /ya esta cancelada/);

  const disponibilidad = await reservasService.getDisponibilidad({
    fecha: `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`,
    empleado_id: empleadoId,
    ubicacion_id: sedeA.id,
  });
  assert.equal(disponibilidad.dia_semana, 1);
  assert.ok(disponibilidad.disponibilidad_empleado);

  ids.reservas = [reserva.id];
});

test('disponibilidad: bloquea dia duplicado y cancela reservas al cambiar de sede (RF9)', async () => {
  const clienteId = await crearUsuario({ rol: 'cliente' });
  const empleadoId = await crearUsuario({ rol: 'empleado', nombre: 'Multi', apellido: 'Sede' });
  const sedeA = await crearSede();
  const sedeB = await crearSede();
  const servicio = await crearServicio('Unit Barba', 20, 20000);
  ids.usuarios.push(clienteId, empleadoId);
  ids.sedes.push(sedeA.id, sedeB.id);
  ids.servicios.push(servicio.id);

  await asignarServicio(empleadoId, servicio.id, 20);
  await crearDisponibilidad(empleadoId, sedeA.id, 1, '09:00', '18:00');

  await assert.rejects(
    () => disponibilidadService.updateDisponibilidad(empleadoId, [
      { dia_semana: 1, ubicacion_id: sedeA.id, hora_inicio: '09:00', hora_fin: '18:00' },
      { dia_semana: 1, ubicacion_id: sedeB.id, hora_inicio: '09:00', hora_fin: '18:00' },
    ]),
    /más de una sede/
  );

  const lunes = proximoLunes();
  const reserva = await reservasService.createReserva(clienteId, {
    empleado_id: empleadoId, servicio_id: servicio.id, ubicacion_id: sedeA.id,
    inicia_en: instanteBogota(lunes, '11:00'), cantidad_personas: 1,
  });

  const resultado = await disponibilidadService.updateDisponibilidad(empleadoId, [
    { dia_semana: 1, ubicacion_id: sedeB.id, hora_inicio: '09:00', hora_fin: '18:00' },
  ]);
  assert.deepEqual(resultado.reservas_canceladas, [reserva.id]);
  assert.equal(resultado.motivo_cancelacion, 'El empleado cambió de sede');

  const { rows } = await pool.query('SELECT estado, motivo_cancelacion FROM reserva WHERE id = $1', [reserva.id]);
  assert.equal(rows[0].estado, 'cancelada');
  assert.equal(rows[0].motivo_cancelacion, 'El empleado cambió de sede');
});

test('checkin: validaciones y cobro atomico', async () => {
  const clienteId = await crearUsuario({ rol: 'cliente' });
  const empleadoId = await crearUsuario({ rol: 'empleado', nombre: 'Cobro', apellido: 'Unit' });
  const sede = await crearSede();
  const servicio = await crearServicio('Unit Corte Nino', 25, 25000);
  ids.usuarios.push(clienteId, empleadoId);
  ids.sedes.push(sede.id);
  ids.servicios.push(servicio.id);

  await asignarServicio(empleadoId, servicio.id, 25);
  await crearDisponibilidad(empleadoId, sede.id, 1, '09:00', '18:00');

  const lunes = proximoLunes();
  const reserva = await reservasService.createReserva(clienteId, {
    empleado_id: empleadoId, servicio_id: servicio.id, ubicacion_id: sede.id,
    inicia_en: instanteBogota(lunes, '12:00'), cantidad_personas: 1,
  });
  await pool.query(
    "UPDATE reserva SET inicia_en = NOW() - INTERVAL '5 minutes', termina_en = NOW() + INTERVAL '20 minutes', estado = 'pendiente' WHERE id = $1",
    [reserva.id]
  );

  await assert.rejects(() => checkinService.validar({ qr_token: 'no-es-uuid', monto: 0 }, empleadoId), /UUID/);
  await assert.rejects(() => checkinService.validar({ qr_token: reserva.qr_token, monto: -5 }, empleadoId), /monto/);
  await assert.rejects(
    () => checkinService.validar({ qr_token: '00000000-0000-4000-8000-000000000000', monto: 0 }, empleadoId),
    /no encontrada/
  );

  const resultado = await checkinService.validar({ qr_token: reserva.qr_token, monto: 25000 }, empleadoId);
  assert.equal(resultado.estado, 'cobrado');
  assert.equal(resultado.metodo, 'fisico');
  assert.equal(resultado.monto, 25000);
  assert.ok(resultado.cliente_nombre);

  await assert.rejects(() => checkinService.validar({ qr_token: reserva.qr_token, monto: 0 }, empleadoId), /ya fue cobrada/);

  const { rows } = await pool.query('SELECT estado FROM reserva WHERE id = $1', [reserva.id]);
  assert.equal(rows[0].estado, 'cobrado');
});

test.after(async () => {
  await limpiar(ids);
  await pool.end();
});
