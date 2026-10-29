const pool = require('../../config/db');

const SELECT_RESERVA_BASE = `
  SELECT r.*,
         u.nombre AS ubicacion_nombre, u.direccion AS ubicacion_direccion,
         u.departamento AS ubicacion_departamento, u.ciudad AS ubicacion_ciudad,
         u.latitud AS ubicacion_latitud, u.longitud AS ubicacion_longitud,
         COALESCE(rs.servicio_nombre, s.nombre) AS servicio_nombre,
         COALESCE(rs.precio_total, s.precio_base) AS precio_total,
         COALESCE(rs.precio_total, s.precio_base) AS precio_base,
         COALESCE(rs.duracion_total, s.duracion_base_minutos) AS duracion_total,
         rs.servicios,
         equipo.equipo_nombre,
         emp.nombre AS empleado_nombre, emp.apellido AS empleado_apellido, ep.foto_url AS empleado_foto_url,
         cli.nombre AS cliente_nombre, cli.apellido AS cliente_apellido,
         p.estado AS pago_estado, p.metodo AS pago_metodo, p.monto AS pago_monto,
         c.metodo AS cobro_metodo, c.monto AS cobro_monto, c.pago_id AS cobro_pago_id
  FROM reserva r
  JOIN ubicacion u ON r.ubicacion_id = u.id
  LEFT JOIN servicio_catalogo s ON r.servicio_id = s.id
  JOIN app_user emp ON r.empleado_id = emp.id
  LEFT JOIN empleado_perfil ep ON ep.usuario_id = emp.id
  JOIN app_user cli ON r.cliente_id = cli.id
  LEFT JOIN LATERAL (
    SELECT STRING_AGG(rsx.nombre, ' + ' ORDER BY rsx.orden) AS servicio_nombre,
           SUM(rsx.precio) AS precio_total,
           SUM(rsx.duracion_minutos) AS duracion_total,
           JSON_AGG(
             JSON_BUILD_OBJECT(
               'id', rsx.id,
               'servicio_id', rsx.servicio_id,
               'empleado_id', rsx.empleado_id,
               'nombre', rsx.nombre,
               'precio', rsx.precio,
               'duracion_minutos', rsx.duracion_minutos,
               'inicia_en', rsx.inicia_en,
               'termina_en', rsx.termina_en,
               'orden', rsx.orden
             ) ORDER BY rsx.orden
           ) AS servicios
    FROM reserva_servicio rsx
    WHERE rsx.reserva_id = r.id
  ) rs ON true
  LEFT JOIN LATERAL (
    SELECT STRING_AGG(nombre_completo, ', ') AS equipo_nombre
    FROM (
      SELECT DISTINCT e.nombre || ' ' || COALESCE(e.apellido, '') AS nombre_completo
      FROM reserva_servicio rse
      JOIN app_user e ON e.id = rse.empleado_id
      WHERE rse.reserva_id = r.id
    ) equipo_base
  ) equipo ON true
  LEFT JOIN cobro c ON c.reserva_id = r.id
  LEFT JOIN LATERAL (
    SELECT estado, metodo, monto FROM pago
    WHERE reserva_id = r.id
    ORDER BY creado_en DESC LIMIT 1
  ) p ON true
`;

