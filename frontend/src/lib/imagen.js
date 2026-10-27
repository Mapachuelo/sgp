const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_ENTRADA = 6 * 1024 * 1024;

async function cargar(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* usa el fallback con Image */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

export async function comprimirImagen(file, { maxLado = 900, maxBytes = 220 * 1024 } = {}) {
  if (!file) throw new Error('Selecciona una imagen');
  if (!TIPOS.includes(file.type)) {
    throw new Error('La imagen debe ser JPG, PNG o WebP');
  }
  if (file.size > MAX_ENTRADA) {
    throw new Error('La imagen supera los 6 MB');
  }

  const fuente = await cargar(file);
  const anchoOriginal = fuente.width || fuente.naturalWidth;
  const altoOriginal = fuente.height || fuente.naturalHeight;
  const canvas = document.createElement('canvas');
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('El navegador no pudo procesar la imagen');

  let escala = Math.min(1, maxLado / Math.max(anchoOriginal, altoOriginal));
  let calidad = 0.82;

  for (let intento = 0; intento < 7; intento += 1) {
    const ancho = Math.max(160, Math.round(anchoOriginal * escala));
    const alto = Math.max(160, Math.round(altoOriginal * escala));
    canvas.width = ancho;
    canvas.height = alto;
    contexto.clearRect(0, 0, ancho, alto);
    contexto.drawImage(fuente, 0, 0, ancho, alto);

    const webp = canvas.toDataURL('image/webp', calidad);
    const salida = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', calidad);
    if (salida.length <= maxBytes || (ancho <= 240 && calidad <= 0.45)) {
      if (fuente.close) fuente.close();
      return salida;
    }
    escala *= 0.82;
    calidad = Math.max(0.45, calidad - 0.08);
  }

  if (fuente.close) fuente.close();
  throw new Error('No se pudo comprimir la imagen; intenta con otra');
}
