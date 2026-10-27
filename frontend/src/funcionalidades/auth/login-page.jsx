import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth';
import { Button, Input } from '../../componentes/ui';
import AuthShell, { AuthLink } from '../../componentes/auth/auth-shell.jsx';

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
    <AuthShell
      title="Entra a tu cuenta"
      subtitle="Gestiona tus citas, tu cola o el salón completo desde un solo lugar."
      footer={
        <p className="text-center text-sm text-texto-secundario">
          ¿No tienes cuenta? <AuthLink to="/register">Regístrate</AuthLink>
        </p>
      }
    >
      {error && (
        <div className="mb-4 rounded-md border border-[#e9b8b5] bg-[#fbe9e8] px-3 py-2.5 text-xs font-medium leading-5 text-[#8e2420]" role="alert">
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
          autoCapitalize="none"
          spellCheck={false}
        />
        <Input
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Tu contraseña"
          required
          autoComplete="current-password"
        />
        <Button type="submit" className="mt-2 w-full" size="lg" disabled={cargando}>
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>

      {noVerificada && (
        <p className="mt-4 text-center text-sm">
          <Link to="/verificar" state={{ email }} className="font-medium text-acento underline-offset-2 hover:underline">
            Verificar mi cuenta
          </Link>
        </p>
      )}

      <p className="mt-5 text-center text-[11px] leading-5 text-tenue">
        ¿Problemas para entrar? Pide apoyo a la administración del salón.
      </p>
    </AuthShell>
  );
}
