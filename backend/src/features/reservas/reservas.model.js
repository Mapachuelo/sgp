const pool = require('../../config/db');

const reservasModel = {
  async findAllServicios() {
    const { rows } = await pool.query('SELECT * FROM servicio_catalogo ORDER BY nombre');
    return rows;
  },

  async findServicioById(id) {
    const { rows } = await pool.query('SELECT * FROM servicio_catalogo WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async createServicio(data) {
    const { nombre, descripcion, precio_base, duracion_base_minutos } = data;
    const { rows } = await pool.query(
      `INSERT INTO servicio_catalogo (nombre, descripcion, precio_base, duracion_base_minutos)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre, descripcion, precio_base, duracion_base_minutos]
    );
    return rows[0];
  },

  async updateServicio(id, data) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (data.nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(data.nombre); }
    if (data.descripcion !== undefined) { fields.push(`descripcion = $${idx++}`); values.push(data.descripcion); }
    if (data.precio_base !== undefined) { fields.push(`precio_base = $${idx++}`); values.push(data.precio_base); }
    if (data.duracion_base_minutos !== undefined) { fields.push(`duracion_base_minutos = $${idx++}`); values.push(data.duracion_base_minutos); }

    if (fields.length === 0) return reservasModel.findServicioById(id);

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE servicio_catalogo SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async deleteServicio(id) {
    const { rows } = await pool.query('DELETE FROM servicio_catalogo WHERE id = $1 RETURNING id', [id]);
    return rows[0] || null;
  },

  async findReservasActivasPorCliente(cliente_id) {
    const { rows } = await pool.query(
      "SELECT COUNT(*) as count FROM reserva WHERE cliente_id = $1 AND estado IN ('pendiente', 'confirmada', 'en_curso')",
      [cliente_id]
    );
    return parseInt(rows[0].count, 10);
  },

  async createReserva(data) {
    const { cliente_id, empleado_id, servicio_id, ubicacion_id, inicia_en, termina_en, cantidad_personas, qr_data_url } = data;
    const { rows } = await pool.query(
      `INSERT INTO reserva (cliente_id, empleado_id, servicio_id, ubicacion_id, inicia_en, termina_en, cantidad_personas, estado, qr_data_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente', $8)
       RETURNING *`,
      [cliente_id, empleado_id, servicio_id, ubicacion_id, inicia_en, termina_en, cantidad_personas, qr_data_url]
    );
    return rows[0];
  },

  async findReservasByCliente(cliente_id) {
    const { rows } = await pool.query(
      `SELECT r.*, u.nombre as ubicacion_nombre, s.nombre as servicio_nombre, s.precio_base,
              emp.nombre as empleado_nombre, emp.apellido as empleado_apellido
       FROM reserva r
       JOIN ubicacion u ON r.ubicacion_id = u.id
       JOIN servicio_catalogo s ON r.servicio_id = s.id
       JOIN app_user emp ON r.empleado_id = emp.id
       WHERE r.cliente_id = $1
       ORDER BY r.inicia_en DESC`,
      [cliente_id]
    );
    return rows;
  },

  async findReservaById(id) {
    const { rows } = await pool.query('SELECT * FROM reserva WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async cancelReserva(id, cliente_id, motivo) {
    const { rows } = await pool.query(
      "UPDATE reserva SET estado = 'cancelada', motivo_cancelacion = $3 WHERE id = $1 AND cliente_id = $2 RETURNING *",
      [id, cliente_id, motivo]
    );
    return rows[0] || null;
  },

  async findAllReservas(filtros = {}) {
    let query = `
      SELECT r.*, u.nombre as ubicacion_nombre, s.nombre as servicio_nombre, s.precio_base,
             emp.nombre as empleado_nombre, emp.apellido as empleado_apellido,
             cli.nombre as cliente_nombre, cli.apellido as cliente_apellido
      FROM reserva r
      JOIN ubicacion u ON r.ubicacion_id = u.id
      JOIN servicio_catalogo s ON r.servicio_id = s.id
      JOIN app_user emp ON r.empleado_id = emp.id
      JOIN app_user cli ON r.cliente_id = cli.id
      WHERE 1=1`;
    const values = [];
    let idx = 1;

    if (filtros.fecha) {
      values.push(filtros.fecha);
      query += ` AND r.inicia_en::date = $${idx++}`;
    }
    if (filtros.ubicacion_id) {
      values.push(filtros.ubicacion_id);
      query += ` AND r.ubicacion_id = $${idx++}`;
    }
    if (filtros.estado) {
      values.push(filtros.estado);
      query += ` AND r.estado = $${idx++}`;
    }
    if (filtros.empleado_id) {
      values.push(filtros.empleado_id);
      query += ` AND r.empleado_id = $${idx++}`;
    }

    query += ' ORDER BY r.inicia_en DESC';

    const { rows } = await pool.query(query, values);
    return rows;
  },

  async findEmpleadosDisponibles(fecha, ubicacion_id) {
    const diaSemana = new Date(fecha).getDay();
    const diaMapeado = diaSemana === 0 ? 7 : diaSemana;

    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.apellido
       FROM app_user u
       JOIN empleado_disponibilidad ed ON u.id = ed.empleado_id
       WHERE u.rol = 'empleado'
         AND NOT u.esta_bloqueado
         AND ed.ubicacion_id = $1
         AND ed.dia_semana = $2`,
      [ubicacion_id, diaMapeado]
    );
    return rows;
  },

  async findSlotsOcupados(fecha, empleado_id) {
    const { rows } = await pool.query(
      `SELECT inicia_en, termina_en, estado FROM reserva
       WHERE empleado_id = $1
         AND inicia_en::date = $2::date
         AND estado IN ('pendiente', 'confirmada', 'en_curso')
       ORDER BY inicia_en`,
      [empleado_id, fecha]
    );
    return rows;
  },

  async findJornada(ubicacion_id, fecha) {
    const { rows } = await pool.query(
      'SELECT * FROM jornada WHERE ubicacion_id = $1 AND fecha = $2',
      [ubicacion_id, fecha]
    );
    return rows[0] || null;
  },

  async findJornadas(ubicacion_id) {
    const { rows } = await pool.query(
      'SELECT * FROM jornada WHERE ubicacion_id = $1 ORDER BY fecha',
      [ubicacion_id]
    );
    return rows;
  },

  async upsertJornada(ubicacion_id, items) {
    for (const item of items) {
      await pool.query(
        `INSERT INTO jornada (ubicacion_id, fecha, hora_inicio, hora_fin)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (ubicacion_id, fecha) DO UPDATE
         SET hora_inicio = EXCLUDED.hora_inicio, hora_fin = EXCLUDED.hora_fin`,
        [ubicacion_id, item.fecha, item.hora_inicio, item.hora_fin]
      );
    }
  },

  async findEmpleadoTiemposServicio(empleado_id) {
    const { rows } = await pool.query(
      `SELECT etp.*, sc.nombre as servicio_nombre
       FROM empleado_tiempo_servicio etp
       JOIN servicio_catalogo sc ON etp.servicio_id = sc.id
       WHERE etp.empleado_id = $1`,
      [empleado_id]
    );
    return rows;
  },

  async findAllEmpleadoTiemposServicio() {
    const { rows } = await pool.query(
      `SELECT etp.*, sc.nombre as servicio_nombre, u.nombre as empleado_nombre, u.apellido as empleado_apellido
       FROM empleado_tiempo_servicio etp
       JOIN servicio_catalogo sc ON etp.servicio_id = sc.id
       JOIN app_user u ON etp.empleado_id = u.id
       ORDER BY u.nombre, sc.nombre`
    );
    return rows;
  },

  async upsertEmpleadoTiempoServicio(empleado_id, items) {
    for (const item of items) {
      await pool.query(
        `INSERT INTO empleado_tiempo_servicio (empleado_id, servicio_id, duracion_minutos)
         VALUES ($1, $2, $3)
         ON CONFLICT (empleado_id, servicio_id) DO UPDATE
         SET duracion_minutos = EXCLUDED.duracion_minutos`,
        [empleado_id, item.servicio_id, item.duracion_minutos]
      );
    }
  },

  async updateReservaQr(id, qr_data_url) {
    await pool.query(
      'UPDATE reserva SET qr_data_url = $2 WHERE id = $1',
      [id, qr_data_url]
    );
  },

  async updateReservaEstado(id, estado) {
    const { rows } = await pool.query(
      'UPDATE reserva SET estado = $2 WHERE id = $1 RETURNING *',
      [id, estado]
    );
    return rows[0] || null;
  },

  async findReservasFuturasByEmpleadoAndUbicacion(empleado_id, ubicacion_id) {
    const { rows } = await pool.query(
      `SELECT id FROM reserva
       WHERE empleado_id = $1 AND ubicacion_id = $2
         AND inicia_en > NOW()
         AND estado IN ('pendiente', 'confirmada')`,
      [empleado_id, ubicacion_id]
    );
    return rows;
  },

  async cancelReservasFuturas(ids, motivo) {
    if (ids.length === 0) return;
    await pool.query(
      `UPDATE reserva SET estado = 'cancelada', motivo_cancelacion = $2
       WHERE id = ANY($1)`,
      [ids, motivo]
    );
  },
};

module.exports = reservasModel;
