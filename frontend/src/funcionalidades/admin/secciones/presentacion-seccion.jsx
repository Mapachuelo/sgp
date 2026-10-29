import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImageOff, Plus, Trash2, Video } from 'lucide-react';
import { PageHeader, Badge, Button, Card, Input, Modal, Spinner, Textarea } from '../../../componentes/ui/index.jsx';
import { avisarAdmin } from './avisos.js';
import MediaCarrusel from '../../../componentes/presentacion/media-carrusel.jsx';
import api from '../../../api/cliente.js';

const CONFIG_INICIAL = {
  hero_etiqueta: '',
  hero_titulo: '',
  hero_subtitulo: '',
  hero_cta_principal: '',
  hero_cta_secundario: '',
  seccion_cita_titulo: '',
  seccion_cita_texto: '',
  seccion_servicios_titulo: '',
  seccion_servicios_texto: '',
  seccion_salon_titulo: '',
  seccion_salon_texto: '',
  seccion_sedes_titulo: '',
  seccion_sedes_texto: '',
  cierre_titulo: '',
  cierre_texto: '',
  activo: true,
};

const MEDIA_INICIAL = { tipo: 'imagen', titulo: '', descripcion: '', alt: '' };
const CAMPOS_CONFIG = [
  ['hero', 'Hero', [
    ['hero_etiqueta', 'Etiqueta superior'],
    ['hero_titulo', 'Título'],
    ['hero_subtitulo', 'Subtítulo'],
    ['hero_cta_principal', 'Botón principal'],
    ['hero_cta_secundario', 'Botón secundario'],
  ]],
  ['cita', 'Cómo funciona', [['seccion_cita_titulo', 'Título'], ['seccion_cita_texto', 'Texto']]],
  ['servicios', 'Servicios', [['seccion_servicios_titulo', 'Título'], ['seccion_servicios_texto', 'Texto']]],
  ['salon', 'El salón', [['seccion_salon_titulo', 'Título'], ['seccion_salon_texto', 'Texto']]],
  ['sedes', 'Sedes', [['seccion_sedes_titulo', 'Título'], ['seccion_sedes_texto', 'Texto']]],
  ['cierre', 'Cierre', [['cierre_titulo', 'Título'], ['cierre_texto', 'Texto']]],
];

function miniatura(media) {
  if (media.tipo === 'imagen') return media.fuentes?.[0]?.archivo_url;
  return media.poster_url;
}

