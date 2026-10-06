const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { Pool } = require('pg');
const env = require('../config/env');
const { cifrarTelefono } = require('../shared/utils/telefono');

const pool = new Pool({ connectionString: env.databaseUrl });

const PASSWORD_DEMO = 'demo1234';
const DOMINIO_DEMO = '@demo.sgp';

const SEDES = [
  { nombre: 'Demo Sede Norte', direccion: 'Calle 170 # 20-30, Bogota', latitud: 4.7551, longitud: -74.0453 },
  { nombre: 'Demo Sede Chapinero', direccion: 'Carrera 13 # 55-20, Bogota', latitud: 4.6486, longitud: -74.0621 },
  { nombre: 'Demo Sede Usaquen', direccion: 'Calle 119 # 6-40, Bogota', latitud: 4.7009, longitud: -74.0312 },
  { nombre: 'Demo Sede Centro', direccion: 'Carrera 7 # 12-50, Bogota', latitud: 4.5989, longitud: -74.0757 },
  { nombre: 'Demo Sede Kennedy', direccion: 'Avenida 1 de Mayo # 60-10, Bogota', latitud: 4.6282, longitud: -74.1481 },
  { nombre: 'Demo Sede Suba', direccion: 'Carrera 91 # 145-20, Bogota', latitud: 4.7422, longitud: -74.0841 },
];

const SERVICIOS = [
  { nombre: 'Demo Corte Caballero', descripcion: 'Corte de cabello caballero', precio: 30000, duracion: 30 },
  { nombre: 'Demo Corte Dama', descripcion: 'Corte y estilo dama', precio: 55000, duracion: 45 },
  { nombre: 'Demo Barba', descripcion: 'Arreglo y perfilado de barba', precio: 20000, duracion: 20 },
  { nombre: 'Demo Tinte', descripcion: 'Coloracion completa', precio: 90000, duracion: 90 },
  { nombre: 'Demo Peinado', descripcion: 'Peinado para evento', precio: 45000, duracion: 40 },
  { nombre: 'Demo Uñas', descripcion: 'Manicure y pedicure', precio: 40000, duracion: 50 },
  { nombre: 'Demo Masaje Capilar', descripcion: 'Masaje relajante capilar', precio: 35000, duracion: 30 },
  { nombre: 'Demo Corte Niño', descripcion: 'Corte para niño', precio: 22000, duracion: 25 },
  { nombre: 'Demo Alisado', descripcion: 'Alisado profesional', precio: 120000, duracion: 120 },
  { nombre: 'Demo Hidratacion', descripcion: 'Hidratacion profunda', precio: 50000, duracion: 45 },
];

const NOMBRES = [
  'Andres', 'Camila', 'Daniel', 'Valentina', 'Santiago', 'Isabella', 'Juan', 'Mariana',
  'Felipe', 'Sara', 'Sebastian', 'Laura', 'Nicolas', 'Carolina', 'Mateo', 'Juliana',
  'Alejandro', 'Daniela', 'David', 'Paula', 'Miguel', 'Natalia', 'Jorge', 'Catalina',
  'Ricardo', 'Manuela', 'Esteban', 'Gabriela', 'Oscar', 'Luciana',
];

const APELLIDOS = [
  'Gomez', 'Rodriguez', 'Martinez', 'Garcia', 'Lopez', 'Hernandez', 'Ramirez', 'Torres',
  'Vargas', 'Castillo', 'Moreno', 'Jimenez', 'Rojas', 'Suarez', 'Cardenas', 'Pinzon',
  'Quintero', 'Salazar', 'Mendoza', 'Ortiz',
];

const TURNOS = [
  { inicio: '08:00', fin: '14:00' },
  { inicio: '14:00', fin: '20:00' },
  { inicio: '09:00', fin: '18:00' },
  { inicio: '10:00', fin: '19:00' },
  { inicio: '08:00', fin: '17:00' },
  { inicio: '11:00', fin: '20:00' },
  { inicio: '15:00', fin: '21:00' },
];

function leerOpciones() {
  const args = process.argv.slice(2);
  const opciones = {
    reset: !args.includes('--append'),
    sedes: 6,
    empleados: 15,
    clientes: 80,
    reservas: 1500,
    diasPasados: 30,
    diasFuturos: 30,
    seed: 20260926,
    exportar: !args.includes('--sin-export'),
    api: !args.includes('--sin-api'),
  };
  for (const arg of args) {
    const coincidencia = arg.match(/^--(\w+)=(\d+)$/);
    if (coincidencia) opciones[coincidencia[1]] = Number(coincidencia[2]);
  }
  return opciones;
}

