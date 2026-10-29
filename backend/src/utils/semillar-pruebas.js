const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { Pool } = require('pg');
const env = require('../config/env');
const { cifrarTelefono } = require('../shared/utils/telefono');

const pool = new Pool({ connectionString: env.databaseUrl });

const SEDES = [
  { nombre: 'Pruebas Sede Norte', direccion: 'Calle 170 # 20-30, Bogotá', departamento: 'Bogotá D.C.', ciudad: 'Bogotá', latitud: 4.7551, longitud: -74.0453 },
  { nombre: 'Pruebas Sede Centro', direccion: 'Carrera 7 # 12-50, Bogotá', departamento: 'Bogotá D.C.', ciudad: 'Bogotá', latitud: 4.5989, longitud: -74.0757 },
  { nombre: 'Pruebas Sede Sur', direccion: 'Avenida 1 de Mayo # 60-10, Bogotá', departamento: 'Bogotá D.C.', ciudad: 'Bogotá', latitud: 4.6282, longitud: -74.1481 },
];

const CATEGORIAS = [
  { nombre: 'Peluqueada', descripcion: 'Cortes y peinados', orden: 1 },
  { nombre: 'Planchada', descripcion: 'Alisados y planchados', orden: 2 },
  { nombre: 'Barba', descripcion: 'Arreglo de barba', orden: 3 },
  { nombre: 'Color', descripcion: 'Tintes y coloracion', orden: 4 },
  { nombre: 'Peinado', descripcion: 'Peinados para eventos', orden: 5 },
  { nombre: 'Tratamientos', descripcion: 'Manicure, masajes e hidratacion', orden: 6 },
  { nombre: 'Otros', descripcion: 'Servicios sin clasificar', orden: 99 },
];

const SERVICIOS = [
  { nombre: 'Pruebas Corte Caballero', descripcion: 'Corte de cabello caballero', precio: 30000, duracion: 30, categoria: 'Peluqueada' },
  { nombre: 'Pruebas Corte Dama', descripcion: 'Corte y estilo dama', precio: 55000, duracion: 45, categoria: 'Peluqueada' },
  { nombre: 'Pruebas Barba', descripcion: 'Arreglo y perfilado de barba', precio: 20000, duracion: 20, categoria: 'Barba' },
  { nombre: 'Pruebas Tinte', descripcion: 'Coloracion completa', precio: 90000, duracion: 90, categoria: 'Color' },
  { nombre: 'Pruebas Combo', descripcion: 'Corte y barba', precio: 45000, duracion: 45, categoria: 'Peluqueada' },
];

const NOMBRES_CLIENTES = ['Ana', 'Bruno', 'Carla', 'David', 'Elena', 'Felipe', 'Gloria', 'Hugo', 'Ines', 'Jorge'];
const APELLIDOS_CLIENTES = ['Gomez', 'Rodriguez', 'Martinez', 'Garcia', 'Lopez', 'Hernandez', 'Ramirez', 'Torres', 'Vargas', 'Castillo'];
const NOMBRES_EMPLEADOS = ['Andres', 'Camila', 'Daniel', 'Valentina', 'Santiago', 'Isabella', 'Juan', 'Mariana', 'Felipe', 'Sara'];
const APELLIDOS_EMPLEADOS = ['Moreno', 'Jimenez', 'Rojas', 'Suarez', 'Cardenas', 'Pinzon', 'Quintero', 'Salazar', 'Mendoza', 'Ortiz'];

function partesBogota(fecha = new Date()) {
  const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
  const [anio, mes, dia] = formato.split('-').map(Number);
  return { anio, mes, dia };
}

function fechaIso(partes) {
  return `${partes.anio}-${String(partes.mes).padStart(2, '0')}-${String(partes.dia).padStart(2, '0')}`;
}

function sumarDias(partes, dias) {
  const fecha = new Date(Date.UTC(partes.anio, partes.mes - 1, partes.dia));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1, dia: fecha.getUTCDate() };
}

function diaSemanaIso(partes) {
  const fecha = new Date(Date.UTC(partes.anio, partes.mes - 1, partes.dia));
  const dia = fecha.getUTCDay();
  return dia === 0 ? 7 : dia;
}

function instanteBogota(partes, minutos) {
  return new Date(Date.UTC(partes.anio, partes.mes - 1, partes.dia, 5, minutos, 0));
}

