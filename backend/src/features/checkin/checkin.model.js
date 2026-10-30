const pool = require('../../config/db');

const RESERVA_SELECT = `
  SELECT r.*, cli.nombre AS cliente_nombre, cli.apellido AS cliente_apellido,
         COALESCE(rs.precio_total, s.precio_base) AS precio_total,
         COALESCE(rs.precio_total, s.precio_base) AS precio_base,
         COALESCE(rs.servicio_nombre, s.nombre) AS servicio_nombre,
         COALESCE(rs.empleados_ids, ARRAY[]::int[]) AS empleados_ids
  FROM reserva r
  JOIN app_user cli ON r.cliente_id = cli.id
  LEFT JOIN servicio_catalogo s ON r.servicio_id = s.id
  LEFT JOIN LATERAL (
    SELECT SUM(rsx.precio) AS precio_total,
           STRING_AGG(rsx.nombre, ' + ' ORDER BY rsx.orden) AS servicio_nombre,
           ARRAY_AGG(DISTINCT rsx.empleado_id) AS empleados_ids
    FROM reserva_servicio rsx
    WHERE rsx.reserva_id = r.id
  ) rs ON true
`;

const checkinModel = {
  async findReservaByQrTokenForUpdate(qr_token, db = pool) {
    const { rows } = await db.query(
      `${RESERVA_SELECT}
       WHERE r.qr_token = $1::uuid
       FOR UPDATE OF r`,
      [qr_token]
    );
    return rows[0] || null;
  },

  async findReservaByIdForUpdate(id, db = pool) {
    const { rows } = await db.query(
      `${RESERVA_SELECT}
       WHERE r.id = $1
       FOR UPDATE OF r`,
      [id]
    );
    return rows[0] || null;
  },

  async findReservaByQrToken(qr_token, db = pool) {
    const { rows } = await db.query(
      `${RESERVA_SELECT}
       WHERE r.qr_token = $1::uuid`,
      [qr_token]
    );
    return rows[0] || null;
  },

  async findSegmentosEmpleado(reserva_id, empleado_id, db = pool) {
    const { rows } = await db.query(
      `SELECT inicia_en, termina_en, duracion_minutos
       FROM reserva_servicio
       WHERE reserva_id = $1 AND empleado_id = $2
       ORDER BY orden`,
      [reserva_id, empleado_id]
    );
    return rows;
  },

  async findDisponibilidadEmpleado(empleado_id, ubicacion_id, inicia_en, db = pool) {
    const { rows } = await db.query(
      `SELECT hora_inicio, hora_fin, descansos, descanso
       FROM empleado_disponibilidad
       WHERE empleado_id = $1
         AND ubicacion_id = $2
         AND dia_semana = EXTRACT(ISODOW FROM ($3::timestamptz AT TIME ZONE 'America/Bogota'))::int`,
      [empleado_id, ubicacion_id, inicia_en]
    );
    return rows[0] || null;
  },

  async findJornada(ubicacion_id, inicia_en, db = pool) {
    const { rows } = await db.query(
      `SELECT hora_inicio, hora_fin
       FROM jornada
       WHERE ubicacion_id = $1
         AND fecha = ($2::timestamptz AT TIME ZONE 'America/Bogota')::date`,
      [ubicacion_id, inicia_en]
    );
    return rows[0] || null;
  },

  async findReservasEmpleadoEnRango(empleado_id, desde, hasta, excluir_reserva_id, db = pool) {
    const { rows } = await db.query(
      `SELECT rs.reserva_id, rs.inicia_en, rs.termina_en, rs.nombre
       FROM reserva_servicio rs
       JOIN reserva r ON r.id = rs.reserva_id
       WHERE rs.empleado_id = $1
         AND rs.reserva_id <> $4
         AND r.estado IN ('pendiente', 'confirmada', 'en_curso')
         AND rs.inicia_en < $3::timestamptz
         AND rs.termina_en > $2::timestamptz
       ORDER BY rs.inicia_en`,
      [empleado_id, desde, hasta, excluir_reserva_id]
    );
    return rows;
  },

  async findPagoAprobado(reserva_id, db = pool) {
    const { rows } = await db.query(
      "SELECT id, monto, metodo, transaction_id, actualizado_en FROM pago WHERE reserva_id = $1 AND estado = 'aprobado' ORDER BY creado_en DESC LIMIT 1",
      [reserva_id]
    );
    return rows[0] || null;
  },

  async findUltimoPago(reserva_id, db = pool) {
    const { rows } = await db.query(
      'SELECT id, monto, metodo, transaction_id, estado, actualizado_en FROM pago WHERE reserva_id = $1 ORDER BY creado_en DESC LIMIT 1',
      [reserva_id]
    );
    return rows[0] || null;
  },

  async findCobroByReservaId(reserva_id, db = pool) {
    const { rows } = await db.query(
      'SELECT * FROM cobro WHERE reserva_id = $1',
      [reserva_id]
    );
    return rows[0] || null;
  },

  async registrarCobro(reserva_id, monto, metodo, registrado_por, pago_id = null, pagadoAntes = false, db = pool) {
    const { rows } = await db.query(
      `INSERT INTO cobro (reserva_id, monto, metodo, registrado_por, pago_id, pagado_antes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (reserva_id) DO NOTHING
       RETURNING *`,
      [reserva_id, monto, metodo, registrado_por, pago_id, Boolean(pagadoAntes)]
    );
    return rows[0] || null;
  },

  async registrarLlegada(reserva_id, db = pool) {
    const { rows } = await db.query(
      'UPDATE reserva SET llego_en = COALESCE(llego_en, NOW()) WHERE id = $1 RETURNING *',
      [reserva_id]
    );
    return rows[0] || null;
  },

  async iniciarServicio(reserva_id, db = pool) {
    const { rows } = await db.query(
      `UPDATE reserva
       SET estado = 'en_curso',
           llego_en = COALESCE(llego_en, NOW()),
           inicio_servicio = COALESCE(inicio_servicio, NOW())
       WHERE id = $1
       RETURNING *`,
      [reserva_id]
    );
    return rows[0] || null;
  },

  async finalizarServicio(reserva_id, db = pool) {
    const { rows } = await db.query(
      `UPDATE reserva
       SET estado = 'cobrado',
           llego_en = COALESCE(llego_en, NOW()),
           inicio_servicio = COALESCE(inicio_servicio, NOW()),
           fin_servicio = COALESCE(fin_servicio, NOW())
       WHERE id = $1
       RETURNING *`,
      [reserva_id]
    );
    return rows[0] || null;
  },

  async updateReservaEstado(reserva_id, estado, db = pool) {
    const { rows } = await db.query(
      'UPDATE reserva SET estado = $2 WHERE id = $1 RETURNING *',
      [reserva_id, estado]
    );
    return rows[0] || null;
  },
};

module.exports = checkinModel;
