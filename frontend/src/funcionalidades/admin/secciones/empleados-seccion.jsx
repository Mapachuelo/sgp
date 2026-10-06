import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { Badge, Button, Card, Input, Sheet, Spinner } from '../../../componentes/ui/index.jsx';
import api from '../../../api/cliente.js';

const DIAS = [
  { dia: 1, label: 'Lunes' },
  { dia: 2, label: 'Martes' },
  { dia: 3, label: 'Miercoles' },
  { dia: 4, label: 'Jueves' },
  { dia: 5, label: 'Viernes' },
  { dia: 6, label: 'Sabado' },
  { dia: 7, label: 'Domingo' },
];

function crearHorarioDefault() {
  const horario = {};
  for (let d = 1; d <= 7; d++) {
    horario[d] = { disponible: d <= 5, hora_inicio: '08:00', hora_fin: '17:00' };
  }
  return horario;
}

function crearHorarioVacio() {
  const horario = {};
  for (let d = 1; d <= 7; d++) {
    horario[d] = { disponible: false, hora_inicio: '08:00', hora_fin: '17:00' };
  }
  return horario;
}

const FORM_INICIAL = {
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  telefono: '',
  identificacion: '',
  sedes_asignadas: [],
  horarios: {},
  servicios_asignados: {},
};

