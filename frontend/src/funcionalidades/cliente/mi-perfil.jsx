import { useEffect, useState } from 'react';
import { toast as notificar } from 'sonner';
import TemaSelect from '../../componentes/tema/tema-select.jsx';
import { Button, Card, ConfirmDialog, Input, PageHeader, Select } from '../../componentes/ui/index.jsx';
import CampoTelefono from '../../componentes/telefono/campo-telefono.jsx';
import api from '../../api/cliente.js';
import { useAuth } from '../../hooks/use-auth.js';
import { DEPARTAMENTOS, ciudadesDeDepartamento } from '../../lib/colombia.js';

export default function MiPerfil() {
  const { usuario, logout, setUsuario } = useAuth();
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', email: '' });
  const [ubicacion, setUbicacion] = useState({ departamento_preferido: '', ciudad_preferida: '' });
  const [cargando, setCargando] = useState(false);
  const [cargaInicial, setCargaInicial] = useState(true);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

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
      .finally(() => setCargaInicial(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.preferencias
      .get()
      .then((prefs) => {
        setUbicacion({
          departamento_preferido: prefs?.departamento_preferido || '',
          ciudad_preferida: prefs?.ciudad_preferida || '',
        });
      })
      .catch(() => {});
  }, []);

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim() && !form.apellido.trim() && !form.telefono.trim()) {
      notificar.warning('Modifica al menos un campo');
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
      await api.preferencias.update(ubicacion).catch(() => {});
      notificar.success('Perfil actualizado');
    } catch (err) {
      notificar.error(err.message);
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
      notificar.error(err.message);
      setCargando(false);
    }
  };

  if (cargaInicial) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Mi perfil" subtitle="Cargando tus datos…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Mi perfil" subtitle="Actualiza tus datos de contacto. El correo de acceso no se puede cambiar." />

      <Card>
        <h2 className="text-sm font-semibold text-texto-principal">Apariencia</h2>
        <p className="mt-1 text-xs text-texto-secundario">Elige el tema de la interfaz o sigue la preferencia del sistema.</p>
        <div className="mt-3"><TemaSelect /></div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-texto-principal">Mi ubicación</h2>
        <p className="mt-1 text-xs text-texto-secundario">
          La usamos para mostrarte primero las sedes de tu departamento y ciudad al reservar.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Departamento"
            value={ubicacion.departamento_preferido}
            onChange={(e) => setUbicacion({ departamento_preferido: e.target.value, ciudad_preferida: '' })}
            options={[
              { value: '', label: 'Sin preferencia' },
              ...DEPARTAMENTOS.map((item) => ({ value: item, label: item })),
            ]}
          />
          <Select
            label="Ciudad"
            value={ubicacion.ciudad_preferida}
            onChange={(e) => setUbicacion((previo) => ({ ...previo, ciudad_preferida: e.target.value }))}
            options={[
              { value: '', label: 'Sin preferencia' },
              ...ciudadesDeDepartamento(ubicacion.departamento_preferido).map((item) => ({ value: item, label: item })),
            ]}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-texto-principal">Datos personales</h2>
        <form onSubmit={handleGuardar} className="mt-4 space-y-4">
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
            <Button type="submit" disabled={cargando}>
              {cargando ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="border-error/30">
        <h2 className="text-sm font-semibold text-error">Eliminar cuenta</h2>
        <p className="mt-1 text-xs leading-5 text-texto-secundario">
          Esta acción es permanente. Se eliminan tus reservas y tus accesos al salón. No se puede deshacer.
        </p>
        <Button variant="dangerSuave" size="sm" className="mt-4" onClick={() => setConfirmarEliminar(true)}>
          Eliminar mi cuenta
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmarEliminar}
        onClose={() => setConfirmarEliminar(false)}
        onConfirm={handleEliminarCuenta}
        title="Eliminar mi cuenta"
        description="Se eliminarán tu cuenta, tus reservas y tus accesos. Esta acción no se puede deshacer."
        confirmLabel="Eliminar cuenta"
        danger
        cargando={cargando}
      />
    </div>
  );
}
