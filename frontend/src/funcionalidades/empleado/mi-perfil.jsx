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
    if (usuario) {
      setForm({
        nombre: usuario.nombre || '',
        apellido: usuario.apellido || '',
        telefono: usuario.telefono || '',
        email: usuario.email || '',
      });
      setCargando(false);
    }
  }, [usuario]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const data = await api.clientes.updateMe({
        nombre: form.nombre,
        apellido: form.apellido,
        telefono: form.telefono,
      });
      setUsuario((prev) => ({ ...prev, ...data }));
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
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-texto-principal">Mi Perfil</h1>
        <p className="text-texto-secundario mt-1">Administrá tu información personal</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              required
            />
            <Input
              label="Apellido"
              name="apellido"
              value={form.apellido}
              onChange={handleChange}
              required
            />
          </div>

          <Input
            label="Teléfono"
            name="telefono"
            type="tel"
            value={form.telefono}
            onChange={handleChange}
          />

          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            disabled
          />

          <div className="pt-2">
            <Button type="submit" disabled={guardando}>
              {guardando ? <Spinner /> : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
