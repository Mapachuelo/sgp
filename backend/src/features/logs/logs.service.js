const fs = require('fs');
const path = require('path');

function leerArchivo(nombreArchivo) {
  const filePath = path.join(__dirname, '..', '..', '..', nombreArchivo);
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { msg: line };
      }
    });
}

function filtrarLogs(lineas, { filtro, fecha, severidad }) {
  return lineas.filter((linea) => {
    const texto = JSON.stringify(linea).toLowerCase();

    if (filtro && !texto.includes(filtro.toLowerCase())) return false;
    if (severidad && linea.level !== undefined) {
      const niveles = { info: 30, warn: 40, error: 50 };
      const nivelNumerico = niveles[severidad.toLowerCase()];
      if (nivelNumerico && linea.level < nivelNumerico) return false;
    }
    if (fecha) {
      const ts = linea.time || linea.timestamp;
      if (ts && !String(ts).includes(fecha)) return false;
    }
    return true;
  });
}

function exportarLineas(lineas, desde, hasta) {
  const inicio = parseInt(desde, 10) || 0;
  const fin = parseInt(hasta, 10) || lineas.length;
  return lineas.slice(inicio, fin);
}

module.exports = { leerArchivo, filtrarLogs, exportarLineas };
