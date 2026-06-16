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
  const [isMobile, setIsMobile] = useState(false);
  const [diaInicioMovil, setDiaInicioMovil] = useState(0);
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const cambiarGranularidad = (newG) => {
    if (horasDisponibles.length === 0) return;
    const newSlots = generarSlots(horaInicio, horaFin, newG);
    const ajustado = {};
    for (let d = 0; d < 7; d++) {
      ajustado[d] = {};
      newSlots.forEach((slot) => {
        const [sh, sm] = slot.split(':').map(Number);
        const slotMin = sh * 60 + sm;
        const oldSlotsKeys = Object.keys(slots[d] || {});
        let matchedOldSlot = null;
        oldSlotsKeys.forEach((os) => {
          const [oh, om] = os.split(':').map(Number);
          const osMin = oh * 60 + om;
          if (osMin <= slotMin && slotMin - osMin < (granularidad || 60)) {
            matchedOldSlot = os;
          }
        });
        if (matchedOldSlot && slots[d]?.[matchedOldSlot]) {
          ajustado[d][slot] = { ...slots[d][matchedOldSlot] };
        } else {
          ajustado[d][slot] = { tipo: 'no_disponible' };
        }
      });
    }
    setSlots(ajustado);
    setHorasDisponibles(newSlots);
    setGranularidad(newG);
  };

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
    const idx = ubicaciones.findIndex((u) => u.id === sedeId);
    const colores = [
      { bg: '#DCE8E0', border: '#A3C9A8', text: '#4A7C59' }, // Sede Centro
      { bg: '#DCE8F2', border: '#A3BDD4', text: '#5B7B9A' }, // Sede Norte
      { bg: '#F5E8DC', border: '#E5C7A3', text: '#C4883C' },
      { bg: '#EADCF5', border: '#CFA3E5', text: '#8A5B9A' },
      { bg: '#F5DCE6', border: '#E5A3BD', text: '#9A5B7B' },
    ];
    return colores[idx >= 0 ? idx % colores.length : 0];
  };

  const getSlotStyle = (dia, slot) => {
    const entry = slots[dia]?.[slot];
    if (!entry || entry.tipo === 'no_disponible') {
      return { background: '#F2D8D5', borderColor: '#E8B4AF', color: '#B84C3D' };
    }
    if (entry.tipo === 'descanso') {
      return { background: '#FAF7F2', borderColor: '#E5DDD3', color: '#8C7B70' };
    }
    if (entry.tipo === 'disponible') {
      return getSedeColor(entry.sedeId);
    }
    return { background: '#F2D8D5', borderColor: '#E8B4AF', color: '#B84C3D' };
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

  const diasVisibles = isMobile 
    ? [diaInicioMovil, Math.min(6, diaInicioMovil + 1)] 
    : [0, 1, 2, 3, 4, 5, 6];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8 border-b border-borde/60 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-texto-principal">Planificación de Turnos</h1>
          <p className="text-texto-secundario mt-1">Configura tus horarios semanales por sede y gestiona tus servicios asignados.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Select
            label="Intervalo"
            options={GRANULARIDADES}
            value={String(granularidad)}
            onChange={(e) => cambiarGranularidad(Number(e.target.value))}
            className="text-xs font-normal"
          />
          <div className="pt-5">
            <Button onClick={guardarCambios} disabled={guardando} variant="primario">
              {guardando ? <Spinner /> : 'Guardar Cambios'}
            </Button>
          </div>
        </div>
      </div>

      {/* Contenedor principal de dos columnas */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Lado izquierdo: Grilla de disponibilidad (lg:w-3/4) */}
        <div className="lg:w-3/4 space-y-6">
          {isMobile && (
            <div className="flex justify-between items-center bg-superficie border border-borde/60 p-3 rounded-xl shadow-sm">
              <button
                type="button"
                disabled={diaInicioMovil === 0}
                onClick={() => setDiaInicioMovil((prev) => Math.max(0, prev - 1))}
                className="px-3 py-1.5 rounded-lg border border-borde bg-fondo/35 text-xs font-semibold hover:bg-superficie disabled:opacity-50 cursor-pointer"
              >
                ← Anterior
              </button>
              <span className="text-xs font-bold text-texto-principal">
                Días: {DIAS[diaInicioMovil]} - {DIAS[Math.min(6, diaInicioMovil + 1)]}
              </span>
              <button
                type="button"
                disabled={diaInicioMovil >= 5}
                onClick={() => setDiaInicioMovil((prev) => Math.min(5, prev + 1))}
                className="px-3 py-1.5 rounded-lg border border-borde bg-fondo/35 text-xs font-semibold hover:bg-superficie disabled:opacity-50 cursor-pointer"
              >
                Siguiente →
              </button>
            </div>
          )}

          <Card padding={false} className="overflow-hidden border border-borde/70 shadow-premium">
            <div className="overflow-x-auto max-h-[70vh]">
              <table className={`w-full border-collapse text-xs ${isMobile ? '' : 'min-w-[750px]'}`}>
                <thead className="sticky top-0 z-20">
                  <tr className="border-b border-borde bg-fondo/50 backdrop-blur">
                    <th className="sticky left-0 bg-superficie z-30 border-b border-borde py-3 px-4 text-left font-bold text-texto-secundario uppercase tracking-wider w-24">Hora</th>
                    {diasVisibles.map((idx) => {
                      const dia = DIAS[idx];
                      return (
                        <th key={idx} className="border-b border-borde py-3 px-2 text-center font-bold text-texto-principal">
                          <div className="mb-2 uppercase text-[10px] tracking-wider text-texto-secundario font-bold">{dia}</div>
                          <Select
                            options={[
                              { value: '', label: '—' },
                              ...ubicaciones.map((u) => ({ value: u.id, label: u.nombre })),
                            ]}
                            value={sedesPorDia[idx] || ''}
                            onChange={(e) => handleSedeChange(idx, e.target.value)}
                            className="text-xs font-normal max-w-full"
                          />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {horasDisponibles.map((slot) => (
                    <tr key={slot} className="hover:bg-fondo/20 transition-colors">
                      <td className="sticky left-0 bg-superficie z-10 border-b border-borde/40 py-2 px-4 text-xs font-semibold text-texto-secundario whitespace-nowrap">{slot}</td>
                      {diasVisibles.map((idx) => {
                        const style = getSlotStyle(idx, slot);
                        const label = getSlotLabel(idx, slot);
                        return (
                          <td key={idx} className="border-b border-r border-borde/20 p-0.5">
                            <button
                              type="button"
                              onClick={() => toggleSlot(idx, slot)}
                              style={style}
                              className="w-full text-center py-2 text-xs font-semibold rounded-lg border transition hover:ring-2 hover:ring-primario/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm relative"
                            >
                              {label || '\u00A0'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Lado derecho: Servicios asignados y Leyendas (lg:w-1/4) */}
        <div className="lg:w-1/4 space-y-6">
          {/* Card de Servicios Asignados */}
          <Card padding={true} className="border border-borde/70 shadow-premium">
            <h3 className="font-display text-lg font-bold text-texto-principal mb-2">Mis Servicios Asignados</h3>
            <p className="text-xs text-texto-secundario mb-4">Gestiona los servicios del catálogo que tienes habilitados para realizar.</p>
            
            {/* Listado de servicios actuales */}
            <div className="flex flex-wrap gap-2 mb-6">
              {misServicios.length === 0 ? (
                <div className="w-full text-center py-4 bg-fondo/30 rounded-xl border border-dashed border-borde text-xs text-texto-secundario">
                  Sin servicios asignados.
                </div>
              ) : (
                misServicios.map((ms) => {
                  const serv = servicios.find((s) => s.id === ms.servicio_id);
                  return (
                    <span 
                      key={ms.servicio_id} 
                      className="inline-flex items-center gap-1.5 text-xs bg-primario/10 text-primario px-3 py-1.5 rounded-full font-medium"
                    >
                      {serv?.nombre || 'Servicio'}
                      <span className="text-[10px] text-texto-secundario">({ms.duracion_minutos}m)</span>
                      <button 
                        onClick={() => eliminarServicio(ms.servicio_id)} 
                        className="text-error hover:text-red-700 hover:scale-110 transition font-bold ml-1 text-sm focus:outline-none"
                        title="Desvincular servicio"
                      >
                        ×
                      </button>
                    </span>
                  );
                })
              )}
            </div>

            {/* Formulario para agregar servicio */}
            <div className="space-y-3 pt-4 border-t border-borde/50">
              <label className="block text-xs font-semibold text-texto-principal uppercase tracking-wider">Vincular Nuevo Servicio</label>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-texto-secundario mb-1">Servicio</label>
                  <Select
                    options={[
                      { value: '', label: 'Seleccionar...' },
                      ...servicios
                        .filter((s) => !misServicios.find((ms) => ms.servicio_id === s.id))
                        .map((s) => ({ value: String(s.id), label: s.nombre })),
                    ]}
                    value={servicioSeleccionado}
                    onChange={(e) => setServicioSeleccionado(e.target.value)}
                    className="w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-texto-secundario mb-1">Duración estimada</label>
                  <Select
                    options={[
                      { value: '10', label: '10 min' },
                      { value: '15', label: '15 min' },
                      { value: '20', label: '20 min' },
                      { value: '30', label: '30 min' },
                      { value: '45', label: '45 min' },
                      { value: '60', label: '60 min' },
                      { value: '90', label: '90 min' },
                    ]}
                    value={String(duracionServicio)}
                    onChange={(e) => setDuracionServicio(Number(e.target.value))}
                    className="w-full text-xs"
                  />
                </div>

                <Button 
                  variant="primario" 
                  size="sm" 
                  onClick={agregarServicio} 
                  disabled={!servicioSeleccionado}
                  className="w-full py-2 text-xs font-semibold"
                >
                  Vincular Servicio
                </Button>
              </div>
            </div>
          </Card>

          {/* Card de Leyenda de Sedes y Colores */}
          <Card padding={true} className="border border-borde/70 shadow-premium">
            <h3 className="font-semibold text-sm text-texto-principal mb-3">Leyenda de Disponibilidad</h3>
            <div className="space-y-2 text-xs">
              {ubicaciones.map((sede) => {
                const color = getSedeColor(sede.id);
                return (
                  <div key={sede.id} className="flex items-center gap-2.5 py-1">
                    <span 
                      className="w-4 h-4 rounded border shrink-0 transition-transform hover:scale-110 shadow-sm"
                      style={{ backgroundColor: color.bg, borderColor: color.border }}
                    />
                    <span className="font-medium text-texto-principal">{sede.nombre}</span>
                  </div>
                );
              })}
              
              <div className="flex items-center gap-2.5 py-1">
                <span className="w-4 h-4 rounded border bg-[#FAF7F2] border-[#E5DDD3] shrink-0 shadow-sm" />
                <span className="text-texto-secundario">Descanso (Fuera de Turno)</span>
              </div>
              
              <div className="flex items-center gap-2.5 py-1">
                <span className="w-4 h-4 rounded border bg-[#F2D8D5] border-[#E8B4AF] shrink-0 shadow-sm" />
                <span className="text-texto-secundario">Bloqueado (No Disponible)</span>
              </div>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