export default function EmpleadosSeccion({ open, onClose, onToast }) {
  const [empleados, setEmpleados] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [editId, setEditId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [sedeActiva, setSedeActiva] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [emps, ubis, servs] = await Promise.all([
        api.auth.empleados.list(),
        api.ubicaciones.list(),
        api.reservas.servicios(),
      ]);
      setEmpleados(Array.isArray(emps) ? emps : []);
      setUbicaciones(Array.isArray(ubis) ? ubis : []);
      setServicios(Array.isArray(servs) ? servs : []);
    } catch (errorCarga) {
      onToast?.(errorCarga.message, 'error');
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
    setSedeActiva(null);
    setError('');
  };

  const toggleSede = (sedeId, marcada) => {
    setForm((prev) => {
      let sedes = [...(prev.sedes_asignadas || [])];
      const horarios = { ...(prev.horarios || {}) };
      if (marcada) {
        if (!sedes.includes(sedeId)) sedes.push(sedeId);
        if (!horarios[sedeId]) horarios[sedeId] = sedes.length === 1 ? crearHorarioDefault() : crearHorarioVacio();
      } else {
        sedes = sedes.filter((id) => id !== sedeId);
        delete horarios[sedeId];
      }
      if (sedes.length > 0 && (!sedeActiva || !sedes.includes(sedeActiva))) {
        setSedeActiva(sedes[0]);
      } else if (sedes.length === 0) {
        setSedeActiva(null);
      }
      return { ...prev, sedes_asignadas: sedes, horarios };
    });
  };

  const actualizarDia = (sedeId, dia, campo, valor) => {
    if (campo === 'disponible' && valor === true) {
      const duplicada = Object.entries(form.horarios || {}).find(([sid, dias]) => {
        return Number(sid) !== Number(sedeId) && form.sedes_asignadas?.includes(Number(sid)) && dias[dia]?.disponible;
      });
      if (duplicada) {
        const nombreSede = ubicaciones.find((u) => u.id === Number(duplicada[0]))?.nombre || `Sede #${duplicada[0]}`;
        const nombreDia = DIAS.find((d) => d.dia === dia)?.label || `Dia ${dia}`;
        onToast?.(`El empleado ya tiene horario en ${nombreSede} el ${nombreDia}`, 'error');
        return;
      }
    }
    setForm((prev) => {
      const horarios = { ...(prev.horarios || {}) };
      if (!horarios[sedeId]) horarios[sedeId] = crearHorarioVacio();
      horarios[sedeId] = {
        ...horarios[sedeId],
        [dia]: { ...(horarios[sedeId][dia] || { disponible: false, hora_inicio: '08:00', hora_fin: '17:00' }), [campo]: valor },
      };
      return { ...prev, horarios };
    });
  };

  const guardar = async () => {
    if (!form.nombre || !form.apellido || !form.email) {
      setError('Nombre, apellido y email son obligatorios');
      return;
    }
    if (!editId && !form.password) {
      setError('La contrasena es obligatoria para crear el empleado');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      const disponibilidadItems = [];
      Object.entries(form.horarios || {}).forEach(([ubicacionId, dias]) => {
        if (!form.sedes_asignadas?.includes(Number(ubicacionId))) return;
        Object.entries(dias).forEach(([diaSemana, config]) => {
          if (config.disponible) {
            disponibilidadItems.push({
              ubicacion_id: Number(ubicacionId),
              dia_semana: Number(diaSemana),
              hora_inicio: config.hora_inicio || '08:00',
              hora_fin: config.hora_fin || '17:00',
            });
          }
        });
      });

      const serviciosItems = [];
      Object.entries(form.servicios_asignados || {}).forEach(([srvId, config]) => {
        if (config.checked) {
          serviciosItems.push({ servicio_id: Number(srvId), duracion_minutos: Number(config.duracion) || 30 });
        }
      });

      const { sedes_asignadas, horarios, servicios_asignados, ...resto } = form;
      let empleadoId = editId;
      if (editId) {
        await api.auth.empleados.update(editId, form.password ? { ...resto, password: form.password } : resto);
      } else {
        const creado = await api.auth.empleados.create(resto);
        empleadoId = creado?.id;
      }
      if (empleadoId) {
        await api.disponibilidad.updateByAdmin(empleadoId, disponibilidadItems);
        await api.reservas.empleadoTiempos.update({ empleado_id: empleadoId, items: serviciosItems });
      }
      onToast?.(editId ? 'Empleado actualizado' : 'Empleado creado');
      resetForm();
      await cargar();
    } catch (errorGuardar) {
      onToast?.(errorGuardar.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (empleado) => {
    if (!window.confirm(`¿Eliminar a ${empleado.nombre} ${empleado.apellido}?`)) return;
    try {
      await api.auth.empleados.delete(empleado.id);
      onToast?.('Empleado eliminado');
      await cargar();
    } catch (errorEliminar) {
      onToast?.(errorEliminar.message, 'error');
    }
  };

  const editar = async (empleado) => {
    setEditId(empleado.id);
    setMostrarForm(true);
    setError('');
    setForm({
      nombre: empleado.nombre || '',
      apellido: empleado.apellido || '',
      email: empleado.email || '',
      password: '',
      telefono: empleado.telefono || '',
      identificacion: empleado.identificacion || '',
      sedes_asignadas: [],
      horarios: {},
      servicios_asignados: {},
    });
    try {
      const [disponibilidad, tiempos] = await Promise.all([
        api.disponibilidad.getByAdmin(empleado.id),
        api.reservas.empleadoTiempos.get(empleado.id),
      ]);
      const sedes = [...new Set((disponibilidad || []).map((i) => i.ubicacion_id))];
      const horariosMap = {};
      sedes.forEach((sid) => {
        horariosMap[sid] = crearHorarioVacio();
      });
      (disponibilidad || []).forEach((item) => {
        if (!horariosMap[item.ubicacion_id]) horariosMap[item.ubicacion_id] = crearHorarioVacio();
        horariosMap[item.ubicacion_id][item.dia_semana] = {
          disponible: true,
          hora_inicio: (item.hora_inicio || '').slice(0, 5) || '08:00',
          hora_fin: (item.hora_fin || '').slice(0, 5) || '17:00',
        };
      });
      const serviciosMap = {};
      (tiempos || []).forEach((t) => {
        serviciosMap[t.servicio_id] = { checked: true, duracion: t.duracion_minutos || 30 };
      });
      setForm((prev) => ({ ...prev, sedes_asignadas: sedes, horarios: horariosMap, servicios_asignados: serviciosMap }));
      setSedeActiva(sedes[0] || null);
    } catch {
      onToast?.('Error al cargar los datos del empleado', 'error');
    }
  };

  const filtrados = empleados.filter((emp) =>
    `${emp.nombre} ${emp.apellido} ${emp.email}`.toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  return (
    <Sheet open={open} onClose={onClose} title="Gestion de empleados" size="wide">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-texto-secundario" aria-hidden="true" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              aria-label="Buscar empleado"
              className="pl-9 pr-3 py-2.5 border border-borde rounded-lg text-sm bg-superficie focus:outline-none focus:ring-2 focus:ring-primario/30 w-full sm:w-80"
            />
          </div>
          <Button variant="primario" onClick={() => { resetForm(); setMostrarForm(true); }}>
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> Nuevo empleado
          </Button>
        </div>

        {mostrarForm && (
          <Card>
            <h3 className="font-display text-lg font-bold text-texto-principal mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primario" aria-hidden="true" />
              {editId ? 'Editar empleado' : 'Nuevo empleado'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Input label="Nombre" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
              <Input label="Apellido" value={form.apellido} onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              <Input label={editId ? 'Nuevo password (opcional)' : 'Password'} type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder={editId ? 'Dejar vacio para no cambiar' : ''} />
              <Input label="Telefono" value={form.telefono} onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))} placeholder="+573001112233" />
              <Input label="Identificacion" value={form.identificacion} onChange={(e) => setForm((p) => ({ ...p, identificacion: e.target.value }))} />
            </div>

            <div className="mt-5 space-y-2">
              <span className="block text-xs font-bold text-texto-secundario uppercase tracking-wider">Sedes de trabajo (una por dia)</span>
              <div className="flex flex-wrap gap-2">
                {ubicaciones.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-xs font-semibold text-texto-principal bg-fondo border border-borde p-2 rounded-xl cursor-pointer hover:bg-superficie transition select-none">
                    <input
                      type="checkbox"
                      checked={form.sedes_asignadas?.includes(u.id) || false}
                      onChange={(e) => toggleSede(u.id, e.target.checked)}
                      className="rounded border-borde text-primario w-4 h-4 cursor-pointer"
                    />
                    {u.nombre}
                  </label>
                ))}
              </div>
            </div>

            {form.sedes_asignadas?.length > 0 && (
              <div className="mt-5 border-t border-borde/60 pt-4 space-y-3">
                <div className="flex flex-wrap gap-1">
                  {form.sedes_asignadas.map((sid) => {
                    const sede = ubicaciones.find((u) => u.id === sid);
                    if (!sede) return null;
                    return (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => setSedeActiva(sid)}
                        aria-pressed={sedeActiva === sid}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          sedeActiva === sid ? 'bg-primario text-white' : 'bg-fondo border border-borde text-texto-principal hover:bg-superficie'
                        }`}
                      >
                        {sede.nombre}
                      </button>
                    );
                  })}
                </div>

                {sedeActiva && form.horarios?.[sedeActiva] && (
                  <div className="space-y-2">
                    {DIAS.map(({ dia, label }) => {
                      const config = form.horarios[sedeActiva][dia] || { disponible: false, hora_inicio: '08:00', hora_fin: '17:00' };
                      return (
                        <div key={dia} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-fondo/40 rounded-xl border border-borde/40 text-xs">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={config.disponible}
                              onChange={(e) => actualizarDia(sedeActiva, dia, 'disponible', e.target.checked)}
                              className="rounded border-borde text-primario w-4 h-4 cursor-pointer"
                            />
                            <span className="font-semibold text-texto-principal w-20">{label}</span>
                            <Badge variant={config.disponible ? 'success' : 'default'}>{config.disponible ? 'Disponible' : 'Descanso'}</Badge>
                          </div>
                          {config.disponible && (
                            <div className="flex items-center gap-2">
                              <input type="time" value={config.hora_inicio} aria-label={`Hora inicio ${label}`} onChange={(e) => actualizarDia(sedeActiva, dia, 'hora_inicio', e.target.value)} className="px-2 py-1 border border-borde rounded bg-superficie text-xs focus:outline-none" />
                              <span className="text-texto-secundario">a</span>
                              <input type="time" value={config.hora_fin} aria-label={`Hora fin ${label}`} onChange={(e) => actualizarDia(sedeActiva, dia, 'hora_fin', e.target.value)} className="px-2 py-1 border border-borde rounded bg-superficie text-xs focus:outline-none" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 border-t border-borde/60 pt-4 space-y-3">
              <span className="block text-xs font-bold text-texto-secundario uppercase tracking-wider">Servicios y duraciones</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {servicios.map((servicio) => {
                  const config = form.servicios_asignados?.[servicio.id] || { checked: false, duracion: servicio.duracion_base_minutos || 30 };
                  return (
                    <div key={servicio.id} className="flex items-center justify-between p-2 bg-fondo/40 rounded-xl border border-borde/40 text-xs">
                      <label className="flex items-center gap-2 font-semibold text-texto-principal cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={config.checked}
                          onChange={(e) => setForm((p) => ({ ...p, servicios_asignados: { ...p.servicios_asignados, [servicio.id]: { ...config, checked: e.target.checked } } }))}
                          className="rounded border-borde text-primario w-4 h-4 cursor-pointer"
                        />
                        {servicio.nombre}
                      </label>
                      {config.checked && (
                        <span className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="5"
                            value={config.duracion}
                            aria-label={`Duracion de ${servicio.nombre}`}
                            onChange={(e) => setForm((p) => ({ ...p, servicios_asignados: { ...p.servicios_asignados, [servicio.id]: { ...config, duracion: Number(e.target.value) } } }))}
                            className="w-16 px-1.5 py-0.5 border border-borde rounded bg-superficie text-xs text-center focus:outline-none"
                          />
                          <span className="text-texto-secundario text-[10px]">min</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-error text-sm mt-3 font-medium">{error}</p>}
            <div className="flex gap-2 mt-5">
              <Button variant="primario" onClick={guardar} disabled={guardando}>
                {guardando ? <Spinner /> : editId ? 'Actualizar empleado' : 'Crear empleado'}
              </Button>
              <Button variant="secundario" onClick={resetForm}>Cancelar</Button>
            </div>
          </Card>
        )}

        {cargando ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-borde">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-fondo/60 sticky top-0">
                <tr className="text-left text-texto-secundario text-xs uppercase">
                  <th className="py-3 px-3">Nombre</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Telefono</th>
                  <th className="py-3 px-3">Identificacion</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((emp) => (
                  <tr key={emp.id} className="border-t border-borde/50 hover:bg-fondo/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-texto-principal">{emp.nombre} {emp.apellido}</td>
                    <td className="py-2.5 px-3 text-xs text-texto-secundario">{emp.email}</td>
                    <td className="py-2.5 px-3 text-xs">{emp.telefono}</td>
                    <td className="py-2.5 px-3 text-xs">{emp.identificacion}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => editar(emp)} aria-label={`Editar ${emp.nombre}`}>
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => eliminar(emp)} aria-label={`Eliminar ${emp.nombre}`}>
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan="5" className="py-10 text-center text-texto-secundario">No hay empleados registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Sheet>
  );
}
