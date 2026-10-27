import { useState, useEffect, useCallback } from 'react';
import api from '../../api/cliente';
import { Button, Card, Modal, PageHeader, Select, Spinner, Toast } from '../../componentes/ui/index.jsx';

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
              <p className="mt-0.5 text-xs text-texto-secundario">Cada día tiene una sede y un horario.</p>
            </div>
            <span className="text-[11px] text-tenue">{ubicaciones.length} sedes disponibles</span>
          </div>

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
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="text-sm font-semibold text-texto-principal">Servicios asignados</h2>
            <p className="mt-0.5 text-xs leading-5 text-texto-secundario">
              Servicios del catálogo que puedes realizar y su duración.
            </p>

            <div className="mt-3 space-y-1.5">
              {misServicios.length === 0 ? (
                <p className="rounded-md border border-dashed border-control bg-panel/50 px-3 py-4 text-xs text-texto-secundario">
                  Sin servicios asignados.
                </p>
              ) : (
                misServicios.map((ms) => {
                  const serv = servicios.find((s) => s.id === ms.servicio_id);
                  return (
                    <div key={ms.servicio_id} className="flex items-center justify-between gap-2 rounded-md border border-borde px-2.5 py-2">
                      <span className="min-w-0 truncate text-xs text-texto-principal">{serv?.nombre || 'Servicio'}</span>
                      <span className="flex shrink-0 items-center gap-2 text-[11px] text-tenue">
                        {ms.duracion_minutos} min
                        <button
                          type="button"
                          onClick={() => eliminarServicio(ms.servicio_id)}
                          className="flex h-5 w-5 items-center justify-center rounded text-error transition-colors hover:bg-error/10"
                          aria-label={`Desvincular ${serv?.nombre || 'servicio'}`}
                          title="Desvincular servicio"
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 space-y-3 border-t border-borde pt-4">
              <p className="text-[11px] font-medium text-texto-principal">Vincular servicio</p>
              <Select
                options={[
                  { value: '', label: 'Seleccionar…' },
                  ...servicios
                    .filter((s) => !misServicios.find((ms) => ms.servicio_id === s.id))
                    .map((s) => ({ value: String(s.id), label: s.nombre })),
                ]}
                value={servicioSeleccionado}
                onChange={(e) => setServicioSeleccionado(e.target.value)}
                className="text-xs"
              />
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
                className="text-xs"
              />
              <Button size="sm" className="w-full" onClick={agregarServicio} disabled={!servicioSeleccionado}>
                Vincular servicio
              </Button>
            </div>
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
