export function estadoBadgeVariant(estado) {
  const mapa = {
    confirmada: 'success',
    completada: 'success',
    cobrado: 'success',
    en_curso: 'info',
    cancelada: 'danger',
    no_show: 'danger',
    pendiente: 'warning',
  };
  return mapa[estado] || 'default';
}

export function estadoLabel(estado) {
  const mapa = {
    confirmada: 'Confirmada',
    completada: 'Completada',
    cobrado: 'Completada',
    en_curso: 'En curso',
    cancelada: 'Cancelada',
    no_show: 'No show',
    pendiente: 'Pendiente',
  };
  return mapa[estado] || estado;
}

export function hoy() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatearFechaLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function sumarDias(fecha, dias) {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

export function lunesDeSemana(fecha) {
  const copia = new Date(fecha);
  const dia = copia.getDay();
  const desplazamiento = dia === 0 ? -6 : 1 - dia;
  copia.setDate(copia.getDate() + desplazamiento);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

export function fechaHoyBogota() {
  const texto = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${texto}T00:00:00`);
}

export function fechaBogotaDeIso(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function horaBogotaDeIso(iso) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export const DIAS_SEMANA = [
  { numero: 1, corto: 'LUN', nombre: 'Lunes' },
  { numero: 2, corto: 'MAR', nombre: 'Martes' },
  { numero: 3, corto: 'MIE', nombre: 'Miercoles' },
  { numero: 4, corto: 'JUE', nombre: 'Jueves' },
  { numero: 5, corto: 'VIE', nombre: 'Viernes' },
  { numero: 6, corto: 'SAB', nombre: 'Sabado' },
  { numero: 7, corto: 'DOM', nombre: 'Domingo' },
];

export const PALETA_SEDES = [
  { bg: '#DCE8E0', borde: '#A3C9A8', texto: '#3F6B4C' },
  { bg: '#DCE8F2', borde: '#A3BDD4', texto: '#3F5F7F' },
  { bg: '#F5E8DC', borde: '#E5C7A3', texto: '#8A5E1F' },
  { bg: '#EADCF5', borde: '#CFA3E5', texto: '#6B4A86' },
  { bg: '#F5DCE6', borde: '#E5A3BD', texto: '#8A4A6B' },
  { bg: '#E3F0DA', borde: '#B5D4A0', texto: '#4F6B3F' },
  { bg: '#F2E9D5', borde: '#D9C79A', texto: '#7A6528' },
];

export function estiloSede(indice) {
  const color = PALETA_SEDES[((indice % PALETA_SEDES.length) + PALETA_SEDES.length) % PALETA_SEDES.length];
  return { backgroundColor: color.bg, borderColor: color.borde, color: color.texto };
}

export const COLOR_ESTADO_CITA = {
  pendiente: { bg: '#FFF3E6', texto: '#8F5E1D', borde: '#F0C78E' },
  confirmada: { bg: '#E3EEF7', texto: '#3F5F7F', borde: '#A3BDD4' },
  en_curso: { bg: '#DCE8F2', texto: '#3F5F7F', borde: '#7FA8C9' },
  cobrado: { bg: '#DCE8E0', texto: '#3F6B4C', borde: '#A3C9A8' },
  cancelada: { bg: '#F5E6E3', texto: '#8F3B2E', borde: '#E8C5C0' },
};
