import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  CalendarDays,
  CalendarRange,
  Clock3,
  LayoutDashboard,
  MapPin,
  Menu,
  Scissors,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../hooks/use-auth';
import { useI18n } from '../i18n/index.jsx';
import { Sheet } from './ui/index.jsx';

function Marca({ compacto = false, to = '/login' }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5" aria-label="SGP, inicio">
      <span className="flex h-6 items-end gap-[2px]" aria-hidden="true">
        <span className="h-2 w-[2px] rounded-full bg-texto-principal" />
        <span className="h-4 w-[2px] rounded-full bg-texto-principal" />
        <span className="h-1.5 w-[2px] rounded-full bg-acento" />
      </span>
      <span className={`font-display font-bold tracking-[-0.04em] text-texto-principal ${compacto ? 'text-[17px]' : 'text-[19px]'}`}>
        SGP
      </span>
    </Link>
  );
}

const NAV_ADMIN = [
  {
    grupo: 'Día',
    items: [
      { path: '/admin', label: 'Hoy', icon: LayoutDashboard, end: true },
      { path: '/admin/agenda', label: 'Agenda', icon: CalendarDays },
    ],
  },
  {
    grupo: 'Salón',
    items: [
      { path: '/admin/equipo', label: 'Equipo', icon: Users },
      { path: '/admin/servicios', label: 'Servicios', icon: Scissors },
      { path: '/admin/sedes', label: 'Sedes', icon: MapPin },
      { path: '/admin/horarios', label: 'Horarios', icon: CalendarRange },
    ],
  },
  {
    grupo: 'Clientes',
    items: [
      { path: '/admin/clientes', label: 'Clientes', icon: ShieldCheck },
      { path: '/admin/reportes', label: 'Reportes', icon: WalletCards },
    ],
  },
  {
    grupo: 'Sistema',
    items: [{ path: '/admin/actividad', label: 'Actividad', icon: Activity }],
  },
];

const NAV_EMPLEADO = [
  {
    grupo: 'Día',
    items: [
      { path: '/empleado', label: 'Cola', icon: LayoutDashboard, end: true },
      { path: '/empleado/agenda', label: 'Agenda', icon: CalendarDays },
    ],
  },
  {
    grupo: 'Personal',
    items: [
      { path: '/empleado/disponibilidad', label: 'Disponibilidad', icon: Clock3 },
      { path: '/empleado/perfil', label: 'Perfil', icon: UserRound },
    ],
  },
];

const NAV_CLIENTE = [
  { path: '/cliente', label: 'Mis citas', icon: CalendarDays, end: true },
  { path: '/cliente/reservar', label: 'Reservar', icon: Sparkles },
  { path: '/cliente/perfil', label: 'Perfil', icon: UserRound },
];

function Iniciales({ nombre = '', apellido = '' }) {
  const letras = `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase() || '?';
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-activo text-[11px] font-semibold text-texto-secundario" aria-hidden="true">
      {letras}
    </span>
  );
}

function BotonIdioma({ className = '' }) {
  const { idioma, setIdioma } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setIdioma(idioma === 'es' ? 'en' : 'es')}
      aria-label={idioma === 'es' ? 'Switch to English' : 'Cambiar a español'}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md border border-borde px-2 text-[11px] font-semibold text-texto-secundario transition-colors hover:bg-panel hover:text-texto-principal ${className}`}
    >
      {idioma === 'es' ? 'EN' : 'ES'}
    </button>
  );
}

