import { useCallback, useEffect, useState } from 'react';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Input, Sheet, Spinner } from '../../../componentes/ui/index.jsx';
import api from '../../../api/cliente.js';

const FORM_INICIAL = { nombre: '', direccion: '', latitud: '', longitud: '' };

export default function SedesSeccion({ open, onClose, onToast }) {
  const [sedes, setSedes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [editId, setEditId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api.ubicaciones.list();
      setSedes(Array.isArray(data) ? data : []);
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (open) cargar();
  }, [open, cargar]);

  const resetForm = () => {
    setForm(FORM_INICIAL);
    setEditId(null);
    setMostrarForm(false);
  };

  const guardar = async () => {
    if (!form.nombre || !form.direccion) return onToast?.('Nombre y direccion son obligatorios', 'warning');
    setGuardando(true);
    try {
      const body = { ...form, latitud: Number(form.latitud) || 0, longitud: Number(form.longitud) || 0 };
      if (editId) await api.ubicaciones.update(editId, body);
      else await api.ubicaciones.create(body);
      onToast?.(editId ? 'Sede actualizada' : 'Sede creada');
      resetForm();
      await cargar();
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (sede) => {
    if (!window.confirm(`¿Eliminar sede "${sede.nombre}"?`)) return;
    try {
      await api.ubicaciones.delete(sede.id);
      onToast?.('Sede eliminada');
      await cargar();
    } catch (error) {
      onToast?.(error.message, 'error');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Gestion de sedes" size="wide">
      <div className="space-y-5">
        <div className="flex justify-end">
          <Button variant="primario" onClick={() => { resetForm(); setMostrarForm(true); }}>
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> Nueva sede
          </Button>
        </div>

        {mostrarForm && (
          <Card>
            <h3 className="font-display text-lg font-bold text-texto-principal mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primario" aria-hidden="true" />
              {editId ? 'Editar sede' : 'Nueva sede'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input label="Nombre" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
              <Input label="Direccion" value={form.direccion} onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))} />
              <Input label="Latitud" type="number" step="any" value={form.latitud} onChange={(e) => setForm((p) => ({ ...p, latitud: e.target.value }))} />
              <Input label="Longitud" type="number" step="any" value={form.longitud} onChange={(e) => setForm((p) => ({ ...p, longitud: e.target.value }))} />
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="primario" onClick={guardar} disabled={guardando}>{guardando ? <Spinner /> : editId ? 'Actualizar' : 'Crear'}</Button>
              <Button variant="secundario" onClick={resetForm}>Cancelar</Button>
            </div>
          </Card>
        )}

        {cargando ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-borde">
            <table className="w-full text-sm min-w-[680px]">
              <thead className="bg-fondo/60">
                <tr className="text-left text-texto-secundario text-xs uppercase">
                  <th className="py-3 px-3">Nombre</th>
                  <th className="py-3 px-3">Direccion</th>
                  <th className="py-3 px-3">Latitud</th>
                  <th className="py-3 px-3">Longitud</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sedes.map((sede) => (
                  <tr key={sede.id} className="border-t border-borde/50 hover:bg-fondo/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-texto-principal">{sede.nombre}</td>
                    <td className="py-2.5 px-3 text-xs text-texto-secundario">{sede.direccion}</td>
                    <td className="py-2.5 px-3 text-xs">{sede.latitud}</td>
                    <td className="py-2.5 px-3 text-xs">{sede.longitud}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" aria-label={`Editar ${sede.nombre}`} onClick={() => { setEditId(sede.id); setMostrarForm(true); setForm({ nombre: sede.nombre || '', direccion: sede.direccion || '', latitud: sede.latitud ?? '', longitud: sede.longitud ?? '' }); }}>
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                        <Button variant="danger" size="sm" aria-label={`Eliminar ${sede.nombre}`} onClick={() => eliminar(sede)}>
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sedes.length === 0 && (
                  <tr><td colSpan="5" className="py-10 text-center text-texto-secundario">No hay sedes registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Sheet>
  );
}
