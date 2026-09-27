const checkinService = require('./checkin.service');
const asyncHandler = require('../../shared/async-handler');
const logger = require('../../shared/logger');
const { emitReservaActualizada } = require('../../integrations/realtime/ws-hub');

const checkinController = {
  validar: asyncHandler(async (req, res) => {
    const result = await checkinService.validar(req.body, req.usuario.id);
    logger.info(
      { reserva_id: result.reserva_id, metodo: result.metodo, monto: result.monto },
      'Checkin y cobro registrados'
    );
    emitReservaActualizada(result.reserva_id, 'cobrado');
    res.json({ ok: true, data: result });
  }),
};

module.exports = checkinController;
