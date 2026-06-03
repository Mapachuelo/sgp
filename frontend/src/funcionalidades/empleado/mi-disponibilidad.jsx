import { useState, useEffect, useCallback } from 'react';
import api from '../../api/cliente';
import { Button, Card, Select, Spinner, Toast } from '../../componentes/ui/index.jsx';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const GRANULARIDADES = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '60 min' },
];

const SEDE_COLORS = [
  'bg-blue-100 border-blue-300 text-blue-800',
  'bg-green-100 border-green-300 text-green-800',
  'bg-purple-100 border-purple-300 text-purple-800',
  'bg-amber-100 border-amber-300 text-amber-800',
  'bg-pink-100 border-pink-300 text-pink-800',
];

const DESCANSO_CLASS = 'bg-gray-100 border-gray-300 text-gray-600';
const NO_DISPONIBLE_CLASS = 'bg-red-50 border-red-200 text-red-500';

function generarSlots(inicio, fin, granularidad) {
  const slots = [];
  const [hIni, mIni] = inicio.split(':').map(Number);
  const [hFin, mFin] = fin.split(':').map(Number);
  let actual = hIni * 60 + mIni;
  const finMinutos = hFin * 60 + mFin;
  while (actual < finMinutos) {
    const h = Math.floor(actual / 60);
    const m = actual % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    actual += granularidad;
  }
  return slots;
}

