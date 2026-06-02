import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';

export default function Layout() {
  const { usuario, logout } = useAuth();
  const location = useLocation();

  const rolBase = usuario?.rol === 'admin' ? '/admin' : usuario?.rol === 'empleado' ? '/empleado' : usuario?.rol === 'cliente' ? '/cliente' : '/';

  const navItems = {
    cliente: [
      { path: '/cliente', label: 'Dashboard' },
      { path: '/cliente/reservar', label: 'Reservar' },
      { path: '/cliente/perfil', label: 'Mi Perfil' },
    ],
    empleado: [
      { path: '/empleado', label: 'Citas' },
      { path: '/empleado/disponibilidad', label: 'Disponibilidad' },
      { path: '/empleado/perfil', label: 'Mi Perfil' },
    ],
    admin: [
      { path: '/admin', label: 'Dashboard' },
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
          <div className="flex gap-1 bg-fondo rounded-lg p-1 shrink-0">
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
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-texto-secundario hidden sm:block">
              {usuario?.nombre} ({usuario?.rol})
            </span>
            <button
              onClick={logout}
              className="text-xs text-error hover:underline"
            >
              Salir
            </button>
          </div>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
