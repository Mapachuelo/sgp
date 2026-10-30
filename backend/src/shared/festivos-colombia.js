const FIJOS = [
  [1, 1, 'Año Nuevo'],
  [5, 1, 'Día del Trabajo'],
  [7, 20, 'Independencia de Colombia'],
  [8, 7, 'Batalla de Boyacá'],
  [12, 8, 'Inmaculada Concepción'],
  [12, 25, 'Navidad'],
];

const EMILIANI = [
  [1, 6, 'Reyes Magos'],
  [3, 19, 'San José'],
  [6, 29, 'San Pedro y San Pablo'],
  [8, 15, 'Asunción de la Virgen'],
  [10, 12, 'Día de la Raza'],
  [11, 1, 'Todos los Santos'],
  [11, 11, 'Independencia de Cartagena'],
];

function fechaUtc(anio, mes, dia) {
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function sumarDias(fecha, dias) {
  return new Date(fecha.getTime() + dias * 86400000);
}

function siguienteLunes(fecha) {
  const dia = fecha.getUTCDay();
  const delta = (1 - dia + 7) % 7;
  return sumarDias(fecha, delta);
}

function pascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return fechaUtc(anio, mes, dia);
}

function iso(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function festivosDelAnio(anio) {
  const lista = [];
  FIJOS.forEach(([mes, dia, nombre]) => {
    lista.push({ fecha: iso(fechaUtc(anio, mes, dia)), nombre });
  });
  EMILIANI.forEach(([mes, dia, nombre]) => {
    lista.push({ fecha: iso(siguienteLunes(fechaUtc(anio, mes, dia))), nombre });
  });
  const domingoPascua = pascua(anio);
  lista.push({ fecha: iso(sumarDias(domingoPascua, -3)), nombre: 'Jueves Santo' });
  lista.push({ fecha: iso(sumarDias(domingoPascua, -2)), nombre: 'Viernes Santo' });
  lista.push({ fecha: iso(sumarDias(domingoPascua, 43)), nombre: 'Ascensión del Señor' });
  lista.push({ fecha: iso(sumarDias(domingoPascua, 64)), nombre: 'Corpus Christi' });
  lista.push({ fecha: iso(sumarDias(domingoPascua, 71)), nombre: 'Sagrado Corazón' });
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

const cache = new Map();

function festivosColombia(anio) {
  if (!cache.has(anio)) cache.set(anio, festivosDelAnio(anio));
  return cache.get(anio);
}

function normalizarFecha(fecha) {
  if (fecha instanceof Date) return iso(fecha);
  return String(fecha).slice(0, 10);
}

function esFestivo(fecha) {
  const texto = normalizarFecha(fecha);
  const anio = Number(texto.slice(0, 4));
  if (!Number.isInteger(anio) || texto.length !== 10) return null;
  return festivosColombia(anio).find((item) => item.fecha === texto) || null;
}

function festivosEntre(desde, hasta) {
  const inicio = normalizarFecha(desde);
  const fin = normalizarFecha(hasta);
  const anioInicio = Number(inicio.slice(0, 4));
  const anioFin = Number(fin.slice(0, 4));
  if (!Number.isInteger(anioInicio) || !Number.isInteger(anioFin) || anioFin < anioInicio) return [];
  const lista = [];
  for (let anio = anioInicio; anio <= anioFin; anio += 1) {
    festivosColombia(anio).forEach((item) => {
      if (item.fecha >= inicio && item.fecha <= fin) lista.push(item);
    });
  }
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

module.exports = { festivosColombia, festivosEntre, esFestivo };
