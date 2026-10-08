const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
let contador = 0;
const nuevoId = () => `c${++contador}`;

function xml(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;');
}

function nodo(celdas, x, y, w, h, valor, estilo = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#8B5E3C;fontColor=#2D2420;') {
  const id = nuevoId();
  celdas.push(`<mxCell id="${id}" value="${xml(valor)}" style="${estilo}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
  return id;
}

function actor(celdas, x, y, valor) {
  return nodo(celdas, x, y, 40, 60, valor, 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;fillColor=#FAF7F2;strokeColor=#8B5E3C;fontColor=#2D2420;');
}

function elipse(celdas, x, y, w, h, valor) {
  return nodo(celdas, x, y, w, h, valor, 'ellipse;whiteSpace=wrap;html=1;fillColor=#F5E8DC;strokeColor=#C4883C;fontColor=#2D2420;');
}

function entidad(celdas, x, y, w, h, titulo, campos) {
  const tituloId = nodo(celdas, x, y, w, 26, titulo, 'rounded=0;whiteSpace=wrap;html=1;fillColor=#8B5E3C;fontColor=#FFFFFF;fontStyle=1;');
  const cuerpo = campos
    .map((campo) => `<div style="text-align:left;font-size:11px;padding:1px 4px;">${xml(campo)}</div>`)
    .join('');
  nodo(celdas, x, y + 26, w, h - 26, cuerpo, 'rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;fillColor=#FFFFFF;strokeColor=#8B5E3C;fontColor=#2D2420;');
  return tituloId;
}

function flecha(celdas, fuente, destino, etiqueta = '', estilo = 'edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;strokeColor=#8C7B70;fontColor=#6F6157;fontSize=10;') {
  const id = nuevoId();
  celdas.push(`<mxCell id="${id}" value="${xml(etiqueta)}" style="${estilo}" edge="1" parent="1" source="${fuente}" target="${destino}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  return id;
}

function flechaLibre(celdas, x1, y1, x2, y2, etiqueta = '', estilo = 'edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;strokeColor=#8C7B70;fontColor=#6F6157;fontSize=10;') {
  const id = nuevoId();
  celdas.push(`<mxCell id="${id}" value="${xml(etiqueta)}" style="${estilo}" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${x1}" y="${y1}" as="sourcePoint"/><mxPoint x="${x2}" y="${y2}" as="targetPoint"/></mxGeometry></mxCell>`);
  return id;
}

function diagrama(nombre, id, celdas, ancho = 1200, alto = 900) {
  return `<diagram id="${id}" name="${xml(nombre)}"><mxGraphModel dx="${ancho}" dy="${alto}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="826" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${celdas.join('')}</root></mxGraphModel></diagram>`;
}

function archivoDrawio(paginas) {
  return `<mxfile host="app.diagrams.net" modified="2026-09-27T00:00:00.000Z" agent="SGP" version="24.7.17" type="device">${paginas.join('')}</mxfile>`;
}

function tituloPagina(celdas, texto) {
  return nodo(celdas, 20, 20, 460, 36, texto, 'text;html=1;fontSize=18;fontStyle=1;align=left;verticalAlign=middle;fontColor=#2D2420;');
}

function bloque(celdas, x, y, w, h, valor, color = '#F5E8DC') {
  return nodo(celdas, x, y, w, h, valor, `rounded=1;whiteSpace=wrap;html=1;fillColor=${color};strokeColor=#8B5E3C;fontColor=#2D2420;fontSize=11;`);
}

function cajaProceso(celdas, x, y, w, h, valor, color = '#DCE8E0') {
  return bloque(celdas, x, y, w, h, valor, color);
}

function circulo(celdas, x, y, valor, tipo = 'start') {
  const estilo = tipo === 'start'
    ? 'ellipse;whiteSpace=wrap;html=1;fillColor=#4A7C59;strokeColor=#2F5A3D;fontColor=#FFFFFF;fontSize=10;'
    : 'ellipse;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#8C7B70;fontColor=#2D2420;fontSize=10;';
  return nodo(celdas, x, y, 46, 46, valor, estilo);
}

// ---------------- Pagina: flujo actual ----------------
function paginaFlujoActual() {
  const c = [];
  tituloPagina(c, 'Flujo actual del sistema (2026)');
  bloque(c, 20, 70, 250, 660, '<b>Cliente</b>', '#FAF7F2');
  bloque(c, 290, 70, 250, 660, '<b>Empleado</b>', '#FAF7F2');
  bloque(c, 560, 70, 590, 660, '<b>Administrador</b>', '#FAF7F2');

  const cli = [
    'Registro (nombre, +57, correo)',
    'Verificacion OTP por correo',
    'Login unificado -> rol cliente',
    'Reservar: sede -> estilista -> calendario',
    'Modal: servicio, duracion, personas 1-5',
    'Confirmar reserva + QR unico',
    'Kanban por estado + mapa + descargar QR',
    'Cancelar reserva / editar perfil',
  ].map((texto, i) => cajaProceso(c, 40, 100 + i * 60, 210, 42, texto, '#DCE8E0'));

  const emp = [
    'Login unificado -> rol empleado',
    'Citas de hoy (timeline por color)',
    'Validar QR (manual / camara)',
    'Registrar cobro (online $0 / efectivo)',
    'Estado final: cobrado',
    'Disponibilidad semanal por sede',
    'Cambio de sede -> cancela dia anterior',
  ].map((texto, i) => cajaProceso(c, 310, 100 + i * 60, 210, 42, texto, '#DCE8F2'));

  const adm = [
    'Login unificado -> rol admin',
    'KPIs + timeline de todas las sedes',
    'Planificador empleados x LUN-DOM',
    'CRUD empleados / servicios / sedes',
    'Reportes: ventas, ocupacion, recurrentes',
    'Moderar clientes (bloquear/eliminar)',
    'Logs.txt / errores.txt + export',
    'Modal Validar QR / Registrar cobro',
  ].map((texto, i) => cajaProceso(c, 580, 100 + i * 60, 550, 42, texto, '#F5E8DC'));

  const enlazar = (lista) => {
    for (let i = 0; i < lista.length - 1; i++) flecha(c, lista[i], lista[i + 1]);
  };
  enlazar(cli);
  enlazar(emp);
  enlazar(adm);

  circulo(c, 640, 660, 'Fin');
  flecha(c, emp[4], adm[1], 'reserva.cobrada (WS)', 'edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;dashed=1;strokeColor=#8C7B70;fontColor=#6F6157;fontSize=10;');
  flecha(c, emp[6], adm[6], 'reserva.actualizada (WS)', 'edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;dashed=1;strokeColor=#8C7B70;fontColor=#6F6157;fontSize=10;');

  return diagrama('Flujo actual', 'flujoActual', c, 1200, 800);
}

// ---------------- Paginas UML ----------------
function paginaCasosDeUso() {
  const c = [];
  tituloPagina(c, 'Casos de uso');
  const cliente = actor(c, 60, 220, 'Cliente');
  const empleado = actor(c, 60, 520, 'Empleado');
  const admin = actor(c, 60, 830, 'Administrador');

  const casosCliente = [
    'Registrarse',
    'Verificar cuenta (OTP)',
    'Iniciar sesion',
    'Reservar cita',
    'Ver reservas (kanban)',
    'Descargar QR',
    'Cancelar reserva',
    'Editar perfil',
  ].map((t, i) => elipse(c, 320, 120 + i * 70, 220, 46, t));
  const casosEmpleado = [
    'Ver citas del dia',
    'Validar QR',
    'Registrar cobro',
    'Gestionar disponibilidad',
    'Editar perfil',
  ].map((t, i) => elipse(c, 640, 300 + i * 70, 220, 46, t));
  const casosAdmin = [
    'Ver KPIs y timeline',
    'Planificador de horarios',
    'Gestionar empleados',
    'Gestionar servicios',
    'Gestionar sedes',
    'Configurar jornadas',
    'Ver reportes',
    'Moderar clientes',
    'Ver logs',
    'Validar QR y cobro',
  ].map((t, i) => elipse(c, 960, 100 + i * 70, 240, 46, t));

  casosCliente.forEach((id) => flecha(c, cliente, id));
  casosEmpleado.forEach((id) => flecha(c, empleado, id));
  casosAdmin.forEach((id) => flecha(c, admin, id));
  return diagrama('Casos de uso', 'casosUso', c, 1300, 1000);
}

function paginaClases() {
  const c = [];
  tituloPagina(c, 'Diagrama de clases (dominio)');
  const usuario = entidad(c, 60, 100, 260, 210, 'AppUser', [
    '+ id: serial (PK)',
    '+ email: varchar (UQ)',
    '+ password_hash: text',
    '+ rol: cliente|empleado|admin',
    '+ nombre, apellido: varchar',
    '+ telefono: text (AES-256)',
    '+ verificado / esta_bloqueado',
  ]);
  const perfil = entidad(c, 60, 360, 260, 110, 'EmpleadoPerfil', [
    '+ usuario_id: int (PK/FK)',
    '+ identificacion: varchar',
    '+ ubicacion_base_id: int (FK)',
  ]);
  const ubicacion = entidad(c, 60, 520, 260, 130, 'Ubicacion', [
    '+ id: serial (PK)',
    '+ nombre, direccion: text',
    '+ latitud, longitud: double',
  ]);
  const reserva = entidad(c, 440, 100, 300, 230, 'Reserva', [
    '+ id: serial (PK)',
    '+ cliente_id / empleado_id (FK)',
    '+ servicio_id / ubicacion_id (FK)',
    '+ inicia_en, termina_en: timestamptz',
    '+ cantidad_personas: int (1-5)',
    '+ estado: pendiente|confirmada|en_curso|cobrado|cancelada',
    '+ qr_token: uuid (UQ)',
    '+ motivo_cancelacion: text',
  ]);
  const cobro = entidad(c, 440, 380, 300, 130, 'Cobro', [
    '+ id: serial (PK)',
    '+ reserva_id: int (UQ/FK)',
    '+ monto: decimal',
    '+ metodo: fisico|online',
    '+ cobrado_en / registrado_por',
  ]);
  const servicio = entidad(c, 820, 100, 280, 130, 'ServicioCatalogo', [
    '+ id: serial (PK)',
    '+ nombre, descripcion: text',
    '+ precio_base: decimal',
    '+ duracion_base_minutos: int',
  ]);
  const tiempo = entidad(c, 820, 280, 280, 110, 'EmpleadoTiempoServicio', [
    '+ empleado_id: int (FK)',
    '+ servicio_id: int (FK)',
    '+ duracion_minutos: int',
  ]);
  const disponibilidad = entidad(c, 820, 440, 280, 130, 'EmpleadoDisponibilidad', [
    '+ empleado_id: int (FK)',
    '+ ubicacion_id: int (FK)',
    '+ dia_semana: int (1-7)',
    '+ hora_inicio, hora_fin: time',
  ]);
  const jornada = entidad(c, 440, 560, 300, 120, 'Jornada', [
    '+ ubicacion_id: int (FK)',
    '+ fecha: date',
    '+ hora_inicio, hora_fin: time',
  ]);
  const preferencia = entidad(c, 60, 700, 260, 140, 'PreferenciaUsuario', [
    '+ usuario_id: int (PK/FK)',
    '+ rango_hora_desde/hasta: time',
    '+ granularidad_calendario: int',
    '+ tema: varchar',
    '+ idioma: es|en',
  ]);

  flecha(c, usuario, perfil, '1 a 0..1');
  flecha(c, usuario, reserva, 'cliente 1..*');
  flecha(c, reserva, cobro, '1 a 0..1');
  flecha(c, reserva, servicio, 'N a 1');
  flecha(c, reserva, ubicacion, 'N a 1');
  flecha(c, servicio, tiempo, 'N a M');
  flecha(c, usuario, disponibilidad, 'empleado 0..*');
  flecha(c, disponibilidad, ubicacion, 'N a 1');
  flecha(c, ubicacion, jornada, '1 a 0..*');
  flecha(c, usuario, preferencia, '1 a 1');
  return diagrama('Clases', 'clases', c, 1200, 1000);
}

function dibujarParticipantes(c, participantes, xInicial = 60, ancho = 200, paso = 250, color = '#8B5E3C') {
  return participantes.map((p, i) => {
    const x = xInicial + i * paso;
    nodo(c, x, 80, ancho, 40, p, `rounded=1;whiteSpace=wrap;html=1;fillColor=${color};fontColor=#FFFFFF;fontStyle=1;`);
    const centro = x + ancho / 2;
    c.push(`<mxCell id="${nuevoId()}" value="" style="endArrow=none;dashed=1;html=1;strokeColor=#8C7B70;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${centro}" y="120" as="sourcePoint"/><mxPoint x="${centro}" y="820" as="targetPoint"/></mxGeometry></mxCell>`);
    return centro;
  });
}

function paginaSecuenciaReserva() {
  const c = [];
  tituloPagina(c, 'Secuencia: Reserva -> QR');
  const vida = dibujarParticipantes(c, ['Cliente (UI)', 'API /reservas', 'ReservasService', 'PostgreSQL']);

  const mensajes = [
    ['Clic en horario libre', 0, 1],
    ['Modal: servicio + personas + duracion', 0, 1],
    ['POST /reservas {empleado, servicio, sede, inicia_en, personas}', 1, 2],
    ['Validar anticipacion >= 60 min', 2, 3],
    ['Contar reservas activas (< 5)', 2, 3],
    ['pg_advisory_xact_lock(empleado, dia)', 2, 3],
    ['Buscar solape y verificar disponibilidad', 2, 3],
    ['INSERT reserva + QR (qrcode)', 2, 3],
    ['201 {reserva, qr_data_url}', 3, 1],
    ['Mostrar confirmacion y descargar QR', 1, 0],
    ['[409] solape -> volver al calendario y refrescar', 1, 0],
  ];
  mensajes.forEach(([texto, desde, hasta], i) => {
    const y = 170 + i * 56;
    const estilo = i === 10 ? 'html=1;endArrow=block;dashed=1;strokeColor=#B84C3D;fontColor=#B84C3D;fontSize=10;' : undefined;
    flechaLibre(c, vida[desde], y, vida[hasta], y, texto, estilo);
  });
  return diagrama('Secuencia reserva', 'secuenciaReserva', c, 1200, 950);
}

function paginaSecuenciaCheckin() {
  const c = [];
  tituloPagina(c, 'Secuencia: Validacion -> Cobro (atomico)');
  const vida = dibujarParticipantes(c, ['Empleado (UI)', 'API /checkin', 'CheckinService', 'PostgreSQL', 'WebSocket'], 40, 180, 235, '#4A7C59');

  const mensajes = [
    ['Ingresar token QR + monto', 0, 1],
    ['Validar UUID y monto >= 0', 1, 2],
    ['withTransaction + SELECT ... FOR UPDATE', 2, 3],
    ['Validar estado activo y ventana +-120 min', 1, 1],
    ['INSERT cobro (UNIQUE reserva_id)', 2, 3],
    ['UPDATE reserva SET estado = cobrado', 2, 3],
    ['COMMIT', 2, 3],
    ['200 {estado: cobrado, metodo, monto}', 2, 1],
    ['reserva.actualizada (WS)', 1, 4],
    ['[409] ya cobrada / [400] fuera de ventana', 1, 0],
  ];
  mensajes.forEach(([texto, desde, hasta], i) => {
    const y = 170 + i * 56;
    const estilo = i === 9 ? 'html=1;endArrow=block;dashed=1;strokeColor=#B84C3D;fontColor=#B84C3D;fontSize=10;' : undefined;
    flechaLibre(c, vida[desde], y, vida[hasta], y, texto, estilo);
  });
  return diagrama('Secuencia check-in', 'secuenciaCheckin', c, 1300, 900);
}

function paginaEstados() {
  const c = [];
  tituloPagina(c, 'Estados de la reserva');
  const inicio = circulo(c, 60, 160, 'inicio');
  const pendiente = cajaProceso(c, 180, 160, 150, 46, 'pendiente', '#FFF3E6');
  const confirmada = cajaProceso(c, 390, 160, 150, 46, 'confirmada', '#DCE8F2');
  const enCurso = cajaProceso(c, 600, 160, 150, 46, 'en_curso', '#DCE8F2');
  const cobrado = cajaProceso(c, 810, 160, 150, 46, 'cobrado', '#DCE8E0');
  const cancelada = cajaProceso(c, 390, 330, 150, 46, 'cancelada', '#F5E6E3');
  flecha(c, inicio, pendiente);
  flecha(c, pendiente, confirmada, 'confirmar');
  flecha(c, confirmada, enCurso, 'cliente llega');
  flecha(c, pendiente, cancelada, 'cancela cliente / no-show');
  flecha(c, confirmada, cancelada, 'cancela cliente / cambio de sede');
  flecha(c, enCurso, cobrado, 'check-in + cobro atomicos');
  nodo(c, 560, 330, 440, 60, 'Nota: el endpoint de check-in deja la reserva directamente en cobrado (RF3/RF4).', 'text;html=1;fontSize=11;fontColor=#6F6157;');
  return diagrama('Estados', 'estados', c, 1100, 600);
}

function paginaDespliegue() {
  const c = [];
  tituloPagina(c, 'Diagrama de despliegue');
  bloque(c, 40, 80, 1080, 600, '<b>Host Linux</b>', '#FAF7F2');
  nodo(c, 80, 140, 240, 60, 'Navegador (Chrome/Firefox)', 'rounded=1;whiteSpace=wrap;html=1;fillColor=#DCE8F2;strokeColor=#8B5E3C;');
  bloque(c, 400, 130, 680, 220, '<b>Pod sgp-app</b>', '#F5E8DC');
  nodo(c, 430, 180, 240, 110, 'Nginx (frontend)&#10;puerto 80 -> hostPort 8080&#10;SPA + proxy /api y /ws', 'rounded=1;whiteSpace=wrap;html=1;fillColor=#DCE8E0;strokeColor=#8B5E3C;fontSize=11;');
  nodo(c, 720, 180, 320, 110, 'Backend Node.js/Express :3000&#10;JWT + RBAC + Pino + WebSocket /ws&#10;Swagger /api/docs', 'rounded=1;whiteSpace=wrap;html=1;fillColor=#DCE8E0;strokeColor=#8B5E3C;fontSize=11;');
  bloque(c, 400, 390, 680, 220, '<b>Pod sgp-db</b>', '#F5E8DC');
  nodo(c, 430, 440, 240, 130, 'PostgreSQL 17 Alpine&#10;10 tablas + seeds&#10;Volumen PVC sgp-pgdata', 'rounded=1;whiteSpace=wrap;html=1;fillColor=#E3EEF7;strokeColor=#8B5E3C;fontSize=11;');
  nodo(c, 720, 440, 320, 130, 'init.sql&#10;database-init.js (migraciones idempotentes)&#10;cifrado de telefonos AES-256', 'rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#8B5E3C;fontSize=11;');
  nodo(c, 80, 250, 240, 120, 'Brevo API v3&#10;(correo OTP)', 'rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF3E6;strokeColor=#C4883C;fontSize=11;');
  nodo(c, 80, 420, 240, 60, 'Red Podman: sgp-net', 'rounded=1;whiteSpace=wrap;html=1;fillColor=#EADCF5;strokeColor=#8B5E3C;');
  flechaLibre(c, 320, 170, 430, 220, 'HTTP :8080');
  flechaLibre(c, 670, 235, 720, 235, '127.0.0.1:3000');
  flechaLibre(c, 880, 290, 880, 440, 'TCP 5432');
  flechaLibre(c, 320, 300, 720, 230, 'HTTPS API v3 (salida)', 'html=1;endArrow=block;dashed=1;strokeColor=#C4883C;fontColor=#8F5E1D;fontSize=10;');
  return diagrama('Despliegue', 'despliegue', c, 1200, 750);
}

function paginaEr() {
  const c = [];
  tituloPagina(c, 'Modelo entidad-relacion');
  const ubicacion = entidad(c, 40, 80, 220, 120, 'ubicacion', ['PK id', 'nombre', 'direccion', 'latitud, longitud']);
  const usuario = entidad(c, 40, 260, 220, 170, 'app_user', ['PK id', 'UQ email', 'rol, nombre, apellido', 'telefono (AES)', 'verificado / esta_bloqueado']);
  const perfil = entidad(c, 40, 490, 220, 110, 'empleado_perfil', ['PK/FK usuario_id', 'identificacion', 'FK ubicacion_base_id']);
  const preferencia = entidad(c, 40, 660, 220, 120, 'preferencia_usuario', ['PK/FK usuario_id', 'rango_hora', 'granularidad, tema, idioma']);
  const servicio = entidad(c, 380, 80, 220, 120, 'servicio_catalogo', ['PK id', 'nombre, descripcion', 'precio_base', 'duracion_base_minutos']);
  const tiempo = entidad(c, 380, 260, 220, 110, 'empleado_tiempo_servicio', ['FK empleado_id', 'FK servicio_id', 'duracion_minutos']);
  const disponibilidad = entidad(c, 380, 430, 220, 120, 'empleado_disponibilidad', ['FK empleado_id', 'FK ubicacion_id', 'dia_semana 1-7', 'hora_inicio, hora_fin']);
  const jornada = entidad(c, 380, 610, 220, 110, 'jornada', ['FK ubicacion_id', 'fecha', 'hora_inicio, hora_fin']);
  const reserva = entidad(c, 740, 80, 260, 190, 'reserva', ['PK id', 'FK cliente_id / empleado_id', 'FK servicio_id / ubicacion_id', 'inicia_en, termina_en', 'cantidad_personas', 'estado', 'UQ qr_token', 'motivo_cancelacion']);
  const cobro = entidad(c, 740, 340, 260, 130, 'cobro', ['PK id', 'UQ/FK reserva_id', 'monto, metodo', 'cobrado_en', 'FK registrado_por']);

  flecha(c, usuario, perfil, '1:1');
  flecha(c, usuario, preferencia, '1:1');
  flecha(c, usuario, reserva, 'cliente/empleado 1:N');
  flecha(c, servicio, reserva, '1:N');
  flecha(c, ubicacion, reserva, '1:N');
  flecha(c, servicio, tiempo, '1:N');
  flecha(c, usuario, disponibilidad, '1:N');
  flecha(c, ubicacion, jornada, '1:N');
  flecha(c, reserva, cobro, '1:0..1');
  flecha(c, usuario, cobro, 'registrado_por');
  return diagrama('Modelo ER', 'modeloEr', c, 1100, 850);
}

// ---------------- Salida ----------------
const rutaUml = path.join(RAIZ, 'docs', 'modelos-uml.drawio');
const paginas = [
  paginaCasosDeUso(),
  paginaClases(),
  paginaSecuenciaReserva(),
  paginaSecuenciaCheckin(),
  paginaEstados(),
  paginaDespliegue(),
  paginaEr(),
];
fs.writeFileSync(rutaUml, archivoDrawio(paginas), 'utf8');
console.log('Generado', rutaUml, 'con', paginas.length, 'paginas');

const rutaFlujo = path.join(RAIZ, 'docs', 'diagrama.drawio');
const flujo = fs.readFileSync(rutaFlujo, 'utf8');
if (!flujo.includes('name="Flujo actual"')) {
  const pagina = paginaFlujoActual();
  fs.writeFileSync(rutaFlujo, flujo.replace('</mxfile>', `${pagina}</mxfile>`), 'utf8');
  console.log('Agregada pagina "Flujo actual" a', rutaFlujo);
} else {
  console.log('La pagina "Flujo actual" ya existe en', rutaFlujo);
}
