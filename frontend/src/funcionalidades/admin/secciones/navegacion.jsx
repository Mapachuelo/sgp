import { createContext, useContext, useEffect, useRef } from 'react';
import {
  BadgeDollarSign,
  BarChart3,
  CalendarCog,
  FileText,
  MapPin,
  QrCode,
  Scissors,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Sheet } from '../../../componentes/ui/index.jsx';

export const ACCESOS_ADMIN = [
  { clave: 'qr', etiqueta: 'Validar QR', icono: QrCode, rapido: true },
  { clave: 'cobro', etiqueta: 'Cobro', icono: BadgeDollarSign, rapido: true },
  { clave: 'empleados', etiqueta: 'Empleados', icono: Users },
  { clave: 'servicios', etiqueta: 'Servicios', icono: Scissors },
  { clave: 'sedes', etiqueta: 'Sedes', icono: MapPin },
  { clave: 'horarios', etiqueta: 'Horarios', icono: CalendarCog },
  { clave: 'reportes', etiqueta: 'Reportes', icono: BarChart3 },
  { clave: 'clientes', etiqueta: 'Moderacion clientes', icono: ShieldAlert },
  { clave: 'logs', etiqueta: 'Logs', icono: FileText },
];

export const AdminNavContext = createContext(null);

export function RielSecciones() {
  const nav = useContext(AdminNavContext);
  const activoRef = useRef(null);

  useEffect(() => {
    activoRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [nav?.activa]);

  if (!nav) return null;

  return (
    <nav
      aria-label="Secciones del panel"
      className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-borde bg-fondo/40 p-2 lg:w-56 lg:flex-col lg:gap-1 lg:overflow-x-visible lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-3"
    >
      <p className="hidden lg:block px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-texto-secundario">
        Secciones
      </p>
      {ACCESOS_ADMIN.map(({ clave, etiqueta, icono: Icono }) => {
        const activa = nav.activa === clave;
        return (
          <button
            key={clave}
            type="button"
            ref={activa ? activoRef : undefined}
            onClick={() => nav.ir(clave)}
            aria-current={activa ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition cursor-pointer lg:w-full ${
              activa
                ? 'border-primario bg-primario text-white shadow-sm'
                : 'border-transparent bg-superficie/60 text-texto-secundario hover:border-borde hover:bg-superficie hover:text-texto-principal'
            }`}
          >
            <Icono className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">{etiqueta}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function SheetAdmin({ open, onClose, children, title, size = 'wide' }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} size={size} nav={<RielSecciones />}>
      {children}
    </Sheet>
  );
}
