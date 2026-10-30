import { useState } from 'react';
import { ImageOff, MapPin } from 'lucide-react';
import { Modal } from '../ui/index.jsx';

export default function ImagenSede({ sede, className = '', placeholder = false }) {
  const [abierta, setAbierta] = useState(false);

  if (!sede?.imagen_url) {
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
        onClick={() => setAbierta(true)}
        aria-label={`Ver foto de ${sede.nombre}`}
        className={`block overflow-hidden border border-borde bg-panel p-0 transition-colors hover:border-acento ${className}`}
      >
        <img
          src={sede.imagen_url}
          alt={`Foto de ${sede.nombre}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </button>

      <Modal open={abierta} onClose={() => setAbierta(false)} title={sede.nombre} size="xl">
        <div className="space-y-3">
          <img
            src={sede.imagen_url}
            alt={`Foto de ${sede.nombre}`}
            className="max-h-[70vh] w-full rounded-md border border-borde bg-panel object-contain"
          />
          <p className="flex items-start gap-2 text-xs leading-5 text-texto-secundario">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {[sede.direccion, sede.ciudad, sede.departamento].filter(Boolean).join(' · ')}
            </span>
          </p>
        </div>
      </Modal>
    </>
  );
}
