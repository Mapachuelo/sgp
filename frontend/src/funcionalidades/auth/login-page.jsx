import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth';
import { Button, Input } from '../../componentes/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [noVerificada, setNoVerificada] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNoVerificada(false);
    setCargando(true);
    try {
      const data = await login(email, password);
      const rol = data.usuario?.rol;

      if (rol === 'cliente') navigate('/cliente', { replace: true });
      else if (rol === 'empleado') navigate('/empleado', { replace: true });
      else if (rol === 'admin') navigate('/admin', { replace: true });
      else navigate('/', { replace: true });
    } catch (err) {
      const mensaje = err.message || 'Error al iniciar sesión';
      setError(mensaje);
      if (mensaje.toLowerCase().includes('verificada')) setNoVerificada(true);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-pattern flex">
      <div className="hidden lg:flex lg:w-1/2 bg-primario items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primario/90 to-texto-principal/80" />
        <div className="relative z-10 text-center px-12">
          <h1 className="font-display text-5xl font-bold text-white mb-4">SGP</h1>
          <p className="text-white/80 text-lg font-body">Sistema de Gestión de Peluquería</p>
          <p className="text-white/60 text-sm mt-6 font-body max-w-md">
            Reserva tu cita, gestiona tus horarios y administra tu negocio desde un solo lugar.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:hidden">
            <h1 className="font-display text-3xl font-bold text-primario">SGP</h1>
            <p className="text-texto-secundario text-sm mt-1 font-body">Sistema de Gestión de Peluquería</p>
          </div>

          <div className="bg-superficie rounded-2xl border border-borde shadow-sm p-8">
            <h2 className="font-display text-2xl font-bold text-texto-principal mb-6">Iniciar sesión</h2>

            {error && (
              <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Correo electrónico"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                autoComplete="email"
              />
              <Input
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <Button type="submit" variant="primario" className="w-full" size="lg" disabled={cargando}>
                {cargando ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-texto-secundario font-body">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-primario font-semibold hover:underline">
                Regístrate
              </Link>
            </p>
            {noVerificada && (
              <p className="mt-3 text-center text-sm font-body">
                <Link
                  to="/verificar"
                  state={{ email }}
                  className="text-primario font-semibold hover:underline"
                >
                  Verificar mi cuenta
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