function sumarMinutos(fecha, minutos) {
  return new Date(fecha.getTime() + minutos * 60000);
}

function referencia(prefijo, indice) {
  return `${prefijo}-${Date.now().toString(36)}-${indice}-${crypto.randomBytes(2).toString('hex')}`;
}

async function resetear(client) {
  await client.query(`
    TRUNCATE TABLE
      pago, cobro, reserva_servicio, reserva, empleado_disponibilidad, empleado_tiempo_servicio,
      jornada, empleado_perfil, preferencia_usuario, app_user, servicio_catalogo,
      servicio_categoria, configuracion, ubicacion
    RESTART IDENTITY CASCADE
  `);
}

async function insertarUsuarios(client, usuarios, hash) {
  const ids = new Map();
  for (const usuario of usuarios) {
    const { rows } = await client.query(
      `INSERT INTO app_user (email, password_hash, rol, nombre, apellido, telefono, verificado)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id`,
      [
        usuario.email,
        hash,
        usuario.rol,
        usuario.nombre,
        usuario.apellido,
        cifrarTelefono(usuario.telefono),
      ]
    );
    ids.set(usuario.email, rows[0].id);
  }
  return ids;
}

async function insertarSegmento(client, reserva, servicio, empleadoId, inicio, fin, orden) {
  await client.query(
    `INSERT INTO reserva_servicio
       (reserva_id, servicio_id, empleado_id, nombre, precio, duracion_minutos, inicia_en, termina_en, orden)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      reserva.id,
      servicio.id,
      empleadoId,
      servicio.nombre,
      Number(servicio.precio_base),
      Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / 60000)),
      inicio,
      fin,
      orden,
    ]
  );
}

async function insertarReserva(client, datos) {
  const qrToken = crypto.randomUUID();
  const qrDataUrl = await QRCode.toDataURL(qrToken, { margin: 1, width: 240 });
  const { rows } = await client.query(
    `INSERT INTO reserva
       (cliente_id, empleado_id, servicio_id, ubicacion_id, inicia_en, termina_en,
        cantidad_personas, estado, qr_token, qr_data_url, motivo_cancelacion,
        llego_en, inicio_servicio, fin_servicio)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      datos.cliente_id,
      datos.empleado_id,
      datos.servicio_id,
      datos.ubicacion_id,
      datos.inicia_en,
      datos.termina_en,
      datos.cantidad_personas || 1,
      datos.estado,
      qrToken,
      qrDataUrl,
      datos.motivo_cancelacion || null,
      datos.llego_en || null,
      datos.inicio_servicio || null,
      datos.fin_servicio || null,
    ]
  );
  return rows[0];
}