export default function PresentacionSeccion() {
  const [config, setConfig] = useState(CONFIG_INICIAL);
  const [media, setMedia] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modalMedia, setModalMedia] = useState(false);
  const [formMedia, setFormMedia] = useState(MEDIA_INICIAL);
  const [archivos, setArchivos] = useState([]);
  const [poster, setPoster] = useState(null);
  const [fuentesMedia, setFuentesMedia] = useState(null);
  const [archivosFuente, setArchivosFuente] = useState([]);
  const [previa, setPrevia] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const inputArchivos = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api.presentacion.admin();
      setConfig({ ...CONFIG_INICIAL, ...(data?.config || {}) });
      setMedia(Array.isArray(data?.media) ? data.media : []);
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarConfig = async () => {
    setGuardando(true);
    try {
      const data = await api.presentacion.actualizarConfig(config);
      setConfig({ ...CONFIG_INICIAL, ...data });
      avisarAdmin('Presentación actualizada');
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const subirMedia = async () => {
    if (!formMedia.tipo) return;
    if (archivos.length === 0) return avisarAdmin('Selecciona al menos un archivo', 'warning');
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append('tipo', formMedia.tipo);
      datos.append('titulo', formMedia.titulo);
      datos.append('descripcion', formMedia.descripcion);
      datos.append('alt', formMedia.alt);
      archivos.forEach((archivo) => datos.append('archivos', archivo));
      if (poster) datos.append('poster', poster);
      await api.presentacion.crearMedia(datos);
      avisarAdmin('Medio agregado a la presentación');
      setModalMedia(false);
      setFormMedia(MEDIA_INICIAL);
      setArchivos([]);
      setPoster(null);
      await cargar();
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setSubiendo(false);
    }
  };

  const actualizar = async (item, cambio) => {
    try {
      const data = await api.presentacion.actualizarMedia(item.id, cambio);
      setMedia((prev) => prev.map((medio) => (medio.id === item.id ? data : medio)));
    } catch (error) {
      avisarAdmin(error.message, 'error');
    }
  };

  const mover = async (indice, delta) => {
    const destino = indice + delta;
    if (destino < 0 || destino >= media.length) return;
    const siguiente = [...media];
    [siguiente[indice], siguiente[destino]] = [siguiente[destino], siguiente[indice]];
    setMedia(siguiente);
    try {
      const data = await api.presentacion.reordenar(
        siguiente.map((item, posicion) => ({ id: item.id, orden: posicion + 1 }))
      );
      setMedia(data);
    } catch (error) {
      avisarAdmin(error.message, 'error');
      await cargar();
    }
  };

  const eliminar = async (item) => {
    if (!window.confirm(`¿Eliminar "${item.titulo || 'este medio'}" de la presentación?`)) return;
    try {
      await api.presentacion.eliminarMedia(item.id);
      avisarAdmin('Medio eliminado');
      await cargar();
    } catch (error) {
      avisarAdmin(error.message, 'error');
    }
  };

  const agregarFuentes = async () => {
    if (!fuentesMedia || archivosFuente.length === 0) return;
    setSubiendo(true);
    try {
      const datos = new FormData();
      archivosFuente.forEach((archivo) => datos.append('archivos', archivo));
      const actualizado = await api.presentacion.agregarFuentes(fuentesMedia.id, datos);
      setMedia((prev) => prev.map((item) => (item.id === actualizado.id ? actualizado : item)));
      setFuentesMedia(null);
      setArchivosFuente([]);
      avisarAdmin('Versión de video agregada');
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setSubiendo(false);
    }
  };

  const mediosParaPrevia = media.filter((item) => item.activo).map((item) => ({
    ...item,
    fuentes: item.fuentes || [],
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Presentación pública"
        subtitle="Textos, imágenes y videos que ven los clientes en la portada."
      />
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-texto-principal">Textos y medios</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-texto-secundario">
              Edita los textos y el carrusel de imágenes y videos. Esta información vive en una base separada y no afecta reservas ni pagos.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secundario" size="sm" onClick={() => setPrevia(true)}>Vista previa</Button>
            <Button size="sm" onClick={guardarConfig} disabled={guardando}>
              {guardando ? <Spinner /> : 'Guardar textos'}
            </Button>
          </div>
        </div>

        {cargando ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              {CAMPOS_CONFIG.map(([clave, titulo, campos]) => (
                <Card key={clave} className="w-full xl:w-[calc(50%-6px)]">
                  <h3 className="text-sm font-semibold text-texto-principal">{titulo}</h3>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {campos.map(([campo, etiqueta]) => (
                      <div key={campo} className={campo.endsWith('_texto') || campo.endsWith('_subtitulo') ? 'sm:col-span-2' : ''}>
                        {campo.endsWith('_texto') || campo.endsWith('_subtitulo') ? (
                          <Textarea
                            label={etiqueta}
                            value={config[campo] || ''}
                            onChange={(e) => setConfig((prev) => ({ ...prev, [campo]: e.target.value }))}
                            rows={2}
                          />
                        ) : (
                          <Input
                            label={etiqueta}
                            value={config[campo] || ''}
                            onChange={(e) => setConfig((prev) => ({ ...prev, [campo]: e.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            <Card padding={false}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde p-4">
                <div>
                  <h3 className="text-sm font-semibold text-texto-principal">Imágenes y videos</h3>
                  <p className="mt-0.5 text-[11px] text-texto-secundario">El primer medio activo es la portada. Puedes agregar varias versiones de un mismo video.</p>
                </div>
                <Button size="sm" onClick={() => setModalMedia(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Agregar medio</Button>
              </div>
              {media.length === 0 ? (
                <p className="p-8 text-center text-sm text-texto-secundario">Aún no hay medios. La portada mostrará el marco de marca hasta que agregues el primero.</p>
              ) : (
                <div className="divide-y divide-regla">
                  {media.map((item, indice) => (
                    <div key={item.id} className="flex flex-wrap items-center gap-3 p-3.5">
                      <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-borde bg-panel">
                        {miniatura(item) ? <img src={miniatura(item)} alt="" className="h-full w-full object-cover" /> : item.tipo === 'video' ? <Video className="h-5 w-5 text-tenue" aria-hidden="true" /> : <ImageOff className="h-5 w-5 text-tenue" aria-hidden="true" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-texto-principal">{item.titulo || 'Sin título'}</p>
                          <Badge variant={item.activo ? 'success' : 'default'}>{item.activo ? 'Visible' : 'Oculto'}</Badge>
                          <span className="text-[10px] text-tenue">{item.tipo} · {item.fuentes?.length || 0} fuente(s)</span>
                        </div>
                        {item.descripcion && <p className="mt-0.5 truncate text-[11px] text-texto-secundario">{item.descripcion}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {item.tipo === 'video' && (
                          <Button variant="ghost" size="sm" onClick={() => { setFuentesMedia(item); setArchivosFuente([]); }} aria-label={`Agregar formato a ${item.titulo || 'video'}`}>
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Formato
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => actualizar(item, { activo: !item.activo })} aria-label={item.activo ? 'Ocultar medio' : 'Mostrar medio'}>
                          {item.activo ? 'Ocultar' : 'Mostrar'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => mover(indice, -1)} disabled={indice === 0} aria-label="Subir medio"><ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => mover(indice, 1)} disabled={indice === media.length - 1} aria-label="Bajar medio"><ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                        <Button variant="dangerSuave" size="sm" onClick={() => eliminar(item)} aria-label="Eliminar medio"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      <Modal open={modalMedia} onClose={() => setModalMedia(false)} title="Agregar imagen o video" size="wide">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-texto-principal">Tipo</span>
              <select value={formMedia.tipo} onChange={(e) => setFormMedia((prev) => ({ ...prev, tipo: e.target.value }))} className="h-10 w-full rounded-md border border-control bg-superficie px-3 text-sm">
                <option value="imagen">Imagen</option>
                <option value="video">Video</option>
              </select>
            </label>
            <Input label="Título" value={formMedia.titulo} onChange={(e) => setFormMedia((prev) => ({ ...prev, titulo: e.target.value }))} />
          </div>
          <Textarea label="Descripción" value={formMedia.descripcion} onChange={(e) => setFormMedia((prev) => ({ ...prev, descripcion: e.target.value }))} rows={2} />
          <Input label="Texto alternativo" value={formMedia.alt} onChange={(e) => setFormMedia((prev) => ({ ...prev, alt: e.target.value }))} hint="Describe la imagen para accesibilidad." />
          <div>
            <p className="mb-1.5 text-xs font-medium text-texto-principal">{formMedia.tipo === 'video' ? 'Versiones del video' : 'Imagen'}</p>
            <input
              ref={inputArchivos}
              type="file"
              multiple={formMedia.tipo === 'video'}
              accept={formMedia.tipo === 'video' ? 'video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v' : 'image/jpeg,image/png,image/webp,image/avif,image/gif'}
              onChange={(e) => setArchivos([...e.target.files])}
              className="block w-full text-xs text-texto-secundario file:mr-3 file:rounded-md file:border-0 file:bg-panel file:px-3 file:py-2 file:text-xs file:font-medium file:text-texto-principal"
            />
            <p className="mt-1 text-[10px] leading-4 text-tenue">Hasta 4 versiones para video. MP4/H.264 es la opción más compatible; WebM/AV1 puede ir como alternativa.</p>
          </div>
          {formMedia.tipo === 'video' && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-texto-principal">Póster (opcional)</p>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => setPoster(e.target.files?.[0] || null)} className="block w-full text-xs text-texto-secundario file:mr-3 file:rounded-md file:border-0 file:bg-panel file:px-3 file:py-2 file:text-xs file:font-medium file:text-texto-principal" />
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-borde pt-4">
            <Button variant="secundario" onClick={() => setModalMedia(false)}>Cancelar</Button>
            <Button onClick={subirMedia} disabled={subiendo || archivos.length === 0}>{subiendo ? <Spinner /> : 'Agregar a la presentación'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(fuentesMedia)} onClose={() => setFuentesMedia(null)} title="Agregar formato de video" size="normal">
        <div className="space-y-4">
          <p className="text-sm text-texto-secundario">Agrega otra versión codificada del mismo video para mejorar la compatibilidad. El navegador elegirá la primera que pueda reproducir.</p>
          <input type="file" multiple accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v" onChange={(e) => setArchivosFuente([...e.target.files])} className="block w-full text-xs text-texto-secundario file:mr-3 file:rounded-md file:border-0 file:bg-panel file:px-3 file:py-2 file:text-xs file:font-medium file:text-texto-principal" />
          <div className="flex justify-end gap-2 border-t border-borde pt-4">
            <Button variant="secundario" onClick={() => setFuentesMedia(null)}>Cancelar</Button>
            <Button onClick={agregarFuentes} disabled={subiendo || archivosFuente.length === 0}>{subiendo ? <Spinner /> : 'Agregar formato'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={previa} onClose={() => setPrevia(false)} title="Vista previa del carrusel" size="wide">
        <MediaCarrusel items={mediosParaPrevia} etiqueta="Vista previa de la presentación" />
      </Modal>
    </div>
  );
}
