import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BotonTema from '../tema/boton-tema.jsx';

function Marca() {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5" aria-label="SGP, volver al inicio">
      <span className="flex h-6 items-end gap-[2px]" aria-hidden="true">
        <span className="h-2 w-[2px] rounded-full bg-texto-principal" />
        <span className="h-4 w-[2px] rounded-full bg-texto-principal" />
        <span className="h-1.5 w-[2px] rounded-full bg-acento" />
      </span>
      <span className="font-display text-[19px] font-bold tracking-[-0.04em] text-texto-principal">SGP</span>
    </Link>
  );
}

const PASOS = [
  { titulo: 'Llega', detalle: 'El cliente muestra su QR en recepción.' },
  { titulo: 'Atiende', detalle: 'La cola ordena llegada, pago y servicio.' },
  { titulo: 'Cobra', detalle: 'Efectivo o Wompi, conciliado al instante.' },
];

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-[100dvh] bg-fondo lg:flex lg:items-center lg:justify-center lg:p-2">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1180px] flex-col overflow-hidden bg-superficie lg:min-h-[calc(100dvh-16px)] lg:flex-row lg:rounded-2xl lg:border lg:border-borde">
        <aside className="hidden w-[38%] flex-col justify-between border-r border-borde bg-panel p-8 lg:flex">
          <div>
            <div className="flex items-center justify-between gap-4">
              <Marca />
              <BotonTema />
            </div>
            <p className="mt-16 max-w-[300px] text-[28px] font-semibold leading-[1.08] tracking-[-0.035em] text-texto-principal">
              El día del salón, en orden.
            </p>
            <p className="mt-3 max-w-[290px] text-sm leading-6 text-texto-secundario">
              Citas, pagos y turnos en una sola línea de tiempo. Para el cliente, para el equipo y para quien administra.
            </p>
          </div>

          <div className="relative mt-10">
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-borde" aria-hidden="true" />
            <ol className="space-y-6">
              {PASOS.map((paso) => (
                <li key={paso.titulo} className="relative pl-6">
                  <span className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-superficie bg-acento" aria-hidden="true" />
                  <p className="text-sm font-medium text-texto-principal">{paso.titulo}</p>
                  <p className="mt-0.5 max-w-[240px] text-xs leading-5 text-texto-secundario">{paso.detalle}</p>
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-10 text-[11px] text-tenue">SGP · Sistema de Gestión de Peluquería</p>
        </aside>

        <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-[400px]">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Marca />
              <BotonTema />
            </div>

            <Link
              to="/"
              className="mb-5 inline-flex h-8 items-center gap-1.5 rounded-md border border-borde bg-superficie px-2.5 text-[11px] font-medium text-texto-secundario transition-colors hover:bg-panel hover:text-texto-principal"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Volver al inicio
            </Link>

            <div className="mb-7">
              <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-texto-principal">{title}</h1>
              {subtitle && <p className="mt-2 text-sm leading-6 text-texto-secundario">{subtitle}</p>}
            </div>

            {children}

            {footer && <div className="mt-8 border-t border-borde pt-5">{footer}</div>}

            <p className="mt-8 text-center text-[11px] leading-5 text-tenue lg:text-left">
              Al continuar aceptas el tratamiento de tus datos para gestionar citas y pagos.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export function AuthLink({ to, children }) {
  return (
    <Link to={to} className="font-medium text-acento underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}
