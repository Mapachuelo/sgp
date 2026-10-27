import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth';
import api from '../../api/cliente';
import { Button, Input } from '../../componentes/ui';
import AuthShell from '../../componentes/auth/auth-shell.jsx';

function formatearTiempo(segundos) {
  const m = String(Math.floor(segundos / 60)).padStart(2, '0');
  const s = String(segundos % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function VerificarPage() {
  const { verificarCuenta } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inputsRef = useRef([]);

  const ttlMinutos = location.state?.ttlMinutos || 5;
  const [email, setEmail] = useState(location.state?.email || '');
  const [digitos, setDigitos] = useState(Array(6).fill(''));
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [contador, setContador] = useState(0);
  const [expiraEn, setExpiraEn] = useState(
    location.state?.expiraEn || new Date(Date.now() + ttlMinutos * 60000).toISOString()
  );
  const [restante, setRestante] = useState(() =>
    Math.max(0, Math.floor((new Date(location.state?.expiraEn || Date.now() + ttlMinutos * 60000).getTime() - Date.now()) / 1000))
  );
  const [correoEnviado] = useState(location.state?.correoEnviado !== false);

  const expirado = restante <= 0;
  const codigo = digitos.join('');

  useEffect(() => {
    const timer = setInterval(() => {
      setRestante(Math.max(0, Math.floor((new Date(expiraEn).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiraEn]);

  useEffect(() => {
    if (contador <= 0) return undefined;
    const timer = setTimeout(() => setContador((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [contador]);

  function marcarExpirado(mensaje) {
    setExpiraEn(new Date(0).toISOString());
    setRestante(0);
    setError(mensaje || 'Tu registro expiró y el correo quedó libre.');
  }

  function escribirDigito(indice, valor) {
    const limpio = valor.replace(/\D/g, '').slice(-1);
    const siguiente = [...digitos];
    siguiente[indice] = limpio;
    setDigitos(siguiente);
    if (limpio && indice < 5) inputsRef.current[indice + 1]?.focus();
  }

  function manejarTecla(indice, evento) {
    if (evento.key === 'Backspace' && !digitos[indice] && indice > 0) {
      inputsRef.current[indice - 1]?.focus();
    }
    if (evento.key === 'ArrowLeft' && indice > 0) inputsRef.current[indice - 1]?.focus();
    if (evento.key === 'ArrowRight' && indice < 5) inputsRef.current[indice + 1]?.focus();
  }

  function pegarCodigo(evento) {
    const texto = (evento.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!texto) return;
    evento.preventDefault();
    const siguiente = Array(6).fill('');
    texto.split('').forEach((d, i) => {
      siguiente[i] = d;
    });
    setDigitos(siguiente);
    inputsRef.current[Math.min(texto.length, 5)]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (expirado) return;
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico.');
      return;
    }
    if (codigo.length !== 6) {
      setError('Ingresa el código de 6 dígitos enviado a tu correo.');
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
      const mensaje = err.message || 'No se pudo verificar la cuenta';
      if (/no encontrado|expiro|expirado/i.test(mensaje)) marcarExpirado(mensaje);
      else setError(mensaje);
    } finally {
      setCargando(false);
    }
  }

  async function handleReenviar() {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico para reenviar el código.');
      return;
    }
    setCargando(true);
    try {
      const data = await api.auth.reenviarCodigo({ email: email.trim() });
      const nuevoExpira = data?.expiraEn || new Date(Date.now() + ttlMinutos * 60000).toISOString();
      setExpiraEn(nuevoExpira);
      setRestante(Math.max(0, Math.floor((new Date(nuevoExpira).getTime() - Date.now()) / 1000)));
      setInfo('Código reenviado. Revisa tu correo.');
      setContador(60);
    } catch (err) {
      const mensaje = err.message || 'No se pudo reenviar el código';
      if (/no encontrado|expiro|expirado/i.test(mensaje)) marcarExpirado(mensaje);
      else setError(mensaje);
    } finally {
      setCargando(false);
    }
  }

  return (
    <AuthShell
      title="Verifica tu correo"
      subtitle="Enviamos un código de 6 dígitos. Ingrésalo para activar tu cuenta y empezar a reservar."
      footer={
        <p className="text-center text-sm text-texto-secundario">
          ¿Ya tienes cuenta? <Link to="/login" className="font-medium text-acento underline-offset-2 hover:underline">Inicia sesión</Link>
        </p>
      }
    >
      {expirado ? (
        <div className="rounded-md border border-advertencia/30 bg-advertencia/10 p-4">
          <p className="text-sm font-medium text-advertencia">Tu registro expiró y el correo quedó libre.</p>
          <p className="mt-1 text-xs leading-5 text-advertencia/80">Regístrate de nuevo para recibir un código de verificación.</p>
          <Button className="mt-4 w-full" onClick={() => navigate('/register')}>
            Registrarme de nuevo
          </Button>
        </div>
      ) : (
        <div className="mb-5 rounded-md border border-borde bg-panel px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-texto-secundario">Tiempo para verificar</p>
            <p className={`mono text-sm font-medium ${restante <= 60 ? 'text-error' : 'text-texto-principal'}`} aria-live="polite">
              {formatearTiempo(restante)}
            </p>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-tenue">
            Si no verificas en este tiempo, el registro se elimina y el correo queda libre.
          </p>
        </div>
      )}

      {!correoEnviado && !expirado && (
        <div className="mb-4 rounded-md border border-advertencia/30 bg-advertencia/10 px-3 py-2.5 text-xs leading-5 text-advertencia">
          No se pudo enviar el código a tu correo. Usa “Reenviar código” para intentarlo de nuevo.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-error/30 bg-error/10 px-3 py-2.5 text-xs font-medium leading-5 text-error" role="alert">
          {error}
        </div>
      )}
      {info && (
        <div className="mb-4 rounded-md border border-exito/30 bg-exito/10 px-3 py-2.5 text-xs font-medium leading-5 text-exito" role="status">
          {info}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Correo electrónico"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          required
          autoComplete="email"
          disabled={expirado}
        />

        <div>
          <p className="mb-1.5 text-xs font-medium text-texto-principal">Código de verificación</p>
          <div className="flex gap-2" onPaste={pegarCodigo}>
            {digitos.map((digito, indice) => (
              <input
                key={indice}
                ref={(el) => {
                  inputsRef.current[indice] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={indice === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={digito}
                onChange={(e) => escribirDigito(indice, e.target.value)}
                onKeyDown={(e) => manejarTecla(indice, e)}
                disabled={expirado}
                aria-label={`Dígito ${indice + 1} de 6`}
                className="mono h-12 w-full rounded-md border border-control bg-superficie text-center text-lg font-medium text-texto-principal transition-colors focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20 disabled:bg-panel disabled:text-tenue"
              />
            ))}
          </div>
        </div>

        <Button type="submit" className="mt-2 w-full" size="lg" disabled={cargando || expirado || codigo.length !== 6}>
          {cargando ? 'Verificando…' : 'Verificar cuenta'}
        </Button>
      </form>

      <Button
        type="button"
        variant="secundario"
        className="mt-3 w-full"
        onClick={handleReenviar}
        disabled={cargando || contador > 0 || expirado}
      >
        {contador > 0 ? `Reenviar código en ${contador}s` : 'Reenviar código'}
      </Button>
    </AuthShell>
  );
}
