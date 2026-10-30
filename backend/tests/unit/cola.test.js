const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { pool, crearUsuario, crearSede, crearServicio, limpiar, sufijo } = require('./helpers');
const checkinService = require('../../src/features/checkin/checkin.service');

const ids = { usuarios: [], sedes: [], servicios: [] };

async function crearReserva({ clienteId, empleadoId, servicioId, sedeId, estado = 'confirmada', pago = null }) {
  await pool.query(
    `INSERT INTO empleado_disponibilidad (empleado_id, ubicacion_id, dia_semana, hora_inicio, hora_fin)
     VALUES ($1, $2, EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'America/Bogota')::int, '00:00', '23:59')
     ON CONFLICT (empleado_id, ubicacion_id, dia_semana) DO NOTHING`,
    [empleadoId, sedeId]
  );
  await pool.query(
    `INSERT INTO jornada (ubicacion_id, fecha, hora_inicio, hora_fin)
     VALUES ($1, (NOW() AT TIME ZONE 'America/Bogota')::date, '00:00', '23:59')
     ON CONFLICT (ubicacion_id, fecha) DO NOTHING`,
    [sedeId]
  );
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

  await checkinService.llegada({ qr_token: reserva.qr_token }, usuario);
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

test('cola: confirmar pago acepta QR legado JSON y registra efectivo sin finalizar', async () => {
  const clienteId = await crearUsuario({ rol: 'cliente' });
  const empleadoId = await crearUsuario({ rol: 'empleado', nombre: 'PagoQR', apellido: 'Unit' });
  const sede = await crearSede();
  const servicio = await crearServicio('PagoQR Unit', 30, 30000);
  ids.usuarios.push(clienteId, empleadoId);
  ids.sedes.push(sede.id);
  ids.servicios.push(servicio.id);

  const reserva = await crearReserva({
    clienteId, empleadoId, servicioId: servicio.id, sedeId: sede.id,
  });
  const usuario = { id: empleadoId, rol: 'empleado' };
  const qrLegado = JSON.stringify({ id: reserva.id, qr_token: reserva.qr_token });

  const resultado = await checkinService.confirmarPago({ qr_token: qrLegado, monto: 30000 }, usuario);
  assert.equal(resultado.pagado, true);
  assert.equal(resultado.cobro_metodo, 'fisico');
  assert.equal(resultado.reserva_id, reserva.id);

  const repetido = await checkinService.confirmarPago({ reserva_id: reserva.id, monto: 30000 }, usuario);
  assert.equal(repetido.cobro_id, resultado.cobro_id);

  const { rows } = await pool.query('SELECT estado, fin_servicio FROM reserva WHERE id = $1', [reserva.id]);
  assert.equal(rows[0].estado, 'confirmada');
  assert.equal(rows[0].fin_servicio, null);
});

test('cola: no inicia mas de 30 minutos antes aunque haya llegado', async () => {
  const clienteId = await crearUsuario({ rol: 'cliente' });
  const empleadoId = await crearUsuario({ rol: 'empleado', nombre: 'Temprano', apellido: 'Unit' });
  const sede = await crearSede();
  const servicio = await crearServicio('Temprano Unit', 30, 30000);
  ids.usuarios.push(clienteId, empleadoId);
  ids.sedes.push(sede.id);
  ids.servicios.push(servicio.id);

  const reserva = await crearReserva({
    clienteId, empleadoId, servicioId: servicio.id, sedeId: sede.id, pago: 'aprobado',
  });
  await pool.query(
    `UPDATE reserva SET inicia_en = NOW() + INTERVAL '60 minutes', termina_en = NOW() + INTERVAL '90 minutes' WHERE id = $1`,
    [reserva.id]
  );
  const usuario = { id: empleadoId, rol: 'empleado' };
  await checkinService.llegada({ qr_token: reserva.qr_token }, usuario);
  await assert.rejects(
    () => checkinService.iniciar({ reserva_id: reserva.id }, usuario),
    /Aun no puedes atender/
  );
});

test.after(async () => {
  await limpiar(ids);
  await pool.end();
});