async function main() {
  const client = await pool.connect();
  const manifiesto = { generado_en: new Date().toISOString(), credenciales: {}, clientes: [], empleados: [], sedes: [], servicios: [], reservas: [] };
  try {
    await client.query('BEGIN');
    await resetear(client);
    await client.query(
      "INSERT INTO configuracion (clave, valor) VALUES ('max_servicios_reserva', '5') ON CONFLICT (clave) DO NOTHING"
    );
    const categorias = [];
    for (const categoria of CATEGORIAS) {
      const { rows } = await client.query(
        'INSERT INTO servicio_categoria (nombre, descripcion, orden) VALUES ($1, $2, $3) RETURNING *',
        [categoria.nombre, categoria.descripcion, categoria.orden]
      );
      categorias.push(rows[0]);
    }
    const categoriaPorNombre = new Map(categorias.map((c) => [c.nombre, c.id]));

    const hashAdmin = await bcrypt.hash('admin123', 10);
    const hashCliente = await bcrypt.hash('cliente123', 10);
    const hashEmpleado = await bcrypt.hash('empleado123', 10);

    const admin = await insertarUsuarios(client, [
      { email: 'admin@sgp.local', rol: 'admin', nombre: 'Admin', apellido: 'Pruebas', telefono: '+573000000000' },
    ], hashAdmin);

    const clientes = [];
    for (let i = 1; i <= 10; i += 1) {
      clientes.push({
        email: `cliente${String(i).padStart(2, '0')}@sgp.local`,
        rol: 'cliente',
        nombre: NOMBRES_CLIENTES[i - 1],
        apellido: APELLIDOS_CLIENTES[i - 1],
        telefono: `+5730000000${String(i).padStart(2, '0')}`,
      });
    }
    const idsClientes = await insertarUsuarios(client, clientes, hashCliente);

    const empleados = [];
    for (let i = 1; i <= 10; i += 1) {
      empleados.push({
        email: `empleado${String(i).padStart(2, '0')}@sgp.local`,
        rol: 'empleado',
        nombre: NOMBRES_EMPLEADOS[i - 1],
        apellido: APELLIDOS_EMPLEADOS[i - 1],
        telefono: `+5731000000${String(i).padStart(2, '0')}`,
      });
    }
    const idsEmpleados = await insertarUsuarios(client, empleados, hashEmpleado);

    const sedes = [];
    for (const sede of SEDES) {
      const { rows } = await client.query(
        `INSERT INTO ubicacion (nombre, direccion, departamento, ciudad, latitud, longitud)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [sede.nombre, sede.direccion, sede.departamento, sede.ciudad, sede.latitud, sede.longitud]
      );
      sedes.push(rows[0]);
    }

    const servicios = [];
    for (const servicio of SERVICIOS) {
      const { rows } = await client.query(
        `INSERT INTO servicio_catalogo
           (nombre, descripcion, precio_base, duracion_base_minutos, categoria_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [servicio.nombre, servicio.descripcion, servicio.precio, servicio.duracion, categoriaPorNombre.get(servicio.categoria) || null]
      );
      servicios.push({ ...rows[0], categoria: servicio.categoria });
    }

    const idsTodos = [...admin.values(), ...idsClientes.values(), ...idsEmpleados.values()];
    for (const usuarioId of idsTodos) {
      await client.query(
        `INSERT INTO preferencia_usuario
           (usuario_id, rango_hora_desde, rango_hora_hasta, granularidad_calendario, tema, departamento_preferido, ciudad_preferida)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [usuarioId, '08:00', '19:00', 30, usuarioId % 2 === 0 ? 'oscuro' : 'claro', 'Bogotá D.C.', 'Bogotá']
      );
    }

    for (let i = 0; i < empleados.length; i += 1) {
      const empleadoId = idsEmpleados.get(empleados[i].email);
      await client.query(
        'INSERT INTO empleado_perfil (usuario_id, identificacion, password_asignada_hash, ubicacion_base_id) VALUES ($1, $2, $3, $4)',
        [empleadoId, `CC-PRUEBA-${String(i + 1).padStart(3, '0')}`, hashEmpleado, sedes[i % sedes.length].id]
      );
      for (const servicio of servicios) {
        await client.query(
          'INSERT INTO empleado_tiempo_servicio (empleado_id, servicio_id, duracion_minutos) VALUES ($1, $2, $3)',
          [empleadoId, servicio.id, servicio.duracion_base_minutos]
        );
      }
    }

    const hoy = partesBogota();
    const ayer = sumarDias(hoy, -1);
    const proximaSemana = sumarDias(hoy, 10);
    const diasSemana = [1, 2, 3, 4, 5, 6, 7];
    for (let i = 0; i < empleados.length; i += 1) {
      const empleadoId = idsEmpleados.get(empleados[i].email);
      for (const dia of diasSemana) {
        const sede = sedes[(i + dia) % sedes.length];
        await client.query(
          `INSERT INTO empleado_disponibilidad (empleado_id, ubicacion_id, dia_semana, hora_inicio, hora_fin)
           VALUES ($1, $2, $3, '09:00', '19:00')`,
          [empleadoId, sede.id, dia]
        );
      }
    }

    for (const fecha of [ayer, hoy, proximaSemana]) {
      for (const sede of sedes) {
        await client.query(
          `INSERT INTO jornada (ubicacion_id, fecha, hora_inicio, hora_fin)
           VALUES ($1, $2, '08:00', '20:00')
           ON CONFLICT (ubicacion_id, fecha) DO NOTHING`,
          [sede.id, fechaIso(fecha)]
        );
      }
    }

    const diaHoy = diaSemanaIso(hoy);
    const sedePara = (indiceEmpleado, dia) => sedes[(indiceEmpleado + dia) % sedes.length];

    const planesHoy = [
      { estado: 'confirmada', pago: 'aprobado', llego: true, inicio: false, fin: false },
      { estado: 'en_curso', pago: 'aprobado', llego: true, inicio: true, fin: false },
      { estado: 'cobrado', pago: 'aprobado', llego: true, inicio: true, fin: true },
      { estado: 'confirmada', pago: 'efectivo', llego: true, inicio: false, fin: false },
      { estado: 'pendiente', pago: null, llego: true, inicio: false, fin: false },
      { estado: 'pendiente', pago: null, llego: false, inicio: false, fin: false },
      { estado: 'confirmada', pago: 'aprobado', llego: false, inicio: false, fin: false },
      { estado: 'pendiente', pago: 'declinado', llego: false, inicio: false, fin: false },
      { estado: 'cancelada', pago: null, llego: false, inicio: false, fin: false },
      { estado: 'confirmada', pago: null, llego: false, inicio: false, fin: false },
    ];

    for (let i = 0; i < 10; i += 1) {
      const cliente = clientes[i];
      const empleado = empleados[i];
      const clienteId = idsClientes.get(cliente.email);
      const empleadoId = idsEmpleados.get(empleado.email);
      const servicio = servicios[i % servicios.length];
      const sede = sedePara(i, diaHoy);
      const inicio = instanteBogota(hoy, 9 * 60 + i * 60);
      const fin = sumarMinutos(inicio, servicio.duracion_base_minutos);
      const plan = planesHoy[i];
      const ahora = new Date();
      const llego = plan.llego ? new Date(Math.max(inicio.getTime(), ahora.getTime() - 10 * 60000)) : null;
      const inicioServicio = plan.inicio ? new Date(Math.max(inicio.getTime(), ahora.getTime() - 35 * 60000)) : null;
      const finServicio = plan.fin ? new Date(Math.max(inicio.getTime(), ahora.getTime() - 5 * 60000)) : null;
      const reserva = await insertarReserva(client, {
        cliente_id: clienteId,
        empleado_id: empleadoId,
        servicio_id: servicio.id,
        ubicacion_id: sede.id,
        inicia_en: inicio,
        termina_en: fin,
        cantidad_personas: (i % 2) + 1,
        estado: plan.estado,
        motivo_cancelacion: plan.estado === 'cancelada' ? 'Cancelada por el cliente en pruebas' : null,
        llego_en: llego,
        inicio_servicio: inicioServicio,
        fin_servicio: finServicio,
      });
      await insertarSegmento(client, reserva, servicio, empleadoId, inicio, fin, 1);

      const total = Number(servicio.precio_base) * ((i % 2) + 1);
      if (plan.pago === 'aprobado') {
        const { rows: pagoRows } = await client.query(
          `INSERT INTO pago (reserva_id, referencia, transaction_id, monto, metodo, estado, payload)
           VALUES ($1, $2, $3, $4, $5, 'aprobado', $6) RETURNING *`,
          [reserva.id, referencia('SEED', i), `TX-SEED-${i + 1}`, total, i % 2 === 0 ? 'CARD' : 'NEQUI', { origen: 'seed' }]
        );
        await client.query(
          `INSERT INTO cobro (reserva_id, monto, metodo, pago_id, pagado_antes)
           VALUES ($1, $2, 'online', $3, TRUE)`,
          [reserva.id, total, pagoRows[0].id]
        );
      } else if (plan.pago === 'efectivo') {
        await client.query(
          `INSERT INTO cobro (reserva_id, monto, metodo, registrado_por)
           VALUES ($1, $2, 'fisico', $3)`,
          [reserva.id, total, empleadoId]
        );
      } else if (plan.pago === 'declinado') {
        await client.query(
          `INSERT INTO pago (reserva_id, referencia, monto, metodo, estado, payload)
           VALUES ($1, $2, $3, 'CARD', 'declinado', $4)`,
          [reserva.id, referencia('SEED', i), total, { origen: 'seed' }]
        );
      }

      manifiesto.reservas.push({
        id: reserva.id,
        cliente: cliente.email,
        empleado: empleado.email,
        servicio: servicio.nombre,
        estado: reserva.estado,
        pago: plan.pago,
        qr_token: reserva.qr_token,
        inicia_en: reserva.inicia_en,
      });
    }

    for (let i = 0; i < 10; i += 1) {
      const cliente = clientes[i];
      const empleado = empleados[(i + 3) % 10];
      const clienteId = idsClientes.get(cliente.email);
      const empleadoId = idsEmpleados.get(empleado.email);
      const servicio = servicios[(i + 2) % servicios.length];
      const comboServicio = i % 3 === 0 ? servicios[(i + 4) % servicios.length] : null;
      const sede = sedePara((i + 3) % 10, diaSemanaIso(proximaSemana));
      const inicio = instanteBogota(proximaSemana, 9 * 60 + i * 45);
      const finPrimero = sumarMinutos(inicio, servicio.duracion_base_minutos);
      const fin = comboServicio ? sumarMinutos(finPrimero, comboServicio.duracion_base_minutos) : finPrimero;
      const reserva = await insertarReserva(client, {
        cliente_id: clienteId,
        empleado_id: empleadoId,
        servicio_id: servicio.id,
        ubicacion_id: sede.id,
        inicia_en: inicio,
        termina_en: fin,
        cantidad_personas: 1,
        estado: i % 2 === 0 ? 'confirmada' : 'pendiente',
      });
      await insertarSegmento(client, reserva, servicio, empleadoId, inicio, finPrimero, 1);
      if (comboServicio) {
        await insertarSegmento(client, reserva, comboServicio, empleadoId, finPrimero, fin, 2);
      }
      manifiesto.reservas.push({
        id: reserva.id,
        cliente: cliente.email,
        empleado: empleado.email,
        servicio: comboServicio ? `${servicio.nombre} + ${comboServicio.nombre}` : servicio.nombre,
        estado: reserva.estado,
        pago: null,
        qr_token: reserva.qr_token,
        inicia_en: reserva.inicia_en,
      });
    }

    for (let i = 0; i < 10; i += 1) {
      const cliente = clientes[i];
      const empleado = empleados[(i + 6) % 10];
      const clienteId = idsClientes.get(cliente.email);
      const empleadoId = idsEmpleados.get(empleado.email);
      const servicio = servicios[(i + 1) % servicios.length];
      const sede = sedePara((i + 6) % 10, diaSemanaIso(ayer));
      const inicio = instanteBogota(ayer, 9 * 60 + i * 60);
      const fin = sumarMinutos(inicio, servicio.duracion_base_minutos);
      const reserva = await insertarReserva(client, {
        cliente_id: clienteId,
        empleado_id: empleadoId,
        servicio_id: servicio.id,
        ubicacion_id: sede.id,
        inicia_en: inicio,
        termina_en: fin,
        cantidad_personas: 1,
        estado: i === 9 ? 'cancelada' : 'cobrado',
        motivo_cancelacion: i === 9 ? 'Cancelada en pruebas' : null,
        llego_en: inicio,
        inicio_servicio: inicio,
        fin_servicio: fin,
      });
      await insertarSegmento(client, reserva, servicio, empleadoId, inicio, fin, 1);
      if (i !== 9) {
        await client.query(
          `INSERT INTO cobro (reserva_id, monto, metodo, registrado_por)
           VALUES ($1, $2, 'fisico', $3)`,
          [reserva.id, Number(servicio.precio_base), empleadoId]
        );
      }
      manifiesto.reservas.push({
        id: reserva.id,
        cliente: cliente.email,
        empleado: empleado.email,
        servicio: servicio.nombre,
        estado: reserva.estado,
        pago: i === 9 ? null : 'efectivo',
        qr_token: reserva.qr_token,
        inicia_en: reserva.inicia_en,
      });
    }

    manifiesto.credenciales = {
      admin: { email: 'admin@sgp.local', password: 'admin123' },
      cliente: { email: 'cliente01@sgp.local', password: 'cliente123' },
      empleado: { email: 'empleado01@sgp.local', password: 'empleado123' },
      clientes: clientes.map((c) => ({ email: c.email, password: 'cliente123' })),
      empleados: empleados.map((e) => ({ email: e.email, password: 'empleado123' })),
    };
    manifiesto.clientes = clientes.map((c) => ({ email: c.email, id: idsClientes.get(c.email), nombre: c.nombre, apellido: c.apellido }));
    manifiesto.empleados = empleados.map((e) => ({ email: e.email, id: idsEmpleados.get(e.email), nombre: e.nombre, apellido: e.apellido }));
    manifiesto.sedes = sedes;
    manifiesto.servicios = servicios;

    await client.query('COMMIT');

    const ruta = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'seed-10x10.json');
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, JSON.stringify(manifiesto, null, 2));

    console.log(`Seed 10x10 completado: ${manifiesto.clientes.length} clientes, ${manifiesto.empleados.length} empleados, ${manifiesto.reservas.length} reservas.`);
    console.log(`Manifiesto: ${ruta}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en seed 10x10:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
