import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Scissors, Trash2 } from 'lucide-react';
import { Button, Card, Input, Select, Spinner } from '../../../componentes/ui/index.jsx';
import { SheetAdmin } from './navegacion.jsx';
import api from '../../../api/cliente.js';

export default function ServiciosSeccion({ open, onClose, onToast }) {
  const [servicios, setServicios] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: '' });
  const [editId, setEditId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [empleadoId, setEmpleadoId] = useState('');
  const [tiempos, setTiempos] = useState([]);
  const [cargandoTiempos, setCargandoTiempos] = useState(false);
  const [servicioAgregar, setServicioAgregar] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [servs, emps] = await Promise.all([api.reservas.servicios(), api.auth.empleados.list()]);
      setServicios(Array.isArray(servs) ? servs : []);
      setEmpleados(Array.isArray(emps) ? emps : []);
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
    setForm({ nombre: '', descripcion: '', precio: '' });
    setEditId(null);
    setMostrarForm(false);
  };

  const guardar = async () => {
    if (!form.nombre) return onToast?.('El nombre es obligatorio', 'warning');
    setGuardando(true);
    try {
      const body = {
        nombre: form.nombre,
        descripcion: form.descripcion,
        precio_base: Number(form.precio) || 0,
        duracion_base_minutos: 30,
      };
      if (editId) await api.reservas.updateServicio(editId, body);
      else await api.reservas.createServicio(body);
      onToast?.(editId ? 'Servicio actualizado' : 'Servicio creado');
      resetForm();
      await cargar();
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (servicio) => {
    if (!window.confirm(`¿Eliminar servicio "${servicio.nombre}"?`)) return;
    try {
      await api.reservas.deleteServicio(servicio.id);
      onToast?.('Servicio eliminado');
      await cargar();
    } catch (error) {
      onToast?.(error.message, 'error');
    }
  };

  const cargarTiempos = async (id) => {
    setEmpleadoId(id);
    if (!id) {
      setTiempos([]);
      return;
    }
    setCargandoTiempos(true);
    try {
      const data = await api.reservas.empleadoTiempos.get(id);
      setTiempos(
        (data || []).map((t) => ({
          servicio_id: t.servicio_id,
          servicio_nombre: t.servicio_nombre,
          duracion_minutos: t.duracion_minutos || 30,
        }))
      );
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setCargandoTiempos(false);
    }
  };

  const guardarTiempos = async () => {
    if (!empleadoId) return;
    try {
      const items = tiempos.map((t) => ({ servicio_id: t.servicio_id, duracion_minutos: Number(t.duracion_minutos) || 30 }));
      await api.reservas.empleadoTiempos.update({ empleado_id: Number(empleadoId), items });
      onToast?.('Tiempos de servicio actualizados');
      await cargarTiempos(empleadoId);
    } catch (error) {
      onToast?.(error.message, 'error');
    }
  };

  return (
    <SheetAdmin open={open} onClose={onClose} title="Gestion de servicios">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="primario" onClick={() => { resetForm(); setMostrarForm(true); }}>
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> Nuevo servicio
          </Button>
        </div>

        {mostrarForm && (
          <Card>
            <h3 className="font-display text-lg font-bold text-texto-principal mb-4 flex items-center gap-2">
              <Scissors className="w-5 h-5 text-primario" aria-hidden="true" />
              {editId ? 'Editar servicio' : 'Nuevo servicio'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Nombre" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
              <Input label="Precio base" type="number" value={form.precio} onChange={(e) => setForm((p) => ({ ...p, precio: e.target.value }))} />
              <Input label="Descripcion" value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} />
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
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-fondo/60">
                <tr className="text-left text-texto-secundario text-xs uppercase">
                  <th className="py-3 px-3">Nombre</th>
                  <th className="py-3 px-3">Descripcion</th>
                  <th className="py-3 px-3">Precio</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {servicios.map((servicio) => (
                  <tr key={servicio.id} className="border-t border-borde/50 hover:bg-fondo/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-texto-principal">{servicio.nombre}</td>
                    <td className="py-2.5 px-3 text-xs text-texto-secundario max-w-[260px] truncate">{servicio.descripcion}</td>
                    <td className="py-2.5 px-3">${Number(servicio.precio_base ?? servicio.precio ?? 0).toLocaleString('es-CO')}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" aria-label={`Editar ${servicio.nombre}`} onClick={() => { setEditId(servicio.id); setMostrarForm(true); setForm({ nombre: servicio.nombre || '', descripcion: servicio.descripcion || '', precio: servicio.precio_base ?? servicio.precio ?? '' }); }}>
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                        <Button variant="danger" size="sm" aria-label={`Eliminar ${servicio.nombre}`} onClick={() => eliminar(servicio)}>
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {servicios.length === 0 && (
                  <tr><td colSpan="4" className="py-10 text-center text-texto-secundario">No hay servicios registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Card>
          <h4 className="font-display text-base font-bold text-texto-principal mb-3">Tiempos de servicio por empleado</h4>
          <Select
            label="Empleado"
            options={[{ value: '', label: 'Seleccionar empleado...' }, ...empleados.map((e) => ({ value: String(e.id), label: `${e.nombre} ${e.apellido}` }))]}
            value={empleadoId}
            onChange={(e) => cargarTiempos(e.target.value)}
          />
          {cargandoTiempos ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : empleadoId ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-end gap-2 bg-fondo/40 p-3 rounded-xl border border-borde/40">
                <div className="flex-grow">
                  <Select
                    label="Asociar servicio"
                    value={servicioAgregar}
                    onChange={(e) => setServicioAgregar(e.target.value)}
                    options={[
                      { value: '', label: 'Seleccionar servicio...' },
                      ...servicios
                        .filter((s) => !tiempos.some((t) => t.servicio_id === s.id))
                        .map((s) => ({ value: String(s.id), label: s.nombre })),
                    ]}
                  />
                </div>
                <Button
                  variant="primario"
                  disabled={!servicioAgregar}
                  onClick={() => {
                    const elegido = servicios.find((s) => String(s.id) === servicioAgregar);
                    if (!elegido) return;
                    setTiempos((prev) => [...prev, { servicio_id: elegido.id, servicio_nombre: elegido.nombre, duracion_minutos: elegido.duracion_base_minutos || 30 }]);
                    setServicioAgregar('');
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Agregar
                </Button>
              </div>
              {tiempos.length === 0 ? (
                <p className="text-xs text-texto-secundario italic p-3 bg-fondo/20 border border-dashed border-borde rounded-xl text-center">
                  No tiene servicios asignados.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {tiempos.map((t, indice) => (
                    <div key={t.servicio_id} className="flex items-center justify-between p-2.5 bg-fondo/40 rounded-xl border border-borde/40 text-xs">
                      <span className="font-semibold text-texto-principal">{t.servicio_nombre}</span>
                      <span className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="5"
                            value={t.duracion_minutos}
                            aria-label={`Duracion de ${t.servicio_nombre}`}
                            onChange={(e) => setTiempos((prev) => prev.map((item, i) => (i === indice ? { ...item, duracion_minutos: Number(e.target.value) } : item)))}
                            className="w-16 px-1.5 py-0.5 border border-borde rounded bg-superficie text-xs text-center focus:outline-none"
                          />
                          <span className="text-texto-secundario text-[10px]">min</span>
                        </span>
                        <button
                          type="button"
                          aria-label={`Quitar ${t.servicio_nombre}`}
                          onClick={() => setTiempos((prev) => prev.filter((_, i) => i !== indice))}
                          className="p-1.5 rounded-lg text-error hover:bg-error/10 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="primario" className="w-full" onClick={guardarTiempos}>Guardar tiempos de servicio</Button>
            </div>
          ) : null}
        </Card>
      </div>
    </SheetAdmin>
  );
}