const reservasModel = {
  async findAllServicios({
    incluirInactivos = false,
    categoria_id = null,
    ubicacion_id = null,
    empleado_id = null,
  } = {}) {
    const { rows } = await pool.query(
      `SELECT s.*, c.nombre AS categoria_nombre, c.orden AS categoria_orden,
              (SELECT COUNT(*)::int FROM servicio_imagen si WHERE si.servicio_id = s.id) AS total_imagenes,
              (SELECT COUNT(DISTINCT etp.empleado_id)::int
                 FROM empleado_tiempo_servicio etp
                 JOIN app_user eu ON eu.id = etp.empleado_id
                WHERE etp.servicio_id = s.id
                  AND eu.rol = 'empleado' AND NOT eu.esta_bloqueado
                  AND ($3::int IS NULL OR EXISTS (
                    SELECT 1 FROM empleado_disponibilidad ed
                    WHERE ed.empleado_id = etp.empleado_id AND ed.ubicacion_id = $3
                  ))) AS total_estilistas,
              (SELECT STRING_AGG(nombres, ', ' ORDER BY nombres)
                 FROM (
                   SELECT DISTINCT eu.nombre || ' ' || COALESCE(eu.apellido, '') AS nombres
                   FROM empleado_tiempo_servicio etp
                   JOIN app_user eu ON eu.id = etp.empleado_id
                   WHERE etp.servicio_id = s.id
                     AND eu.rol = 'empleado' AND NOT eu.esta_bloqueado
                     AND ($3::int IS NULL OR EXISTS (
                       SELECT 1 FROM empleado_disponibilidad ed
                       WHERE ed.empleado_id = etp.empleado_id AND ed.ubicacion_id = $3
                     ))
                 ) nombres_servicio) AS estilistas
       FROM servicio_catalogo s
       LEFT JOIN servicio_categoria c ON c.id = s.categoria_id
       WHERE ($1::boolean IS TRUE OR s.activo = TRUE)
         AND ($2::int IS NULL OR s.categoria_id = $2)
         AND ($3::int IS NULL OR EXISTS (
           SELECT 1 FROM empleado_tiempo_servicio etp
           JOIN empleado_disponibilidad ed
             ON ed.empleado_id = etp.empleado_id AND ed.ubicacion_id = $3
           JOIN app_user eu ON eu.id = etp.empleado_id
           WHERE etp.servicio_id = s.id AND eu.rol = 'empleado' AND NOT eu.esta_bloqueado
         ))
         AND ($4::int IS NULL OR EXISTS (
           SELECT 1 FROM empleado_tiempo_servicio etp
           WHERE etp.servicio_id = s.id AND etp.empleado_id = $4
         ))
       ORDER BY COALESCE(c.orden, 999), COALESCE(c.nombre, 'Otros'), s.nombre`,
      [Boolean(incluirInactivos), categoria_id || null, ubicacion_id || null, empleado_id || null]
    );
    return rows;
  },

  async findServicioById(id, db = pool) {
    const { rows } = await db.query(
      `SELECT s.*, c.nombre AS categoria_nombre, c.orden AS categoria_orden,
              (SELECT COUNT(*)::int FROM servicio_imagen si WHERE si.servicio_id = s.id) AS total_imagenes
       FROM servicio_catalogo s
       LEFT JOIN servicio_categoria c ON c.id = s.categoria_id
       WHERE s.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findImagenesServicio(servicio_id) {
    const { rows } = await pool.query(
      `SELECT id, imagen_url, orden
       FROM servicio_imagen
       WHERE servicio_id = $1
       ORDER BY orden, id`,
      [servicio_id]
    );
    return rows;
  },

  async replaceImagenesServicio(servicio_id, imagenes, db = pool) {
    await db.query('DELETE FROM servicio_imagen WHERE servicio_id = $1', [servicio_id]);
    for (let indice = 0; indice < imagenes.length; indice += 1) {
      await db.query(
        `INSERT INTO servicio_imagen (servicio_id, imagen_url, orden)
         VALUES ($1, $2, $3)`,
        [servicio_id, imagenes[indice], indice + 1]
      );
    }
    await db.query(
      'UPDATE servicio_catalogo SET imagen_url = $2 WHERE id = $1',
      [servicio_id, imagenes[0] || null]
    );
  },

  async findServiciosPorIds(ids) {
    if (!ids.length) return [];
    const { rows } = await pool.query(
      `SELECT s.*, c.nombre AS categoria_nombre, c.orden AS categoria_orden
       FROM servicio_catalogo s
       LEFT JOIN servicio_categoria c ON c.id = s.categoria_id
       WHERE s.id = ANY($1::int[])
       ORDER BY array_position($1::int[], s.id)`,
      [ids]
    );
    return rows;
  },

  async createServicio(data, db = pool) {
    const { nombre, descripcion, precio_base, duracion_base_minutos, categoria_id, imagen_url, activo } = data;
    const { rows } = await db.query(
      `INSERT INTO servicio_catalogo
         (nombre, descripcion, precio_base, duracion_base_minutos, categoria_id, imagen_url, activo)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE))
       RETURNING *`,
      [nombre, descripcion, precio_base, duracion_base_minutos, categoria_id || null, imagen_url || null, activo]
    );
    return rows[0];
  },

  async updateServicio(id, data, db = pool) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (data.nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(data.nombre); }
    if (data.descripcion !== undefined) { fields.push(`descripcion = $${idx++}`); values.push(data.descripcion); }
    if (data.precio_base !== undefined) { fields.push(`precio_base = $${idx++}`); values.push(data.precio_base); }
    if (data.duracion_base_minutos !== undefined) { fields.push(`duracion_base_minutos = $${idx++}`); values.push(data.duracion_base_minutos); }
    if (data.categoria_id !== undefined) { fields.push(`categoria_id = $${idx++}`); values.push(data.categoria_id || null); }
    if (data.imagen_url !== undefined) { fields.push(`imagen_url = $${idx++}`); values.push(data.imagen_url || null); }
    if (data.activo !== undefined) { fields.push(`activo = $${idx++}`); values.push(Boolean(data.activo)); }

    if (fields.length === 0) return reservasModel.findServicioById(id, db);

    values.push(id);
    const { rows } = await db.query(
      `UPDATE servicio_catalogo SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async countReservasServicio(id) {
    const { rows } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM reserva WHERE servicio_id = $1) +
         (SELECT COUNT(*) FROM reserva_servicio WHERE servicio_id = $1) AS total`,
      [id]
    );
    return Number(rows[0]?.total || 0);
  },

  async deleteServicio(id) {
    const enUso = await reservasModel.countReservasServicio(id);
    if (enUso > 0) {
      const { rows } = await pool.query(
        'UPDATE servicio_catalogo SET activo = FALSE WHERE id = $1 RETURNING id, activo',
        [id]
      );
      return rows[0] ? { desactivado: true, ...rows[0] } : null;
    }
    const { rows } = await pool.query('DELETE FROM servicio_catalogo WHERE id = $1 RETURNING id', [id]);
    return rows[0] ? { eliminado: true, ...rows[0] } : null;
  },

  async findAllCategorias() {
    const { rows } = await pool.query(
      `SELECT c.*, COUNT(s.id)::int AS total_servicios
       FROM servicio_categoria c
       LEFT JOIN servicio_catalogo s ON s.categoria_id = c.id
       GROUP BY c.id
       ORDER BY c.orden, LOWER(c.nombre)`
    );
    return rows;
  },

  async findCategoriaById(id) {
    const { rows } = await pool.query('SELECT * FROM servicio_categoria WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findCategoriaByNombre(nombre) {
    const { rows } = await pool.query(
      'SELECT * FROM servicio_categoria WHERE LOWER(nombre) = LOWER($1)',
      [nombre]
    );
    return rows[0] || null;
  },

  async createCategoria({ nombre, descripcion, orden }) {
    const { rows } = await pool.query(
      `INSERT INTO servicio_categoria (nombre, descripcion, orden)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [nombre, descripcion || null, orden ?? 0]
    );
    return rows[0];
  },

  async updateCategoria(id, data) {
    const fields = [];
    const values = [];
    let idx = 1;
    if (data.nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(data.nombre); }
    if (data.descripcion !== undefined) { fields.push(`descripcion = $${idx++}`); values.push(data.descripcion); }
    if (data.orden !== undefined) { fields.push(`orden = $${idx++}`); values.push(data.orden); }
    if (fields.length === 0) return reservasModel.findCategoriaById(id);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE servicio_categoria SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async deleteCategoria(id) {
    const { rows } = await pool.query(
      'DELETE FROM servicio_categoria WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] || null;
  },

  async countServiciosCategoria(id) {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS total FROM servicio_catalogo WHERE categoria_id = $1',
      [id]
    );
    return Number(rows[0]?.total || 0);
  },

  async findConfiguracion() {
    const { rows } = await pool.query('SELECT clave, valor FROM configuracion ORDER BY clave');
    return rows.reduce((acc, fila) => {
      acc[fila.clave] = fila.valor;
      return acc;
    }, {});
  },

  async upsertConfiguracion(clave, valor) {
    const { rows } = await pool.query(
      `INSERT INTO configuracion (clave, valor, actualizado_en)
       VALUES ($1, $2, NOW())
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = NOW()
       RETURNING *`,
      [clave, String(valor)]
    );
    return rows[0];
  },

  async findReservasActivasPorCliente(cliente_id, db = pool) {
    const { rows } = await db.query(
      "SELECT COUNT(*) as count FROM reserva WHERE cliente_id = $1 AND estado IN ('pendiente', 'confirmada', 'en_curso')",
      [cliente_id]
    );
    return parseInt(rows[0].count, 10);
  },

  async createReserva(data, db = pool) {
    const { cliente_id, empleado_id, servicio_id, ubicacion_id, inicia_en, termina_en, cantidad_personas, qr_data_url } = data;
    const { rows } = await db.query(
      `INSERT INTO reserva (cliente_id, empleado_id, servicio_id, ubicacion_id, inicia_en, termina_en, cantidad_personas, estado, qr_data_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente', $8)
       RETURNING *`,
      [cliente_id, empleado_id, servicio_id, ubicacion_id, inicia_en, termina_en, cantidad_personas, qr_data_url]
    );
    return rows[0];
  },

  async createReservaServicios(reserva_id, segmentos, db = pool) {
    const creados = [];
    for (const segmento of segmentos) {
      const { rows } = await db.query(
        `INSERT INTO reserva_servicio
           (reserva_id, servicio_id, empleado_id, nombre, precio, duracion_minutos, inicia_en, termina_en, orden)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          reserva_id,
          segmento.servicio_id,
          segmento.empleado_id,
          segmento.nombre,
          segmento.precio,
          segmento.duracion_minutos,
          segmento.inicia_en,
          segmento.termina_en,
          segmento.orden,
        ]
      );
      creados.push(rows[0]);
    }
    return creados;
  },

  async findReservasByCliente(cliente_id) {
    const { rows } = await pool.query(
      `${SELECT_RESERVA_BASE}
       WHERE r.cliente_id = $1
       ORDER BY r.inicia_en DESC`,
      [cliente_id]
    );
    return rows;
  },

  async findReservaById(id) {
    const { rows } = await pool.query(
      `${SELECT_RESERVA_BASE}
       WHERE r.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async cancelReserva(id, cliente_id, motivo) {
    const { rows } = await pool.query(
      "UPDATE reserva SET estado = 'cancelada', motivo_cancelacion = $3 WHERE id = $1 AND cliente_id = $2 RETURNING *",
      [id, cliente_id, motivo]
    );
    return rows[0] || null;
  },

  async findAgenda(desde, hasta, filtros = {}) {
    const values = [desde, hasta];
    let condiciones = '';
    if (filtros.empleado_id) {
      values.push(filtros.empleado_id);
      condiciones += ` AND rs.empleado_id = $${values.length}`;
    }
    if (filtros.ciudad) {
      values.push(filtros.ciudad);
      condiciones += ` AND u.ciudad = $${values.length}`;
    }
    if (filtros.departamento) {
      values.push(filtros.departamento);
      condiciones += ` AND u.departamento = $${values.length}`;
    }
    const { rows } = await pool.query(
      `SELECT rs.id, rs.id AS segmento_id, rs.reserva_id, rs.empleado_id, rs.servicio_id,
              rs.nombre AS servicio_nombre, rs.precio, rs.duracion_minutos,
              rs.inicia_en, rs.termina_en,
              r.cantidad_personas, r.estado, r.qr_token, r.qr_data_url,
              r.llego_en, r.inicio_servicio, r.fin_servicio, r.creado_en,
              r.ubicacion_id,
              u.nombre AS ubicacion_nombre, u.departamento AS ubicacion_departamento,
              u.ciudad AS ubicacion_ciudad,
              cli.nombre AS cliente_nombre, cli.apellido AS cliente_apellido,
              emp.nombre AS empleado_nombre, emp.apellido AS empleado_apellido, ep.foto_url AS empleado_foto_url,
              p.estado AS pago_estado, p.metodo AS pago_metodo, p.monto AS pago_monto,
              c.metodo AS cobro_metodo, c.monto AS cobro_monto, c.pago_id AS cobro_pago_id
       FROM reserva_servicio rs
       JOIN reserva r ON r.id = rs.reserva_id
       JOIN ubicacion u ON r.ubicacion_id = u.id
       JOIN app_user cli ON r.cliente_id = cli.id
       JOIN app_user emp ON rs.empleado_id = emp.id
       LEFT JOIN empleado_perfil ep ON ep.usuario_id = emp.id
       LEFT JOIN cobro c ON c.reserva_id = r.id
       LEFT JOIN LATERAL (
         SELECT estado, metodo, monto FROM pago
         WHERE reserva_id = r.id
         ORDER BY creado_en DESC LIMIT 1
       ) p ON true
       WHERE (rs.inicia_en AT TIME ZONE 'America/Bogota')::date BETWEEN $1::date AND $2::date${condiciones}
       ORDER BY rs.inicia_en`,
      values
    );
    return rows;
  },

  async findAllReservas(filtros = {}) {
    let query = `${SELECT_RESERVA_BASE.replace(
      '  FROM reserva r',
      ',\n         mi.mi_inicia_en, mi.mi_termina_en, mi.mis_servicios, mi.mi_duracion_minutos\n  FROM reserva r'
    )}
      LEFT JOIN LATERAL (
        SELECT MIN(rsf.inicia_en) AS mi_inicia_en,
               MAX(rsf.termina_en) AS mi_termina_en,
               SUM(rsf.duracion_minutos) AS mi_duracion_minutos,
               STRING_AGG(rsf.nombre, ' + ' ORDER BY rsf.orden) AS mis_servicios
        FROM reserva_servicio rsf
        WHERE rsf.reserva_id = r.id AND ($1::int IS NULL OR rsf.empleado_id = $1)
      ) mi ON true
      WHERE 1=1`;
    const values = [filtros.empleado_id ? Number(filtros.empleado_id) : null];
    let idx = 2;

    if (filtros.fecha) {
      values.push(filtros.fecha);
      query += ` AND (r.inicia_en AT TIME ZONE 'America/Bogota')::date = $${idx++}`;
    }
    if (filtros.ubicacion_id) {
      values.push(filtros.ubicacion_id);
      query += ` AND r.ubicacion_id = $${idx++}`;
    }
    if (filtros.ciudad) {
      values.push(filtros.ciudad);
      query += ` AND u.ciudad = $${idx++}`;
    }
    if (filtros.departamento) {
      values.push(filtros.departamento);
      query += ` AND u.departamento = $${idx++}`;
    }
    if (filtros.estado) {
      values.push(filtros.estado);
      query += ` AND r.estado = $${idx++}`;
    }
    if (filtros.empleado_id) {
      query += ` AND EXISTS (
        SELECT 1 FROM reserva_servicio rse
        WHERE rse.reserva_id = r.id AND rse.empleado_id = $1
      )`;
    }

    query += ' ORDER BY r.inicia_en DESC';

    const { rows } = await pool.query(query, values);
    return rows;
  },

  async findEmpleadosDisponibles(fecha, ubicacion_id, servicio_id = null) {
    const diaSemana = new Date(fecha).getUTCDay();
    const diaMapeado = diaSemana === 0 ? 7 : diaSemana;

    const { rows } = await pool.query(
      `SELECT DISTINCT u.id, u.nombre, u.apellido, ep.foto_url,
              etp.duracion_minutos, sc.precio_base, sc.nombre AS servicio_nombre
       FROM app_user u
       LEFT JOIN empleado_perfil ep ON ep.usuario_id = u.id
       JOIN empleado_disponibilidad ed ON u.id = ed.empleado_id
       LEFT JOIN empleado_tiempo_servicio etp
         ON etp.empleado_id = u.id AND etp.servicio_id = $3::int
       LEFT JOIN servicio_catalogo sc ON sc.id = etp.servicio_id
       WHERE u.rol = 'empleado'
         AND NOT u.esta_bloqueado
         AND ed.ubicacion_id = $1
         AND ed.dia_semana = $2
         AND ($3::int IS NULL OR etp.id IS NOT NULL)
       ORDER BY u.nombre, u.apellido`,
      [ubicacion_id, diaMapeado, servicio_id || null]
    );
    return rows;
  },

  async findEmpleadosPorSede(ubicacion_id) {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.apellido, ep.foto_url,
              COUNT(DISTINCT etp.servicio_id)::int AS total_servicios,
              MIN(etp.duracion_minutos)::int AS duracion_minima
       FROM app_user u
       LEFT JOIN empleado_perfil ep ON ep.usuario_id = u.id
       JOIN empleado_disponibilidad ed ON ed.empleado_id = u.id AND ed.ubicacion_id = $1
       JOIN empleado_tiempo_servicio etp ON etp.empleado_id = u.id
       JOIN servicio_catalogo sc ON sc.id = etp.servicio_id AND sc.activo = TRUE
       WHERE u.rol = 'empleado' AND NOT u.esta_bloqueado
       GROUP BY u.id, u.nombre, u.apellido, ep.foto_url
       ORDER BY u.nombre, u.apellido`,
      [ubicacion_id]
    );
    return rows;
  },

  async findEmpleadosPorServicio(ubicacion_id, servicio_id) {
    const { rows } = await pool.query(
      `SELECT DISTINCT u.id, u.nombre, u.apellido, ep.foto_url,
              etp.duracion_minutos, sc.precio_base, sc.nombre AS servicio_nombre
       FROM app_user u
       LEFT JOIN empleado_perfil ep ON ep.usuario_id = u.id
       JOIN empleado_tiempo_servicio etp ON etp.empleado_id = u.id AND etp.servicio_id = $2
       JOIN servicio_catalogo sc ON sc.id = etp.servicio_id
       JOIN empleado_disponibilidad ed ON ed.empleado_id = u.id AND ed.ubicacion_id = $1
       WHERE u.rol = 'empleado'
         AND NOT u.esta_bloqueado
         AND sc.activo = TRUE
       ORDER BY u.nombre, u.apellido`,
      [ubicacion_id, servicio_id]
    );
    return rows;
  },

  async findSedesPorServicio(servicio_id) {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.direccion, u.departamento, u.ciudad, u.latitud, u.longitud,
              COUNT(DISTINCT emp.id)::int AS total_estilistas,
              MIN(etp.duracion_minutos)::int AS duracion_minima
       FROM ubicacion u
       JOIN empleado_disponibilidad ed ON ed.ubicacion_id = u.id
       JOIN app_user emp ON emp.id = ed.empleado_id
         AND emp.rol = 'empleado'
         AND NOT emp.esta_bloqueado
       JOIN empleado_tiempo_servicio etp ON etp.empleado_id = emp.id
         AND etp.servicio_id = $1
       JOIN servicio_catalogo sc ON sc.id = etp.servicio_id AND sc.activo = TRUE
       GROUP BY u.id
       ORDER BY u.nombre`,
      [servicio_id]
    );
    return rows;
  },

  async findDisponibilidadEmpleados(empleado_ids, ubicacion_id, dia_semana) {
    if (!empleado_ids.length) return [];
    const { rows } = await pool.query(
      `SELECT * FROM empleado_disponibilidad
       WHERE empleado_id = ANY($1::int[])
         AND ubicacion_id = $2
         AND dia_semana = $3`,
      [empleado_ids, ubicacion_id, dia_semana]
    );
    return rows;
  },

  async findSegmentosOcupados(fecha, empleado_ids) {
    if (!empleado_ids.length) return [];
    const { rows } = await pool.query(
      `SELECT rs.empleado_id, rs.inicia_en, rs.termina_en, r.estado
       FROM reserva_servicio rs
       JOIN reserva r ON r.id = rs.reserva_id
       WHERE rs.empleado_id = ANY($2::int[])
         AND (rs.inicia_en AT TIME ZONE 'America/Bogota')::date = $1::date
         AND r.estado IN ('pendiente', 'confirmada', 'en_curso')
       ORDER BY rs.inicia_en`,
      [fecha, empleado_ids]
    );
    return rows;
  },

  async findSegmentosByReserva(reserva_id) {
    const { rows } = await pool.query(
      `SELECT rs.*, u.nombre AS empleado_nombre, u.apellido AS empleado_apellido
       FROM reserva_servicio rs
       JOIN app_user u ON u.id = rs.empleado_id
       WHERE rs.reserva_id = $1
       ORDER BY rs.orden`,
      [reserva_id]
    );
    return rows;
  },

  async findSlotsOcupados(fecha, empleado_id) {
    const { rows } = await pool.query(
      `SELECT rs.inicia_en, rs.termina_en, r.estado
       FROM reserva_servicio rs
       JOIN reserva r ON r.id = rs.reserva_id
       WHERE rs.empleado_id = $1
         AND (rs.inicia_en AT TIME ZONE 'America/Bogota')::date = $2::date
         AND r.estado IN ('pendiente', 'confirmada', 'en_curso')
       ORDER BY rs.inicia_en`,
      [empleado_id, fecha]
    );
    return rows;
  },

  async findEmpleadoDisponibilidadDia(empleado_id, ubicacion_id, dia_semana) {
    const { rows } = await pool.query(
      `SELECT hora_inicio, hora_fin
       FROM empleado_disponibilidad
       WHERE empleado_id = $1 AND ubicacion_id = $2 AND dia_semana = $3`,
      [empleado_id, ubicacion_id, dia_semana]
    );
    return rows[0] || null;
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

  async replaceJornadas(ubicacion_id, items, client = pool) {
    await client.query('DELETE FROM jornada WHERE ubicacion_id = $1', [ubicacion_id]);
    for (const item of items) {
      await client.query(
        `INSERT INTO jornada (ubicacion_id, fecha, hora_inicio, hora_fin)
         VALUES ($1, $2, $3, $4)`,
        [ubicacion_id, item.fecha, item.hora_inicio, item.hora_fin]
      );
    }
  },

  async findEmpleadoTiemposServicio(empleado_id) {
    const { rows } = await pool.query(
      `SELECT etp.*, sc.nombre as servicio_nombre, sc.precio_base, sc.imagen_url,
              sc.categoria_id, c.nombre AS categoria_nombre
       FROM empleado_tiempo_servicio etp
       JOIN servicio_catalogo sc ON etp.servicio_id = sc.id
       LEFT JOIN servicio_categoria c ON c.id = sc.categoria_id
       WHERE etp.empleado_id = $1 AND sc.activo = TRUE`,
      [empleado_id]
    );
    return rows;
  },

  async findAllEmpleadoTiemposServicio() {
    const { rows } = await pool.query(
      `SELECT etp.*, sc.nombre as servicio_nombre, sc.precio_base, sc.imagen_url,
              sc.categoria_id, c.nombre AS categoria_nombre,
              u.nombre as empleado_nombre, u.apellido as empleado_apellido
       FROM empleado_tiempo_servicio etp
       JOIN servicio_catalogo sc ON etp.servicio_id = sc.id
       LEFT JOIN servicio_categoria c ON c.id = sc.categoria_id
       JOIN app_user u ON etp.empleado_id = u.id
       WHERE sc.activo = TRUE
       ORDER BY u.nombre, sc.nombre`
    );
    return rows;
  },

  async upsertEmpleadoTiempoServicio(empleado_id, items) {
    await pool.query('DELETE FROM empleado_tiempo_servicio WHERE empleado_id = $1', [empleado_id]);
    for (const item of items) {
      await pool.query(
        `INSERT INTO empleado_tiempo_servicio (empleado_id, servicio_id, duracion_minutos)
         VALUES ($1, $2, $3)`,
        [empleado_id, item.servicio_id, item.duracion_minutos]
      );
    }
  },

  async updateReservaQr(id, qr_data_url, db = pool) {
    await db.query(
      'UPDATE reserva SET qr_data_url = $2 WHERE id = $1',
      [id, qr_data_url]
    );
  },

  async updateReservaEstado(id, estado, db = pool) {
    const { rows } = await db.query(
      'UPDATE reserva SET estado = $2 WHERE id = $1 RETURNING *',
      [id, estado]
    );
    return rows[0] || null;
  },

  async findEmpleadoById(id) {
    const { rows } = await pool.query(
      "SELECT id, nombre, apellido, esta_bloqueado FROM app_user WHERE id = $1 AND rol = 'empleado'",
      [id]
    );
    return rows[0] || null;
  },

  async findUbicacionById(id) {
    const { rows } = await pool.query('SELECT * FROM ubicacion WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findDuracionServicioEmpleado(empleado_id, servicio_id) {
    const { rows } = await pool.query(
      `SELECT etp.duracion_minutos, sc.nombre AS servicio_nombre, sc.precio_base,
              sc.categoria_id, sc.activo
       FROM empleado_tiempo_servicio etp
       JOIN servicio_catalogo sc ON sc.id = etp.servicio_id
       WHERE etp.empleado_id = $1 AND etp.servicio_id = $2`,
      [empleado_id, servicio_id]
    );
    return rows[0] || null;
  },

  async estaDentroDeDisponibilidad(empleado_id, ubicacion_id, inicia_en, termina_en, db = pool) {
    const { rows } = await db.query(
      `SELECT 1
       FROM empleado_disponibilidad ed
       WHERE ed.empleado_id = $1
         AND ed.ubicacion_id = $2
         AND ed.dia_semana = EXTRACT(ISODOW FROM ($3::timestamptz AT TIME ZONE 'America/Bogota'))::int
         AND ($3::timestamptz AT TIME ZONE 'America/Bogota')::time >= ed.hora_inicio
         AND ($4::timestamptz AT TIME ZONE 'America/Bogota')::time <= ed.hora_fin`,
      [empleado_id, ubicacion_id, inicia_en, termina_en]
    );
    return rows.length > 0;
  },

  async findReservasSolapadas(empleado_id, inicia_en, termina_en, db = pool) {
    const { rows } = await db.query(
      `SELECT rs.id, rs.reserva_id, rs.inicia_en, rs.termina_en
       FROM reserva_servicio rs
       JOIN reserva r ON r.id = rs.reserva_id
       WHERE rs.empleado_id = $1
         AND r.estado IN ('pendiente', 'confirmada', 'en_curso')
         AND rs.inicia_en < $3::timestamptz
         AND rs.termina_en > $2::timestamptz`,
      [empleado_id, inicia_en, termina_en]
    );
    return rows;
  },

  async acquireLock(empleado_id, inicia_en, db = pool) {
    await db.query(
      `SELECT pg_advisory_xact_lock(
         $1,
         (EXTRACT(YEAR FROM ($2::timestamptz AT TIME ZONE 'America/Bogota'))::int * 10000
          + EXTRACT(MONTH FROM ($2::timestamptz AT TIME ZONE 'America/Bogota'))::int * 100
          + EXTRACT(DAY FROM ($2::timestamptz AT TIME ZONE 'America/Bogota'))::int)
       )`,
      [empleado_id, inicia_en]
    );
  },

  async findReservasFuturasByEmpleadoUbicacionYDia(empleado_id, ubicacion_id, dia_semana) {
    const { rows } = await pool.query(
      `SELECT DISTINCT rs.reserva_id AS id
       FROM reserva_servicio rs
       JOIN reserva r ON r.id = rs.reserva_id
       WHERE rs.empleado_id = $1 AND r.ubicacion_id = $2
         AND rs.inicia_en > NOW()
         AND r.estado IN ('pendiente', 'confirmada')
         AND EXTRACT(ISODOW FROM (rs.inicia_en AT TIME ZONE 'America/Bogota'))::int = $3`,
      [empleado_id, ubicacion_id, dia_semana]
    );
    return rows;
  },

  async cancelReservasFuturas(ids, motivo) {
    if (ids.length === 0) return [];
    const { rows } = await pool.query(
      `UPDATE reserva SET estado = 'cancelada', motivo_cancelacion = $2
       WHERE id = ANY($1)
       RETURNING id`,
      [ids, motivo]
    );
    return rows.map((r) => r.id);
  },
};

module.exports = reservasModel;
