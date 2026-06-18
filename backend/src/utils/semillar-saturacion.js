const { Pool } = require('pg');
const path = require('path');

const env = require('../config/env');
const pool = new Pool({
  connectionString: env.databaseUrl,
});

async function main() {
  console.log('Iniciando semillado de saturacion de datos para pruebas...');
  
  try {
    // 1. Obtener una Sede
    const sedesRes = await pool.query('SELECT id FROM ubicacion LIMIT 1');
    if (sedesRes.rows.length === 0) {
      throw new Error('No hay sedes (ubicaciones) registradas. Por favor, corre el seed inicial primero.');
    }
    const ubicacionId = sedesRes.rows[0].id;

    // 2. Obtener el Empleado principal Carlos
    const empRes = await pool.query("SELECT id FROM app_user WHERE email = 'empleado@sgp.local' LIMIT 1");
    if (empRes.rows.length === 0) {
      throw new Error("No se encontro el empleado semilla 'empleado@sgp.local'.");
    }
    const empleadoId = empRes.rows[0].id;

    // 3. Obtener un Servicio
    const srvRes = await pool.query('SELECT id FROM servicio_catalogo LIMIT 1');
    if (srvRes.rows.length === 0) {
      throw new Error('No hay servicios registrados en la base de datos.');
    }
    const servicioId = srvRes.rows[0].id;

    // 4. Asegurar que exista al menos un cliente de prueba
    let clienteId;
    const cliRes = await pool.query("SELECT id FROM app_user WHERE rol = 'cliente' LIMIT 1");
    if (cliRes.rows.length > 0) {
      clienteId = cliRes.rows[0].id;
    } else {
      // Crear uno de pruebas de saturacion
      const insertCli = await pool.query(`
        INSERT INTO app_user (email, password_hash, rol, nombre, apellido, telefono)
        VALUES ('cliente_saturacion@sgp.local', '$2a$12$OKLNQLCSiMtT7YgbpZYWaO1uRYE32s4u1ydgErygYSeOogQhIhOsO', 'cliente', 'Cliente', 'Pruebas', '+573009999999')
        RETURNING id
      `);
      clienteId = insertCli.rows[0].id;
      console.log('Cliente de saturacion creado.');
    }

    // 5. Limpiar reservas anteriores de saturacion
    await pool.query('DELETE FROM reserva WHERE cliente_id = $1', [clienteId]);

    // 6. Generar 60 reservas para el dia de hoy
    console.log('Generando 60 reservas falsas distribuidas a lo largo del dia de hoy...');
    
    const hoy = new Date();
    // Establecer a las 08:00 AM de hoy
    hoy.setHours(8, 0, 0, 0);

    const estados = ['pendiente', 'confirmada', 'en_curso', 'cobrado'];

    for (let i = 0; i < 60; i++) {
      const iniciaEn = new Date(hoy.getTime() + i * 15 * 60000); // Intervalo de 15 min
      const terminaEn = new Date(iniciaEn.getTime() + 15 * 60000);
      
      const estado = estados[i % estados.length];
      
      await pool.query(`
        INSERT INTO reserva (cliente_id, empleado_id, servicio_id, ubicacion_id, inicia_en, termina_en, cantidad_personas, estado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        clienteId,
        empleadoId,
        servicioId,
        ubicacionId,
        iniciaEn.toISOString(),
        terminaEn.toISOString(),
        (i % 3) + 1, // Cantidad de personas (1 a 3)
        estado
      ]);
    }

    console.log('Semillado de saturacion completado con éxito. Se insertaron 60 reservas para hoy.');
  } catch (error) {
    console.error('Error durante el semillado:', error);
  } finally {
    await pool.end();
  }
}

main();
