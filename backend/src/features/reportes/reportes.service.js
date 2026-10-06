const reportesModel = require('./reportes.model');
const HttpError = require('../../shared/http-error');

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
  async ventasDiarias(fecha) {
    const f = resolverFecha(fecha);
    const desglose = await reportesModel.ventasDiarias(f);
    const total = await reportesModel.totalDia(f);
    return { fecha: f, total, desglose };
  },

  async ocupacion(fecha) {
    const f = resolverFecha(fecha);
    return reportesModel.ocupacion(f);
  },

  async clientesRecurrentes() {
    return reportesModel.clientesRecurrentes();
  },
};

module.exports = reportesService;
