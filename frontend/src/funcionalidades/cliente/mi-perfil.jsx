import { useState, useEffect } from 'react';
import { Button, Card, Input, Toast } from '../../componentes/ui/index.jsx';
import api from '../../api/cliente.js';
import { useAuth } from '../../hooks/use-auth.js';

export default function MiPerfil() {
  const { usuario, logout, setUsuario } = useAuth();
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', email: '' });
  const [cargando, setCargando] = useState(false);
  const [cargaInicial, setCargaInicial] = useState(true);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  useEffect(() => {
    api.clientes.me().then((data) => {
      setUsuario(data);
      setForm({ nombre: data.nombre || '', apellido: data.apellido || '', telefono: data.telefono || '', email: data.email || '' });
    }).catch(() => {
      if (usuario) setForm({ nombre: usuario.nombre || '', apellido: usuario.apellido || '', telefono: usuario.telefono || '', email: usuario.email || '' });
    }).finally(() => setCargaInicial(false));
  }, []);

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3000);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim() && !form.apellido.trim() && !form.telefono.trim()) {
      mostrarToast('Modifica al menos un campo', 'warning');
      return;
    }
    try {
      setCargando(true);
      const data = await api.clientes.updateMe({
        nombre: form.nombre.trim() || undefined,
        apellido: form.apellido.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
      });
      setUsuario({ ...usuario, ...data });
      setForm({
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        telefono: data.telefono || '',
        email: data.email || '',
      });
      mostrarToast('Perfil actualizado');
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
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <Input
            label="Apellido"
            value={form.apellido}
            onChange={(e) => setForm({ ...form, apellido: e.target.value })}
          />
          <Input
            label="Telefono"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          />
          <Input label="Email" value={form.email} disabled />

          <div className="pt-4 border-t border-borde">
            <Button type="submit" disabled={cargando}>
              {cargando ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold text-error mb-3">Zona de peligro</h2>
        <Card className="border-error/20">
          <p className="text-texto-secundario text-sm mb-4">
            Una vez que elimines tu cuenta, no hay vuelta atras.
          </p>
          {!mostrarConfirmacion ? (
            <Button variant="danger" onClick={() => setMostrarConfirmacion(true)}>
              Eliminar mi cuenta
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="danger" onClick={handleEliminarCuenta} disabled={cargando}>
                {cargando ? 'Eliminando...' : 'Confirmar eliminacion'}
              </Button>
              <Button variant="secundario" onClick={() => setMostrarConfirmacion(false)}>
                Cancelar
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
