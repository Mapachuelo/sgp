import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function BuscadorSelect({
  label,
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar...',
  error,
  hint,
  disabled = false,
  className = '',
  wrapperClassName = '',
  allowClear = true,
  renderOption,
  name,
}) {
  const autoId = useId();
  const selectId = id || autoId;
  const contenedorRef = useRef(null);
  const inputRef = useRef(null);
  const listaRef = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [activo, setActivo] = useState(0);
  const [posicion, setPosicion] = useState(null);

  const seleccionada = useMemo(
    () => options.find((opcion) => String(opcion.value) === String(value)),
    [options, value]
  );

  const filtradas = useMemo(() => {
    const termino = normalizar(texto);
    if (!termino) return options;
    return options.filter((opcion) => {
      const contenido = normalizar(
        `${opcion.label || ''} ${opcion.description || ''} ${opcion.search || ''}`
      );
      return contenido.includes(termino);
    });
  }, [options, texto]);

  useEffect(() => {
    if (!abierto) {
      setTexto('');
      setActivo(0);
      return;
    }
    inputRef.current?.focus();
  }, [abierto]);

  useLayoutEffect(() => {
    if (!abierto || !contenedorRef.current) return undefined;
    const actualizar = () => {
      const rect = contenedorRef.current.getBoundingClientRect();
      const espacioAbajo = window.innerHeight - rect.bottom;
      const espacioArriba = rect.top;
      const abrirArriba = espacioAbajo < 220 && espacioArriba > espacioAbajo;
      const disponible = abrirArriba ? espacioArriba : espacioAbajo;
      setPosicion({
        left: rect.left,
        top: abrirArriba ? Math.max(8, rect.top - Math.min(288, disponible - 8)) : rect.bottom + 4,
        width: Math.max(rect.width, 220),
        maxHeight: Math.min(288, Math.max(140, disponible - 12)),
      });
    };
    actualizar();
    window.addEventListener('resize', actualizar);
    window.addEventListener('scroll', actualizar, true);
    return () => {
      window.removeEventListener('resize', actualizar);
      window.removeEventListener('scroll', actualizar, true);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return undefined;
    const alTocarFuera = (evento) => {
      if (contenedorRef.current?.contains(evento.target)) return;
      if (listaRef.current?.contains(evento.target)) return;
      setAbierto(false);
    };
    document.addEventListener('pointerdown', alTocarFuera);
    return () => document.removeEventListener('pointerdown', alTocarFuera);
  }, [abierto]);

  useEffect(() => {
    if (activo >= filtradas.length) setActivo(Math.max(0, filtradas.length - 1));
  }, [filtradas, activo]);

  const elegir = (opcion) => {
    onChange?.(opcion.value);
    setAbierto(false);
  };

  const alTeclear = (evento) => {
    if (disabled) return;
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      if (!abierto) setAbierto(true);
      setActivo((actual) => Math.min(filtradas.length - 1, actual + 1));
      return;
    }
    if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setActivo((actual) => Math.max(0, actual - 1));
      return;
    }
    if (evento.key === 'Enter') {
      evento.preventDefault();
      if (abierto && filtradas[activo]) elegir(filtradas[activo]);
      else setAbierto(true);
      return;
    }
    if (evento.key === 'Escape') {
      evento.preventDefault();
      setAbierto(false);
      return;
    }
    if (evento.key === 'Tab') {
      setAbierto(false);
    }
  };

  const opcionesLista = filtradas.length ? filtradas : [];
  const idLista = `${selectId}-lista`;
  const idActivo = opcionesLista[activo] ? `${selectId}-opcion-${activo}` : undefined;

  useEffect(() => {
    if (!abierto || !idActivo) return;
    document.getElementById(idActivo)?.scrollIntoView({ block: 'nearest' });
  }, [abierto, activo, idActivo]);

  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-xs font-medium text-texto-principal">
          {label}
        </label>
      )}
      <div ref={contenedorRef} className="relative">
        {abierto ? (
          <div
            className={`flex h-10 items-center gap-2 rounded-md border bg-superficie px-3 ${
              error ? 'border-error ring-2 ring-error/20' : 'border-acento ring-2 ring-acento/20'
            } ${className}`}
          >
            <Search className="h-4 w-4 shrink-0 text-tenue" strokeWidth={1.7} aria-hidden="true" />
            <input
              ref={inputRef}
              id={selectId}
              name={name}
              value={texto}
              onChange={(evento) => {
                setTexto(evento.target.value);
                setActivo(0);
              }}
              onKeyDown={alTeclear}
              placeholder="Escribe para buscar..."
              role="combobox"
              aria-expanded="true"
              aria-controls={idLista}
              aria-activedescendant={idActivo}
              aria-autocomplete="list"
              aria-invalid={error ? true : undefined}
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-texto-principal placeholder:text-tenue/70 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar búsqueda"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-tenue hover:bg-panel hover:text-texto-principal"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            id={selectId}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setAbierto(true);
              setActivo(0);
            }}
            onKeyDown={alTeclear}
            role="combobox"
            aria-expanded="false"
            aria-controls={idLista}
            aria-invalid={error ? true : undefined}
            className={`flex h-10 w-full items-center gap-2 rounded-md border bg-superficie px-3 text-left text-sm transition-colors focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20 disabled:bg-panel disabled:text-tenue ${
              error ? 'border-error' : 'border-control'
            } ${className}`}
          >
            <span className={`min-w-0 flex-1 truncate ${seleccionada ? 'text-texto-principal' : 'text-tenue/70'}`}>
              {seleccionada?.label || placeholder}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-tenue" strokeWidth={1.7} aria-hidden="true" />
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-[11px] font-medium leading-4 text-error">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-[11px] leading-4 text-tenue">{hint}</p>}

      {abierto &&
        posicion &&
        createPortal(
          <div
            ref={listaRef}
            id={idLista}
            role="listbox"
            aria-label={label || 'Opciones'}
            className="fixed z-[120] overflow-y-auto rounded-md border border-borde bg-superficie p-1 scroll-thin"
            style={{
              left: posicion.left,
              top: posicion.top,
              width: posicion.width,
              maxHeight: posicion.maxHeight,
            }}
          >
            {opcionesLista.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-texto-secundario">Sin resultados</p>
            ) : (
              opcionesLista.map((opcion, indice) => {
                const activa = indice === activo;
                const elegida = String(opcion.value) === String(value);
                return (
                  <button
                    key={opcion.value}
                    id={`${selectId}-opcion-${indice}`}
                    type="button"
                    role="option"
                    aria-selected={elegida}
                    onMouseEnter={() => setActivo(indice)}
                    onClick={() => elegir(opcion)}
                    className={`flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-sm ${
                      activa ? 'bg-activo text-texto-principal' : 'text-texto-secundario hover:bg-panel'
                    }`}
                  >
                    {opcion.image ? (
                      <img
                        src={opcion.image}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded border border-borde object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      {renderOption ? (
                        renderOption(opcion)
                      ) : (
                        <>
                          <span className="block truncate font-medium text-texto-principal">{opcion.label}</span>
                          {opcion.description && (
                            <span className="mt-0.5 block truncate text-[11px] text-texto-secundario">
                              {opcion.description}
                            </span>
                          )}
                        </>
                      )}
                    </span>
                    {elegida && <Check className="h-4 w-4 shrink-0 text-acento" strokeWidth={2} aria-hidden="true" />}
                  </button>
                );
              })
            )}
            {allowClear && value !== '' && value != null && (
              <button
                type="button"
                onClick={() => {
                  onChange?.('');
                  setAbierto(false);
                }}
                className="mt-1 flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs text-texto-secundario hover:bg-panel"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Limpiar selección
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
