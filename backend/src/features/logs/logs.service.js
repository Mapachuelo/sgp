const fs = require('fs');
const path = require('path');

const NIVELES = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };

function fechaEnBogota(epochMs) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(epochMs));
  } catch {
    return null;
  }
}

function leerArchivo(nombreArchivo) {
  const filePath = path.join(__dirname, '..', '..', '..', nombreArchivo);
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return { ...JSON.parse(line), _linea: index + 1 };
      } catch {
        return { msg: line, _linea: index + 1 };
      }
    });
}

function filtrarLogs(lineas, { filtro, fecha, severidad, desde, hasta }) {
  return lineas.filter((linea) => {
    const texto = JSON.stringify(linea).toLowerCase();

    if (filtro && !texto.includes(String(filtro).toLowerCase())) return false;

    if (severidad) {
      const nivel = NIVELES[String(severidad).toLowerCase()];
      if (nivel && linea.level !== nivel) return false;
    }

    if (fecha) {
      if (!linea.time) return false;
      const dia = fechaEnBogota(linea.time);
      if (desde && hasta) {
        if (!dia || dia < desde || dia > hasta) return false;
      } else if (dia !== fecha) {
        return false;
      }
    }

    return true;
  });
}

function exportarLineas(lineas, desde, hasta) {
  const inicio = Math.max(parseInt(desde, 10) || 0, 0);
  const fin = hasta === undefined || hasta === '' ? lineas.length : parseInt(hasta, 10);
  if (Number.isNaN(fin) || fin <= 0) return lineas.slice(inicio);
  return lineas.slice(inicio, fin);
}

module.exports = { leerArchivo, filtrarLogs, exportarLineas, fechaEnBogota };