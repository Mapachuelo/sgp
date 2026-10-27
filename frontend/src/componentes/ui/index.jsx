import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast as sonnerToast } from 'sonner';

export function cn(...clases) {
  return clases.filter(Boolean).join(' ');
}

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
    if (!open) return undefined;
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
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflowPrevio;
      previo?.focus?.();
    };
  }, [open, onClose, ref]);
}

export function Button({
  children,
  variant = 'primario',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-[transform,background-color,border-color,color,opacity] duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 cursor-pointer select-none';
  const variants = {
    primario: 'bg-primario text-white hover:bg-primario-hover border border-primario',
    secundario: 'bg-superficie text-texto-principal border border-control hover:bg-panel',
    outline: 'bg-transparent text-texto-principal border border-borde hover:bg-panel',
    ghost: 'bg-transparent text-texto-secundario hover:bg-panel hover:text-texto-principal border border-transparent',
    danger: 'bg-error text-white hover:bg-[#a51d22] border border-error',
    dangerSuave: 'bg-[#fbe9e8] text-[#8e2420] border border-[#e9b8b5] hover:bg-[#f7dedd]',
    exito: 'bg-exito text-white hover:bg-[#17633f] border border-exito',
    acento: 'bg-acento text-white hover:bg-[#155a6b] border border-acento',
  };
  const sizes = {
    xs: 'h-7 px-2 text-[11px]',
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-3.5 text-sm',
    lg: 'h-10 px-4 text-sm',
    icon: 'h-9 w-9 p-0',
  };
  return (
    <button
      type={type}
      className={cn(base, variants[variant] || variants.primario, sizes[size] || sizes.md, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, children, className = '', variant = 'ghost', size = 'md', ...props }) {
  return (
    <Button
      variant={variant}
      size={size === 'sm' ? 'icon' : size}
      aria-label={label}
      title={label}
      className={cn(size === 'sm' ? 'h-8 w-8' : '', className)}
      {...props}
    >
      {children}
    </Button>
  );
}

export function Field({ label, htmlFor, hint, error, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-texto-principal">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1.5 text-[11px] leading-4 text-tenue">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-[11px] font-medium leading-4 text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ label, id, error, hint, className = '', wrapperClassName = '', ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} className={wrapperClassName}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          'h-10 w-full rounded-md border border-control bg-superficie px-3 text-sm text-texto-principal placeholder:text-tenue/70 transition-colors focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20 disabled:bg-panel disabled:text-tenue',
          error && 'border-error focus:border-error focus:ring-error/20',
          className
        )}
        {...props}
      />
    </Field>
  );
}

export function Textarea({ label, id, error, hint, className = '', wrapperClassName = '', ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} className={wrapperClassName}>
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          'min-h-24 w-full rounded-md border border-control bg-superficie px-3 py-2.5 text-sm text-texto-principal placeholder:text-tenue/70 transition-colors focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20',
          error && 'border-error focus:border-error focus:ring-error/20',
          className
        )}
        {...props}
      />
    </Field>
  );
}

export function Select({ label, id, options = [], error, hint, className = '', wrapperClassName = '', ...props }) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <Field label={label} htmlFor={selectId} error={error} hint={hint} className={wrapperClassName}>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={cn(
          'h-10 w-full rounded-md border border-control bg-superficie px-3 text-sm text-texto-principal transition-colors focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20',
          error && 'border-error focus:border-error focus:ring-error/20',
          className
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Card({ children, className = '', padding = true, ...props }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-borde bg-superficie',
        padding && 'p-5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-panel text-texto-secundario border-borde',
    warning: 'bg-[#fff6e8] text-[#7a4a10] border-[#edcf9c]',
    success: 'bg-[#e8f5ee] text-[#145c39] border-[#b9dfc9]',
    danger: 'bg-[#fbe9e8] text-[#8e2420] border-[#e9b8b5]',
    info: 'bg-[#eaf1fb] text-[#1e4f8f] border-[#c7d9f2]',
    accent: 'bg-acento-suave text-acento-tinta border-[#cfe3e7]',
    neutral: 'bg-activo text-texto-principal border-control',
  };
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded px-1.5 text-[11px] font-medium leading-none',
        variants[variant] || variants.default,
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusPill({ estado, children, className = '' }) {
  const mapa = {
    pendiente: 'warning',
    confirmada: 'info',
    en_curso: 'accent',
    cobrado: 'success',
    completada: 'success',
    cancelada: 'danger',
    aprobado: 'success',
    declinado: 'danger',
    error: 'danger',
    pagado: 'success',
  };
  return (
    <Badge variant={mapa[estado] || 'default'} className={className}>
      {children}
    </Badge>
  );
}

export function Spinner({ label = 'Cargando' }) {
  return (
    <span role="status" aria-label={label}>
      <span className="block h-5 w-5 animate-spin rounded-full border-2 border-control border-t-acento" />
    </span>
  );
}

export function Sheet({ open, onClose, children, title, side = 'right', size = 'normal', nav, footer }) {
  const ref = useRef(null);
  const tituloId = useId();
  useDialogo(open, onClose, ref);
  if (!open) return null;

  const anchos = {
    normal: 'sm:max-w-[480px]',
    wide: 'sm:max-w-[900px]',
    full: 'sm:max-w-[1120px]',
  };
  const posicion =
    side === 'right'
      ? `sm:top-2 sm:right-2 sm:bottom-auto sm:max-h-[calc(100dvh-16px)] ${anchos[size] || anchos.normal}`
      : 'inset-x-0 bottom-0';

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] overlay animate-fade-in" onClick={onClose} role="presentation" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={cn(
          'fixed z-[80] flex max-h-[92dvh] flex-col overflow-hidden border border-borde bg-superficie shadow-2xl',
          'inset-x-0 bottom-0 rounded-t-2xl',
          posicion,
          side === 'right' && 'sm:left-auto sm:rounded-xl',
          'sheet-panel'
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-borde px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 id={tituloId} className="truncate text-base font-semibold text-texto-principal">
                {title}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-texto-secundario transition-colors hover:bg-panel hover:text-texto-principal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {nav ? (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {nav}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 scroll-thin sm:p-5">{children}</div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 scroll-thin sm:p-5">{children}</div>
        )}
        {footer && <div className="shrink-0 border-t border-borde bg-superficie p-4 sm:p-5">{footer}</div>}
      </div>
    </>,
    document.body
  );
}

