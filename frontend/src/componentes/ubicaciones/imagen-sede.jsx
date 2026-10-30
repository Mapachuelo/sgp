import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, Images, MapPin } from 'lucide-react';
import { Modal, Spinner } from '../ui/index.jsx';
import api from '../../api/cliente.js';

export default function ImagenSede({ sede, className = '', placeholder = false, compacto = false }) {
  const [abierta, setAbierta] = useState(false);
  const [imagenes, setImagenes] = useState([]);
  const [indice, setIndice] = useState(0);
  const [cargando, setCargando] = useState(false);

  const portada = sede?.imagen_url || '';
  const total = imagenes.length;

  useEffect(() => {
    if (!abierta || !sede?.id) return undefined;
    let activo = true;
    setCargando(portada ? false : true);
    setImagenes(portada ? [portada] : []);
    setIndice(0);
    api.ubicaciones
      .imagenes(sede.id)
      .then((data) => {
        if (!activo) return;
        const urls = (Array.isArray(data) ? data : [])
          .sort((a, b) => Number(a.orden) - Number(b.orden))
          .map((imagen) => imagen.imagen_url)
          .filter(Boolean);
        if (urls.length > 0) setImagenes(urls);
      })
      .catch(() => {})
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [abierta, sede?.id, portada]);

  const mover = (delta) => {
    if (total <= 1) return;
    setIndice((actual) => (actual + delta + total) % total);
  };

  if (!portada) {
    if (!placeholder) return null;
    return (
      <span className={`flex items-center justify-center border border-borde bg-panel text-tenue ${className}`}>
        <ImageOff className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setImagenes(portada ? [portada] : []);
          setIndice(0);
          setAbierta(true);
        }}
        aria-label={`Ver fotos de ${sede.nombre}`}
        className={`group relative block overflow-hidden border border-borde bg-panel p-0 transition-colors hover:border-acento ${className}`}
      >
        <img
          src={portada}
          alt={`Foto de ${sede.nombre}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {Number(sede.total_imagenes) > 1 && (
          <span className="num absolute right-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {sede.total_imagenes}
          </span>
        )}
        <span className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/65 px-1 py-1 text-[10px] font-medium text-white ${compacto ? 'min-h-0' : ''}`}>
          <Images className="h-3 w-3 shrink-0" aria-hidden="true" />
          {!compacto && <span className="whitespace-nowrap">Ver fotos</span>}
        </span>
      </button>

      <Modal open={abierta} onClose={() => setAbierta(false)} title={sede.nombre} size="xl">
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-md border border-borde bg-panel">
            {cargando && total === 0 ? (
              <div className="flex aspect-[4/3] items-center justify-center"><Spinner /></div>
            ) : total === 0 ? (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-tenue">
                <ImageOff className="h-8 w-8" aria-hidden="true" />
                <span className="text-xs">Sin imágenes</span>
              </div>
            ) : (
              <img
                src={imagenes[indice]}
                alt={`Foto de ${sede.nombre}, imagen ${indice + 1} de ${total}`}
                className="max-h-[70vh] w-full object-contain"
              />
            )}
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => mover(-1)}
                  aria-label="Foto anterior"
                  className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-borde bg-superficie text-texto-principal hover:bg-panel"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(1)}
                  aria-label="Foto siguiente"
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-borde bg-superficie text-texto-principal hover:bg-panel"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
                <span className="num absolute bottom-2 right-2 rounded border border-borde bg-superficie px-1.5 py-0.5 text-[10px] font-medium text-texto-secundario" aria-live="polite">
                  {indice + 1} / {total}
                </span>
              </>
            )}
          </div>

          {total > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scroll-thin" aria-label="Miniaturas de fotos de la sede">
              {imagenes.map((imagen, posicion) => (
                <button
                  key={`${posicion}-${imagen.slice(-16)}`}
                  type="button"
                  onClick={() => setIndice(posicion)}
                  aria-label={`Ver foto ${posicion + 1}`}
                  aria-current={posicion === indice ? 'true' : undefined}
                  className={`h-12 w-16 shrink-0 overflow-hidden rounded border ${
                    posicion === indice ? 'border-acento ring-1 ring-acento/20' : 'border-borde opacity-75 hover:opacity-100'
                  }`}
                >
                  <img src={imagen} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <p className="flex items-start gap-2 text-xs leading-5 text-texto-secundario">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{[sede.direccion, sede.ciudad, sede.departamento].filter(Boolean).join(' · ')}</span>
          </p>
        </div>
      </Modal>
    </>
  );
}
