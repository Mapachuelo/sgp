const test = require('node:test');
const assert = require('node:assert/strict');
const {
  pool, crearUsuario, crearSede, crearServicio, asignarServicio,
  crearDisponibilidad, limpiar, proximoLunes,
} = require('./helpers');
const disponibilidadService = require('../../src/features/disponibilidad/disponibilidad.service');
const reservasService = require('../../src/features/reservas/reservas.service');

const ids = { usuarios: [], sedes: [], servicios: [] };

function instanteBogota(objetivo, hora) {
  const [h, m] = hora.split(':').map(Number);
  return new Date(Date.UTC(objetivo.getFullYear(), objetivo.getMonth(), objetivo.getDate(), h + 5, m, 0)).toISOString();
}

function fechaLocal(objetivo) {
  return `${objetivo.getFullYear()}-${String(objetivo.getMonth() + 1).padStart(2, '0')}-${String(objetivo.getDate()).padStart(2, '0')}`;
}

test.after(async () => {
  await limpiar(ids);
  await pool.end();
});

test('descansos: guarda automaticamente, bloquea slots y cancela citas al confirmar', async () => {
  const clienteId = await crearUsuario({ rol: 'cliente', nombre: 'Descanso', apellido: 'Cliente' });
  const empleadoId = await crearUsuario({ rol: 'empleado', nombre: 'Descanso', apellido: 'Empleado' });
  const sede = await crearSede();
  const servicio = await crearServicio('Descanso Automatico', 30, 40000);
  ids.usuarios.push(clienteId, empleadoId);
  ids.sedes.push(sede.id);
  ids.servicios.push(servicio.id);

  await asignarServicio(empleadoId, servicio.id, 30);
  await crearDisponibilidad(empleadoId, sede.id, 1, '09:00', '18:00');
  const lunes = proximoLunes();
  const fecha = fechaLocal(lunes);
  const reserva = await reservasService.createReserva(clienteId, {
    empleado_id: empleadoId,
    servicio_id: servicio.id,
    ubicacion_id: sede.id,
    inicia_en: instanteBogota(lunes, '10:00'),
    cantidad_personas: 1,
  });

  await assert.rejects(
    () => disponibilidadService.actualizarDescansos(empleadoId, {
      items: [{ dia_semana: 1, descanso: false, descansos: [{ inicio: '09:30', fin: '10:30' }] }],
    }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.detalles?.codigo, 'CONFLICTOS_DESCANSO');
      assert.equal(error.detalles?.conflictos?.length, 1);
      return true;
    }
  );

  const resultado = await disponibilidadService.actualizarDescansos(empleadoId, {
    items: [{ dia_semana: 1, descanso: false, descansos: [{ inicio: '09:30', fin: '10:30' }] }],
    confirmar_cancelaciones: true,
  });
  assert.equal(resultado.total_canceladas, 1);

  const filas = await disponibilidadService.getDisponibilidad(empleadoId);
  assert.deepEqual(filas[0].descansos, [{ inicio: '09:30', fin: '10:30' }]);

  const { rows: reservaRows } = await pool.query(
    'SELECT estado, motivo_cancelacion FROM reserva WHERE id = $1',
    [reserva.id]
  );
  assert.equal(reservaRows[0].estado, 'cancelada');
  assert.match(reservaRows[0].motivo_cancelacion, /descanso semanal/i);

  const combo = await reservasService.getDisponibilidadCombo({
    ubicacion_id: sede.id,
    fecha,
    granularidad: 30,
    servicios: [{ servicio_id: servicio.id, empleado_id: empleadoId }],
  });
  assert.equal(combo.descansos.length, 1);
  assert.equal(combo.descansos[0].inicio, '09:30');
  assert.equal(combo.descansos[0].fin, '10:30');
  assert.ok(!combo.slots.some((slot) => ['09:30', '10:00'].includes(slot.hora)));
  assert.ok(combo.slots.some((slot) => slot.hora === '09:00'));
  assert.ok(combo.slots.some((slot) => slot.hora === '10:30'));

  const multiple = await disponibilidadService.actualizarDescansos(empleadoId, {
    items: [{
      dia_semana: 1,
      descanso: false,
      descansos: [
        { inicio: '09:30', fin: '10:00' },
        { inicio: '10:30', fin: '11:00' },
      ],
    }],
  });
  assert.equal(multiple.descansos[0].descansos.length, 2);

  const comboMultiple = await reservasService.getDisponibilidadCombo({
    ubicacion_id: sede.id,
    fecha,
    granularidad: 30,
    servicios: [{ servicio_id: servicio.id, empleado_id: empleadoId }],
  });
  assert.equal(comboMultiple.descansos.length, 2);
  assert.ok(!comboMultiple.slots.some((slot) => ['09:30', '10:30'].includes(slot.hora)));
  assert.ok(comboMultiple.slots.some((slot) => slot.hora === '10:00'));
  assert.ok(comboMultiple.slots.some((slot) => slot.hora === '11:00'));

  await assert.rejects(
    () => disponibilidadService.actualizarDescansos(empleadoId, {
      items: [{
        dia_semana: 1,
        descanso: false,
        descansos: [
          { inicio: '09:30', fin: '11:00' },
          { inicio: '10:30', fin: '12:00' },
        ],
      }],
    }),
    /descansos/
  );
});