function crearRng(semilla) {
  let a = semilla >>> 0;
  return function azar() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function partesFechaBogota(fecha = new Date()) {
  const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
  const [anio, mes, dia] = formato.split('-').map(Number);
  return { anio, mes, dia };
}

function fechaIso({ anio, mes, dia }) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function sumarDias({ anio, mes, dia }, dias) {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + dias);
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

function diaSemanaIso(partes) {
  const d = new Date(Date.UTC(partes.anio, partes.mes - 1, partes.dia));
  const dow = d.getUTCDay();
  return dow === 0 ? 7 : dow;
}

function minutosBogota(fecha = new Date()) {
  const desplazado = new Date(fecha.getTime() - 5 * 60 * 60 * 1000);
  return desplazado.getUTCHours() * 60 + desplazado.getUTCMinutes();
}

function esFechaBogota(iso, partes) {
  const desplazado = new Date(new Date(iso).getTime() - 5 * 60 * 60 * 1000);
  return (
    desplazado.getUTCFullYear() === partes.anio &&
    desplazado.getUTCMonth() + 1 === partes.mes &&
    desplazado.getUTCDate() === partes.dia
  );
}

function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function instanteBogota(partes, minutos) {
  return new Date(Date.UTC(partes.anio, partes.mes - 1, partes.dia, 5, minutos, 0));
}

async function insertarUsuarios(client, usuarios) {
  const ids = new Map();
  const tamano = 50;
  for (let i = 0; i < usuarios.length; i += tamano) {
    const lote = usuarios.slice(i, i + tamano);
    const valores = [];
    const parametros = [];
    lote.forEach((u, idx) => {
      const base = idx * 7;
      valores.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`);
      parametros.push(u.email, u.password_hash, u.rol, u.nombre, u.apellido, cifrarTelefono(u.telefono), true);
    });
    const { rows } = await client.query(
      `INSERT INTO app_user (email, password_hash, rol, nombre, apellido, telefono, verificado)
       VALUES ${valores.join(',')}
       RETURNING id, email`,
      parametros
    );
    rows.forEach((r) => ids.set(r.email, r.id));
  }
  return ids;
}

async function insertarFilas(client, tabla, columnas, filas, extra = '', devolverIds = false) {
  const ids = [];
  if (filas.length === 0) return ids;
  const tamano = Math.floor(60000 / columnas.length);
  for (let i = 0; i < filas.length; i += tamano) {
    const lote = filas.slice(i, i + tamano);
    const valores = [];
    const parametros = [];
    lote.forEach((fila, idx) => {
      const base = idx * columnas.length;
      valores.push(`(${columnas.map((_, c) => `$${base + c + 1}`).join(',')})`);
      parametros.push(...fila);
    });
    const { rows } = await client.query(
      `INSERT INTO ${tabla} (${columnas.join(',')}) VALUES ${valores.join(',')} ${extra}${devolverIds ? ' RETURNING id' : ''}`,
      parametros
    );
    if (devolverIds) rows.forEach((r) => ids.push(r.id));
  }
  return ids;
}

function escaparCsv(texto) {
  const valor = texto === null || texto === undefined ? '' : String(texto);
  return valor.includes(',') || valor.includes('"') || valor.includes('\n')
    ? `"${valor.replace(/"/g, '""')}"`
    : valor;
}

function escribirCsv(ruta, encabezados, filas) {
  const contenido = [
    encabezados.join(','),
    ...filas.map((fila) => fila.map(escaparCsv).join(',')),
  ].join('\n');
  fs.writeFileSync(ruta, contenido, 'utf8');
}

async function resetearDemo(client) {
  await client.query(
    `DELETE FROM cobro WHERE registrado_por IN (SELECT id FROM app_user WHERE email LIKE '%${DOMINIO_DEMO}')`
  );
  await client.query(`DELETE FROM app_user WHERE email LIKE '%${DOMINIO_DEMO}'`);
  await client.query("DELETE FROM ubicacion WHERE nombre LIKE 'Demo %'");
  await client.query("DELETE FROM servicio_catalogo WHERE nombre LIKE 'Demo %'");
}

async function flujoApi() {
  const base = `http://127.0.0.1:${env.port}/api`;
  const login = async (email) => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD_DEMO }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'login fallo');
    return data.data.token;
  };

  const partes = partesFechaBogota();
  const dow = diaSemanaIso(partes);
  const { rows: candidatos } = await pool.query(
    `SELECT ed.empleado_id, ed.ubicacion_id, ed.hora_inicio, ed.hora_fin, u.email
     FROM empleado_disponibilidad ed
     JOIN app_user u ON u.id = ed.empleado_id
     WHERE ed.dia_semana = $1 AND u.email LIKE '%${DOMINIO_DEMO}'
     ORDER BY ed.hora_fin DESC`,
    [dow]
  );
  if (candidatos.length === 0) {
    console.log('INFO API: hoy no hay estilistas de demo trabajando; se omite el flujo de API.');
    return;
  }

  const ahoraMin = minutosBogota();
  let candidato = candidatos.find((c) => {
    const inicioTurno = aMinutos(c.hora_inicio.slice(0, 5));
    const finTurno = aMinutos(c.hora_fin.slice(0, 5));
    return Math.max(inicioTurno, ahoraMin + 70) + 30 <= finTurno;
  });
  let partesDestino = partes;
  if (!candidato) {
    const manana = sumarDias(partes, 1);
    const dowManana = diaSemanaIso(manana);
    const { rows } = await pool.query(
      `SELECT ed.empleado_id, ed.ubicacion_id, ed.hora_inicio, ed.hora_fin, u.email
       FROM empleado_disponibilidad ed
       JOIN app_user u ON u.id = ed.empleado_id
       WHERE ed.dia_semana = $1 AND u.email LIKE '%${DOMINIO_DEMO}'
       ORDER BY ed.hora_fin DESC LIMIT 1`,
      [dowManana]
    );
    if (rows.length === 0) {
      console.log('INFO API: sin turnos disponibles hoy ni manana; se omite.');
      return;
    }
    candidato = rows[0];
    partesDestino = manana;
  }
  const inicioBase = partesDestino === partes
    ? Math.max(aMinutos(candidato.hora_inicio.slice(0, 5)), ahoraMin + 70)
    : aMinutos(candidato.hora_inicio.slice(0, 5)) + 60;

  const { rows: servicios } = await pool.query(
    'SELECT servicio_id, duracion_minutos FROM empleado_tiempo_servicio WHERE empleado_id = $1 ORDER BY servicio_id LIMIT 1',
    [candidato.empleado_id]
  );
  if (servicios.length === 0) return;
  const duracion = servicios[0].duracion_minutos;
  const finTurno = aMinutos(candidato.hora_fin.slice(0, 5));

  let inicio = null;
  for (let m = inicioBase; m + duracion <= finTurno; m += 30) {
    const inicioIso = instanteBogota(partesDestino, m).toISOString();
    const finIso = instanteBogota(partesDestino, m + duracion).toISOString();
    const { rows } = await pool.query(
      `SELECT 1 FROM reserva
       WHERE empleado_id = $1 AND estado IN ('pendiente','confirmada','en_curso')
         AND inicia_en < $3::timestamptz AND termina_en > $2::timestamptz LIMIT 1`,
      [candidato.empleado_id, inicioIso, finIso]
    );
    if (rows.length === 0) {
      inicio = m;
      break;
    }
  }
  if (inicio === null) {
    console.log('INFO API: sin ranura libre en el turno elegido; se omite.');
    return;
  }

  const { rows: clientesDisponibles } = await pool.query(
    `SELECT u.email FROM app_user u
     WHERE u.rol = 'cliente' AND u.email LIKE '%${DOMINIO_DEMO}'
       AND (SELECT COUNT(*) FROM reserva r WHERE r.cliente_id = u.id
            AND r.estado IN ('pendiente','confirmada','en_curso')) < 5
     ORDER BY random() LIMIT 1`
  );
  if (clientesDisponibles.length === 0) {
    console.log('INFO API: no hay clientes demo con cupo de reservas activas; se omite.');
    return;
  }

  const tokenCliente = await login(clientesDisponibles[0].email);
  const tokenEmpleado = await login(candidato.email);
  const inicioInstante = instanteBogota(partesDestino, inicio);
  const res = await fetch(`${base}/reservas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCliente}` },
    body: JSON.stringify({
      empleado_id: candidato.empleado_id,
      servicio_id: servicios[0].servicio_id,
      ubicacion_id: candidato.ubicacion_id,
      inicia_en: inicioInstante.toISOString(),
      cantidad_personas: 1,
    }),
  });
  const reserva = await res.json();
  if (!res.ok) {
    console.log('INFO API: la reserva por API no se pudo crear:', reserva.error);
    return;
  }
  if (partesDestino !== partes || inicio - ahoraMin > 120) {
    console.log(`INFO API: reserva ${reserva.data.id} creada para ${fechaIso(partesDestino)} (check-in no aplica por ventana horaria).`);
    return;
  }
  const checkin = await fetch(`${base}/checkin/validar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpleado}` },
    body: JSON.stringify({ qr_token: reserva.data.qr_token, monto: 30000 }),
  });
  const resultado = await checkin.json();
  if (checkin.ok) {
    console.log(`INFO API: reserva ${reserva.data.id} creada y check-in+cobro registrados (logs.txt y WS).`);
  } else {
    console.log(`INFO API: reserva ${reserva.data.id} creada; check-in no aplicado:`, resultado.error);
  }
}

