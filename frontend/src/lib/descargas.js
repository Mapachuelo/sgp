export function descargarDataUrl(dataUrl, nombreArchivo) {
  if (!dataUrl) return false;
  const enlace = document.createElement('a');
  enlace.href = dataUrl;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  return true;
}

export function descargarQrReserva(reserva) {
  if (!reserva?.qr_data_url) return false;
  return descargarDataUrl(reserva.qr_data_url, `reserva-${reserva.id || 'qr'}.png`);
}

export function descargarTexto(nombreArchivo, contenido) {
  const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}