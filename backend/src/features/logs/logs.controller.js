const logsService = require('./logs.service');
const asyncHandler = require('../../shared/async-handler');

const logsController = {
  actividad: asyncHandler(async (req, res) => {
    const lineas = logsService.leerArchivo('logs.txt');
    const filtradas = logsService.filtrarLogs(lineas, req.query);
    res.json({ ok: true, data: filtradas, total: filtradas.length });
  }),

  errores: asyncHandler(async (req, res) => {
    const lineas = logsService.leerArchivo('errores.txt');
    const filtradas = logsService.filtrarLogs(lineas, req.query);
    res.json({ ok: true, data: filtradas, total: filtradas.length });
  }),

  exportar: asyncHandler(async (req, res) => {
    const { tipo, desde, hasta } = req.query;
    const archivo = tipo === 'errores' ? 'errores.txt' : 'logs.txt';
    const lineas = logsService.leerArchivo(archivo);
    const exportadas = logsService.exportarLineas(lineas, desde, hasta);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${tipo || 'actividad'}-export.txt"`
    );
    res.send(exportadas.map((l) => JSON.stringify(l)).join('\n'));
  }),
};

module.exports = logsController;