export function Modal({ open, onClose, children, title, size = 'normal' }) {
  const ref = useRef(null);
  const tituloId = useId();
  useDialogo(open, onClose, ref);
  if (!open) return null;

  const anchos = {
    sm: 'max-w-sm',
    normal: 'max-w-lg',
    wide: 'max-w-2xl',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center overlay p-0 animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={cn(
          'max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-borde bg-superficie p-5 shadow-2xl scroll-thin animate-slide-up sm:rounded-xl sm:p-6',
          anchos[size] || anchos.normal
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={tituloId} className="text-lg font-semibold text-texto-principal">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-texto-secundario transition-colors hover:bg-panel hover:text-texto-principal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirmar', danger = false, cargando = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm leading-6 text-texto-secundario">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secundario" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant={danger ? 'danger' : 'primario'} onClick={onConfirm} disabled={cargando}>
          {cargando ? 'Procesando…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function Toast({ message, type = 'success', open }) {
  const ultimoRef = useRef('');
  useEffect(() => {
    if (!open || !message || ultimoRef.current === message) return;
    ultimoRef.current = message;
    const fn = type === 'error' ? sonnerToast.error : type === 'warning' ? sonnerToast.warning : sonnerToast.success;
    fn(message);
  }, [open, message, type]);
  useEffect(() => {
    if (!open) ultimoRef.current = '';
  }, [open]);
  return null;
}

export function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight text-texto-principal">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-texto-secundario">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function KpiStrip({ items = [], className = '' }) {
  return (
    <div
      className={cn(
        'grid overflow-hidden rounded-lg border border-borde bg-superficie',
        'grid-cols-2 divide-x divide-y divide-regla sm:grid-cols-4 sm:divide-y-0',
        className
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 px-4 py-3.5">
          <p className="truncate text-[11px] font-medium text-texto-secundario">{item.label}</p>
          <p className="num mt-1.5 text-2xl font-medium leading-none text-texto-principal">{item.value}</p>
          {item.caption && <p className="mt-2 truncate text-[11px] text-tenue">{item.caption}</p>}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action, className = '' }) {
  return (
    <div className={cn('rounded-lg border border-dashed border-control bg-panel/60 px-4 py-8 text-center', className)}>
      <p className="text-sm font-medium text-texto-principal">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-texto-secundario">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={cn('rounded bg-activo', className)} aria-hidden="true" />;
}

export function Tabs({ items = [], value, onChange, className = '', label = 'Secciones' }) {
  return (
    <div className={cn('flex gap-5 overflow-x-auto border-b border-borde', className)} role="tablist" aria-label={label}>
      {items.map((item) => {
        const activo = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => onChange?.(item.value)}
            className={cn(
              'relative -mb-px shrink-0 border-b-2 px-0 pb-2.5 pt-1 text-sm transition-colors',
              activo
                ? 'border-acento font-medium text-texto-principal'
                : 'border-transparent text-texto-secundario hover:text-texto-principal'
            )}
          >
            {item.label}
            {item.count != null && <span className="ml-1.5 text-[11px] text-tenue">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl({ items = [], value, onChange, className = '', label }) {
  return (
    <div className={cn('inline-flex rounded-md border border-borde bg-panel p-0.5', className)} role="group" aria-label={label}>
      {items.map((item) => {
        const activo = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange?.(item.value)}
            className={cn(
              'h-8 rounded px-3 text-xs font-medium transition-colors',
              activo ? 'bg-superficie text-texto-principal' : 'text-texto-secundario hover:text-texto-principal'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function DataTable({ columns = [], rows = [], getKey, empty, className = '', rowClassName }) {
  if (!rows.length) return empty || null;
  return (
    <div className={cn('w-full overflow-x-auto scroll-thin', className)}>
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-superficie">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'whitespace-nowrap border-b border-borde px-3 py-2 text-[11px] font-medium text-texto-secundario',
                  col.align === 'right' && 'text-right',
                  col.className
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={getKey ? getKey(row) : idx}
              className={cn('border-b border-regla last:border-0 hover:bg-panel/60', rowClassName?.(row))}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-3 py-3 align-middle',
                    col.align === 'right' && 'num text-right',
                    col.className
                  )}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Avatar({ nombre = '', apellido = '', size = 'md', className = '' }) {
  const iniciales = `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase() || '?';
  const sizes = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-activo font-semibold text-texto-secundario',
        sizes[size] || sizes.md,
        className
      )}
      aria-hidden="true"
    >
      {iniciales}
    </span>
  );
}
