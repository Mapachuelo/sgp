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
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      <div className="bg-superficie border border-borde rounded-2xl p-6 shadow-premium space-y-4">
        <h2 className="font-display text-xl font-bold text-texto-principal border-b border-borde pb-2">Información del Cliente</h2>
        <form onSubmit={handleGuardar} className="space-y-4">
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
            disabled={cargando}
            className="w-full py-2.5 bg-primario hover:bg-primario-hover text-white rounded-xl text-sm font-semibold transition mt-4 flex justify-center items-center gap-2"
          >
            {cargando ? 'Guardando...' : 'Guardar Información'}
          </button>
        </form>
      </div>

      <div className="bg-superficie border border-error/25 bg-red-50/10 rounded-2xl p-6 shadow-premium space-y-4">
        <h3 className="font-display text-lg font-bold text-error border-b border-error/15 pb-2">Zona de Peligro</h3>
        <p className="text-texto-secundario text-xs">
          Una vez que elimines tu cuenta, no hay marcha atrás. Todas tus reservas y accesos serán eliminados de manera permanente.
        </p>
        {!mostrarConfirmacion ? (
          <button
            onClick={() => setMostrarConfirmacion(true)}
            className="px-4 py-2 border border-error/30 hover:bg-error/10 text-error rounded-xl text-xs font-semibold transition"
          >
            Eliminar mi cuenta
          </button>
        ) : (
          <div className="flex gap-3 items-center">
            <button
              onClick={handleEliminarCuenta}
              disabled={cargando}
              className="px-4 py-2 bg-error hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition"
            >
              {cargando ? 'Eliminando...' : 'Confirmar eliminación'}
            </button>
            <button
              onClick={() => setMostrarConfirmacion(false)}
              className="px-4 py-2 bg-fondo border border-borde hover:bg-superficie rounded-xl text-xs font-semibold text-texto-principal transition"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
