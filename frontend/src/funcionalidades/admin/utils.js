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

const TOTAL_SEDES = 7;

export function estiloSede(indice) {
  const numero = ((indice % TOTAL_SEDES) + TOTAL_SEDES) % TOTAL_SEDES + 1;
  return {
    backgroundColor: `var(--sede-${numero}-bg)`,
    borderColor: `var(--sede-${numero}-border)`,
    color: `var(--sede-${numero}-ink)`,
  };
}

export const COLOR_ESTADO_CITA = {
  pendiente: { bg: 'var(--pill-warning-bg)', texto: 'var(--pill-warning-ink)', borde: 'var(--pill-warning-border)' },
  confirmada: { bg: 'var(--pill-accent-bg)', texto: 'var(--pill-accent-ink)', borde: 'var(--pill-accent-border)' },
  en_curso: { bg: 'var(--pill-info-bg)', texto: 'var(--pill-info-ink)', borde: 'var(--pill-info-border)' },
  cobrado: { bg: 'var(--pill-positive-bg)', texto: 'var(--pill-positive-ink)', borde: 'var(--pill-positive-border)' },
  cancelada: { bg: 'var(--pill-negative-bg)', texto: 'var(--pill-negative-ink)', borde: 'var(--pill-negative-border)' },
};
