const test = require('node:test');
const assert = require('node:assert/strict');
const {
  pool, crearUsuario, crearSede, crearServicio, asignarServicio,
  crearDisponibilidad, limpiar, proximoLunes,
} = require('./helpers');
const reservasService = require('../../src/features/reservas/reservas.service');
const disponibilidadService = require('../../src/features/disponibilidad/disponibilidad.service');

const ids = { usuarios: [], sedes: [], servicios: [] };

function instanteBogota(objetivo, hora) {
  const [h, m] = hora.split(':').map(Number);
  return new Date(Date.UTC(objetivo.getFullYear(), objetivo.getMonth(), objetivo.getDate(), h + 5, m, 0)).toISOString();
}

test.after(async () => {
  await limpiar(ids);
  await pool.end();
});

test('empleado: cancela el dia completo, bloquea la fecha y deja reembolso pendiente', async () => {
  const clienteId = await crearUsuario({ rol: 'cliente', email: `canceladia.${Date.now()}@unit.local` });
  const empleadoId = await crearUsuario({ rol: 'empleado', nombre: 'Cancelacion', apellido: 'Dia' });
  const sede = await crearSede();
  const servicio = await crearServicio('Cancelacion Dia', 30, 30000);
  ids.usuarios.push(clienteId, empleadoId);
  ids.sedes.push(sede.id);
  ids.servicios.push(servicio.id);

  await asignarServicio(empleadoId, servicio.id, 30);
  await crearDisponibilidad(empleadoId, sede.id, 1, '09:00', '18:00');
  const lunes = proximoLunes();
  const fecha = `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`;
  const reserva = await reservasService.createReserva(clienteId, {
    empleado_id: empleadoId,
    servicio_id: servicio.id,
    ubicacion_id: sede.id,
    inicia_en: instanteBogota(lunes, '10:00'),
    cantidad_personas: 1,
  });

  const { rows: pagoRows } = await pool.query(
    `INSERT INTO pago (reserva_id, referencia, transaction_id, monto, estado, metodo)
     VALUES ($1, $2, $3, 30000, 'aprobado', 'CARD') RETURNING id`,
    [reserva.id, `CANCEL-${Date.now()}`, `TX-CANCEL-${Date.now()}`]
  );
  await pool.query(
    `INSERT INTO cobro (reserva_id, monto, metodo, pago_id)
     VALUES ($1, 30000, 'online', $2)`,
    [reserva.id, pagoRows[0].id]
  );

  const resultado = await reservasService.cancelarDiaEmpleado(empleadoId, {
    fecha,
    motivo: 'Imprevisto de prueba',
  });
  assert.equal(resultado.reservas_encontradas, 1);
  assert.equal(resultado.total_canceladas, 1);
  assert.equal(resultado.reembolsos_pendientes, 1);

  const { rows: reservaRows } = await pool.query('SELECT estado, motivo_cancelacion FROM reserva WHERE id = $1', [reserva.id]);
  assert.equal(reservaRows[0].estado, 'cancelada');
  assert.match(reservaRows[0].motivo_cancelacion, /Imprevisto del empleado/);

  const bloqueo = await disponibilidadService.getBloqueos(fecha, fecha, empleadoId);
  assert.equal(bloqueo.length, 1);

  const { rows: pagoActual } = await pool.query('SELECT reembolso_estado FROM pago WHERE id = $1', [pagoRows[0].id]);
  assert.equal(pagoActual[0].reembolso_estado, 'pendiente');

  const disponibilidad = await reservasService.getDisponibilidad({
    fecha,
    empleado_id: empleadoId,
    ubicacion_id: sede.id,
  });
  assert.equal(disponibilidad.disponibilidad_empleado, null);

  const sinReservas = await reservasService.cancelarDiaEmpleado(empleadoId, {
    fecha,
    motivo: 'Otro imprevisto sin reservas',
  });
  assert.equal(sinReservas.reservas_encontradas, 0);
  assert.equal(sinReservas.total_canceladas, 0);
});
