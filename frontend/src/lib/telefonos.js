export const PAISES_TELEFONO = [
  { codigo: 'CO', nombre: 'Colombia', prefijo: '+57', longitud: 10 },
  { codigo: 'AR', nombre: 'Argentina', prefijo: '+54' },
  { codigo: 'BO', nombre: 'Bolivia', prefijo: '+591' },
  { codigo: 'BR', nombre: 'Brasil', prefijo: '+55' },
  { codigo: 'CL', nombre: 'Chile', prefijo: '+56' },
  { codigo: 'CR', nombre: 'Costa Rica', prefijo: '+506' },
  { codigo: 'CU', nombre: 'Cuba', prefijo: '+53' },
  { codigo: 'DO', nombre: 'Republica Dominicana', prefijo: '+1809' },
  { codigo: 'EC', nombre: 'Ecuador', prefijo: '+593' },
  { codigo: 'SV', nombre: 'El Salvador', prefijo: '+503' },
  { codigo: 'US', nombre: 'Estados Unidos / Canada', prefijo: '+1' },
  { codigo: 'GT', nombre: 'Guatemala', prefijo: '+502' },
  { codigo: 'HN', nombre: 'Honduras', prefijo: '+504' },
  { codigo: 'MX', nombre: 'Mexico', prefijo: '+52' },
  { codigo: 'NI', nombre: 'Nicaragua', prefijo: '+505' },
  { codigo: 'PA', nombre: 'Panama', prefijo: '+507' },
  { codigo: 'PY', nombre: 'Paraguay', prefijo: '+595' },
  { codigo: 'PE', nombre: 'Peru', prefijo: '+51' },
  { codigo: 'UY', nombre: 'Uruguay', prefijo: '+598' },
  { codigo: 'VE', nombre: 'Venezuela', prefijo: '+58' },
  { codigo: 'ES', nombre: 'Espana', prefijo: '+34' },
  { codigo: 'FR', nombre: 'Francia', prefijo: '+33' },
  { codigo: 'IT', nombre: 'Italia', prefijo: '+39' },
  { codigo: 'DE', nombre: 'Alemania', prefijo: '+49' },
  { codigo: 'PT', nombre: 'Portugal', prefijo: '+351' },
  { codigo: 'NL', nombre: 'Paises Bajos', prefijo: '+31' },
  { codigo: 'BE', nombre: 'Belgica', prefijo: '+32' },
  { codigo: 'CH', nombre: 'Suiza', prefijo: '+41' },
  { codigo: 'AT', nombre: 'Austria', prefijo: '+43' },
  { codigo: 'SE', nombre: 'Suecia', prefijo: '+46' },
  { codigo: 'NO', nombre: 'Noruega', prefijo: '+47' },
  { codigo: 'DK', nombre: 'Dinamarca', prefijo: '+45' },
  { codigo: 'FI', nombre: 'Finlandia', prefijo: '+358' },
  { codigo: 'IE', nombre: 'Irlanda', prefijo: '+353' },
  { codigo: 'GB', nombre: 'Reino Unido', prefijo: '+44' },
  { codigo: 'PL', nombre: 'Polonia', prefijo: '+48' },
  { codigo: 'RO', nombre: 'Rumania', prefijo: '+40' },
  { codigo: 'GR', nombre: 'Grecia', prefijo: '+30' },
  { codigo: 'TR', nombre: 'Turquia', prefijo: '+90' },
  { codigo: 'RU', nombre: 'Rusia', prefijo: '+7' },
  { codigo: 'UA', nombre: 'Ucrania', prefijo: '+380' },
  { codigo: 'CN', nombre: 'China', prefijo: '+86' },
  { codigo: 'JP', nombre: 'Japon', prefijo: '+81' },
  { codigo: 'KR', nombre: 'Corea del Sur', prefijo: '+82' },
  { codigo: 'IN', nombre: 'India', prefijo: '+91' },
  { codigo: 'ID', nombre: 'Indonesia', prefijo: '+62' },
  { codigo: 'PH', nombre: 'Filipinas', prefijo: '+63' },
  { codigo: 'TH', nombre: 'Tailandia', prefijo: '+66' },
  { codigo: 'VN', nombre: 'Vietnam', prefijo: '+84' },
  { codigo: 'MY', nombre: 'Malasia', prefijo: '+60' },
  { codigo: 'SG', nombre: 'Singapur', prefijo: '+65' },
  { codigo: 'AU', nombre: 'Australia', prefijo: '+61' },
  { codigo: 'NZ', nombre: 'Nueva Zelanda', prefijo: '+64' },
  { codigo: 'ZA', nombre: 'Sudafrica', prefijo: '+27' },
  { codigo: 'EG', nombre: 'Egipto', prefijo: '+20' },
  { codigo: 'MA', nombre: 'Marruecos', prefijo: '+212' },
  { codigo: 'IL', nombre: 'Israel', prefijo: '+972' },
  { codigo: 'SA', nombre: 'Arabia Saudita', prefijo: '+966' },
  { codigo: 'AE', nombre: 'Emiratos Arabes Unidos', prefijo: '+971' },
  { codigo: 'QA', nombre: 'Catar', prefijo: '+974' },
  { codigo: 'LB', nombre: 'Libano', prefijo: '+961' },
  { codigo: 'NG', nombre: 'Nigeria', prefijo: '+234' },
  { codigo: 'KE', nombre: 'Kenia', prefijo: '+254' },
  { codigo: 'GH', nombre: 'Ghana', prefijo: '+233' },
  { codigo: 'ET', nombre: 'Etiopia', prefijo: '+251' },
  { codigo: 'PK', nombre: 'Pakistan', prefijo: '+92' },
  { codigo: 'BD', nombre: 'Banglades', prefijo: '+880' },
  { codigo: 'LK', nombre: 'Sri Lanka', prefijo: '+94' },
  { codigo: 'NP', nombre: 'Nepal', prefijo: '+977' },
];

const PAIS_POR_DEFECTO = PAISES_TELEFONO[0];

export function obtenerPais(codigo) {
  return PAISES_TELEFONO.find((pais) => pais.codigo === codigo) || PAIS_POR_DEFECTO;
}

export function separarTelefono(valor) {
  const limpio = typeof valor === 'string' ? valor.trim() : '';
  if (limpio.startsWith('+')) {
    const candidatos = PAISES_TELEFONO
      .filter((pais) => limpio.startsWith(pais.prefijo))
      .sort((a, b) => b.prefijo.length - a.prefijo.length);
    if (candidatos.length > 0) {
      const pais = candidatos[0];
      return { pais, numero: limpio.slice(pais.prefijo.length).replace(/\D/g, '') };
    }
  }
  const digitos = limpio.replace(/\D/g, '');
  if (digitos.length === 10 && digitos.startsWith('3')) {
    return { pais: PAIS_POR_DEFECTO, numero: digitos };
  }
  return { pais: PAIS_POR_DEFECTO, numero: digitos };
}

export function construirTelefono(pais, numero) {
  const digitos = String(numero || '').replace(/\D/g, '');
  return digitos ? `${pais.prefijo}${digitos}` : '';
}

export function validarTelefonoInternacional(valor) {
  const normalizado = String(valor || '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(normalizado)) return false;
  if (normalizado.startsWith('+57')) return /^\+57\d{10}$/.test(normalizado);
  return true;
}
