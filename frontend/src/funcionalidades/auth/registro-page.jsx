import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth';
import { Button, Input } from '../../componentes/ui';
import CampoTelefono from '../../componentes/telefono/campo-telefono.jsx';
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
    <div className="min-h-screen bg-pattern flex">
      <div className="hidden lg:flex lg:w-1/2 bg-primario items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primario/90 to-texto-principal/80" />
        <div className="relative z-10 text-center px-12">
          <h1 className="font-display text-5xl font-bold text-white mb-4">SGP</h1>
          <p className="text-white/80 text-lg font-body">Sistema de Gestión de Peluquería</p>
          <p className="text-white/60 text-sm mt-6 font-body max-w-md">
            Crea tu cuenta y comienza a reservar tus citas favoritas.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:hidden">
            <h1 className="font-display text-3xl font-bold text-primario">SGP</h1>
            <p className="text-texto-secundario text-sm mt-1 font-body">Sistema de Gestión de Peluquería</p>
          </div>

          <div className="bg-superficie rounded-2xl border border-borde shadow-sm p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-texto-principal mb-6">Crear cuenta</h2>

            {error && (
              <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              />
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
                label="Confirmar contraseña"
                name="confirmarPassword"
                type="password"
                value={form.confirmarPassword}
                onChange={handleChange}
                placeholder="Repite tu contraseña"
                required
                autoComplete="new-password"
              />
              <Button type="submit" variant="primario" className="w-full" size="lg" disabled={cargando}>
                {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
              </Button>
            </form>

            <p className="mt-4 text-xs text-texto-secundario font-body text-center">
              Recibiras un codigo por correo. Si no verificas en pocos minutos, el registro se elimina y el correo queda libre.
            </p>

            <p className="mt-6 text-center text-sm text-texto-secundario font-body">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-primario font-semibold hover:underline">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
