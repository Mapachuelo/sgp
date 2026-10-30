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
const authModel = require('../../src/features/auth/auth.model');
const clientesService = require('../../src/features/clientes/clientes.service');
const { leerArchivo, exportarLineas, filtrarLogs } = require('../../src/features/logs/logs.service');

const ids = { usuarios: [], sedes: [], servicios: [] };

function instanteBogota(objetivo, hora) {
  const [h, m] = hora.split(':').map(Number);
  return new Date(Date.UTC(objetivo.getFullYear(), objetivo.getMonth(), objetivo.getDate(), h + 5, m, 0)).toISOString();
}

test('reservas: CRUD de servicios y validaciones del catalogo', async () => {
  await assert.rejects(() => reservasService.createServicio({}), /obligatorio|requeridos/);
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

test('reservas: galeria de imagenes y sedes que ofrecen un servicio', async () => {
  const imagenA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const imagenB = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==';

  const servicio = await reservasService.createServicio({
    nombre: `Galeria ${sufijo()}`,
    precio_base: 10000,
    duracion_base_minutos: 20,
    imagenes: [imagenA, imagenB],
  });
  ids.servicios.push(servicio.id);

  assert.equal(servicio.imagen_url, imagenA);
  const galeria = await reservasService.getImagenesServicio(servicio.id);
  assert.equal(galeria.length, 2);
  assert.equal(galeria[0].imagen_url, imagenA);
  assert.equal(galeria[1].imagen_url, imagenB);

  const actualizado = await reservasService.updateServicio(servicio.id, { imagenes: [imagenB] });
  assert.equal(actualizado.imagen_url, imagenB);
  const galeriaActualizada = await reservasService.getImagenesServicio(servicio.id);
  assert.equal(galeriaActualizada.length, 1);
  assert.equal(galeriaActualizada[0].imagen_url, imagenB);

  await assert.rejects(
    () => reservasService.createServicio({
      nombre: `Galeria excedida ${sufijo()}`,
      precio_base: 10000,
      duracion_base_minutos: 20,
      imagenes: Array(7).fill(imagenA),
    }),
    /hasta 6 imagenes/
  );
  await assert.rejects(
    () => reservasService.updateServicio(servicio.id, { imagenes: ['data:image/svg+xml;base64,PHN2Zy8+'] }),
    /PNG, JPG o WebP/
  );
  await assert.rejects(() => reservasService.getImagenesServicio(999999), /no encontrado/);

  const sedeA = await crearSede();
  const sedeB = await crearSede();
  const empleadoA = await crearUsuario({ rol: 'empleado' });
  const empleadoB = await crearUsuario({ rol: 'empleado' });
  ids.sedes.push(sedeA.id, sedeB.id);
  ids.usuarios.push(empleadoA, empleadoB);
  await asignarServicio(empleadoA, servicio.id, 20);
  await crearDisponibilidad(empleadoA, sedeA.id, 1, '09:00', '18:00');
  await crearDisponibilidad(empleadoB, sedeB.id, 1, '09:00', '18:00');

  const sedes = await reservasService.getSedesPorServicio({ servicio_id: servicio.id });
  assert.deepEqual(sedes.map((sede) => sede.id), [sedeA.id]);
  assert.equal(sedes[0].total_estilistas, 1);
  await assert.rejects(() => reservasService.getSedesPorServicio({}), /requerido/);
  await assert.rejects(() => reservasService.getSedesPorServicio({ servicio_id: 999999 }), /no encontrado/);

  await reservasService.deleteServicio(servicio.id);
  await limpiar({ usuarios: [empleadoA, empleadoB], sedes: [sedeA.id, sedeB.id] });
  ids.servicios = ids.servicios.filter((id) => id !== servicio.id);
});

test('reservas: categorias, varios servicios y varios estilistas', async () => {
  const sufijoPrueba = sufijo();
  const categoria = await reservasService.createCategoria({
    nombre: `Cat Multi ${sufijoPrueba}`,
    descripcion: 'Prueba multi-servicio',
  });
  const servicioA = await reservasService.createServicio({
    nombre: `Multi A ${sufijoPrueba}`, precio_base: 12000, duracion_base_minutos: 20, categoria_id: categoria.id,
  });
  const servicioB = await reservasService.createServicio({
    nombre: `Multi B ${sufijoPrueba}`, precio_base: 8000, duracion_base_minutos: 15, categoria_id: categoria.id,
  });
  ids.servicios.push(servicioA.id, servicioB.id);

  await assert.rejects(
    () => reservasService.deleteCategoria(categoria.id),
    /servicios asignados/
  );

  const empleadoA = await crearUsuario({ rol: 'empleado' });
  const empleadoB = await crearUsuario({ rol: 'empleado' });
  const sede = await crearSede();
  ids.usuarios.push(empleadoA, empleadoB);
  ids.sedes.push(sede.id);
  await asignarServicio(empleadoA, servicioA.id, 20);
  await asignarServicio(empleadoB, servicioB.id, 15);
  await crearDisponibilidad(empleadoA, sede.id, 1, '09:00', '18:00');
  await crearDisponibilidad(empleadoB, sede.id, 1, '09:00', '18:00');

  const lunes = proximoLunes();
  const fecha = `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`;
  const disponibles = await reservasService.getEmpleadosDisponibles({
    fecha, ubicacion_id: sede.id, servicio_id: servicioA.id,
  });
  assert.ok(disponibles.some((empleado) => empleado.id === empleadoA));
  assert.ok(!disponibles.some((empleado) => empleado.id === empleadoB));

  const combo = await reservasService.getDisponibilidadCombo({
    ubicacion_id: sede.id,
    fecha,
    granularidad: 30,
    servicios: [
      { servicio_id: servicioA.id, empleado_id: empleadoA },
      { servicio_id: servicioB.id, empleado_id: empleadoB },
    ],
  });
  assert.equal(combo.duracion_total, 35);
  assert.equal(combo.precio_total, 20000);
  assert.ok(combo.slots.length > 0);
  assert.equal(combo.slots[0].plan.length, 2);
  assert.equal(combo.slots[0].plan[1].empleado_id, empleadoB);

  const clienteId = await crearUsuario({ rol: 'cliente' });
  ids.usuarios.push(clienteId);
  const horario = combo.slots.find((slot) => slot.hora === '10:00') || combo.slots[0];
  const reserva = await reservasService.createReserva(clienteId, {
    empleado_id: empleadoA,
    ubicacion_id: sede.id,
    inicia_en: horario.inicia_en,
    cantidad_personas: 1,
    servicios: [
      { servicio_id: servicioA.id, empleado_id: empleadoA },
      { servicio_id: servicioB.id, empleado_id: empleadoB },
    ],
  });
  assert.equal(Number(reserva.precio_total), 20000);
  assert.equal(Number(reserva.duracion_total), 35);
  assert.equal(reserva.servicios.length, 2);
  assert.equal(reserva.servicios[0].empleado_id, empleadoA);
  assert.equal(reserva.servicios[1].empleado_id, empleadoB);
  const inicio = new Date(reserva.inicia_en).getTime();
  const fin = new Date(reserva.termina_en).getTime();
  assert.equal((fin - inicio) / 60000, 35);

  await assert.rejects(
    () => reservasService.createReserva(clienteId, {
      empleado_id: empleadoA,
      ubicacion_id: sede.id,
      inicia_en: horario.inicia_en,
      cantidad_personas: 1,
      servicios: [
        { servicio_id: servicioA.id, empleado_id: empleadoA },
        { servicio_id: servicioA.id, empleado_id: empleadoA },
      ],
    }),
    /repetir/
  );

  await reservasService.deleteCategoria(categoria.id).catch(() => {});
  await limpiar({ usuarios: [empleadoA, empleadoB, clienteId], sedes: [sede.id], servicios: [servicioA.id, servicioB.id] });
  await reservasService.deleteCategoria(categoria.id).catch(() => {});
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

  await reservasService.updateJornada(sede.id, [
    { fecha: '2026-11-02', hora_inicio: '09:00', hora_fin: '18:00' },
  ]);
  const restantes = await reservasService.getJornada(sede.id);
  assert.equal(restantes.length, 1);
  assert.equal(restantes[0].fecha.toISOString().slice(0, 10), '2026-11-02');
});

test('reservas: aplica plantilla semanal a todas las sedes', async () => {
  const sedeA = await crearSede();
  const sedeB = await crearSede();
  ids.sedes.push(sedeA.id, sedeB.id);
  const items = [1, 2, 3, 4, 5].map((dia) => ({
    dia_semana: dia,
    abierto: true,
    hora_inicio: '08:30',
    hora_fin: '19:30',
  })).concat([6, 7].map((dia) => ({
    dia_semana: dia,
    abierto: false,
    hora_inicio: '00:00',
    hora_fin: '00:00',
  })));

  const resultado = await reservasService.updateJornadaPlantillaTodas(items);
  assert.ok(resultado.sedes >= 2);
  const plantillaA = await reservasService.getJornadaPlantilla(sedeA.id);
  const plantillaB = await reservasService.getJornadaPlantilla(sedeB.id);
  assert.equal(plantillaA.length, 7);
  assert.equal(plantillaB.length, 7);
  assert.equal(plantillaA[0].hora_inicio, '08:30:00');
  assert.equal(plantillaB[5].abierto, false);
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
  assert.ok(agenda.some((r) => r.reserva_id === reserva.id));
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
  const foto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3Q6wAAAABJRU5ErkJggg==';
  const empleado = await authService.createEmpleado({
    email, nombre: 'Emp', apellido: 'Unit', telefono: '+573001112244', identificacion: '123', foto_url: foto,
  });
  ids.usuarios.push(empleado.id);
  assert.equal(empleado.rol, 'empleado');
  assert.equal(empleado.foto_url, foto);

  await assert.rejects(() => authService.createEmpleado({ email, nombre: 'Dup' }), /ya esta registrado/);
  await assert.rejects(() => authService.updateEmpleado(empleado.id, { foto_url: 'no-es-imagen' }), /foto/);
  await assert.rejects(() => authService.updateEmpleado(empleado.id, { telefono: '300' }), /telefono/);
  await assert.rejects(() => authService.updateEmpleado(999999, { nombre: 'x' }), /no encontrado/);

  const actualizado = await authService.updateEmpleado(empleado.id, { identificacion: '999', nombre: 'Emp2', password: 'nueva123' });
  assert.equal(actualizado.identificacion, '999');
  assert.equal(actualizado.nombre, 'Emp2');
  assert.equal(actualizado.foto_url, foto);

  const sinFoto = await authService.updateEmpleado(empleado.id, { foto_url: null });
  assert.equal(sinFoto.foto_url, null);

  const admin = await authService.createEmpleado({
    rol: 'admin',
    email: `admin.${sufijo()}@unit.local`,
    nombre: 'Admin',
    apellido: 'Unit',
    password: 'admin123',
    telefono: '+573001112255',
  });
  ids.usuarios.push(admin.id);
  assert.equal(admin.rol, 'admin');
  assert.equal(admin.identificacion, null);
  const { rows: perfilAdmin } = await pool.query(
    'SELECT 1 FROM empleado_perfil WHERE usuario_id = $1',
    [admin.id]
  );
  assert.equal(perfilAdmin.length, 0);
  await assert.rejects(
    () => authService.updateEmpleado(admin.id, { rol: 'empleado' }),
    /rol/
  );
  const adminEditado = await authService.updateEmpleado(admin.id, { nombre: 'Admin Editado' });
  assert.equal(adminEditado.nombre, 'Admin Editado');
  await assert.rejects(
    () => authService.deleteEmpleado(admin.id, admin.id),
    /propia cuenta/
  );

  const usuariosStaff = await authModel.findAllUsuarios();
  assert.ok(usuariosStaff.some((item) => item.id === admin.id && item.rol === 'admin'));

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
