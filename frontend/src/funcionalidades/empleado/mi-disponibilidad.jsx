import { useState, useEffect, useCallback } from 'react';
import api from '../../api/cliente';
import { Button, Card, Select, Spinner, Toast } from '../../componentes/ui/index.jsx';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

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
  'bg-cyan-100 border-cyan-300 text-cyan-800',
  'bg-indigo-100 border-indigo-300 text-indigo-800',
  'bg-teal-100 border-teal-300 text-teal-800',
];

const DESCANSO_CLASS = 'bg-gray-100 border-gray-300 text-gray-600 line-through';
const NO_DISPONIBLE_CLASS = 'bg-red-50 border-red-200 text-red-500';

function agregarGranularidad(hora, mins) {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function generarSlots(inicio, fin, granularidad) {
  const slots = [];
  const [hIni, mIni] = inicio.split(':').map(Number);
  const [hFin, mFin] = fin.split(':').map(Number);
  let actual = hIni * 60 + mIni;
  const finMinutos = hFin * 60 + mFin;
  while (actual < finMinutos) {
    const h = Math.floor(actual / 60);
    const m = actual % 60;
    const hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    slots.push(hora);
    actual += granularidad;
  }
  return slots;
}

export default function EmpleadoDisponibilidad() {
  const [cargando, setCargando] = useState(true);
  const [horasDisponibles, setHorasDisponibles] = useState([]);
  const [slots, setSlots] = useState({});
  const [sedesPorDia, setSedesPorDia] = useState({});
  const [ubicaciones, setUbicaciones] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });
  const [granularidad, setGranularidad] = useState(60);

  const mostrarToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: '', type: 'success' }), 3000);
  };

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [dispData, ubiData, prefData] = await Promise.all([
        api.disponibilidad.get(),
        api.ubicaciones.list().catch(() => []),
        api.preferencias.get().catch(() => null),
      ]);

      setUbicaciones(Array.isArray(ubiData) ? ubiData : []);

      const horaInicio = prefData?.hora_inicio || '06:00';
      const horaFin = prefData?.hora_fin || '22:00';
      const slotsArr = generarSlots(horaInicio, horaFin, 60);
      setHorasDisponibles(slotsArr);

      const slotsIniciales = {};
      const sedesIniciales = {};

      for (let d = 0; d < 7; d++) {
        slotsIniciales[d] = {};

        if (Array.isArray(dispData)) {
          const diaDisponibilidad = dispData.filter((item) => item.dia_semana === d + 1);
          diaDisponibilidad.forEach((bloque) => {
            const bloquesSlots = generarSlots(bloque.hora_inicio, bloque.hora_fin, 60);
            bloquesSlots.forEach((slot) => {
              slotsIniciales[d][slot] = {
                tipo: 'disponible',
                sedeId: bloque.ubicacion_id,
              };
            });
          });
        }

        if (!dispData || (Array.isArray(dispData) && dispData.length === 0)) {
          const bloquesSlots = generarSlots(horaInicio, horaFin, 60);
          bloquesSlots.forEach((slot) => {
            slotsIniciales[d][slot] = { tipo: 'no_disponible' };
          });
        }

        sedesIniciales[d] = dispData && Array.isArray(dispData) && dispData.length > 0
          ? dispData.find((bloque) => bloque.dia_semana === d + 1)?.ubicacion_id || ''
          : '';
      }

      setSlots(slotsIniciales);
      setSedesPorDia(sedesIniciales);
    } catch (err) {
      mostrarToast(err.message || 'Error al cargar', 'error');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    if (horasDisponibles.length === 0) return;
    const newSlots = generarSlots(horasDisponibles[0], horasDisponibles[horasDisponibles.length - 1], granularidad);
    if (granularidad === 60) return;
    const ajustado = {};
    for (let d = 0; d < 7; d++) {
      ajustado[d] = {};
      newSlots.forEach((slot) => {
        const closest = horasDisponibles.find((h) => h <= slot) || horasDisponibles[0];
        ajustado[d][slot] = (slots[d] && slots[d][closest])
          ? { ...slots[d][closest] }
          : { tipo: 'no_disponible' };
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
        next = { tipo: 'descanso' };
      } else if (actual.tipo === 'descanso') {
        next = { tipo: 'disponible', sedeId: sedesPorDia[dia] || '' };
      } else if (actual.tipo === 'disponible') {
        next = { tipo: 'no_disponible' };
      } else {
        next = { tipo: 'no_disponible' };
      }
      return { ...prev, [dia]: { ...prev[dia], [slot]: next } };
    });
  };

  const handleSedeChange = (dia, sedeId) => {
    setSedesPorDia((prev) => ({ ...prev, [dia]: sedeId }));
    if (sedeId) {
      setSlots((prev) => {
        const updated = { ...prev[dia] };
        Object.keys(updated).forEach((slot) => {
          if (updated[slot].tipo === 'dispobible' || updated[slot].tipo === 'descanso') {
            updated[slot] = { tipo: 'disponible', sedeId };
          }
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
        ([, v]) => v.tipo === 'disponible'
      );

      if (disponibles.length === 0) continue;

      const agrupados = [];
      disponibles.forEach(([hora]) => {
        if (agrupados.length === 0) {
          agrupados.push({ inicio: hora, fin: hora });
          return;
        }
        const ultimo = agrupados[agrupados.length - 1];
        const ultimoIdx = horasDisponibles.indexOf(ultimo.fin);
        const actualIdx = horasDisponibles.indexOf(hora);
        if (actualIdx === ultimoIdx + 1) {
          ultimo.fin = hora;
        } else {
          agrupados.push({ inicio: hora, fin: hora });
        }
      });

      agrupados.forEach((b) => {
        const finIdx = horasDisponibles.indexOf(b.fin);
        const finGranularidad = finIdx >= 0 && finIdx < horasDisponibles.length - 1
          ? horasDisponibles[finIdx + 1]
          : agregarGranularidad(b.fin, granularidad);
        bloques.push({
          dia_semana: d + 1,
          ubicacion_id: sedeId,
          hora_inicio: b.inicio,
          hora_fin: finGranularidad,
        });
      });
    }
    return bloques;
  };

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      const payload = buildDisponibilidadPayload();
      await api.disponibilidad.update(payload);
      mostrarToast('Disponibilidad guardada correctamente');
    } catch (err) {
      mostrarToast(err.message || 'Error al guardar', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const getSedeColor = (sedeId) => {
    if (!ubicaciones || ubicaciones.length === 0) return SEDE_COLORS[0];
    const idx = ubicaciones.findIndex((u) => u.id === sedeId);
    return SEDE_COLORS[idx >= 0 ? idx % SEDE_COLORS.length : 0];
  };

  const getSlotClass = (dia, slot) => {
    const entry = slots[dia]?.[slot];
    if (!entry || entry.tipo === 'no_disponible') return NO_DISPONIBLE_CLASS;
    if (entry.tipo === 'descanso') return DESCANSO_CLASS;
    if (entry.tipo === 'disponible') return getSedeColor(entry.sedeId);
    return NO_DISPONIBLE_CLASS;
  };

  const getSlotLabel = (dia, slot) => {
    const entry = slots[dia]?.[slot];
    if (!entry || entry.tipo === 'no_disponible') return '';
    if (entry.tipo === 'descanso') return 'Descanso';
    if (entry.tipo === 'disponible') {
      const sede = ubicaciones.find((u) => u.id === entry.sedeId);
      return sede?.nombre || 'Disponible';
    }
    return '';
  };

  if (cargando) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Toast open={toast.open} message={toast.message} type={toast.type} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-texto-principal">Mi Disponibilidad</h1>
          <p className="text-texto-secundario mt-1">Configurá tus horarios semanales por sede</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            label="Granularidad"
            options={GRANULARIDADES}
            value={granularidad}
            onChange={(e) => setGranularidad(Number(e.target.value))}
          />
          <Button onClick={guardarCambios} disabled={guardando}>
            {guardando ? <Spinner /> : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {ubicaciones.length > 0 && (
        <Card className="mb-6" padding>
          <h3 className="text-sm font-semibold text-texto-principal mb-3">Sedes</h3>
          <div className="flex flex-wrap gap-3">
            {ubicaciones.map((sede, i) => (
              <div key={sede.id} className={`text-xs font-medium px-3 py-1.5 rounded-full border ${SEDE_COLORS[i % SEDE_COLORS.length]}`}>
                {sede.nombre}
              </div>
            ))}
            <div className="text-xs font-medium px-3 py-1.5 rounded-full border bg-gray-100 border-gray-300 text-gray-600 line-through">
              Descanso
            </div>
            <div className="text-xs font-medium px-3 py-1.5 rounded-full border bg-red-50 border-red-200 text-red-500">
              No disponible
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
        {DIAS.map((dia, idx) => (
          <Card key={idx} padding className="min-w-0">
            <div className="mb-3">
              <h3 className="font-display font-semibold text-texto-principal">{dia}</h3>
              <Select
                options={[
                  { value: '', label: 'Sin sede asignada' },
                  ...ubicaciones.map((u) => ({ value: u.id, label: u.nombre })),
                ]}
                value={sedesPorDia[idx] || ''}
                onChange={(e) => handleSedeChange(idx, e.target.value)}
                className="mt-2 text-xs"
              />
            </div>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {horasDisponibles.map((slot) => {
                const clase = getSlotClass(idx, slot);
                const label = getSlotLabel(idx, slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => toggleSlot(idx, slot)}
                    className={`w-full text-center py-1.5 rounded-md text-xs font-medium border cursor-pointer transition ${clase}`}
                  >
                    {granularidad <= 15 ? slot : label || slot}
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
