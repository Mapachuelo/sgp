const fs = require('fs/promises');
const path = require('path');
const presentacionModel = require('./presentacion.model');
const HttpError = require('../../shared/http-error');
const env = require('../../config/env');

const IMAGENES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
const VIDEOS = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-m4v']);

const CODEX = {
  mp4: 'MP4',
  m4v: 'M4V',
  webm: 'WebM',
  ogv: 'Ogg',
  ogg: 'Ogg',
  mov: 'MOV',
};

const MIME_POR_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  avif: 'image/avif', gif: 'image/gif', mp4: 'video/mp4', m4v: 'video/x-m4v',
  webm: 'video/webm', ogv: 'video/ogg', ogg: 'video/ogg', mov: 'video/quicktime',
};

function extension(nombre) {
  return String(nombre || '').split('.').pop().toLowerCase();
}

function mimeDeArchivo(file) {
  return MIME_POR_EXT[extension(file.originalname)] || file.mimetype;
}

function mimeValido(file, tipo) {
  const mime = mimeDeArchivo(file);
  if (tipo === 'imagen') return IMAGENES.has(mime);
  return VIDEOS.has(mime);
}

function urlArchivo(file) {
  return `/api/presentacion/archivos/${path.basename(file.path)}`;
}

async function borrarArchivo(url) {
  if (!url) return;
  const nombre = path.basename(String(url));
  try {
    await fs.unlink(path.join(env.presentacionMediaDir, nombre));
  } catch {
    /* archivo ya eliminado */
  }
}

function validarTexto(valor, campo, maximo = 240) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  if (texto.length > maximo) throw new HttpError(400, `${campo} no puede superar ${maximo} caracteres`);
  return texto || null;
}

function archivosDe(files) {
  return Array.isArray(files?.archivos) ? files.archivos : [];
}

function posterDe(files) {
  return Array.isArray(files?.poster) && files.poster[0] ? files.poster[0] : null;
}

