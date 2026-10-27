import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth';
import { Button, Input } from '../../componentes/ui';
import CampoTelefono from '../../componentes/telefono/campo-telefono.jsx';
import AuthShell, { AuthLink } from '../../componentes/auth/auth-shell.jsx';
import { validarTelefonoInternacional } from '../../lib/telefonos.js';

export default function RegistroPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    telefono: '+57',
    email: '',
    password: '',
    confirmarPassword: '',
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === 'telefono') {
      setForm((prev) => ({ ...prev, telefono: value }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validar() {
    if (!validarTelefonoInternacional(form.telefono)) {
      setError('El teléfono debe incluir el código de país. Ejemplo: +57 300 123 4567.');
      return false;
    }
    if (form.password !== form.confirmarPassword) {
      setError('Las contraseñas no coinciden.');
      return false;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return false;
    }
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!validar()) return;
    setCargando(true);
    try {
      const data = await register({
        nombre: form.nombre,
        apellido: form.apellido,
        telefono: form.telefono,
        email: form.email,
        password: form.password,
      });
      navigate('/verificar', {
        state: {
          email: form.email,
          correoEnviado: data?.correoEnviado,
          expiraEn: data?.expiraEn,
          ttlMinutos: data?.ttlMinutos,
        },
        replace: true,
      });
    } catch (err) {
      setError(err.message || 'Error al registrarse');
    } finally {
      setCargando(false);
    }
  }

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Reserva en segundos, guarda tus sedes favoritas y paga en línea cuando quieras."
      footer={
        <p className="text-center text-sm text-texto-secundario">
          ¿Ya tienes cuenta? <AuthLink to="/login">Inicia sesión</AuthLink>
        </p>
      }
    >
      {error && (
        <div className="mb-4 rounded-md border border-error/30 bg-error/10 px-3 py-2.5 text-xs font-medium leading-5 text-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nombre"
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            placeholder="Tu nombre"
            required
            autoComplete="given-name"
          />
          <Input
            label="Apellido"
            name="apellido"
            value={form.apellido}
            onChange={handleChange}
            placeholder="Tu apellido"
            required
            autoComplete="family-name"
          />
        </div>

        <CampoTelefono
          label="Teléfono"
          name="telefono"
          value={form.telefono}
          onChange={(telefono) => setForm((prev) => ({ ...prev, telefono }))}
          required
        />

        <Input
          label="Correo electrónico"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="tu@correo.com"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Contraseña"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Mínimo 6 caracteres"
            required
            autoComplete="new-password"
          />
          <Input
            label="Confirmar"
            name="confirmarPassword"
            type="password"
            value={form.confirmarPassword}
            onChange={handleChange}
            placeholder="Repite la contraseña"
            required
            autoComplete="new-password"
          />
        </div>

        <Button type="submit" className="mt-2 w-full" size="lg" disabled={cargando}>
          {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>

      <p className="mt-4 text-center text-[11px] leading-5 text-tenue">
        Recibirás un código por correo. Si no verificas en pocos minutos, el registro se elimina y el correo queda libre.
      </p>
    </AuthShell>
  );
}
