import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth';
import api from '../../api/cliente';
import { Button, Input } from '../../componentes/ui';

export default function VerificarPage() {
  const { verificarCuenta } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(location.state?.email || '');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [contador, setContador] = useState(0);

  useEffect(() => {
    if (contador <= 0) return;
    const timer = setTimeout(() => setContador((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [contador]);

  function handleEmailChange(e) {
    setEmail(e.target.value);
  }

  function handleCodigoChange(e) {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCodigo(value);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Ingresa tu correo electronico.');
      return;
    }
    if (codigo.length !== 6) {
      setError('Ingresa el codigo de 6 digitos enviado a tu correo.');
      return;
    }
    setCargando(true);
    try {
      const data = await verificarCuenta(email.trim(), codigo);
      if (data.usuario?.rol === 'cliente') navigate('/cliente', { replace: true });
      else if (data.usuario?.rol === 'empleado') navigate('/empleado', { replace: true });
      else if (data.usuario?.rol === 'admin') navigate('/admin', { replace: true });
      else navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo verificar la cuenta');
    } finally {
      setCargando(false);
    }
  }

  async function handleReenviar() {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Ingresa tu correo electronico para reenviar el codigo.');
      return;
    }
    setCargando(true);
    try {
      await api.auth.reenviarCodigo({ email: email.trim() });
      setInfo('Codigo reenviado. Revisa tu correo.');
      setContador(60);
    } catch (err) {
      setError(err.message || 'No se pudo reenviar el codigo');
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
            Confirma tu correo para completar el registro de tu cuenta.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:hidden">
            <h1 className="font-display text-3xl font-bold text-primario">SGP</h1>
            <p className="text-texto-secundario text-sm mt-1 font-body">Sistema de Gestión de Peluquería</p>
          </div>

          <div className="bg-superficie rounded-2xl border border-borde shadow-sm p-8">
            <h2 className="font-display text-2xl font-bold text-texto-principal mb-2">Verificar cuenta</h2>
            <p className="text-sm text-texto-secundario mb-6 font-body">
              Enviamos un codigo de 6 digitos a tu correo. Ingresalo para activar tu cuenta.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm font-medium">
                {error}
              </div>
            )}
            {info && (
              <div className="mb-4 p-3 bg-exito/10 border border-exito/20 rounded-lg text-exito text-sm font-medium">
                {info}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Correo electrónico"
                name="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="tu@correo.com"
                required
                autoComplete="email"
              />
              <Input
                label="Código de verificación"
                name="codigo"
                type="text"
                inputMode="numeric"
                value={codigo}
                onChange={handleCodigoChange}
                placeholder="000000"
                required
                autoComplete="one-time-code"
                maxLength={6}
              />
              <Button type="submit" variant="primario" className="w-full" size="lg" disabled={cargando}>
                {cargando ? 'Verificando…' : 'Verificar cuenta'}
              </Button>
            </form>

            <div className="mt-6 space-y-3 text-center">
              <Button
                type="button"
                variant="secundario"
                className="w-full"
                onClick={handleReenviar}
                disabled={cargando || contador > 0}
              >
                {contador > 0 ? `Reenviar codigo en ${contador}s` : 'Reenviar codigo'}
              </Button>
              <p className="text-sm text-texto-secundario font-body">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-primario font-semibold hover:underline">
                  Inicia sesión
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
