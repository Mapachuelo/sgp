const checkinService = require('./checkin.service');
const asyncHandler = require('../../shared/async-handler');
const logger = require('../../shared/logger');

const checkinController = {
  validar: asyncHandler(async (req, res) => {
    const result = await checkinService.validar(req.body, req.usuario.id);
    logger.info(
      { reserva_id: result.reserva_id, metodo: result.metodo },
      'Checkin y cobro registrados'
    );
    res.json({ ok: true, data: result });
  }),
};

module.exports = checkinController;
