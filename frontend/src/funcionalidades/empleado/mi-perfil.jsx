import { useEffect, useRef, useState } from 'react';
import { toast as notificar } from 'sonner';
import api from '../../api/cliente';
import { useAuth } from '../../hooks/use-auth';
import TemaSelect from '../../componentes/tema/tema-select.jsx';
import { Avatar, Button, Card, Input, PageHeader, Spinner } from '../../componentes/ui/index.jsx';
import { comprimirImagen } from '../../lib/imagen.js';
import CampoTelefono from '../../componentes/telefono/campo-telefono.jsx';

export default function EmpleadoPerfil() {
  const { usuario, setUsuario } = useAuth();
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', email: '' });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const inputFotoRef = useRef(null);

  useEffect(() => {
    api.clientes
      .me()
      .then((data) => {
        setUsuario(data);
        setForm({ nombre: data.nombre || '', apellido: data.apellido || '', telefono: data.telefono || '', email: data.email || '' });
      })
      .catch(() => {
        if (usuario) {
          setForm({
            nombre: usuario.nombre || '',
            apellido: usuario.apellido || '',
            telefono: usuario.telefono || '',
            email: usuario.email || '',
          });
        }
      })
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambiarFoto = async (evento) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      const foto = await comprimirImagen(archivo, { maxLado: 512, maxBytes: 180 * 1024 });
      const data = await api.clientes.updateMe({ foto_url: foto });
      setUsuario((prev) => ({ ...prev, foto_url: data.foto_url }));
      notificar.success('Foto actualizada');
    } catch (err) {
      notificar.error(err.message || 'No se pudo subir la foto');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const quitarFoto = async () => {
    setSubiendoFoto(true);
    try {
      await api.clientes.updateMe({ foto_url: null });
      setUsuario((prev) => ({ ...prev, foto_url: null }));
      notificar.success('Foto retirada');
    } catch (err) {
      notificar.error(err.message || 'No se pudo retirar la foto');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim() && !form.apellido.trim() && !form.telefono.trim()) {
      notificar.warning('Modifica al menos un campo');
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
      notificar.success('Perfil actualizado');
    } catch (err) {
      notificar.error(err.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader title="Mi perfil" subtitle="Cargando tus datos…" />
        <div className="flex justify-center py-16"><Spinner /></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Mi perfil" subtitle="Tus datos de contacto y acceso al salón." />

      <Card>
        <h2 className="text-sm font-semibold text-texto-principal">Mi foto</h2>
        <p className="mt-1 text-xs leading-5 text-texto-secundario">
          Es opcional. Si la subes, tus clientes y el equipo verán tu foto en las citas y en la agenda.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Avatar nombre={form.nombre} apellido={form.apellido} fotoUrl={usuario?.foto_url} size="lg" />
          <div className="flex flex-wrap gap-2">
            <input ref={inputFotoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={cambiarFoto} />
            <Button type="button" variant="outline" size="sm" onClick={() => inputFotoRef.current?.click()} disabled={subiendoFoto}>
              {subiendoFoto ? <Spinner /> : usuario?.foto_url ? 'Cambiar foto' : 'Subir foto'}
            </Button>
            {usuario?.foto_url && (
              <Button type="button" variant="ghost" size="sm" onClick={quitarFoto} disabled={subiendoFoto}>
                Quitar foto
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-texto-principal">Apariencia</h2>
        <p className="mt-1 text-xs text-texto-secundario">Elige el tema de la interfaz o sigue la preferencia del sistema.</p>
        <div className="mt-3"><TemaSelect /></div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-texto-principal">Datos personales</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              autoComplete="given-name"
            />
            <Input
              label="Apellido"
              value={form.apellido}
              onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              autoComplete="family-name"
            />
          </div>

          <CampoTelefono
            label="Teléfono"
            value={form.telefono}
            onChange={(telefono) => setForm({ ...form, telefono })}
          />

          <Input
            label="Correo electrónico"
            type="email"
            value={form.email}
            disabled
            hint="El correo de acceso no se puede editar desde aquí."
          />

          <div className="flex justify-end border-t border-borde pt-4">
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
