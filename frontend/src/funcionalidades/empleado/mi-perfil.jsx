import { useState, useEffect } from 'react';
import api from '../../api/cliente';
import { useAuth } from '../../hooks/use-auth';
import { Button, Card, Input, Spinner, Toast } from '../../componentes/ui/index.jsx';

export default function EmpleadoPerfil() {
  const { usuario, setUsuario } = useAuth();
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', email: '' });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });

  useEffect(() => {
    api.clientes.me().then((data) => {
      setUsuario(data);
      setForm({ nombre: data.nombre || '', apellido: data.apellido || '', telefono: data.telefono || '', email: data.email || '' });
    }).catch(() => {
      if (usuario) setForm({ nombre: usuario.nombre || '', apellido: usuario.apellido || '', telefono: usuario.telefono || '', email: usuario.email || '' });
    }).finally(() => setCargando(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim() && !form.apellido.trim() && !form.telefono.trim()) {
      mostrarToast('Modifica al menos un campo', 'warning');
      return;
    }
    setGuardando(true);
    try {
      const data = await api.clientes.updateMe({
        nombre: form.nombre.trim() || undefined,
        apellido: form.apellido.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
      });
      setUsuario((prev) => ({ ...prev, ...data }));
      setForm({
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        telefono: data.telefono || '',
        email: data.email || '',
      });
      mostrarToast('Perfil actualizado correctamente');
    } catch (err) {
      mostrarToast(err.message || 'Error al guardar', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3000);
  };

  if (cargando) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex justify-center py-20"><Spinner /></div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      <div className="bg-superficie border border-borde rounded-2xl p-6 shadow-premium space-y-4">
        <h2 className="font-display text-xl font-bold text-texto-principal border-b border-borde pb-2">Información del Estilista</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-texto-principal uppercase mb-1">Nombre</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-borde rounded-lg text-sm bg-fondo/20 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-texto-principal uppercase mb-1">Apellido</label>
              <input
                type="text"
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                className="w-full px-3 py-2 border border-borde rounded-lg text-sm bg-fondo/20 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario transition"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-texto-principal uppercase mb-1">Teléfono</label>
            <input
              type="text"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              className="w-full px-3 py-2 border border-borde rounded-lg text-sm bg-fondo/20 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-texto-principal uppercase mb-1">Correo Electrónico (No editable)</label>
            <input
              type="email"
              value={form.email}
              disabled
              className="w-full px-3 py-2 border border-borde rounded-lg text-sm bg-fondo text-texto-secundario cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="w-full py-2.5 bg-primario hover:bg-primario-hover text-white rounded-xl text-sm font-semibold transition mt-4 flex justify-center items-center gap-2"
          >
            {guardando ? <Spinner /> : 'Guardar Información'}
          </button>
        </form>
      </div>
    </div>
  );
}
