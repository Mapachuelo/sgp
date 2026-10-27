import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';

export default function RutaProtegida({ children, roles }) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-fondo">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-control border-t-acento" />
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/login" replace />;

  return children;
}
