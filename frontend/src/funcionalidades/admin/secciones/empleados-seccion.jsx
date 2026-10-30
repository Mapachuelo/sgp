import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageOff, Pencil, Plus, Search, Trash2, Upload, Users } from 'lucide-react';
import { PageHeader, Avatar, Badge, Button, Card, Input, Select, Spinner } from '../../../componentes/ui/index.jsx';
import CampoTelefono from '../../../componentes/telefono/campo-telefono.jsx';
import { avisarAdmin } from './avisos.js';
import api from '../../../api/cliente.js';
import { comprimirImagen } from '../../../lib/imagen.js';

const dinero = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(Number(valor) || 0)
    .replace(/\u00a0/g, '');

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
    horario[d] = {
      disponible: d <= 5,
      hora_inicio: '08:00',
      hora_fin: '17:00',
      descanso: false,
      descansos: [],
    };
  }
  return horario;
}

function crearHorarioVacio() {
  const horario = {};
  for (let d = 1; d <= 7; d++) {
    horario[d] = {
      disponible: false,
      hora_inicio: '08:00',
      hora_fin: '17:00',
      descanso: false,
      descansos: [],
    };
  }
  return horario;
}

const FORM_INICIAL = {
  rol: 'empleado',
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  telefono: '',
  identificacion: '',
  comision_porcentaje: 50,
  foto_url: '',
  sedes_asignadas: [],
  horarios: {},
  servicios_asignados: {},
};

