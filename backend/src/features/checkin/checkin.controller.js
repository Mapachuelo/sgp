const checkinService = require('./checkin.service');
const asyncHandler = require('../../shared/async-handler');
const logger = require('../../shared/logger');
const { emitReservaActualizada } = require('../../integrations/realtime/ws-hub');

function emitir(resultado, evento) {
  if (resultado?.reserva_id) {
    emitReservaActualizada(resultado.reserva_id, evento || resultado.estado || 'pendiente');
  }
}

const checkinController = {
  consultar: asyncHandler(async (req, res) => {
    const result = await checkinService.consultar(req.body, req.usuario);
    res.json({ ok: true, data: result });
  }),

  llegada: asyncHandler(async (req, res) => {
    const result = await checkinService.llegada(req.body, req.usuario);
    emitir(result, 'en_espera');
    logger.info({ reserva_id: result.reserva_id }, 'Llegada de cliente registrada');
    res.json({ ok: true, data: result });
  }),

  cobroEfectivo: asyncHandler(async (req, res) => {
    const result = await checkinService.cobroEfectivo(req.body, req.usuario);
    emitir(result, 'pagado');
    logger.info({ reserva_id: result.reserva_id, monto: result.monto }, 'Cobro en efectivo registrado');
    res.json({ ok: true, data: result });
  }),

  iniciar: asyncHandler(async (req, res) => {
    const result = await checkinService.iniciar(req.body, req.usuario);
    emitir(result, 'en_curso');
    logger.info({ reserva_id: result.reserva_id }, 'Servicio iniciado');
    res.json({ ok: true, data: result });
  }),

  finalizar: asyncHandler(async (req, res) => {
    const result = await checkinService.finalizar(req.body, req.usuario);
    emitir(result, 'cobrado');
    logger.info({ reserva_id: result.reserva_id }, 'Servicio finalizado');
    res.json({ ok: true, data: result });
  }),

  validar: asyncHandler(async (req, res) => {
    const result = await checkinService.validar(req.body, req.usuario);
    emitir(result, 'cobrado');
    logger.info(
      { reserva_id: result.reserva_id, metodo: result.metodo, monto: result.monto },
      'Checkin y cobro registrados'
    );
    res.json({ ok: true, data: result });
  }),
};

module.exports = checkinController;
