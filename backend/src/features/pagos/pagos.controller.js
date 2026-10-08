const pagosService = require('./pagos.service');
const asyncHandler = require('../../shared/async-handler');
const logger = require('../../shared/logger');
const { emitReservaActualizada } = require('../../integrations/realtime/ws-hub');

function emitirSiAplica(resultado) {
  if (resultado && resultado.reserva_id && !resultado.ignorado) {
    emitReservaActualizada(resultado.reserva_id, resultado.reserva_estado || 'pendiente');
  }
}

const pagosController = {
  crearIntencion: asyncHandler(async (req, res) => {
    const result = await pagosService.crearIntencion(req.body, req.usuario);
    logger.info(
      { pago_id: result.pago_id, reserva_id: result.reserva_id, monto: result.monto },
      'Intencion de pago creada'
    );
    res.status(201).json({ ok: true, data: result });
  }),

  obtenerPago: asyncHandler(async (req, res) => {
    const result = await pagosService.obtenerPago(req.params.id, req.usuario);
    res.json({ ok: true, data: result });
  }),

  verificarPago: asyncHandler(async (req, res) => {
    const result = await pagosService.verificarPago(req.params.id, req.body, req.usuario);
    emitirSiAplica(result);
    logger.info(
      { pago_id: result.pago_id, estado: result.estado },
      'Pago verificado contra Wompi'
    );
    res.json({ ok: true, data: result });
  }),

  webhook: asyncHandler(async (req, res) => {
    const result = await pagosService.procesarEvento(req.body);
    emitirSiAplica(result);
    logger.info(
      {
        referencia: result.referencia,
        estado: result.estado,
        ignorado: result.ignorado || false,
        idempotente: result.idempotente || false,
      },
      'Evento de pago Wompi procesado'
    );
    res.json({ ok: true, data: result });
  }),
};

module.exports = pagosController;
