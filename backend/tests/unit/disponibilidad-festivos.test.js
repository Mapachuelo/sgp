const test = require('node:test');
const assert = require('node:assert/strict');
const { pool, crearUsuario, crearSede, limpiar } = require('./helpers');
const disponibilidadService = require('../../src/features/disponibilidad/disponibilidad.service');
const reservasService = require('../../src/features/reservas/reservas.service');
const { esFestivo, festivosEntre } = require('../../src/shared/festivos-colombia');

const ids = { usuarios: [], sedes: [] };

test.after(async () => {
  await limpiar(ids);
  await pool.end();
});

test('festivos: calcula fechas moviles y festivos de Colombia', () => {
  assert.equal(esFestivo('2026-11-02')?.nombre, 'Todos los Santos');
  assert.equal(esFestivo('2026-11-16')?.nombre, 'Independencia de Cartagena');
  assert.equal(esFestivo('2026-11-09'), null);
  assert.ok(festivosEntre('2026-01-01', '2026-12-31').length >= 17);
});

test('disponibilidad: guarda descansos y valida plantilla, cambios temporales y festivos', async () => {
  const empleadoId = await crearUsuario({ rol: 'empleado', nombre: 'Horario', apellido: 'Festivo' });
  const sede = await crearSede();
  ids.usuarios.push(empleadoId);
  ids.sedes.push(sede.id);

  await disponibilidadService.updateDisponibilidad(empleadoId, [{
    dia_semana: 1,
    ubicacion_id: sede.id,
    hora_inicio: '09:00',
    hora_fin: '18:00',
    descansos: [{ inicio: '12:00', fin: '14:00' }],
  }]);
  let filas = await disponibilidadService.getDisponibilidad(empleadoId);
  assert.equal(filas.length, 1);
  assert.deepEqual(filas[0].descansos, [{ inicio: '12:00', fin: '14:00' }]);

  await assert.rejects(
    () => disponibilidadService.updateDisponibilidad(empleadoId, [{
      dia_semana: 1,
      ubicacion_id: sede.id,
      hora_inicio: '09:00',
      hora_fin: '18:00',
      descansos: [{ inicio: '10:00', fin: '13:00' }, { inicio: '12:00', fin: '14:00' }],
    }]),
    /descansos/
  );

  await reservasService.updateJornadaPlantilla(sede.id, [
    { dia_semana: 1, abierto: true, hora_inicio: '09:00', hora_fin: '18:00' },
    { dia_semana: 2, abierto: false, hora_inicio: '09:00', hora_fin: '18:00' },
  ]);
  assert.equal((await reservasService.getJornadaPlantilla(sede.id)).length, 2);
  await assert.rejects(
    () => disponibilidadService.updateDisponibilidad(empleadoId, [{
      dia_semana: 2,
      ubicacion_id: sede.id,
      hora_inicio: '09:00',
      hora_fin: '18:00',
    }]),
    /no abre/
  );

  const temporal = await disponibilidadService.crearTemporal(
    { id: empleadoId, rol: 'empleado' },
    { ubicacion_id: sede.id, desde: '2026-11-10', hasta: '2026-11-20', dias_semana: [1] }
  );
  assert.equal(temporal.empleado_id, empleadoId);
  assert.equal((await disponibilidadService.getTemporales({ id: empleadoId, rol: 'empleado' })).length, 1);
  const finalizado = await disponibilidadService.finalizarTemporal(
    { id: empleadoId, rol: 'empleado' },
    temporal.id,
    {}
  );
  assert.equal(finalizado.finalizado, true);
  assert.equal((await disponibilidadService.getTemporales({ id: empleadoId, rol: 'empleado' })).length, 0);

  await reservasService.abrirFestivo({
    fecha: '2026-11-02',
    sedes: [sede.id],
    hora_inicio: '09:00',
    hora_fin: '18:00',
  });
  const festivo = await disponibilidadService.crearFestivo(
    { id: empleadoId, rol: 'empleado' },
    {
      fecha: '2026-11-02',
      ubicacion_id: sede.id,
      hora_inicio: '09:00',
      hora_fin: '17:00',
      descansos: [{ inicio: '12:00', fin: '13:00' }],
    }
  );
  assert.equal(festivo.empleado_id, empleadoId);
  assert.equal((await disponibilidadService.getFestivosEmpleado(empleadoId, '2026-11-02', '2026-11-02')).length, 1);
  assert.equal((await disponibilidadService.getFestivosAdmin('2026-11-02')).length, 1);
  await disponibilidadService.eliminarFestivo({ id: empleadoId, rol: 'empleado' }, '2026-11-02');
  assert.equal((await disponibilidadService.getFestivosEmpleado(empleadoId, '2026-11-02', '2026-11-02')).length, 0);
});