async function validarDatos() {
  const comprobaciones = [
    {
      nombre: 'Empleados con 2 sedes el mismo dia',
      sql: `SELECT COUNT(*)::int AS n FROM (
              SELECT empleado_id, dia_semana FROM empleado_disponibilidad
              GROUP BY empleado_id, dia_semana HAVING COUNT(DISTINCT ubicacion_id) > 1
            ) t`,
    },
    {
      nombre: 'Reservas solapadas por empleado',
      sql: `SELECT COUNT(*)::int AS n FROM reserva a
            JOIN reserva b ON a.empleado_id = b.empleado_id AND a.id < b.id
            WHERE a.estado <> 'cancelada' AND b.estado <> 'cancelada'
              AND a.inicia_en < b.termina_en AND b.inicia_en < a.termina_en`,
    },
    {
      nombre: 'Clientes con mas de 5 reservas activas',
      sql: `SELECT COUNT(*)::int AS n FROM (
              SELECT cliente_id FROM reserva
              WHERE estado IN ('pendiente','confirmada','en_curso')
              GROUP BY cliente_id HAVING COUNT(*) > 5
            ) t`,
    },
    {
      nombre: 'Cobros duplicados',
      sql: `SELECT COUNT(*)::int AS n FROM (
              SELECT reserva_id FROM cobro GROUP BY reserva_id HAVING COUNT(*) > 1
            ) t`,
    },
    {
      nombre: 'Reservas cobradas sin cobro',
      sql: `SELECT COUNT(*)::int AS n FROM reserva r
            LEFT JOIN cobro c ON c.reserva_id = r.id
            WHERE r.estado = 'cobrado' AND c.id IS NULL`,
    },
    {
      nombre: 'Citas fuera de disponibilidad del empleado',
      sql: `SELECT COUNT(*)::int AS n FROM reserva r
            JOIN app_user u ON u.id = r.empleado_id
            WHERE u.email LIKE '%${DOMINIO_DEMO}'
              AND r.estado IN ('pendiente','confirmada')
              AND NOT EXISTS (
                SELECT 1 FROM empleado_disponibilidad ed
                WHERE ed.empleado_id = r.empleado_id AND ed.ubicacion_id = r.ubicacion_id
                  AND ed.dia_semana = EXTRACT(ISODOW FROM (r.inicia_en AT TIME ZONE 'America/Bogota'))::int
                  AND (r.inicia_en AT TIME ZONE 'America/Bogota')::time >= ed.hora_inicio
                  AND (r.termina_en AT TIME ZONE 'America/Bogota')::time <= ed.hora_fin
              )`,
    },
  ];

  let fallos = 0;
  for (const comprobacion of comprobaciones) {
    const { rows } = await pool.query(comprobacion.sql);
    const total = rows[0].n;
    if (total === 0) {
      console.log(`PASS validacion: ${comprobacion.nombre}`);
    } else {
      fallos += 1;
      console.log(`FAIL validacion: ${comprobacion.nombre} (${total})`);
    }
  }
  return fallos;
}

