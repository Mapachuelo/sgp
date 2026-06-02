import { useState } from 'react';
import { Button, Card, Input, Toast } from '../../componentes/ui/index.jsx';
import api from '../../api/cliente.js';
import { useAuth } from '../../hooks/use-auth.js';

export default function MiPerfil() {
  const { usuario, logout, setUsuario } = useAuth();
  const [form, setForm] = useState({
    nombre: usuario?.nombre || '',
    apellido: usuario?.apellido || '',
    telefono: usuario?.telefono || '',
    email: usuario?.email || '',
  });
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [errores, setErrores] = useState({});

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3000);
  };

  const validar = () => {
    const errs = {};
    if (!form.nombre.trim()) errs.nombre = 'El nombre es obligatorio';
    if (!form.apellido.trim()) errs.apellido = 'El apellido es obligatorio';
    if (!form.telefono.trim()) errs.telefono = 'El telefono es obligatorio';
    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!validar()) return;
    try {
      setCargando(true);
      const data = await api.clientes.updateMe({
        nombre: form.nombre,
        apellido: form.apellido,
        telefono: form.telefono,
      });
      setUsuario({ ...usuario, ...data });
      mostrarToast('Perfil actualizado con exito');
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  const handleEliminarCuenta = async () => {
    try {
      setCargando(true);
      await api.clientes.deleteMe();
      logout();
    } catch (err) {
      mostrarToast(err.message, 'error');
      setCargando(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      <h1 className="font-display text-3xl font-bold text-texto-principal mb-8">Mi Perfil</h1>

      <Card>
        <form onSubmit={handleGuardar} className="space-y-5">
          <Input
            label="Nombre"
            value={form.nombre}
            onChange={(e) => {
              setForm({ ...form, nombre: e.target.value });
              if (errores.nombre) setErrores({ ...errores, nombre: null });
            }}
          />
          {errores.nombre && (
            <p className="text-error text-xs -mt-4">{errores.nombre}</p>
          )}

          <Input
            label="Apellido"
            value={form.apellido}
            onChange={(e) => {
              setForm({ ...form, apellido: e.target.value });
              if (errores.apellido) setErrores({ ...errores, apellido: null });
            }}
          />
          {errores.apellido && (
            <p className="text-error text-xs -mt-4">{errores.apellido}</p>
          )}

          <Input
            label="Telefono"
            value={form.telefono}
            onChange={(e) => {
              setForm({ ...form, telefono: e.target.value });
              if (errores.telefono) setErrores({ ...errores, telefono: null });
            }}
          />
          {errores.telefono && (
            <p className="text-error text-xs -mt-4">{errores.telefono}</p>
          )}

          <Input label="Email" value={form.email} disabled />

          <div className="pt-4 border-t border-borde">
            <Button type="submit" disabled={cargando}>
              {cargando ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold text-error mb-3">
          Zona de peligro
        </h2>
        <Card className="border-error/20">
          <p className="text-texto-secundario text-sm mb-4">
            Una vez que elimines tu cuenta, no hay vuelta atras. Por favor, asegurate de que deseas
            continuar.
          </p>
          {!mostrarConfirmacion ? (
            <Button variant="danger" onClick={() => setMostrarConfirmacion(true)}>
              Eliminar mi cuenta
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="danger"
                onClick={handleEliminarCuenta}
                disabled={cargando}
              >
                {cargando ? 'Eliminando...' : 'Confirmar eliminacion'}
              </Button>
              <Button
                variant="secundario"
                onClick={() => setMostrarConfirmacion(false)}
              >
                Cancelar
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
