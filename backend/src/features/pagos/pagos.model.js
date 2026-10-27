const pool = require('../../config/db');

const pagosModel = {
  async findReservaParaPago(reservaId, db = pool) {
    const { rows } = await db.query(
      `SELECT r.*,
              COALESCE(rs.precio_total, s.precio_base) AS precio_total,
              COALESCE(rs.precio_total, s.precio_base) AS precio_base,
              COALESCE(rs.servicio_nombre, s.nombre) AS servicio_nombre,
              COALESCE(rs.empleados_ids, ARRAY[]::int[]) AS empleados_ids,
              cli.email AS cliente_email, cli.nombre AS cliente_nombre, cli.apellido AS cliente_apellido
       FROM reserva r
       LEFT JOIN servicio_catalogo s ON r.servicio_id = s.id
       LEFT JOIN LATERAL (
         SELECT SUM(rsx.precio) AS precio_total,
                STRING_AGG(rsx.nombre, ' + ' ORDER BY rsx.orden) AS servicio_nombre,
                ARRAY_AGG(DISTINCT rsx.empleado_id) AS empleados_ids
         FROM reserva_servicio rsx
         WHERE rsx.reserva_id = r.id
       ) rs ON true
       JOIN app_user cli ON r.cliente_id = cli.id
       WHERE r.id = $1`,
      [reservaId]
    );
    return rows[0] || null;
  },

  async crearPago({ reserva_id, referencia, monto, moneda = 'COP', estado = 'pendiente' }, db = pool) {
    const { rows } = await db.query(
      `INSERT INTO pago (reserva_id, referencia, monto, moneda, estado)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [reserva_id, referencia, monto, moneda, estado]
    );
    return rows[0];
  },

  async findById(id, db = pool) {
    const { rows } = await db.query(
      `SELECT p.*, r.estado AS reserva_estado, r.cliente_id, r.empleado_id, r.inicia_en,
              COALESCE((SELECT ARRAY_AGG(DISTINCT rs.empleado_id) FROM reserva_servicio rs WHERE rs.reserva_id = r.id), ARRAY[]::int[]) AS empleados_ids
       FROM pago p
       JOIN reserva r ON p.reserva_id = r.id
       WHERE p.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByIdForUpdate(id, db = pool) {
    const { rows } = await db.query(
      `SELECT p.*, r.estado AS reserva_estado, r.cliente_id, r.empleado_id, r.inicia_en,
              COALESCE((SELECT ARRAY_AGG(DISTINCT rs.empleado_id) FROM reserva_servicio rs WHERE rs.reserva_id = r.id), ARRAY[]::int[]) AS empleados_ids
       FROM pago p
       JOIN reserva r ON p.reserva_id = r.id
       WHERE p.id = $1
       FOR UPDATE OF p`,
      [id]
    );
    return rows[0] || null;
  },

  async findByReferencia(referencia, db = pool) {
    const { rows } = await db.query(
      `SELECT p.*, r.estado AS reserva_estado, r.cliente_id, r.empleado_id, r.inicia_en,
              COALESCE((SELECT ARRAY_AGG(DISTINCT rs.empleado_id) FROM reserva_servicio rs WHERE rs.reserva_id = r.id), ARRAY[]::int[]) AS empleados_ids
       FROM pago p
       JOIN reserva r ON p.reserva_id = r.id
       WHERE p.referencia = $1`,
      [referencia]
    );
    return rows[0] || null;
  },

  async findAprobadoByReservaId(reserva_id, db = pool) {
    const { rows } = await db.query(
      "SELECT * FROM pago WHERE reserva_id = $1 AND estado = 'aprobado' ORDER BY creado_en DESC LIMIT 1",
      [reserva_id]
    );
    return rows[0] || null;
  },

  async findCobroByReservaId(reserva_id, db = pool) {
    const { rows } = await db.query('SELECT * FROM cobro WHERE reserva_id = $1', [reserva_id]);
    return rows[0] || null;
  },

  async actualizarPago(id, { estado, transaction_id, metodo, payload }, db = pool) {
    const { rows } = await db.query(
      `UPDATE pago
       SET estado = $2,
           transaction_id = COALESCE($3, transaction_id),
           metodo = COALESCE($4, metodo),
           payload = COALESCE($5, payload),
           actualizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, estado, transaction_id || null, metodo || null, payload || null]
    );
    return rows[0] || null;
  },

  async confirmarReservaSiPendiente(reserva_id, db = pool) {
    const { rows } = await db.query(
      "UPDATE reserva SET estado = 'confirmada' WHERE id = $1 AND estado = 'pendiente' RETURNING id",
      [reserva_id]
    );
    return rows[0] || null;
  },

  async registrarCobroOnline({ reserva_id, monto, pago_id, pagado_antes }, db = pool) {
    const { rows } = await db.query(
      `INSERT INTO cobro (reserva_id, monto, metodo, pago_id, pagado_antes)
       VALUES ($1, $2, 'online', $3, $4)
       ON CONFLICT (reserva_id) DO NOTHING
       RETURNING *`,
      [reserva_id, monto, pago_id, Boolean(pagado_antes)]
    );
    return rows[0] || null;
  },
};

module.exports = pagosModel;