async function main() {
  const opciones = leerOpciones();
  const azar = crearRng(opciones.seed);
  const entre = (min, max) => Math.floor(azar() * (max - min + 1)) + min;
  const elegir = (lista) => lista[Math.floor(azar() * lista.length)];

  console.log('== Semillado demo SGP ==');
  console.log(JSON.stringify(opciones, null, 1));

  const password_hash = bcrypt.hashSync(PASSWORD_DEMO, 12);
  const ahora = new Date();
  const hoy = partesFechaBogota(ahora);
  const hoyMin = minutosBogota(ahora);

  const sedes = SEDES.slice(0, opciones.sedes);
  const servicios = SERVICIOS.slice(0, 10);

  const empleados = [];
  for (let i = 0; i < opciones.empleados; i++) {
    const numSedes = azar() < 0.4 ? 1 : azar() < 0.6 ? 2 : 3;
    const sedesAsignadas = [];
    while (sedesAsignadas.length < numSedes) {
      const idx = entre(0, sedes.length - 1);
      if (!sedesAsignadas.includes(idx)) sedesAsignadas.push(idx);
    }

    const dias = [1, 2, 3, 4, 5, 6, 7];
    for (let j = dias.length - 1; j > 0; j--) {
      const k = Math.floor(azar() * (j + 1));
      [dias[j], dias[k]] = [dias[k], dias[j]];
    }
    const diasTrabajo = dias.slice(0, entre(4, 6)).sort((a, b) => a - b);

    const numServicios = entre(3, Math.min(6, servicios.length));
    const idxServicios = [];
    while (idxServicios.length < numServicios) {
      const idx = entre(0, servicios.length - 1);
      if (!idxServicios.includes(idx)) idxServicios.push(idx);
    }

    const disponibilidad = diasTrabajo.map((dia, posicion) => ({
      sedeIdx: sedesAsignadas[posicion % sedesAsignadas.length],
      dia,
      ...elegir(TURNOS),
    }));

    empleados.push({
      email: `estilista${String(i + 1).padStart(2, '0')}${DOMINIO_DEMO}`,
      nombre: elegir(NOMBRES),
      apellido: elegir(APELLIDOS),
      telefono: `+573${String(100000000 + entre(0, 899999999))}`,
      rol: 'empleado',
      password_hash,
      identificacion: String(1000000000 + entre(0, 899999999)),
      sedesIdx: sedesAsignadas,
      serviciosIdx: idxServicios,
      disponibilidad,
    });
  }

  const clientes = [];
  for (let i = 0; i < opciones.clientes; i++) {
    clientes.push({
      email: `cliente${String(i + 1).padStart(2, '0')}${DOMINIO_DEMO}`,
      nombre: elegir(NOMBRES),
      apellido: elegir(APELLIDOS),
      telefono: `+573${String(200000000 + entre(0, 799999999))}`,
      rol: 'cliente',
      password_hash,
    });
  }

  const client = await pool.connect();
  let reservasCreadas = [];
  let cobrosCreados = [];
  try {
    await client.query('BEGIN');
    if (opciones.reset) {
      console.log('Reset: eliminando datos demo previos...');
      await resetearDemo(client);
    }

    const idsSedes = [];
    for (const sede of sedes) {
      const { rows } = await client.query(
        `INSERT INTO ubicacion (nombre, direccion, latitud, longitud)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [sede.nombre, sede.direccion, sede.latitud, sede.longitud]
      );
      idsSedes.push(rows[0].id);
    }

    const idsServicios = [];
    for (const servicio of servicios) {
      const { rows } = await client.query(
        `INSERT INTO servicio_catalogo (nombre, descripcion, precio_base, duracion_base_minutos)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [servicio.nombre, servicio.descripcion, servicio.precio, servicio.duracion]
      );
      idsServicios.push(rows[0].id);
    }

    const idsEmpleados = await insertarUsuarios(client, empleados);
    const idsClientes = await insertarUsuarios(client, clientes);
    console.log(`Insertados ${empleados.length} empleados y ${clientes.length} clientes demo.`);

    await insertarFilas(
      client,
      'empleado_perfil',
      ['usuario_id', 'identificacion'],
      empleados.map((e) => [idsEmpleados.get(e.email), e.identificacion])
    );

    const filasTiempos = [];
    empleados.forEach((e) => {
      const empleadoId = idsEmpleados.get(e.email);
      e.serviciosIdx.forEach((idx) => {
        filasTiempos.push([empleadoId, idsServicios[idx], servicios[idx].duracion]);
      });
    });
    await insertarFilas(
      client,
      'empleado_tiempo_servicio',
      ['empleado_id', 'servicio_id', 'duracion_minutos'],
      filasTiempos
    );

    const filasDisponibilidad = [];
    empleados.forEach((e) => {
      const empleadoId = idsEmpleados.get(e.email);
      e.disponibilidad.forEach((d) => {
        filasDisponibilidad.push([
          empleadoId,
          idsSedes[d.sedeIdx],
          d.dia,
          d.inicio,
          d.fin,
        ]);
      });
    });
    await insertarFilas(
      client,
      'empleado_disponibilidad',
      ['empleado_id', 'ubicacion_id', 'dia_semana', 'hora_inicio', 'hora_fin'],
      filasDisponibilidad
    );
    console.log(`Disponibilidad multi-sede: ${filasDisponibilidad.length} bloques (1 sede por dia por empleado).`);

    const filasJornada = [];
    for (let delta = -opciones.diasPasados; delta <= opciones.diasFuturos; delta++) {
      const partes = sumarDias(hoy, delta);
      const dow = diaSemanaIso(partes);
      const [inicio, fin] = dow === 7 ? ['10:00', '16:00'] : dow === 6 ? ['08:00', '18:00'] : ['08:00', '20:00'];
      idsSedes.forEach((sedeId) => {
        filasJornada.push([sedeId, fechaIso(partes), inicio, fin]);
      });
    }
    await insertarFilas(
      client,
      'jornada',
      ['ubicacion_id', 'fecha', 'hora_inicio', 'hora_fin'],
      filasJornada,
      'ON CONFLICT (ubicacion_id, fecha) DO UPDATE SET hora_inicio = EXCLUDED.hora_inicio, hora_fin = EXCLUDED.hora_fin'
    );
    console.log(`Jornadas por sede: ${filasJornada.length} filas.`);

    const serviciosPorEmpleado = new Map();
    empleados.forEach((e) => {
      const empleadoId = idsEmpleados.get(e.email);
      serviciosPorEmpleado.set(
        empleadoId,
        e.serviciosIdx.map((idx) => ({ idx, duracion: servicios[idx].duracion, precio: servicios[idx].precio }))
      );
    });

    const disponibilidadPorEmpleado = new Map();
    empleados.forEach((e) => {
      const empleadoId = idsEmpleados.get(e.email);
      const mapa = new Map();
      e.disponibilidad.forEach((d) => {
        mapa.set(d.dia, { sedeId: idsSedes[d.sedeIdx], inicio: d.inicio, fin: d.fin });
      });
      disponibilidadPorEmpleado.set(empleadoId, mapa);
    });

    const idsClientesLista = clientes.map((c) => idsClientes.get(c.email));
    const activasPorCliente = new Map();
    const idsEmpleadosLista = empleados.map((e) => idsEmpleados.get(e.email));

    for (let delta = -opciones.diasPasados; delta <= opciones.diasFuturos; delta++) {
      if (reservasCreadas.length >= opciones.reservas) break;
      const partes = sumarDias(hoy, delta);
      const dow = diaSemanaIso(partes);
      const esPasado = delta < 0;
      const esHoy = delta === 0;

      for (const empleadoId of idsEmpleadosLista) {
        if (reservasCreadas.length >= opciones.reservas) break;
        const agenda = disponibilidadPorEmpleado.get(empleadoId)?.get(dow);
        if (!agenda) continue;

        const probabilidad = esHoy ? 0.7 : 0.92;
        if (azar() > probabilidad) continue;

        const serviciosEmpleado = serviciosPorEmpleado.get(empleadoId);
        const rango = azar();
        const intervalo = rango < 0.06 ? 0 : rango < 0.18 ? 1 : rango < 0.38 ? 2 : rango < 0.64 ? 3 : rango < 0.86 ? 4 : 5;
        const intervalos = [];

        for (let intento = 0; intento < intervalo; intento++) {
          const inicioTurno = aMinutos(agenda.inicio);
          const finTurno = aMinutos(agenda.fin);
          const servicio = elegir(serviciosEmpleado);
          const duracion = servicio.duracion;
          const opciones = [];
          for (let m = inicioTurno; m + duracion <= finTurno; m += 15) {
            const libre = !intervalos.some((iv) => m < iv.fin && m + duracion > iv.ini);
            if (libre) opciones.push(m);
          }
          if (opciones.length === 0) break;

          const inicioMin = elegir(opciones);
          const finMin = inicioMin + duracion;
          intervalos.push({ ini: inicioMin, fin: finMin });

          let clienteId = elegir(idsClientesLista);
          for (let intentoCliente = 0; intentoCliente < 20; intentoCliente++) {
            const activas = activasPorCliente.get(clienteId) || 0;
            if (activas < 4) break;
            clienteId = elegir(idsClientesLista);
          }
          if ((activasPorCliente.get(clienteId) || 0) >= 4) continue;

          const inicioInstante = instanteBogota(partes, inicioMin);
          const finInstante = instanteBogota(partes, finMin);
          const minutosAhora = esHoy ? hoyMin : 0;

          let estado;
          let motivo = null;
          const finYaPaso = esPasado || finMin <= minutosAhora;
          if (finYaPaso) {
            if (esHoy && azar() < 0.08) {
              estado = 'en_curso';
            } else {
              const r = azar();
              if (r < 0.78) estado = 'cobrado';
              else if (r < 0.88) { estado = 'cancelada'; motivo = 'no-show'; }
              else if (r < 0.95) { estado = 'cancelada'; motivo = 'Cancelada por el cliente'; }
              else { estado = 'cancelada'; motivo = 'El empleado cambió de sede'; }
            }
          } else if (esHoy && inicioMin <= minutosAhora && minutosAhora <= finMin) {
            estado = azar() < 0.6 ? 'en_curso' : 'cobrado';
          } else if (esHoy && !finYaPaso && azar() < 0.12) {
            estado = 'en_curso';
          } else {
            const r = azar();
            if (r < 0.72) estado = 'pendiente';
            else if (r < 0.9) estado = 'confirmada';
            else if (r < 0.95) { estado = 'cancelada'; motivo = 'Cancelada por el cliente'; }
            else { estado = 'cancelada'; motivo = 'El empleado cambió de sede'; }
          }

          const cantidad = estado === 'cobrado' ? entre(1, 4) : entre(1, 3);
          const qrToken = crypto.randomUUID();
          let qrDataUrl = null;
          if (['pendiente', 'confirmada', 'en_curso'].includes(estado)) {
            qrDataUrl = await QRCode.toDataURL(
              JSON.stringify({ id: null, qr_token: qrToken, cliente_id: clienteId, inicia_en: inicioInstante.toISOString() })
            );
          }

          const creadoEn = new Date(inicioInstante.getTime() - entre(1, 7) * 24 * 60 * 60 * 1000);
          reservasCreadas.push({
            cliente_id: clienteId,
            empleado_id: empleadoId,
            servicio_id: idsServicios[servicio.idx],
            ubicacion_id: agenda.sedeId,
            inicia_en: inicioInstante.toISOString(),
            termina_en: finInstante.toISOString(),
            cantidad_personas: cantidad,
            estado,
            qr_token: qrToken,
            qr_data_url: qrDataUrl,
            motivo_cancelacion: motivo,
            creado_en: creadoEn.toISOString(),
            precio: servicio.precio,
          });

          if (estado === 'cobrado') {
            const metodo = azar() < 0.7 ? 'fisico' : 'online';
            cobrosCreados.push({
              indiceReserva: reservasCreadas.length - 1,
              monto: metodo === 'fisico' ? servicio.precio * cantidad : 0,
              metodo,
              cobrado_en: new Date(finInstante.getTime() + entre(0, 30) * 60 * 1000).toISOString(),
              registrado_por: empleadoId,
            });
          }
          if (estado === 'pendiente' || estado === 'confirmada' || estado === 'en_curso') {
            activasPorCliente.set(clienteId, (activasPorCliente.get(clienteId) || 0) + 1);
          }
        }
      }
    }

    // Garantizar un par de citas 'en_curso' para la vista de colores (no altera el cupo activo)
    let enCursoForzados = 0;
    const forzarEnCurso = (predicado) => {
      for (const reserva of reservasCreadas) {
        if (enCursoForzados >= 2) break;
        if (predicado(reserva) && ['pendiente', 'confirmada'].includes(reserva.estado)) {
          reserva.estado = 'en_curso';
          reserva.motivo_cancelacion = null;
          enCursoForzados += 1;
        }
      }
    };
    forzarEnCurso((r) => esFechaBogota(r.inicia_en, hoy));
    forzarEnCurso((r) => new Date(r.inicia_en) > ahora);
    cobrosCreados = cobrosCreados.filter((c) => reservasCreadas[c.indiceReserva].estado === 'cobrado');

    const filasReserva = reservasCreadas.map((r) => [
      r.cliente_id, r.empleado_id, r.servicio_id, r.ubicacion_id,
      r.inicia_en, r.termina_en, r.cantidad_personas, r.estado,
      r.qr_token, r.qr_data_url, r.motivo_cancelacion, r.creado_en,
    ]);
    const idsReservas = await insertarFilas(
      client,
      'reserva',
      ['cliente_id', 'empleado_id', 'servicio_id', 'ubicacion_id', 'inicia_en', 'termina_en',
        'cantidad_personas', 'estado', 'qr_token', 'qr_data_url', 'motivo_cancelacion', 'creado_en'],
      filasReserva,
      '',
      true
    );

    const filasCobro = cobrosCreados.map((c) => [
      idsReservas[c.indiceReserva],
      c.monto, c.metodo, c.cobrado_en, c.registrado_por,
    ]);
    await insertarFilas(
      client,
      'cobro',
      ['reserva_id', 'monto', 'metodo', 'cobrado_en', 'registrado_por'],
      filasCobro
    );

    await client.query('COMMIT');
    console.log(`Reservas insertadas: ${reservasCreadas.length} (cobros: ${cobrosCreados.length}).`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const resumenEstados = {};
  reservasCreadas.forEach((r) => {
    resumenEstados[r.estado] = (resumenEstados[r.estado] || 0) + 1;
  });
  const resumenSedes = {};
  reservasCreadas.forEach((r) => {
    resumenSedes[r.ubicacion_id] = (resumenSedes[r.ubicacion_id] || 0) + 1;
  });
  console.log('Resumen por estado:', JSON.stringify(resumenEstados));
  console.log(`Resumen por sede (ids): ${JSON.stringify(resumenSedes)}`);
  console.log('Ejemplo dinamica multi-sede:');
  empleados.slice(0, 5).forEach((e) => {
    const patron = e.disponibilidad
      .map((d) => `${d.dia}:${sedes[d.sedeIdx].nombre.replace('Demo Sede ', '')}`)
      .join(' ');
    console.log(`  ${e.email} -> ${patron}`);
  });

  if (opciones.exportar) {
    const dirExport = path.join(__dirname, '..', '..', 'exports');
    fs.mkdirSync(dirExport, { recursive: true });
    escribirCsv(
      path.join(dirExport, 'reservas.csv'),
      ['id', 'fecha', 'sede', 'empleado', 'cliente', 'servicio', 'estado', 'personas', 'precio', 'motivo'],
      reservasCreadas.map((r, i) => [
        i + 1, r.inicia_en, r.ubicacion_id, r.empleado_id, r.cliente_id,
        r.servicio_id, r.estado, r.cantidad_personas, r.precio, r.motivo_cancelacion,
      ])
    );
    escribirCsv(
      path.join(dirExport, 'cobros.csv'),
      ['reserva', 'monto', 'metodo', 'cobrado_en'],
      cobrosCreados.map((c) => [c.indiceReserva + 1, c.monto, c.metodo, c.cobrado_en])
    );
    escribirCsv(
      path.join(dirExport, 'disponibilidad.csv'),
      ['empleado', 'sede', 'dia_semana', 'hora_inicio', 'hora_fin'],
      empleados.flatMap((e) =>
        e.disponibilidad.map((d) => [e.email, sedes[d.sedeIdx].nombre, d.dia, d.inicio, d.fin])
      )
    );
    fs.writeFileSync(
      path.join(dirExport, 'resumen.json'),
      JSON.stringify({ opciones, resumenEstados, resumenSedes, empleados: empleados.length, clientes: clientes.length }, null, 1),
      'utf8'
    );
    console.log(`Export escrito en ${dirExport} (reservas.csv, cobros.csv, disponibilidad.csv, resumen.json).`);
  }

  const fallos = await validarDatos();

  if (opciones.api) {
    try {
      await flujoApi();
    } catch (error) {
      console.log('INFO API: flujo por API omitido:', error.message);
    }
  }

  await pool.end();
  if (fallos > 0) {
    console.error(`Semillado terminado con ${fallos} validaciones fallidas.`);
    process.exit(1);
  }
  console.log('Semillado demo completado y validado.');
}

main().catch(async (error) => {
  console.error('Error durante el semillado:', error);
  await pool.end().catch(() => {});
  process.exit(1);
});
