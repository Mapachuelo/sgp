import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';

export default function RutaProtegida({ children, roles }) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fondo">
        <div className="w-8 h-8 border-4 border-primario/30 border-t-primario rounded-full animate-spin" />
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/login" replace />;

  return children;
}
