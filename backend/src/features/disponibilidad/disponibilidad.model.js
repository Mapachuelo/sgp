const pool = require('../../config/db');

const disponibilidadModel = {
  async findDisponibilidadByEmpleado(empleado_id) {
    const { rows } = await pool.query(
      `SELECT ed.*, u.nombre as ubicacion_nombre
       FROM empleado_disponibilidad ed
       JOIN ubicacion u ON ed.ubicacion_id = u.id
       WHERE ed.empleado_id = $1
       ORDER BY ed.dia_semana, ed.hora_inicio`,
      [empleado_id]
    );
    return rows;
  },

  async findAllDisponibilidad() {
    const { rows } = await pool.query(
      `SELECT ed.*, u.nombre as ubicacion_nombre,
              emp.nombre as empleado_nombre, emp.apellido as empleado_apellido
       FROM empleado_disponibilidad ed
       JOIN ubicacion u ON ed.ubicacion_id = u.id
       JOIN app_user emp ON ed.empleado_id = emp.id
       WHERE emp.rol = 'empleado'
       ORDER BY emp.nombre, emp.apellido, ed.dia_semana, ed.hora_inicio`
    );
    return rows;
  },

  async deleteDisponibilidadEmpleado(empleado_id) {
    await pool.query('DELETE FROM empleado_disponibilidad WHERE empleado_id = $1', [empleado_id]);
  },

  async insertDisponibilidad(empleado_id, items) {
    for (const item of items) {
      await pool.query(
        `INSERT INTO empleado_disponibilidad (empleado_id, ubicacion_id, dia_semana, hora_inicio, hora_fin)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (empleado_id, ubicacion_id, dia_semana) DO UPDATE
         SET hora_inicio = EXCLUDED.hora_inicio, hora_fin = EXCLUDED.hora_fin`,
        [empleado_id, item.ubicacion_id, item.dia_semana, item.hora_inicio, item.hora_fin]
      );
    }
  },
};

module.exports = disponibilidadModel;
