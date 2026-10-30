import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, Play } from 'lucide-react';

function esVideo(media) {
  return media?.tipo === 'video';
}

function FuentesVideo({ fuentes = [] }) {
  return fuentes.map((fuente) => (
    <source key={fuente.id || fuente.archivo_url} src={fuente.archivo_url} type={fuente.mime_type} />
  ));
}

export default function MediaCarrusel({ items = [], className = '', etiqueta = 'Galería del salón' }) {
  const [indice, setIndice] = useState(0);
  const [arrastre, setArrastre] = useState(null);
  const videoRef = useRef(null);
  const total = items.length;

  useEffect(() => {
    if (indice > total - 1) setIndice(Math.max(0, total - 1));
  }, [indice, total]);

  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, [indice]);

  if (total === 0) {
    return (
      <div className={`flex aspect-[4/3] items-center justify-center rounded-xl border border-borde bg-panel ${className}`}>
        <div className="px-6 text-center">
          <ImageOff className="mx-auto h-8 w-8 text-tenue" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-texto-principal">La galería está tomando forma</p>
          <p className="mt-1 text-xs leading-5 text-texto-secundario">Muy pronto verás aquí el salón.</p>
        </div>
      </div>
    );
  }

  const actual = items[indice];
  const mover = (delta) => setIndice((valor) => (valor + delta + total) % total);

  const alPresionar = (evento) => {
    if (evento.pointerType === 'mouse') return;
    setArrastre({ x: evento.clientX, y: evento.clientY });
  };

  const alSoltar = (evento) => {
    if (!arrastre) return;
    const dx = evento.clientX - arrastre.x;
    const dy = evento.clientY - arrastre.y;
    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) mover(dx < 0 ? 1 : -1);
    setArrastre(null);
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-borde bg-panel ${className}`}
      role="region"
      aria-roledescription="carrusel"
      aria-label={etiqueta}
      tabIndex={0}
      onKeyDown={(evento) => {
        if (evento.key === 'ArrowLeft') mover(-1);
        if (evento.key === 'ArrowRight') mover(1);
        if (evento.key === 'Home') setIndice(0);
        if (evento.key === 'End') setIndice(total - 1);
      }}
      onPointerDown={alPresionar}
      onPointerUp={alSoltar}
      onPointerCancel={() => setArrastre(null)}
    >
      <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
        {esVideo(actual) ? (
          <div className="relative h-full w-full bg-black">
            {actual.poster_url ? (
              <img src={actual.poster_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" aria-hidden="true" />
            ) : null}
            <video
              key={actual.id}
              ref={videoRef}
              className="relative z-10 h-full w-full object-contain"
              controls
              playsInline
              preload="metadata"
              poster={actual.poster_url || undefined}
              onPlay={(evento) => {
                document.querySelectorAll('video').forEach((video) => {
                  if (video !== evento.currentTarget) video.pause();
                });
              }}
            >
              <FuentesVideo fuentes={actual.fuentes} />
            </video>
          </div>
        ) : actual.fuentes?.[0]?.archivo_url ? (
          <img
            src={actual.fuentes[0].archivo_url}
            alt={actual.alt || actual.titulo || 'Imagen del salón'}
            className="h-full w-full object-cover"
            loading={indice === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-tenue"><ImageOff className="h-8 w-8" aria-hidden="true" /></div>
        )}

        {(actual.titulo || actual.descripcion) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-black/55 p-4 text-white">
            {actual.titulo && <p className="text-sm font-medium">{actual.titulo}</p>}
            {actual.descripcion && <p className="mt-1 max-w-xl text-[11px] leading-4 text-white/80">{actual.descripcion}</p>}
          </div>
        )}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => mover(-1)}
            aria-label="Medio anterior"
            className="absolute left-3 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white transition-transform active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => mover(1)}
            aria-label="Medio siguiente"
            className="absolute right-3 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white transition-transform active:scale-95"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/55 px-2 py-1">
            {items.map((item, posicion) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndice(posicion)}
                aria-label={`Ir al medio ${posicion + 1}`}
                aria-current={posicion === indice}
                className={`h-1.5 rounded-full transition-all ${posicion === indice ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
          <span className="absolute right-3 top-3 z-30 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium text-white">
            {String(indice + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </>
      )}

      {esVideo(actual) && !actual.poster_url && (
        <span className="pointer-events-none absolute left-3 top-3 z-30 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white">
          <Play className="h-3 w-3" aria-hidden="true" /> Video
        </span>
      )}
    </div>
  );
}
