import { useEffect, useId, useRef } from 'react';

function elementosEnfocables(contenedor) {
  if (!contenedor) return [];
  return Array.from(
    contenedor.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

function useDialogo(open, onClose, ref) {
  useEffect(() => {
    if (!open) return;
    const previo = document.activeElement;
    const contenedor = ref.current;
    const primerElemento = elementosEnfocables(contenedor)[0];
    (primerElemento || contenedor)?.focus?.();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = elementosEnfocables(contenedor);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const idx = items.indexOf(document.activeElement);
      if (e.shiftKey && idx <= 0) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && idx === items.length - 1) {
        e.preventDefault();
        items[0].focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = '';
      previo?.focus?.();
    };
  }, [open, onClose, ref]);
}

export function Button({ children, variant = 'primario', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-lg font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primario: 'bg-primario hover:bg-primario-hover text-white shadow-sm',
    secundario: 'bg-borde hover:bg-borde/70 text-texto-principal',
    outline: 'border border-borde hover:bg-fondo text-texto-principal',
    danger: 'bg-error/10 text-error border border-error/20 hover:bg-error/20',
    exito: 'bg-exito hover:bg-exito/90 text-white',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-5 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({ label, id, error, className = '', ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-texto-principal mb-1">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`w-full px-3 py-2.5 border border-borde rounded-lg text-texto-principal placeholder-texto-secundario/50 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario transition ${className}`}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-error text-xs mt-1 font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

export function Card({ children, className = '', padding = true, onClick, ...props }) {
  return (
    <div
      className={`bg-superficie rounded-2xl border border-borde shadow-sm ${padding ? 'p-6' : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-fondo text-texto-secundario border-borde',
    warning: 'bg-amber-50 text-advertencia border-amber-200',
    success: 'bg-green-50 text-exito border-green-200',
    danger: 'bg-red-50 text-error border-red-200',
    info: 'bg-blue-50 text-info border-blue-200',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function Sheet({ open, onClose, children, title, side = 'right' }) {
  const ref = useRef(null);
  const tituloId = useId();
  useDialogo(open, onClose, ref);
  if (!open) return null;
  const posicion = side === 'right' ? 'right-0 h-full w-[640px] max-w-[100vw]' : 'left-0 right-0';
  return (
    <>
      <div className="fixed inset-0 z-50 overlay" onClick={onClose} role="presentation" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={`fixed top-0 ${posicion} z-[60] bg-superficie shadow-2xl overflow-y-auto`}
      >
        <div className="sticky top-0 bg-superficie border-b border-borde p-6 flex items-center justify-between z-10">
          <h2 id={tituloId} className="font-display text-xl font-bold text-texto-principal">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="text-texto-secundario hover:text-texto-principal cursor-pointer p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </>
  );
}

export function Modal({ open, onClose, children, title }) {
  const ref = useRef(null);
  const tituloId = useId();
  useDialogo(open, onClose, ref);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 overlay flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className="bg-superficie rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-borde"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={tituloId} className="font-display text-xl font-bold text-texto-principal">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="text-texto-secundario hover:text-texto-principal cursor-pointer p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Select({ label, id, options = [], className = '', ...props }) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <div>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-texto-principal mb-1">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full px-3 py-2.5 border border-borde rounded-lg text-texto-principal bg-superficie focus:outline-none focus:ring-2 focus:ring-primario/30 ${className}`}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function Spinner({ label = 'Cargando' }) {
  return (
    <span role="status" aria-label={label}>
      <span className="block w-6 h-6 border-3 border-primario/30 border-t-primario rounded-full animate-spin" />
    </span>
  );
}

export function Toast({ message, type = 'success', open }) {
  if (!open) return null;
  const colors = { success: 'bg-exito', error: 'bg-error', warning: 'bg-advertencia' };
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-20 left-1/2 -translate-x-1/2 ${colors[type]} text-white px-6 py-3 rounded-xl shadow-lg text-sm font-medium z-[70]`}
    >
      {message}
    </div>
  );
}