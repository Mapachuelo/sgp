import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { Spinner } from '../ui/index.jsx';
import api from '../../api/cliente.js';

export default function GaleriaServicio({ servicio, className = '' }) {
  const [imagenes, setImagenes] = useState([]);
  const [indice, setIndice] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!servicio?.id) return undefined;
    let activo = true;
    setIndice(0);
    setError('');
    setImagenes(servicio.imagen_url ? [servicio.imagen_url] : []);
    setCargando(true);
    api.reservas
      .imagenesServicio(servicio.id)
      .then((data) => {
        if (!activo) return;
        const urls = (Array.isArray(data) ? data : [])
          .sort((a, b) => Number(a.orden) - Number(b.orden))
          .map((imagen) => imagen.imagen_url)
          .filter(Boolean);
        if (urls.length > 0) setImagenes(urls);
      })
      .catch(() => {
        if (activo) setError('No se pudieron cargar todas las imágenes.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [servicio?.id, servicio?.imagen_url]);

  const total = imagenes.length;
  const irA = (delta) => {
    if (total <= 1) return;
    setIndice((actual) => (actual + delta + total) % total);
  };

  return (
    <div className={className}>
      <div
        className="relative overflow-hidden rounded-lg border border-borde bg-panel"
        tabIndex={0}
        onKeyDown={(evento) => {
          if (evento.key === 'ArrowLeft') {
            evento.preventDefault();
            irA(-1);
          }
          if (evento.key === 'ArrowRight') {
            evento.preventDefault();
            irA(1);
          }
        }}
        aria-label={total > 1 ? `Galería de ${servicio?.nombre || 'servicio'}. Usa las flechas para cambiar de imagen.` : `Imagen de ${servicio?.nombre || 'servicio'}`}
      >
        {cargando && total === 0 ? (
          <div className="flex aspect-[4/3] items-center justify-center"><Spinner /></div>
        ) : total === 0 ? (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-tenue">
            <ImageOff className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
            <span className="text-[11px]">Sin imágenes</span>
          </div>
        ) : (
          <img
            src={imagenes[indice]}
            alt={`${servicio?.nombre || 'Servicio'}, imagen ${indice + 1} de ${total}`}
            className="aspect-[4/3] w-full object-cover"
          />
        )}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => irA(-1)}
              aria-label="Imagen anterior"
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-borde bg-superficie text-texto-principal hover:bg-panel"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => irA(1)}
              aria-label="Imagen siguiente"
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
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scroll-thin" aria-label="Miniaturas de imágenes">
          {imagenes.map((imagen, posicion) => (
            <button
              key={`${posicion}-${imagen.slice(-16)}`}
              type="button"
              onClick={() => setIndice(posicion)}
              aria-label={`Ver imagen ${posicion + 1}`}
              aria-current={posicion === indice ? 'true' : undefined}
              className={`h-12 w-12 shrink-0 overflow-hidden rounded border ${
                posicion === indice ? 'border-acento ring-1 ring-acento/20' : 'border-borde opacity-75 hover:opacity-100'
              }`}
            >
              <img src={imagen} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-[11px] text-error">{error}</p>}
    </div>
  );
}
