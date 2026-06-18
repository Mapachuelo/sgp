const reportesModel = require('./reportes.model');
const HttpError = require('../../shared/http-error');

const reportesService = {
  async ventasDiarias(fecha) {
    if (!fecha) throw new HttpError(400, 'El parametro fecha es requerido');
    const desglose = await reportesModel.ventasDiarias(fecha);
    const total = await reportesModel.totalDia(fecha);
    return { fecha, total, desglose };
  },

  async ocupacion(fecha) {
    if (!fecha) throw new HttpError(400, 'El parametro fecha es requerido');
    return reportesModel.ocupacion(fecha);
  },

  async clientesRecurrentes() {
    return reportesModel.clientesRecurrentes();
  },
};

module.exports = reportesService;
