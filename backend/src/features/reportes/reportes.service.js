const reportesModel = require('./reportes.model');
const HttpError = require('../../shared/http-error');
const { generarNominaPdf } = require('./nomina-pdf');

function fechaHoyBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function resolverFecha(fecha) {
  if (fecha === undefined || fecha === '') return fechaHoyBogota();
  const valida =
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    !Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)) &&
    new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) === fecha;
  if (!valida) {
    throw new HttpError(400, 'fecha debe tener formato YYYY-MM-DD');
  }
  return fecha;
}

const reportesService = {
  async ventasDiarias(fecha, filtros = {}) {
    const f = resolverFecha(fecha);
    const ciudad = filtros.ciudad || null;
    const departamento = filtros.departamento || null;
    const desglose = await reportesModel.ventasDiarias(f, ciudad, departamento);
    const total = await reportesModel.totalDia(f, ciudad, departamento);
    return { fecha: f, total, desglose };
  },

  async ocupacion(fecha, filtros = {}) {
    const f = resolverFecha(fecha);
    return reportesModel.ocupacion(f, filtros.ciudad || null, filtros.departamento || null);
  },

  async clientesRecurrentes() {
    return reportesModel.clientesRecurrentes();
  },

  async nomina({ empleado_id, ubicacion_id, desde, hasta }) {
    const desdeValido = resolverFecha(desde);
    const hastaValido = resolverFecha(hasta);
    if (desdeValido > hastaValido) {
      throw new HttpError(400, 'La fecha desde no puede ser mayor que la fecha hasta');
    }
    const empleadoId = empleado_id ? Number(empleado_id) : null;
    const ubicacionId = ubicacion_id ? Number(ubicacion_id) : null;
    if (empleado_id && (!Number.isInteger(empleadoId) || empleadoId <= 0)) {
      throw new HttpError(400, 'empleado_id no es valido');
    }
    if (ubicacion_id && (!Number.isInteger(ubicacionId) || ubicacionId <= 0)) {
      throw new HttpError(400, 'ubicacion_id no es valido');
    }
    const [empleado, ubicacion] = await Promise.all([
      empleadoId ? reportesModel.findEmpleadoNomina(empleadoId) : null,
      ubicacionId ? reportesModel.findUbicacionNomina(ubicacionId) : null,
    ]);
    if (empleadoId && !empleado) throw new HttpError(404, 'Empleado no encontrado');
    if (ubicacionId && !ubicacion) throw new HttpError(404, 'Sede no encontrada');

    const filas = await reportesModel.nomina({
      empleado_id: empleadoId,
      ubicacion_id: ubicacionId,
      desde: desdeValido,
      hasta: hastaValido,
    });

    const detalle = filas.map((fila) => {
      const bruto = Number(fila.bruto) || 0;
      const porcentaje = Number(fila.comision_porcentaje) || 0;
      const empleadoParte = Math.round(bruto * porcentaje) / 100;
      const salonParte = Math.round((bruto - empleadoParte) * 100) / 100;
      return {
        reserva_id: fila.reserva_id,
        fecha: fila.fecha,
        sede: fila.sede,
        cliente: fila.cliente,
        servicio: fila.servicio,
        empleado_id: fila.empleado_id,
        empleado_nombre: `${fila.empleado_nombre} ${fila.empleado_apellido || ''}`.trim(),
        porcentaje,
        bruto: Math.round(bruto * 100) / 100,
        empleado_parte: empleadoParte,
        salon_parte: salonParte,
      };
    });

    const resumenMapa = new Map();
    detalle.forEach((fila) => {
      if (!resumenMapa.has(fila.empleado_id)) {
        resumenMapa.set(fila.empleado_id, {
          empleado_id: fila.empleado_id,
          empleado_nombre: fila.empleado_nombre,
          porcentaje: fila.porcentaje,
          bruto: 0,
          empleado_parte: 0,
          salon_parte: 0,
        });
      }
      const resumen = resumenMapa.get(fila.empleado_id);
      resumen.bruto += fila.bruto;
      resumen.empleado_parte += fila.empleado_parte;
      resumen.salon_parte += fila.salon_parte;
    });
    const resumen = [...resumenMapa.values()].map((fila) => ({
      ...fila,
      bruto: Math.round(fila.bruto * 100) / 100,
      empleado_parte: Math.round(fila.empleado_parte * 100) / 100,
      salon_parte: Math.round(fila.salon_parte * 100) / 100,
    }));

    const totales = resumen.reduce((acc, fila) => ({
      bruto: acc.bruto + fila.bruto,
      empleado_parte: acc.empleado_parte + fila.empleado_parte,
      salon_parte: acc.salon_parte + fila.salon_parte,
    }), { bruto: 0, empleado_parte: 0, salon_parte: 0 });

    return {
      desde: desdeValido,
      hasta: hastaValido,
      empleado,
      ubicacion,
      resumen,
      detalle,
      totales: {
        bruto: Math.round(totales.bruto * 100) / 100,
        empleado_parte: Math.round(totales.empleado_parte * 100) / 100,
        salon_parte: Math.round(totales.salon_parte * 100) / 100,
      },
    };
  },

  async resumenEmpleado(empleado_id, { desde, hasta }) {
    const empleadoId = Number(empleado_id);
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
      throw new HttpError(400, 'empleado_id no es valido');
    }
    const data = await reportesService.nomina({ empleado_id: empleadoId, desde, hasta });
    const porcentaje = Number(data.resumen[0]?.porcentaje ?? data.empleado?.comision_porcentaje ?? 0);
    return {
      desde: data.desde,
      hasta: data.hasta,
      porcentaje,
      servicios: data.detalle.length,
      bruto: data.totales.bruto,
      ganado: data.totales.empleado_parte,
    };
  },

  async nominaPdf(params) {
    const data = await reportesService.nomina(params);
    return generarNominaPdf(data);
  },
};

module.exports = reportesService;
