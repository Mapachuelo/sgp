const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { pool, crearUsuario, crearSede, crearServicio, limpiar, sufijo } = require('./helpers');
const checkinService = require('../../src/features/checkin/checkin.service');

const ids = { usuarios: [], sedes: [], servicios: [] };

async function crearReserva({ clienteId, empleadoId, servicioId, sedeId, estado = 'confirmada', pago = null }) {
  const qrToken = crypto.randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO reserva
       (cliente_id, empleado_id, servicio_id, ubicacion_id, inicia_en, termina_en,
        cantidad_personas, estado, qr_token)
     VALUES ($1, $2, $3, $4, NOW() - INTERVAL '5 minutes', NOW() + INTERVAL '25 minutes', 1, $5, $6)
     RETURNING *`,
    [clienteId, empleadoId, servicioId, sedeId, estado, qrToken]
  );
  const reserva = rows[0];
  if (pago === 'aprobado') {
    await pool.query(
      `INSERT INTO pago (reserva_id, referencia, transaction_id, monto, metodo, estado, actualizado_en)
       VALUES ($1, $2, $3, 30000, 'CARD', 'aprobado', NOW() - INTERVAL '10 minutes')`,
      [reserva.id, `UNIT-${sufijo()}`, `TX-UNIT-${sufijo()}`]
    );
  }
  return reserva;
}

test('cola: llegada, pago en efectivo, inicio y finalizacion', async () => {
  const clienteId = await crearUsuario({ rol: 'cliente' });
  const empleadoId = await crearUsuario({ rol: 'empleado', nombre: 'Cola', apellido: 'Unit' });
  const sede = await crearSede();
  const servicio = await crearServicio('Cola Unit', 30, 30000);
  ids.usuarios.push(clienteId, empleadoId);
  ids.sedes.push(sede.id);
  ids.servicios.push(servicio.id);

  const reserva = await crearReserva({
    clienteId, empleadoId, servicioId: servicio.id, sedeId: sede.id,
  });
  const usuario = { id: empleadoId, rol: 'empleado' };

  const consulta = await checkinService.consultar({ qr_token: reserva.qr_token }, usuario);
  assert.equal(consulta.pagado, false);
  assert.equal(consulta.puede_iniciar, false);

  const llegada = await checkinService.llegada({ qr_token: reserva.qr_token }, usuario);
  assert.ok(llegada.llego_en);

  await assert.rejects(
    () => checkinService.iniciar({ reserva_id: reserva.id }, usuario),
    /Pago pendiente/
  );

  const cobro = await checkinService.cobroEfectivo({ reserva_id: reserva.id, monto: 30000 }, usuario);
  assert.equal(cobro.pagado, true);
  assert.equal(cobro.cobro_metodo, 'fisico');

  const inicio = await checkinService.iniciar({ reserva_id: reserva.id }, usuario);
  assert.equal(inicio.estado, 'en_curso');
  assert.ok(inicio.inicio_servicio);

  const fin = await checkinService.finalizar({ reserva_id: reserva.id }, usuario);
  assert.equal(fin.estado, 'cobrado');
  assert.ok(fin.fin_servicio);
  assert.equal(fin.monto, 30000);
});

test('cola: pago aprobado se vincula al cobro y permite iniciar', async () => {
  const clienteId = await crearUsuario({ rol: 'cliente' });
  const empleadoId = await crearUsuario({ rol: 'empleado', nombre: 'Pago', apellido: 'Unit' });
  const sede = await crearSede();
  const servicio = await crearServicio('Pago Unit', 30, 30000);
  ids.usuarios.push(clienteId, empleadoId);
  ids.sedes.push(sede.id);
  ids.servicios.push(servicio.id);

  const reserva = await crearReserva({
    clienteId, empleadoId, servicioId: servicio.id, sedeId: sede.id, pago: 'aprobado',
  });
  const usuario = { id: empleadoId, rol: 'empleado' };

  const consulta = await checkinService.consultar({ qr_token: reserva.qr_token }, usuario);
  assert.equal(consulta.pagado, true);
  assert.equal(consulta.pago_estado, 'aprobado');
  assert.equal(consulta.puede_iniciar, true);

  const inicio = await checkinService.iniciar({ reserva_id: reserva.id }, usuario);
  assert.equal(inicio.estado, 'en_curso');
  assert.equal(inicio.pagado_online, true);
  assert.equal(inicio.pagado_antes, true);
  assert.ok(inicio.pago_id);

  const { rows } = await pool.query('SELECT pago_id FROM cobro WHERE reserva_id = $1', [reserva.id]);
  assert.equal(rows[0].pago_id, inicio.pago_id);
});

test('cola: un empleado no puede operar la reserva de otro', async () => {
  const clienteId = await crearUsuario({ rol: 'cliente' });
  const empleadoId = await crearUsuario({ rol: 'empleado', nombre: 'Dueno', apellido: 'Unit' });
  const otroEmpleadoId = await crearUsuario({ rol: 'empleado', nombre: 'Otro', apellido: 'Unit' });
  const sede = await crearSede();
  const servicio = await crearServicio('Acceso Unit', 30, 30000);
  ids.usuarios.push(clienteId, empleadoId, otroEmpleadoId);
  ids.sedes.push(sede.id);
  ids.servicios.push(servicio.id);

  const reserva = await crearReserva({
    clienteId, empleadoId, servicioId: servicio.id, sedeId: sede.id, pago: 'aprobado',
  });

  await assert.rejects(
    () => checkinService.consultar({ qr_token: reserva.qr_token }, { id: otroEmpleadoId, rol: 'empleado' }),
    /otro empleado/
  );
});

test.after(async () => {
  await limpiar(ids);
  await pool.end();
});
