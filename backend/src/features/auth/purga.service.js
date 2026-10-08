const authModel = require('./auth.model');
const env = require('../../config/env');
const logger = require('../../shared/logger');

async function purgarNoVerificados() {
  const eliminados = await authModel.deleteNoVerificadosAntiguos(env.registroTtlMinutos);
  if (eliminados > 0) {
    logger.info(
      { eliminados, ttlMinutos: env.registroTtlMinutos },
      'Registros sin verificar eliminados y correos liberados'
    );
  }
  return eliminados;
}

module.exports = { purgarNoVerificados };