const presentacionService = {
  async getPublica() {
    const [config, media] = await Promise.all([
      presentacionModel.getConfig(),
      presentacionModel.findMedia({ soloActivos: true }),
    ]);
    return { config, media };
  },

  async getAdmin() {
    const [config, media] = await Promise.all([
      presentacionModel.getConfig(),
      presentacionModel.findMedia(),
    ]);
    return { config, media };
  },

  async updateConfig(data) {
    const payload = {};
    for (const campo of ['hero_etiqueta', 'hero_titulo', 'hero_subtitulo', 'hero_cta_principal', 'hero_cta_secundario',
      'seccion_cita_titulo', 'seccion_cita_texto', 'seccion_servicios_titulo', 'seccion_servicios_texto',
      'seccion_salon_titulo', 'seccion_salon_texto', 'seccion_sedes_titulo', 'seccion_sedes_texto',
      'cierre_titulo', 'cierre_texto']) {
      if (data[campo] !== undefined) payload[campo] = validarTexto(data[campo], campo, campo.includes('texto') || campo.includes('subtitulo') ? 1200 : 240);
    }
    if (data.activo !== undefined) payload.activo = Boolean(data.activo);
    return presentacionModel.updateConfig(payload);
  },

  async crearMedia({ body, files }) {
    const tipo = body.tipo;
    if (!['imagen', 'video'].includes(tipo)) throw new HttpError(400, 'tipo debe ser imagen o video');
    const archivos = archivosDe(files);
    if (archivos.length === 0) throw new HttpError(400, 'Selecciona al menos un archivo');
    if (tipo === 'imagen' && archivos.length !== 1) throw new HttpError(400, 'Una imagen se sube como un solo archivo');
    if (tipo === 'video' && archivos.length > 4) throw new HttpError(400, 'Un video admite hasta 4 versiones');
    for (const archivo of archivos) {
      if (!mimeValido(archivo, tipo)) {
        await Promise.all(archivos.map((item) => borrarArchivo(urlArchivo(item))));
        throw new HttpError(400, 'Formato de archivo no permitido');
      }
    }
    const poster = posterDe(files);
    if (poster && !IMAGENES.has(mimeDeArchivo(poster))) {
      await Promise.all(archivos.map((item) => borrarArchivo(urlArchivo(item))));
      await borrarArchivo(urlArchivo(poster));
      throw new HttpError(400, 'El poster debe ser una imagen valida');
    }

    const media = await presentacionModel.createMedia({
      tipo,
      titulo: validarTexto(body.titulo, 'titulo', 180),
      descripcion: validarTexto(body.descripcion, 'descripcion', 1200),
      alt: validarTexto(body.alt, 'alt', 240),
      poster_url: poster ? urlArchivo(poster) : null,
      orden: body.orden ? Number(body.orden) : null,
    });

    for (const [indice, archivo] of archivos.entries()) {
      const ext = extension(archivo.originalname);
      await presentacionModel.addFuente(media.id, {
        archivo_url: urlArchivo(archivo),
        mime_type: mimeDeArchivo(archivo),
        codec: CODEX[ext] || ext.toUpperCase(),
        orden: indice + 1,
      });
    }
    return presentacionModel.findMediaById(media.id);
  },

  async agregarFuentes(id, { files }) {
    const media = await presentacionModel.findMediaById(id);
    if (!media) throw new HttpError(404, 'Medio no encontrado');
    if (media.tipo !== 'video') throw new HttpError(400, 'Solo los videos admiten varias fuentes');
    const archivos = archivosDe(files);
    if (archivos.length === 0) throw new HttpError(400, 'Selecciona al menos un video');
    const existentes = await presentacionModel.findFuentes(id);
    if (existentes.length + archivos.length > 4) throw new HttpError(400, 'Un video admite hasta 4 versiones');
    for (const archivo of archivos) {
      if (!mimeValido(archivo, 'video')) throw new HttpError(400, 'Formato de video no permitido');
    }
    for (const archivo of archivos) {
      const ext = extension(archivo.originalname);
      await presentacionModel.addFuente(id, {
        archivo_url: urlArchivo(archivo),
        mime_type: mimeDeArchivo(archivo),
        codec: CODEX[ext] || ext.toUpperCase(),
      });
    }
    return presentacionModel.findMediaById(id);
  },

  async actualizarMedia(id, data) {
    const media = await presentacionModel.findMediaById(id);
    if (!media) throw new HttpError(404, 'Medio no encontrado');
    return presentacionModel.updateMedia(id, {
      ...(data.titulo !== undefined ? { titulo: validarTexto(data.titulo, 'titulo', 180) } : {}),
      ...(data.descripcion !== undefined ? { descripcion: validarTexto(data.descripcion, 'descripcion', 1200) } : {}),
      ...(data.alt !== undefined ? { alt: validarTexto(data.alt, 'alt', 240) } : {}),
      ...(data.orden !== undefined ? { orden: Number(data.orden) } : {}),
      ...(data.activo !== undefined ? { activo: Boolean(data.activo) } : {}),
    });
  },

  async reordenarMedia(items) {
    if (!Array.isArray(items)) throw new HttpError(400, 'items debe ser un arreglo');
    return presentacionModel.reorderMedia(items.map((item, indice) => ({
      id: Number(item.id),
      orden: Number(item.orden ?? indice + 1),
    })));
  },

  async eliminarMedia(id) {
    const media = await presentacionModel.findMediaById(id);
    if (!media) throw new HttpError(404, 'Medio no encontrado');
    await presentacionModel.deleteMedia(id);
    await Promise.all([
      ...media.fuentes.map((fuente) => borrarArchivo(fuente.archivo_url)),
      borrarArchivo(media.poster_url),
    ]);
    return { eliminado: true };
  },

  async eliminarFuente(mediaId, fuenteId) {
    const fuentes = await presentacionModel.findFuentes(mediaId);
    const fuente = fuentes.find((item) => item.id === Number(fuenteId));
    if (!fuente) throw new HttpError(404, 'Fuente no encontrada');
    await presentacionModel.deleteFuente(fuente.id);
    await borrarArchivo(fuente.archivo_url);
    return presentacionModel.findMediaById(mediaId);
  },
};

module.exports = presentacionService;