export default function EmpleadosSeccion() {
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
  const [busquedaServicios, setBusquedaServicios] = useState('');
  const [categoriaServicio, setCategoriaServicio] = useState('');
  const [error, setError] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const inputFotoRef = useRef(null);
  const esAdmin = form.rol === 'admin';

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
      avisarAdmin(errorCarga.message, 'error');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const categoriasServicios = useMemo(() => {
    const mapa = new Map();
    servicios.forEach((servicio) => {
      if (servicio.categoria_id && !mapa.has(servicio.categoria_id)) {
        mapa.set(servicio.categoria_id, servicio.categoria_nombre || 'Sin categoría');
      }
    });
    return [...mapa.entries()].map(([id, nombre]) => ({ value: String(id), label: nombre }));
  }, [servicios]);

  const serviciosFiltrados = useMemo(() => {
    const termino = busquedaServicios.trim().toLowerCase();
    return servicios.filter((servicio) => {
      const coincideTexto =
        !termino ||
        `${servicio.nombre} ${servicio.categoria_nombre || ''}`.toLowerCase().includes(termino);
      const coincideCategoria =
        !categoriaServicio || String(servicio.categoria_id) === String(categoriaServicio);
      return coincideTexto && coincideCategoria;
    });
  }, [servicios, busquedaServicios, categoriaServicio]);

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
        avisarAdmin(`El empleado ya tiene horario en ${nombreSede} el ${nombreDia}`, 'error');
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

  const subirFoto = async (event) => {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      const foto = await comprimirImagen(archivo, { maxLado: 512, maxBytes: 180 * 1024 });
      setForm((previo) => ({ ...previo, foto_url: foto }));
    } catch (errorFoto) {
      avisarAdmin(errorFoto.message, 'error');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const guardar = async () => {
    if (!form.nombre || !form.apellido || !form.email) {
      setError('Nombre, apellido y email son obligatorios');
      return;
    }
    if (!editId && !form.password) {
      setError(`La contrasena es obligatoria para crear el ${esAdmin ? 'administrador' : 'empleado'}`);
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
              descanso: Boolean(config.descanso),
              descansos: Array.isArray(config.descansos) ? config.descansos : [],
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
        const creado = await api.auth.empleados.create(
          esAdmin
            ? {
              rol: 'admin',
              nombre: form.nombre,
              apellido: form.apellido,
              email: form.email,
              password: form.password,
              telefono: form.telefono,
            }
            : resto
        );
        empleadoId = creado?.id;
      }
      if (empleadoId && !esAdmin) {
        await api.disponibilidad.updateByAdmin(empleadoId, disponibilidadItems);
        await api.reservas.empleadoTiempos.update({ empleado_id: empleadoId, items: serviciosItems });
      }
      avisarAdmin(
        editId
          ? `${esAdmin ? 'Administrador' : 'Empleado'} actualizado`
          : `${esAdmin ? 'Administrador' : 'Empleado'} creado`
      );
      resetForm();
      await cargar();
    } catch (errorGuardar) {
      avisarAdmin(errorGuardar.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (empleado) => {
    const rol = empleado.rol === 'admin' ? 'administrador' : 'empleado';
    if (!window.confirm(`¿Eliminar a ${empleado.nombre} ${empleado.apellido} (${rol})?`)) return;
    try {
      await api.auth.empleados.delete(empleado.id);
      avisarAdmin(`${rol[0].toUpperCase()}${rol.slice(1)} eliminado`);
      await cargar();
    } catch (errorEliminar) {
      avisarAdmin(errorEliminar.message, 'error');
    }
  };

  const editar = async (empleado) => {
    setEditId(empleado.id);
    setMostrarForm(true);
    setError('');
    setForm({
      rol: empleado.rol || 'empleado',
      nombre: empleado.nombre || '',
      apellido: empleado.apellido || '',
      email: empleado.email || '',
      password: '',
      telefono: empleado.telefono || '',
      identificacion: empleado.identificacion || '',
      comision_porcentaje: empleado.comision_porcentaje ?? 50,
      foto_url: empleado.foto_url || '',
      sedes_asignadas: [],
      horarios: {},
      servicios_asignados: {},
    });
    if (empleado.rol === 'admin') {
      setSedeActiva(null);
      return;
    }
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
          descanso: Boolean(item.descanso),
          descansos: Array.isArray(item.descansos) ? item.descansos : [],
        };
      });
      const serviciosMap = {};
      (tiempos || []).forEach((t) => {
        serviciosMap[t.servicio_id] = { checked: true, duracion: t.duracion_minutos || 30 };
      });
      setForm((prev) => ({ ...prev, sedes_asignadas: sedes, horarios: horariosMap, servicios_asignados: serviciosMap }));
      setSedeActiva(sedes[0] || null);
    } catch {
      avisarAdmin('Error al cargar los datos del empleado', 'error');
    }
  };

  const filtrados = empleados.filter((emp) =>
    `${emp.nombre} ${emp.apellido} ${emp.email} ${emp.rol}`.toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Equipo"
        subtitle="Gestiona empleados y administradores, sus sedes, horarios y servicios."
      />
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-texto-secundario" aria-hidden="true" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, correo o rol..."
              aria-label="Buscar usuario"
              className="pl-9 pr-3 py-2.5 border border-borde rounded-lg text-sm bg-superficie focus:outline-none focus:ring-2 focus:ring-primario/30 w-full sm:w-80"
            />
          </div>
          <Button variant="primario" onClick={() => { resetForm(); setMostrarForm(true); }}>
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> Nuevo usuario
          </Button>
        </div>

        {mostrarForm && (
          <Card>
            <h3 className="font-display text-lg font-bold text-texto-principal mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primario" aria-hidden="true" />
              {editId ? `Editar ${esAdmin ? 'administrador' : 'empleado'}` : 'Nuevo usuario'}
            </h3>
            <div className="mb-4 max-w-xs">
              <Select
                label="Tipo de cuenta"
                value={form.rol}
                onChange={(e) => setForm((previo) => ({ ...previo, rol: e.target.value }))}
                options={[
                  { value: 'empleado', label: 'Empleado' },
                  { value: 'admin', label: 'Administrador' },
                ]}
                disabled={Boolean(editId)}
                hint={editId ? 'El rol no se puede cambiar después de crear la cuenta.' : undefined}
              />
            </div>
            {!esAdmin && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-borde bg-panel/40 p-3">
              <Avatar nombre={form.nombre} apellido={form.apellido} fotoUrl={form.foto_url} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-texto-principal">Foto del empleado</p>
                <p className="mt-0.5 text-[11px] leading-5 text-texto-secundario">
                  Opcional. Si no tiene foto, el cliente verá sus iniciales. También puede cambiarla desde su perfil.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => inputFotoRef.current?.click()} disabled={subiendoFoto}>
                    {subiendoFoto ? <Spinner /> : <><Upload className="h-3.5 w-3.5" aria-hidden="true" /> {form.foto_url ? 'Cambiar foto' : 'Subir foto'}</>}
                  </Button>
                  {form.foto_url && (
                    <Button type="button" variant="dangerSuave" size="sm" onClick={() => setForm((previo) => ({ ...previo, foto_url: '' }))}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Quitar foto
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={subirFoto}
                aria-label="Foto del empleado"
              />
            </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Input label="Nombre" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
              <Input label="Apellido" value={form.apellido} onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              <Input label={editId ? 'Nuevo password (opcional)' : 'Password'} type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder={editId ? 'Dejar vacio para no cambiar' : ''} />
              <CampoTelefono label="Teléfono" value={form.telefono} onChange={(telefono) => setForm((p) => ({ ...p, telefono }))} />
              {!esAdmin && (
                <>
                  <Input label="Identificación" value={form.identificacion} onChange={(e) => setForm((p) => ({ ...p, identificacion: e.target.value }))} />
                  <Input
                    label="Comisión del empleado (%)"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.comision_porcentaje}
                    onChange={(e) => setForm((p) => ({ ...p, comision_porcentaje: e.target.value }))}
                    hint="El salón recibe el porcentaje restante."
                  />
                </>
              )}
            </div>

            {!esAdmin && (
            <>
            <div className="mt-5 space-y-2">
              <span className="block text-[11px] font-medium text-texto-secundario">Sedes de trabajo (una por dia)</span>
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
                          sedeActiva === sid ? 'bg-primario text-primario-texto' : 'bg-fondo border border-borde text-texto-principal hover:bg-superficie'
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
              <span className="block text-[11px] font-medium text-texto-secundario">Servicios y duraciones</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px]">
                <Input
                  placeholder="Buscar servicio..."
                  value={busquedaServicios}
                  onChange={(evento) => setBusquedaServicios(evento.target.value)}
                  aria-label="Buscar servicio"
                />
                <Select
                  options={[{ value: '', label: 'Todas las categorías' }, ...categoriasServicios]}
                  value={categoriaServicio}
                  onChange={(evento) => setCategoriaServicio(evento.target.value)}
                  aria-label="Filtrar servicios por categoría"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1 scroll-thin">
                {serviciosFiltrados.map((servicio) => {
                  const config = form.servicios_asignados?.[servicio.id] || { checked: false, duracion: servicio.duracion_base_minutos || 30 };
                  return (
                    <div key={servicio.id} className="flex items-center justify-between gap-2 p-2 bg-fondo/40 rounded-xl border border-borde/40 text-xs">
                      <label className="flex min-w-0 items-center gap-2 font-semibold text-texto-principal cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={config.checked}
                          onChange={(e) => setForm((p) => ({ ...p, servicios_asignados: { ...p.servicios_asignados, [servicio.id]: { ...config, checked: e.target.checked } } }))}
                          className="rounded border-borde text-primario w-4 h-4 cursor-pointer"
                        />
                        {servicio.imagen_url ? (
                          <img src={servicio.imagen_url} alt="" className="h-8 w-8 shrink-0 rounded border border-borde object-cover" loading="lazy" />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-borde bg-panel text-tenue">
                            <ImageOff className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        )}
                        <span className="block min-w-0">
                          <span className="block truncate">{servicio.nombre}</span>
                          <span className="block truncate text-[10px] font-normal text-texto-secundario">
                            {servicio.categoria_nombre || 'Sin categoría'} · {dinero(servicio.precio_base)}
                          </span>
                        </span>
                      </label>
                      {config.checked && (
                        <span className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="5"
                            value={config.duracion}
                            aria-label={`Duración de ${servicio.nombre}`}
                            onChange={(e) => setForm((p) => ({ ...p, servicios_asignados: { ...p.servicios_asignados, [servicio.id]: { ...config, duracion: Number(e.target.value) } } }))}
                            className="w-16 px-1.5 py-0.5 border border-borde rounded bg-superficie text-xs text-center focus:outline-none"
                          />
                          <span className="text-texto-secundario text-[10px]">min</span>
                        </span>
                      )}
                    </div>
                  );
                })}
                {serviciosFiltrados.length === 0 && (
                  <p className="rounded-lg border border-dashed border-control bg-panel/40 p-4 text-center text-xs text-texto-secundario sm:col-span-2">
                    No hay servicios para los filtros seleccionados.
                  </p>
                )}
              </div>
            </div>
            </>
            )}

            {error && <p className="text-error text-sm mt-3 font-medium">{error}</p>}
            <div className="sticky bottom-0 z-20 mt-5 flex gap-2 border-t border-borde bg-superficie pt-3">
              <Button variant="primario" onClick={guardar} disabled={guardando}>
                {guardando ? <Spinner /> : editId ? `Actualizar ${esAdmin ? 'administrador' : 'empleado'}` : `Crear ${esAdmin ? 'administrador' : 'empleado'}`}
              </Button>
              <Button variant="secundario" onClick={resetForm}>Cancelar</Button>
            </div>
          </Card>
        )}

        {cargando ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-borde">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-fondo/60 sticky top-0">
                <tr className="text-left text-texto-secundario text-xs uppercase">
                  <th className="py-3 px-3">Nombre</th>
                  <th className="py-3 px-3">Rol</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Teléfono</th>
                  <th className="py-3 px-3">Identificación</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((emp) => (
                  <tr key={emp.id} className="border-t border-borde/50 hover:bg-fondo/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-texto-principal">
                      <span className="flex items-center gap-2">
                        <Avatar nombre={emp.nombre} apellido={emp.apellido} fotoUrl={emp.foto_url} size="sm" />
                        {emp.nombre} {emp.apellido}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs">
                      <Badge variant={emp.rol === 'admin' ? 'accent' : 'default'}>
                        {emp.rol === 'admin' ? 'Administrador' : 'Empleado'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-texto-secundario">{emp.email}</td>
                    <td className="py-2.5 px-3 text-xs">{emp.telefono}</td>
                    <td className="py-2.5 px-3 text-xs">{emp.identificacion}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => editar(emp)} aria-label={`Editar ${emp.nombre}`}>
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                        <Button variant="dangerSuave" size="sm" onClick={() => eliminar(emp)} aria-label={`Eliminar ${emp.nombre}`}>
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan="6" className="py-10 text-center text-texto-secundario">No hay usuarios registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
