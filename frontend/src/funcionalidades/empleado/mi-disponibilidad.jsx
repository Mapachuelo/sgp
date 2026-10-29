import { useState, useEffect, useCallback } from 'react';
import { ImageOff } from 'lucide-react';
import api from '../../api/cliente';
import { BuscadorSelect, Button, Card, Modal, PageHeader, SegmentedControl, Select, Spinner, Toast } from '../../componentes/ui/index.jsx';

const dinero = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(Number(valor) || 0)
    .replace(/\u00a0/g, '');

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const GRANULARIDADES = [
  { value: '30', label: '30 min' },
  { value: '60', label: '60 min' },
];

const ESTILOS_SLOT = {
  disponible: 'border-[var(--slot-libre-border)] bg-[var(--slot-libre-bg)] text-[var(--slot-libre-ink)]',
  descanso: 'border-borde bg-panel text-texto-secundario',
  no_disponible: 'border-[var(--slot-ocupado-border)] bg-[var(--slot-ocupado-bg)] text-[var(--slot-ocupado-ink)]',
};

const ETIQUETAS_SLOT = {
  disponible: 'Disponible',
  descanso: 'Descanso',
  no_disponible: 'No disponible',
};

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
  const [diaEditor, setDiaEditor] = useState(null);
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
  const [vista, setVista] = useState(() => localStorage.getItem('sgp_disponibilidad_vista') || 'lista');
  const [guardandoDuracion, setGuardandoDuracion] = useState(null);

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
      const [dispData, ubiData, prefData, servData, misTiempos] = await Promise.all([
        api.disponibilidad.get(),
        api.ubicaciones.list().catch(() => []),
        api.preferencias.get().catch(() => null),
        api.reservas.servicios().catch(() => []),
        api.reservas.empleadoTiempos.get('').catch(() => []),
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

      setMisServicios(
        (Array.isArray(misTiempos) ? misTiempos : []).map((t) => ({
          servicio_id: t.servicio_id,
          duracion_minutos: t.duracion_minutos || t.tiempo_minutos || 30,
          nombre: t.servicio_nombre,
          precio_base: t.precio_base,
          imagen_url: t.imagen_url,
          categoria_nombre: t.categoria_nombre,
        }))
      );
    } catch (err) {
      mostrarToast(err.message || 'Error al cargar', 'error');
    } finally {
      setCargando(false);
    }
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
    const sedeAnterior = sedesPorDia[dia];
    if (sedeAnterior && String(sedeAnterior) !== String(sedeId)) {
      const nombreAnterior = ubicaciones.find((u) => u.id === sedeAnterior)?.nombre || 'la sede anterior';
      const continuar = window.confirm(
        `Cambiar el ${DIAS[dia]} a otra sede cancelara las reservas futuras de ese dia en ${nombreAnterior}. ¿Deseas continuar?`
      );
      if (!continuar) return;
    }
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
      const respuesta = await api.disponibilidad.update(payload);
      if (respuesta?.reservas_canceladas?.length > 0) {
        mostrarToast(
          `Disponibilidad guardada. ${respuesta.reservas_canceladas.length} reserva(s) cancelada(s) por cambio de sede.`,
          'warning'
        );
      } else {
        mostrarToast('Disponibilidad guardada correctamente');
      }
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

  const guardarDuracion = async (servicioId, valor) => {
    const duracion = Number(valor);
    if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) {
      mostrarToast('La duración debe estar entre 5 y 480 minutos', 'warning');
      return;
    }
    const anterior = misServicios;
    const actualizados = misServicios.map((s) =>
      s.servicio_id === servicioId ? { ...s, duracion_minutos: duracion } : s
    );
    setMisServicios(actualizados);
    setGuardandoDuracion(servicioId);
    try {
      await api.reservas.empleadoServiciosUpdate(
        actualizados.map((s) => ({ servicio_id: s.servicio_id, duracion_minutos: s.duracion_minutos }))
      );
      mostrarToast('Duración actualizada');
    } catch (err) {
      setMisServicios(anterior);
      mostrarToast(err.message, 'error');
    } finally {
      setGuardandoDuracion(null);
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

  const sumarMinutos = (hora, minutos) => {
    const [h, m] = hora.split(':').map(Number);
    const total = h * 60 + m + minutos;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const rangosDia = (dia, tipo) => {
    const rangos = [];
    let inicio = null;
    let ultimo = null;
    horasDisponibles.forEach((hora) => {
      const estado = slots[dia]?.[hora]?.tipo || 'no_disponible';
      if (estado === tipo) {
        if (!inicio) inicio = hora;
        ultimo = hora;
      } else if (inicio) {
        rangos.push([inicio, sumarMinutos(ultimo, granularidad)]);
        inicio = null;
        ultimo = null;
      }
    });
    if (inicio) rangos.push([inicio, sumarMinutos(ultimo, granularidad)]);
    return rangos;
  };

  const resumenDia = (dia) => {
    if (!sedesPorDia[dia]) return 'Sin sede asignada';
    const disponibles = rangosDia(dia, 'disponible');
    if (disponibles.length === 0) return 'Sin horario disponible';
    const partes = disponibles.map(([inicio, fin]) => `${inicio}–${fin}`);
    const descansos = rangosDia(dia, 'descanso').length;
    return `${partes.join(' · ')}${descansos > 0 ? ` · ${descansos} descanso${descansos > 1 ? 's' : ''}` : ''}`;
  };

  const estadoSlot = (dia, hora) => slots[dia]?.[hora]?.tipo || 'no_disponible';

  const datosServicio = (item) => {
    const base = servicios.find((servicio) => String(servicio.id) === String(item.servicio_id)) || {};
    return {
      nombre: item.nombre || base.nombre || 'Servicio',
      precio_base: item.precio_base ?? base.precio_base,
      imagen_url: item.imagen_url ?? base.imagen_url,
      categoria_nombre: item.categoria_nombre || base.categoria_nombre,
    };
  };

  const servicioElegido = servicios.find((servicio) => String(servicio.id) === String(servicioSeleccionado));

  if (cargando) {
    return (
      <div className="space-y-5">
        <PageHeader title="Mi disponibilidad" subtitle="Cargando tus horarios…" />
        <div className="flex justify-center py-20"><Spinner /></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      <PageHeader
        title="Mi disponibilidad"
        subtitle="Una sede por día. Ajusta el horario y los descansos; guarda al final."
        actions={
          <>
            <div className="w-28">
              <Select
                label="Intervalo"
                options={GRANULARIDADES}
                value={String(granularidad)}
                onChange={(e) => cambiarGranularidad(Number(e.target.value))}
                className="text-xs"
              />
            </div>
            <Button className="mt-5" onClick={guardarCambios} disabled={guardando}>
              {guardando ? <Spinner /> : 'Guardar cambios'}
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde p-4">
            <div>
              <h2 className="text-sm font-semibold text-texto-principal">Semana</h2>
              <p className="mt-0.5 text-xs text-texto-secundario">
                {vista === 'lista'
                  ? 'Cada día tiene una sede y un horario.'
                  : 'Vista general de la semana; edita cada día desde aquí.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] text-tenue">{ubicaciones.length} sedes disponibles</span>
              <SegmentedControl
                label="Vista de la semana"
                value={vista}
                onChange={(valor) => {
                  setVista(valor);
                  localStorage.setItem('sgp_disponibilidad_vista', valor);
                }}
                items={[
                  { value: 'lista', label: 'Lista' },
                  { value: 'semana', label: 'Semana' },
                ]}
              />
            </div>
          </div>

          {vista === 'lista' ? (
            <ul className="divide-y divide-regla">
              {DIAS.map((dia, idx) => (
                <li key={dia} className="flex flex-col gap-3 px-4 py-3 sm:grid sm:grid-cols-[52px_200px_minmax(0,1fr)_auto] sm:items-center">
                  <p className="text-xs font-medium text-texto-principal">{dia}</p>
                  <Select
                    options={[
                      { value: '', label: 'Sin sede' },
                      ...ubicaciones.map((u) => ({ value: u.id, label: u.nombre })),
                    ]}
                    value={sedesPorDia[idx] || ''}
                    onChange={(e) => handleSedeChange(idx, e.target.value)}
                    className="text-xs"
                  />
                  <p className="text-xs leading-5 text-texto-secundario">{resumenDia(idx)}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDiaEditor(idx)}
                    disabled={!sedesPorDia[idx]}
                    className="w-full sm:w-auto"
                  >
                    Editar horario
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[920px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-borde bg-panel/50">
                    <th scope="col" className="sticky left-0 z-10 w-28 bg-panel/95 px-3 py-2 text-[11px] font-medium text-texto-secundario">
                      Semana
                    </th>
                    {DIAS.map((dia, idx) => (
                      <th key={dia} scope="col" className="min-w-[120px] px-3 py-2 text-[11px] font-medium text-texto-secundario">
                        {dia} {idx + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-regla">
                    <th scope="row" className="sticky left-0 z-10 bg-superficie px-3 py-3 font-medium text-texto-principal">Sede</th>
                    {DIAS.map((_, idx) => {
                      const sede = ubicaciones.find((u) => String(u.id) === String(sedesPorDia[idx]));
                      return (
                        <td key={`sede-${idx}`} className="px-3 py-3 text-texto-secundario">
                          {sede?.nombre || <span className="text-tenue">Sin sede</span>}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-regla">
                    <th scope="row" className="sticky left-0 z-10 bg-superficie px-3 py-3 font-medium text-texto-principal">Horario</th>
                    {DIAS.map((_, idx) => (
                      <td key={`horario-${idx}`} className="px-3 py-3 leading-5 text-texto-secundario">
                        {resumenDia(idx)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="sticky left-0 z-10 bg-superficie px-3 py-3 font-medium text-texto-principal">Acción</th>
                    {DIAS.map((_, idx) => (
                      <td key={`accion-${idx}`} className="px-3 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDiaEditor(idx)}
                          disabled={!sedesPorDia[idx]}
                        >
                          Editar
                        </Button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="text-sm font-semibold text-texto-principal">Mis servicios</h2>
            <p className="mt-1 text-xs leading-5 text-texto-secundario">
              Tienes {misServicios.length} servicio(s) activo(s). El precio lo define la administración; tú ajustas la duración.
            </p>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => { window.location.href = '/empleado/servicios'; }}>
              Gestionar mis servicios
            </Button>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-texto-principal">Leyenda</h2>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center gap-2.5">
                <span className={`h-3.5 w-3.5 shrink-0 rounded-sm border ${ESTILOS_SLOT.disponible}`} />
                <span className="text-texto-secundario">Disponible</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className={`h-3.5 w-3.5 shrink-0 rounded-sm border ${ESTILOS_SLOT.descanso}`} />
                <span className="text-texto-secundario">Descanso</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className={`h-3.5 w-3.5 shrink-0 rounded-sm border ${ESTILOS_SLOT.no_disponible}`} />
                <span className="text-texto-secundario">No disponible</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={diaEditor !== null}
        onClose={() => setDiaEditor(null)}
        title={diaEditor !== null ? `${DIAS[diaEditor]} · ${ubicaciones.find((u) => u.id === sedesPorDia[diaEditor])?.nombre || 'Sin sede'}` : 'Horario'}
        size="wide"
      >
        {diaEditor !== null && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setAllDay(diaEditor, 'disponible')}>
                  Todo disponible
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAllDay(diaEditor, 'descanso')}>
                  Todo descanso
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAllDay(diaEditor, 'no_disponible')}>
                  Todo no disponible
                </Button>
              </div>
              <div className="w-32">
                <Select
                  label="Intervalo"
                  options={GRANULARIDADES}
                  value={String(granularidad)}
                  onChange={(e) => cambiarGranularidad(Number(e.target.value))}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {horasDisponibles.map((hora) => {
                const estado = estadoSlot(diaEditor, hora);
                return (
                  <button
                    key={hora}
                    type="button"
                    onClick={() => toggleSlot(diaEditor, hora)}
                    className={`rounded-md border px-1.5 py-2 text-left transition-colors ${ESTILOS_SLOT[estado]}`}
                    title={`${hora} · ${ETIQUETAS_SLOT[estado]}`}
                  >
                    <span className="mono block text-[11px] font-medium">{hora}</span>
                    <span className="mt-0.5 block truncate text-[9px] opacity-80">{ETIQUETAS_SLOT[estado]}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] leading-5 text-tenue">
              Toca un bloque para alternar entre disponible, descanso y no disponible. Los cambios se guardan con “Guardar cambios”.
            </p>

            <div className="flex justify-end border-t border-borde pt-4">
              <Button onClick={() => setDiaEditor(null)}>Listo</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
