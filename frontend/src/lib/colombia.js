export const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca',
  'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño',
  'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia',
  'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
  'Bogotá D.C.',
];

export const CIUDADES_POR_DEPARTAMENTO = {
  Amazonas: ['Leticia', 'Puerto Nariño'],
  Antioquia: ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Rionegro', 'Sabaneta', 'Caldas', 'La Estrella'],
  Arauca: ['Arauca', 'Saravena', 'Tame'],
  Atlántico: ['Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga'],
  Bolívar: ['Cartagena', 'Magangué', 'Turbaco', 'El Carmen de Bolívar'],
  Boyacá: ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá'],
  Caldas: ['Manizales', 'Villamaría', 'Chinchiná', 'La Dorada'],
  Caquetá: ['Florencia', 'San Vicente del Caguán', 'Puerto Rico'],
  Casanare: ['Yopal', 'Aguazul', 'Villanueva'],
  Cauca: ['Popayán', 'Santander de Quilichao', 'Puerto Tejada'],
  Cesar: ['Valledupar', 'Aguachica', 'Bosconia'],
  Chocó: ['Quibdó', 'Istmina', 'Apartadó'],
  Córdoba: ['Montería', 'Cereté', 'Sahagún', 'Lorica'],
  Cundinamarca: ['Soacha', 'Zipaquirá', 'Facatativá', 'Chía', 'Cajicá', 'Fusagasugá', 'Girardot'],
  Guainía: ['Inírida'],
  Guaviare: ['San José del Guaviare'],
  Huila: ['Neiva', 'Pitalito', 'Garzón', 'La Plata'],
  'La Guajira': ['Riohacha', 'Maicao', 'Uribia'],
  Magdalena: ['Santa Marta', 'Ciénaga', 'Fundación'],
  Meta: ['Villavicencio', 'Acacías', 'Granada'],
  Nariño: ['Pasto', 'Ipiales', 'Tumaco', 'La Unión'],
  'Norte de Santander': ['Cúcuta', 'Ocaña', 'Pamplona', 'Villa del Rosario'],
  Putumayo: ['Mocoa', 'Puerto Asís', 'Orito'],
  Quindío: ['Armenia', 'Calarcá', 'Montenegro'],
  Risaralda: ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal'],
  'San Andrés y Providencia': ['San Andrés', 'Providencia'],
  Santander: ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja'],
  Sucre: ['Sincelejo', 'Corozal', 'Sampués'],
  Tolima: ['Ibagué', 'Espinal', 'Melgar'],
  'Valle del Cauca': ['Cali', 'Palmira', 'Buenaventura', 'Tuluá', 'Cartago', 'Buga'],
  Vaupés: ['Mitú'],
  Vichada: ['Puerto Carreño'],
  'Bogotá D.C.': ['Bogotá'],
};

export function ciudadesDeDepartamento(departamento) {
  return CIUDADES_POR_DEPARTAMENTO[departamento] || [];
}

export function normalizarUbicacion(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function departamentoDeCiudad(ciudad) {
  const buscada = normalizarUbicacion(ciudad);
  for (const [departamento, ciudades] of Object.entries(CIUDADES_POR_DEPARTAMENTO)) {
    if (ciudades.some((item) => normalizarUbicacion(item) === buscada)) return departamento;
  }
  return '';
}
