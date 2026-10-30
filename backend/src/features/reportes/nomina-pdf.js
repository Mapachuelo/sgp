const PDFDocument = require('pdfkit');

const dinero = (valor) =>
  `$${Number(valor || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;

function fechaTexto(fecha) {
  return new Date(`${String(fecha).slice(0, 10)}T00:00:00`).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function filaTabla(doc, columnas, y, valores, opciones = {}) {
  const { negrita = false, fondo = null } = opciones;
  const alto = 20;
  if (fondo) {
    doc.save().fillColor(fondo).rect(40, y - 3, 515, alto).fill().restore();
  }
  doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#1f2937');
  let x = 44;
  columnas.forEach((columna, indice) => {
    doc.text(String(valores[indice] ?? ''), x, y, {
      width: columna.ancho,
      align: columna.alineacion || 'left',
      lineBreak: false,
    });
    x += columna.ancho;
  });
  return y + alto;
}

async function generarNominaPdf(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const terminado = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827').text('SGP', 40, 40);
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text('Sistema de Gestión de Peluquería', 40, 64);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Nómina', 40, 92);
  doc.font('Helvetica').fontSize(9).fillColor('#4b5563');
  doc.text(`Período: ${fechaTexto(data.desde)} – ${fechaTexto(data.hasta)}`, 40, 118);
  doc.text(`Sede: ${data.ubicacion?.nombre || 'Todas las sedes'}`, 40, 132);
  doc.text(
    `Empleado: ${data.empleado ? `${data.empleado.nombre} ${data.empleado.apellido || ''}`.trim() : 'Todos los empleados'}`,
    40,
    146
  );

  let y = 176;
  const columnasResumen = [
    { ancho: 160, alineacion: 'left' },
    { ancho: 75, alineacion: 'right' },
    { ancho: 90, alineacion: 'right' },
    { ancho: 100, alineacion: 'right' },
  ];
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Resumen por empleado', 40, y);
  y += 18;
  y = filaTabla(doc, columnasResumen, y, ['Empleado', '% empleado', 'Empleado', 'Salón'], {
    negrita: true,
    fondo: '#e5e7eb',
  });
  for (const fila of data.resumen) {
    if (y > 750) {
      doc.addPage();
      y = 50;
    }
    y = filaTabla(doc, columnasResumen, y, [
      fila.empleado_nombre,
      `${Number(fila.porcentaje).toFixed(2)}%`,
      dinero(fila.empleado_parte),
      dinero(fila.salon_parte),
    ]);
  }
  y = filaTabla(doc, columnasResumen, y, [
    'Total',
    '',
    dinero(data.totales.empleado_parte),
    dinero(data.totales.salon_parte),
  ], { negrita: true, fondo: '#f3f4f6' });

  if (data.empleado && data.detalle.length > 0) {
    y += 20;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Detalle de servicios', 40, y);
    y += 18;
    const columnasDetalle = [
      { ancho: 62 },
      { ancho: 105 },
      { ancho: 115 },
      { ancho: 90 },
      { ancho: 70, alineacion: 'right' },
      { ancho: 70, alineacion: 'right' },
    ];
    y = filaTabla(doc, columnasDetalle, y, ['Fecha', 'Cliente', 'Servicio', 'Sede', 'Bruto', 'Empleado'], {
      negrita: true,
      fondo: '#e5e7eb',
    });
    for (const fila of data.detalle) {
      if (y > 760) {
        doc.addPage();
        y = 50;
      }
      y = filaTabla(doc, columnasDetalle, y, [
        fechaTexto(fila.fecha),
        fila.cliente,
        fila.servicio,
        fila.sede,
        dinero(fila.bruto),
        dinero(fila.empleado_parte),
      ]);
    }
  }

  doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
  doc.text('Total bruto del período: ' + dinero(data.totales.bruto), 40, Math.min(y + 14, 790));
  doc.text('Documento generado por SGP. El porcentaje aplicado queda registrado en este PDF.', 40, Math.min(y + 28, 800));

  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i += 1) {
    doc.switchToPage(paginas.start + i);
    doc.font('Helvetica').fontSize(8).fillColor('#9ca3af').text(
      `Página ${i + 1} de ${paginas.count}`,
      40,
      815,
      { width: 515, align: 'right' }
    );
  }

  doc.end();
  return terminado;
}

module.exports = { generarNominaPdf };
