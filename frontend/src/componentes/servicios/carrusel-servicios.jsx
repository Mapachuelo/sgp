import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Scissors } from 'lucide-react';
import { Badge, Button } from '../ui/index.jsx';

const dinero = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(Number(valor) || 0)
    .replace(/\u00a0/g, '');

export default function CarruselServicios({ servicios = [], onVerDetalle }) {
  const viewportRef = useRef(null);
  const [inicio, setInicio] = useState(0);
  const [visibles, setVisibles] = useState(1);
  const [alFinal, setAlFinal] = useState(false);
  const total = servicios.length;

  const medir = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const tarjeta = viewport.querySelector('[data-servicio]');
    const paso = (tarjeta?.offsetWidth || 1) + 12;
    const visiblesAhora = Math.max(1, Math.round(viewport.clientWidth / paso));
    setInicio(Math.min(Math.max(0, total - 1), Math.round(viewport.scrollLeft / paso)));
    setVisibles(Math.min(visiblesAhora, total || 1));
    setAlFinal(viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 4);
  }, [total]);

  useEffect(() => {
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [medir]);

  const mover = (delta) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const tarjeta = viewport.querySelector('[data-servicio]');
    const paso = (tarjeta?.offsetWidth || 1) + 12;
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollBy({ left: paso * delta, behavior: reducido ? 'auto' : 'smooth' });
  };

  if (total === 0) {
    return (
      <p className="mt-6 rounded-lg border border-dashed border-control bg-superficie p-8 text-center text-sm text-texto-secundario">
        El catálogo estará disponible muy pronto.
      </p>
    );
  }

  const fin = Math.min(total, inicio + visibles);

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-tenue">Desliza o usa las flechas para ver más cortes.</p>
        {total > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              aria-label="Servicios anteriores"
              onClick={() => mover(-1)}
              disabled={inicio === 0}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <span className="num min-w-14 text-center text-[11px] text-texto-secundario" aria-live="polite">
              {inicio + 1}–{fin} / {total}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label="Servicios siguientes"
              onClick={() => mover(1)}
              disabled={alFinal}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      <div
        ref={viewportRef}
        className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 scroll-thin"
        role="region"
        aria-roledescription="carrusel"
        aria-label="Servicios del salón"
        tabIndex={0}
        onScroll={medir}
        onKeyDown={(evento) => {
          if (evento.key === 'ArrowLeft') {
            evento.preventDefault();
            mover(-1);
          }
          if (evento.key === 'ArrowRight') {
            evento.preventDefault();
            mover(1);
          }
        }}
      >
        {servicios.map((servicio) => {
          const totalImagenes = Number(servicio.total_imagenes) || (servicio.imagen_url ? 1 : 0);
          return (
            <button
              key={servicio.id}
              type="button"
              data-servicio
              onClick={() => onVerDetalle?.(servicio)}
              aria-label={`Ver detalle de ${servicio.nombre}`}
              className="group flex w-[82%] shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-borde bg-superficie text-left transition-colors hover:border-control sm:w-[calc(50%-6px)] lg:w-[calc(33.333%-8px)]"
            >
              <span className="relative block aspect-[4/3] w-full overflow-hidden bg-panel">
                {servicio.imagen_url ? (
                  <img
                    src={servicio.imagen_url}
                    alt={servicio.nombre}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-tenue">
                    <Scissors className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                )}
                {totalImagenes > 1 && (
                  <Badge variant="accent" className="absolute bottom-2 right-2">
                    {totalImagenes} fotos
                  </Badge>
                )}
              </span>

              <span className="flex flex-1 flex-col p-3.5">
                <span className="text-[10px] font-medium text-tenue">{servicio.categoria_nombre || 'Servicio'}</span>
                <span className="mt-0.5 text-sm font-medium leading-5 text-texto-principal">{servicio.nombre}</span>
                {servicio.descripcion && (
                  <span className="mt-1 line-clamp-2 text-[11px] leading-4 text-texto-secundario">{servicio.descripcion}</span>
                )}
                <span className="mt-auto flex items-center justify-between gap-2 border-t border-borde pt-2.5">
                  <span className="num text-sm font-semibold text-texto-principal">{dinero(servicio.precio_base)}</span>
                  <span className="text-[10px] text-texto-secundario">{servicio.duracion_base_minutos || 30} min</span>
                </span>
                <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-acento">
                  Ver detalle <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