export default function EmpleadoDisponibilidad() {
  const [cargando, setCargando] = useState(true);
  const [horaInicio, setHoraInicio] = useState('06:00');
  const [horaFin, setHoraFin] = useState('22:00');
  const [horasDisponibles, setHorasDisponibles] = useState([]);
  const [slots, setSlots] = useState({});
  const [sedesPorDia, setSedesPorDia] = useState({});
  const [sedesMultiples, setSedesMultiples] = useState({});
  const [ubicaciones, setUbicaciones] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });
  const [granularidad, setGranularidad] = useState(60);

  const [servicios, setServicios] = useState([]);
  const [misServicios, setMisServicios] = useState([]);
  const [servicioSeleccionado, setServicioSeleccionado] = useState('');
  const [duracionServicio, setDuracionServicio] = useState(30);

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3000);
  };

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [dispData, ubiData, prefData, servData] = await Promise.all([
        api.disponibilidad.get(),
        api.ubicaciones.list().catch(() => []),
        api.preferencias.get().catch(() => null),
        api.reservas.servicios().catch(() => []),
      ]);

      setUbicaciones(Array.isArray(ubiData) ? ubiData : []);
      setServicios(Array.isArray(servData) ? servData : []);

      const inicio = prefData?.rango_hora_desde?.slice(0, 5) || '06:00';
      const fin = prefData?.rango_hora_hasta?.slice(0, 5) || '22:00';
      setHoraInicio(inicio);
      setHoraFin(fin);

      const g = 60;
      const slotsArr = generarSlots(inicio, fin, g);
      setHorasDisponibles(slotsArr);

      const slotsIniciales = {};
      const sedesIniciales = {};
      const sedesMultiIniciales = {};

      for (let d = 0; d < 7; d++) {
        slotsIniciales[d] = {};
        sedesMultiIniciales[d] = [];
        sedesIniciales[d] = '';

        if (Array.isArray(dispData) && dispData.length > 0) {
          const diaDisponibilidad = dispData.filter((item) => item.dia_semana === d + 1);

          if (diaDisponibilidad.length > 0) {
            sedesIniciales[d] = diaDisponibilidad[0].ubicacion_id;

            const sedeIds = [...new Set(diaDisponibilidad.map((bl) => bl.ubicacion_id))];
            sedesMultiIniciales[d] = sedeIds;

            diaDisponibilidad.forEach((bloque) => {
              const bloquesSlots = generarSlots(
                bloque.hora_inicio.slice(0, 5),
                bloque.hora_fin.slice(0, 5),
                g
              );
              bloquesSlots.forEach((slot) => {
                slotsIniciales[d][slot] = {
                  tipo: 'disponible',
                  sedeId: bloque.ubicacion_id,
                };
              });
            });
          } else {
            slotsArr.forEach((slot) => {
              slotsIniciales[d][slot] = { tipo: 'no_disponible' };
            });
          }
        } else {
          slotsArr.forEach((slot) => {
            slotsIniciales[d][slot] = { tipo: 'no_disponible' };
          });
        }
      }

      setSlots(slotsIniciales);
      setSedesPorDia(sedesIniciales);
      setSedesMultiples(sedesMultiIniciales);

      setMisServicios(dispData?.mis_servicios || []);
    } catch (err) {
      mostrarToast(err.message || 'Error al cargar', 'error');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  useEffect(() => {
    if (horasDisponibles.length === 0) return;

    const newSlots = generarSlots(horaInicio, horaFin, granularidad);

    const ajustado = {};
    for (let d = 0; d < 7; d++) {
      ajustado[d] = {};
      newSlots.forEach((slot) => {
        const oldSlot = Object.keys(slots[d] || {}).find((os) => os <= slot && (
          slot.split(':').map(Number)[0] * 60 + slot.split(':').map(Number)[1] -
          (os.split(':').map(Number)[0] * 60 + os.split(':').map(Number)[1]) < (granularidad || 60)
        ));
        if (oldSlot !== undefined) {
          const closestIdx = horasDisponibles.indexOf(oldSlot);
          const targetIdx = newSlots.indexOf(slot);
          if (closestIdx >= 0 && targetIdx >= 0 && Math.abs(targetIdx - closestIdx) <= 1) {
            ajustado[d][slot] = { ...(slots[d]?.[oldSlot] || { tipo: 'no_disponible' }) };
          } else {
            ajustado[d][slot] = { tipo: 'no_disponible' };
          }
        } else {
          ajustado[d][slot] = { tipo: 'no_disponible' };
        }
      });
    }
    setSlots(ajustado);
    setHorasDisponibles(newSlots);
  }, [granularidad]);

  const toggleSlot = (dia, slot) => {
    setSlots((prev) => {
      const actual = prev[dia]?.[slot] || { tipo: 'no_disponible' };
      let next;
      if (actual.tipo === 'no_disponible') {
        next = { tipo: 'disponible', sedeId: sedesPorDia[dia] || '' };
      } else if (actual.tipo === 'disponible') {
        next = { tipo: 'descanso' };
      } else {
        next = { tipo: 'no_disponible' };
      }
      return { ...prev, [dia]: { ...prev[dia], [slot]: next } };
    });
  };

  const setAllDay = (dia, tipo) => {
    setSlots((prev) => {
      const updated = { ...prev[dia] };
      Object.keys(updated).forEach((slot) => {
        if (tipo === 'descanso') {
          updated[slot] = { tipo: 'descanso' };
        } else if (tipo === 'disponible' && sedesPorDia[dia]) {
          updated[slot] = { tipo: 'disponible', sedeId: sedesPorDia[dia] };
        } else {
          updated[slot] = { tipo: 'no_disponible' };
        }
      });
      return { ...prev, [dia]: updated };
    });
  };

  const handleSedeChange = (dia, sedeId) => {
    setSedesPorDia((prev) => ({ ...prev, [dia]: sedeId }));
    if (sedeId) {
      setSlots((prev) => {
        const updated = { ...prev[dia] };
        Object.keys(updated).forEach((slot) => {
          updated[slot] = { tipo: 'disponible', sedeId };
        });
        return { ...prev, [dia]: updated };
      });
    }
  };

  const buildDisponibilidadPayload = () => {
    const bloques = [];
    for (let d = 0; d < 7; d++) {
      const sedeId = sedesPorDia[d];
      if (!sedeId) continue;

      const diaSlots = slots[d] || {};
      const disponibles = Object.entries(diaSlots).filter(
        ([, v]) => v.tipo === 'disponible' || v.tipo === 'descanso'
      );

      if (disponibles.length === 0) continue;

      disponibles.sort(([a], [b]) => a.localeCompare(b));

      const agrupados = [];
      disponibles.forEach(([hora, val]) => {
        if (agrupados.length === 0) {
          agrupados.push({
            inicio: hora,
            fin: hora,
            tipo: val.tipo,
          });
        } else {
          const ultimo = agrupados[agrupados.length - 1];
          const ultimoIdx = horasDisponibles.indexOf(ultimo.fin);
          const actualIdx = horasDisponibles.indexOf(hora);
          if (actualIdx === ultimoIdx + 1 && ultimo.tipo === val.tipo) {
            ultimo.fin = hora;
          } else {
            agrupados.push({ inicio: hora, fin: hora, tipo: val.tipo });
          }
        }
      });

      agrupados.forEach((b) => {
        if (b.tipo !== 'disponible') return;
        const finIdx = horasDisponibles.indexOf(b.fin);
        const proximoSlot =
          finIdx >= 0 && finIdx < horasDisponibles.length - 1
            ? horasDisponibles[finIdx + 1]
            : null;
        const finGranularidad = proximoSlot || (() => {
          const [h, m] = b.fin.split(':').map(Number);
          const total = h * 60 + m + granularidad;
          const nh = Math.floor(total / 60) % 24;
          const nm = total % 60;
          return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
        })();
        bloques.push({
          dia_semana: d + 1,
          ubicacion_id: sedeId,
          hora_inicio: b.inicio + ':00',
          hora_fin: (typeof finGranularidad === 'function' ? finGranularidad() : finGranularidad) + ':00',
        });
      });
    }
    return bloques;
  };

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      const payload = buildDisponibilidadPayload();
      if (payload.length === 0) {
        mostrarToast('Selecciona al menos una sede y horario', 'warning');
        setGuardando(false);
        return;
      }
      await api.disponibilidad.update(payload);
      mostrarToast('Disponibilidad guardada correctamente');
      cargarDatos();
    } catch (err) {
      mostrarToast(err.message || 'Error al guardar', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const agregarServicio = async () => {
    if (!servicioSeleccionado) return;
    try {
      const items = [
        ...misServicios.filter((s) => s.servicio_id !== parseInt(servicioSeleccionado)),
        { servicio_id: parseInt(servicioSeleccionado), duracion_minutos: duracionServicio },
      ];
      await api.reservas.empleadoServiciosUpdate(items);
      setMisServicios(items);
      setServicioSeleccionado('');
      mostrarToast('Servicio asignado');
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  };

  const eliminarServicio = async (servicioId) => {
    try {
      const items = misServicios.filter((s) => s.servicio_id !== servicioId);
      await api.reservas.empleadoServiciosUpdate(items);
      setMisServicios(items);
      mostrarToast('Servicio eliminado');
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  };

  const getSedeColor = (sedeId) => {
    if (!ubicaciones || ubicaciones.length === 0) return SEDE_COLORS[0];
    const idx = ubicaciones.findIndex((u) => u.id === sedeId);
    return SEDE_COLORS[idx >= 0 ? idx % SEDE_COLORS.length : 0];
  };

  const getSlotClass = (dia, slot) => {
    const entry = slots[dia]?.[slot];
    if (!entry) return NO_DISPONIBLE_CLASS;
    if (entry.tipo === 'descanso') return DESCANSO_CLASS;
    if (entry.tipo === 'disponible') return getSedeColor(entry.sedeId);
    return NO_DISPONIBLE_CLASS;
  };

  const getSlotLabel = (dia, slot) => {
    const entry = slots[dia]?.[slot];
    if (!entry || entry.tipo === 'no_disponible') return '';
    if (entry.tipo === 'descanso') return 'Ds';
    if (entry.tipo === 'disponible') {
      const sede = ubicaciones.find((u) => u.id === entry.sedeId);
      return sede?.nombre?.slice(0, 3) || 'D';
    }
    return '';
  };

  if (cargando) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-center py-20"><Spinner /></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold text-texto-principal">Mi Disponibilidad</h1>
          <p className="text-texto-secundario mt-1">Configura tus horarios semanales, sedes y servicios</p>
        </div>
        <div className="flex items-start gap-3 shrink-0">
          <Select
            label="Granularidad"
            options={GRANULARIDADES}
            value={granularidad}
            onChange={(e) => setGranularidad(Number(e.target.value))}
          />
          <div className="pt-6">
            <Button onClick={guardarCambios} disabled={guardando}>
              {guardando ? <Spinner /> : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </div>

      {ubicaciones.length > 0 && (
        <Card className="mb-6" padding>
          <h3 className="text-sm font-semibold text-texto-principal mb-3">Leyenda de sedes</h3>
          <div className="flex flex-wrap gap-3">
            {ubicaciones.map((sede, i) => (
              <div key={sede.id} className={`text-xs font-medium px-3 py-1.5 rounded-full border ${SEDE_COLORS[i % SEDE_COLORS.length]}`}>
                {sede.nombre}
              </div>
            ))}
            <div className="text-xs font-medium px-3 py-1.5 rounded-full border bg-gray-100 border-gray-300 text-gray-600 line-through">Descanso</div>
            <div className="text-xs font-medium px-3 py-1.5 rounded-full border bg-red-50 border-red-200 text-red-500">No disponible</div>
          </div>
        </Card>
      )}

      {/* Gestion de servicios por empleado */}
      <Card className="mb-6" padding>
        <h3 className="text-sm font-semibold text-texto-principal mb-3">Mis servicios</h3>
        <p className="text-xs text-texto-secundario mb-3">Selecciona los servicios que realizas y su duracion estimada</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {misServicios.map((ms) => {
            const serv = servicios.find((s) => s.id === ms.servicio_id);
            return (
              <span key={ms.servicio_id} className="inline-flex items-center gap-1 text-xs bg-primario/10 text-primario px-2 py-1 rounded-full">
                {serv?.nombre || 'Servicio'} ({ms.duracion_minutos}min)
                <button onClick={() => eliminarServicio(ms.servicio_id)} className="text-error hover:underline ml-1">x</button>
              </span>
            );
          })}
        </div>
        <div className="flex items-end gap-2">
          <Select
            options={[
              { value: '', label: 'Seleccionar servicio...' },
              ...servicios.filter((s) => !misServicios.find((ms) => ms.servicio_id === s.id)).map((s) => ({ value: s.id, label: s.nombre })),
            ]}
            value={servicioSeleccionado}
            onChange={(e) => setServicioSeleccionado(e.target.value)}
          />
          <Select
            options={[{ value: 10, label: '10 min' }, { value: 15, label: '15 min' }, { value: 20, label: '20 min' }, { value: 30, label: '30 min' }, { value: 45, label: '45 min' }, { value: 60, label: '60 min' }, { value: 90, label: '90 min' }]}
            value={duracionServicio}
            onChange={(e) => setDuracionServicio(Number(e.target.value))}
          />
          <Button variant="primario" size="sm" onClick={agregarServicio} disabled={!servicioSeleccionado}>
            Agregar
          </Button>
        </div>
      </Card>

      {/* Tabla de disponibilidad */}
      <Card className="overflow-x-auto" padding={false}>
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 top-0 bg-superficie z-30 border-b border-borde py-3 px-3 text-left text-xs font-semibold text-texto-secundario uppercase w-20">Hora</th>
                {DIAS.map((dia, idx) => (
                  <th key={idx} className="top-0 bg-superficie border-b border-borde py-2 px-2 text-center text-xs font-semibold align-top">
                    <div className="mb-2">{dia}</div>
                    <Select
                      options={[
                        { value: '', label: '—' },
                        ...ubicaciones.map((u) => ({ value: u.id, label: u.nombre })),
                      ]}
                      value={sedesPorDia[idx] || ''}
                      onChange={(e) => handleSedeChange(idx, e.target.value)}
                      className="text-xs font-normal"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horasDisponibles.map((slot) => (
                <tr key={slot}>
                  <td className="sticky left-0 bg-superficie z-10 border-b border-borde/50 py-1.5 px-3 text-xs font-medium text-texto-secundario whitespace-nowrap">{slot}</td>
                  {DIAS.map((_, idx) => {
                    const clase = getSlotClass(idx, slot);
                    const label = getSlotLabel(idx, slot);
                    return (
                      <td key={idx} className="border-b border-r border-borde/30 p-0">
                        <button
                          type="button"
                          onClick={() => toggleSlot(idx, slot)}
                          className={`w-full text-center py-2 text-xs font-medium border cursor-pointer transition hover:ring-2 hover:ring-primario/40 hover:z-10 relative ${clase}`}
                        >
                          {label || '\u00A0'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 bg-superficie z-10 border-t-2 border-borde py-2 px-3 text-xs font-semibold text-texto-secundario whitespace-nowrap">Acciones</td>
                {DIAS.map((_, idx) => (
                  <td key={idx} className="border-t-2 border-borde py-2 px-1 align-top">
                    <div className="flex flex-col gap-1">
                      <Button variant="secundario" size="sm" className="text-xs w-full" onClick={() => setAllDay(idx, 'disponible')}>Todo disponible</Button>
                      <Button variant="secundario" size="sm" className="text-xs w-full" onClick={() => setAllDay(idx, 'descanso')}>Todo descanso</Button>
                      <Button variant="danger" size="sm" className="text-xs w-full" onClick={() => setAllDay(idx, 'no_disponible')}>Todo no disp.</Button>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