function NavItem({ item, onClick }) {
  const Icono = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors ${
          isActive
            ? 'bg-activo font-medium text-texto-principal'
            : 'text-texto-secundario hover:bg-panel hover:text-texto-principal'
        }`
      }
    >
      {Icono && <Icono className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />}
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function Sidebar({ nav, usuario, logout, onNavigate }) {
  return (
    <aside className="hidden h-full w-[228px] shrink-0 flex-col px-3 py-4 lg:flex">
      <div className="px-2">
        <Marca to={usuario?.rol === 'admin' ? '/admin' : '/empleado'} />
      </div>
      <div className="mt-6 px-2">
        <p className="text-[11px] font-medium text-tenue">Salón</p>
        <p className="mt-0.5 truncate text-[13px] font-medium text-texto-principal">Todas las sedes</p>
      </div>
      <nav className="mt-6 flex-1 space-y-6 overflow-y-auto scroll-thin" aria-label="Navegación principal">
        {nav.map((grupo) => (
          <div key={grupo.grupo}>
            <p className="mb-1.5 px-2.5 text-[11px] font-medium text-tenue">{grupo.grupo}</p>
            <div className="space-y-0.5">
              {grupo.items.map((item) => (
                <NavItem key={item.path} item={item} onClick={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-4 border-t border-borde pt-3">
        <div className="flex items-center gap-2.5 px-2 py-1">
          <Iniciales nombre={usuario?.nombre} apellido={usuario?.apellido} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-texto-principal">
              {usuario?.nombre} {usuario?.apellido}
            </p>
            <p className="truncate text-[11px] capitalize text-tenue">{usuario?.rol}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 px-2">
          <BotonIdioma />
          <button
            type="button"
            onClick={logout}
            className="h-8 rounded-md px-2 text-[11px] font-medium text-texto-secundario transition-colors hover:bg-panel hover:text-texto-principal"
          >
            Salir
          </button>
        </div>
      </div>
    </aside>
  );
}

function ClientHeader({ usuario, logout }) {
  const location = useLocation();
  return (
    <header className="sticky top-0 z-40 border-b border-borde bg-fondo/95">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-4 px-4 sm:px-6">
        <Marca compacto to="/cliente" />
        <nav className="hidden items-center gap-6 md:flex" aria-label="Navegación principal">
          {NAV_CLIENTE.map((item) => {
            const activo = item.end ? location.pathname === item.path : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`border-b-2 py-4 text-[13px] transition-colors ${
                  activo
                    ? 'border-acento font-medium text-texto-principal'
                    : 'border-transparent text-texto-secundario hover:text-texto-principal'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <BotonIdioma />
          <div className="hidden items-center gap-2 sm:flex">
            <Iniciales nombre={usuario?.nombre} apellido={usuario?.apellido} />
            <span className="hidden text-xs text-texto-secundario lg:block">{usuario?.nombre}</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="h-8 rounded-md px-2 text-[11px] font-medium text-texto-secundario transition-colors hover:bg-panel hover:text-texto-principal"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}

function ClientBottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-superficie/95 px-2 pt-1 md:hidden" aria-label="Navegación móvil">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {NAV_CLIENTE.map((item) => {
          const Icono = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1 text-[10px] ${
                  isActive ? 'font-medium text-acento' : 'text-texto-secundario'
                }`
              }
            >
              <Icono className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function StaffHeader({ navPlano, onMenu }) {
  const location = useLocation();
  const actual = navPlano.find((item) =>
    item.end ? location.pathname === item.path : location.pathname.startsWith(item.path)
  );
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenu}
          className="flex h-8 w-8 items-center justify-center rounded-md text-texto-secundario transition-colors hover:bg-panel hover:text-texto-principal lg:hidden"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-tenue">SGP / {actual?.label || 'Salón'}</p>
          <p className="truncate text-[13px] font-medium text-texto-principal lg:hidden">{actual?.label || 'Salón'}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden text-[11px] text-tenue sm:block">
          {new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </span>
        <BotonIdioma />
      </div>
    </header>
  );
}

function StaffMobileMenu({ open, onClose, nav, usuario, logout }) {
  return (
    <Sheet open={open} onClose={onClose} title="Menú" side="right" size="normal">
      <div className="space-y-6">
        {nav.map((grupo) => (
          <div key={grupo.grupo}>
            <p className="mb-2 text-[11px] font-medium text-tenue">{grupo.grupo}</p>
            <div className="space-y-0.5">
              {grupo.items.map((item) => (
                <NavItem key={item.path} item={item} onClick={onClose} />
              ))}
            </div>
          </div>
        ))}
        <div className="border-t border-borde pt-4">
          <div className="flex items-center gap-2.5">
            <Iniciales nombre={usuario?.nombre} apellido={usuario?.apellido} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-texto-principal">
                {usuario?.nombre} {usuario?.apellido}
              </p>
              <p className="text-[11px] capitalize text-tenue">{usuario?.rol}</p>
            </div>
            <BotonIdioma />
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-4 h-10 w-full rounded-md border border-borde text-sm font-medium text-texto-secundario transition-colors hover:bg-panel hover:text-texto-principal"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export default function Layout() {
  const { usuario, logout } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const esStaff = usuario?.rol === 'admin' || usuario?.rol === 'empleado';
  const nav = usuario?.rol === 'admin' ? NAV_ADMIN : NAV_EMPLEADO;
  const navPlano = nav.flatMap((grupo) => grupo.items);

  if (!esStaff) {
    return (
      <div className="min-h-[100dvh] bg-fondo">
        <ClientHeader usuario={usuario} logout={logout} />
        <main id="contenido-principal" className="mx-auto w-full max-w-[1120px] px-4 pb-24 pt-6 sm:px-6 md:pb-12 md:pt-8">
          <Outlet />
        </main>
        <ClientBottomNav />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-fondo lg:pr-2 lg:pb-2">
      <div className="flex h-full min-h-0">
        <Sidebar nav={nav} usuario={usuario} logout={logout} onNavigate={() => setMenuAbierto(false)} />
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <StaffHeader navPlano={navPlano} onMenu={() => setMenuAbierto(true)} />
          <main
            id="contenido-principal"
            className="min-h-0 flex-1 overflow-hidden rounded-t-2xl border border-borde bg-superficie lg:rounded-2xl"
          >
            <div className="h-full overflow-y-auto overscroll-contain scroll-thin">
              <div className="mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-7">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>
      <StaffMobileMenu
        open={menuAbierto}
        onClose={() => setMenuAbierto(false)}
        nav={nav}
        usuario={usuario}
        logout={logout}
      />
    </div>
  );
}
