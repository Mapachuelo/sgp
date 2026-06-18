import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';

export default function Layout() {
  const { usuario, logout } = useAuth();
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const rolBase = usuario?.rol === 'admin' ? '/admin' : usuario?.rol === 'empleado' ? '/empleado' : usuario?.rol === 'cliente' ? '/cliente' : '/';

  const navItems = {
    cliente: [
      { path: '/cliente', label: 'Inicio' },
      { path: '/cliente/reservar', label: 'Reservar' },
      { path: '/cliente/perfil', label: 'Mi Perfil' },
    ],
    empleado: [
      { path: '/empleado', label: 'Citas' },
      { path: '/empleado/disponibilidad', label: 'Disponibilidad' },
      { path: '/empleado/perfil', label: 'Mi Perfil' },
    ],
    admin: [
      { path: '/admin', label: 'Inicio' },
    ],
  };

  const items = navItems[usuario?.rol] || [];

  return (
    <div className="min-h-screen bg-fondo font-body">
      <nav className="sticky top-0 z-50 bg-superficie/90 backdrop-blur border-b border-borde">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to={rolBase} className="font-display text-xl font-bold text-primario tracking-tight shrink-0">
            SGP
          </Link>

          {/* Menú Desktop */}
          <div className="hidden md:flex gap-1 bg-fondo rounded-lg p-1 shrink-0">
            {items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  location.pathname === item.path
                    ? 'bg-superficie shadow-sm text-primario'
                    : 'text-texto-secundario hover:text-texto-principal'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            <span className="text-sm text-texto-secundario">
              {usuario?.nombre} ({usuario?.rol})
            </span>
            <button
              onClick={logout}
              className="text-xs text-error hover:underline cursor-pointer"
            >
              Salir
            </button>
          </div>

          {/* Botón menú Hamburguesa (Móvil) */}
          <button
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="md:hidden p-2 rounded-lg hover:bg-fondo text-texto-principal transition focus:outline-none cursor-pointer"
            aria-label="Abrir menú de navegación"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              {menuAbierto ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Panel Desplegable Móvil */}
        {menuAbierto && (
          <div className="md:hidden border-t border-borde/60 bg-superficie px-4 py-3 space-y-3 shadow-md animate-fade-in">
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuAbierto(false)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    location.pathname === item.path
                      ? 'bg-primario/10 text-primario'
                      : 'text-texto-secundario hover:bg-fondo hover:text-texto-principal'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="border-t border-borde/60 pt-3 flex items-center justify-between">
              <span className="text-xs text-texto-secundario font-medium">
                {usuario?.nombre} ({usuario?.rol})
              </span>
              <button
                onClick={() => {
                  setMenuAbierto(false);
                  logout();
                }}
                className="text-xs text-error hover:underline cursor-pointer font-bold"
              >
                Salir
              </button>
            </div>
          </div>
        )}
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
