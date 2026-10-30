import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { Button, Card, Input, Select, Spinner } from '../ui/index.jsx';
import api from '../../api/cliente.js';

const DIAS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

function fechaLocal(fecha) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

function sumarDias(fecha, dias) {
  return new Date(fecha.getTime() + dias * 86400000);
}

function etiquetaFecha(texto) {
  return new Date(`${String(texto).slice(0, 10)}T00:00:00`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function estadoTemporal(temporal) {
  const hoy = fechaLocal(new Date());
  const desde = String(temporal.desde).slice(0, 10);
  const hasta = String(temporal.hasta).slice(0, 10);
  if (desde <= hoy && hasta >= hoy) return 'activo';
  if (desde > hoy) return 'programado';
  return 'finalizado';
}

export default function CambiosTemporales({ empleados = [], empleadoId = null, sedes = [], onToast, onChanged }) {
  const [temporales, setTemporales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [retornos, setRetornos] = useState({});
  const [form, setForm] = useState({
    empleado_id: empleadoId ? String(empleadoId) : '',
    ubicacion_id: '',
    desde: fechaLocal(new Date()),
    hasta: fechaLocal(sumarDias(new Date(), 14)),
    dias_semana: [],
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api.disponibilidad.temporales(empleadoId || '');
      setTemporales(Array.isArray(data) ? data : []);
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [empleadoId, onToast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const sedesDisponibles = useMemo(
    () => sedes.map((sede) => ({ value: String(sede.id), label: sede.nombre })),
    [sedes]
  );

  const empleadosDisponibles = useMemo(
    () => empleados.map((empleado) => ({
      value: String(empleado.id),
      label: `${empleado.nombre} ${empleado.apellido || ''}`.trim(),
    })),
    [empleados]
  );

  const crear = async () => {
    const empleado = empleadoId || form.empleado_id;
    if (!empleado || !form.ubicacion_id || !form.desde || !form.hasta) {
      onToast?.('Completa empleado, sede y fechas', 'warning');
      return;
    }
    if (!form.dias_semana.length) {
      onToast?.('Selecciona al menos un día', 'warning');
      return;
    }
    setGuardando(true);
    try {
      await api.disponibilidad.crearTemporal({
        empleado_id: Number(empleado),
        ubicacion_id: Number(form.ubicacion_id),
        desde: form.desde,
        hasta: form.hasta,
        dias_semana: form.dias_semana,
      });
      onToast?.('Cambio temporal guardado');
      setForm((prev) => ({ ...prev, ubicacion_id: '', dias_semana: [] }));
      await cargar();
      onChanged?.();
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const finalizar = async (temporal) => {
    setGuardando(true);
    try {
      await api.disponibilidad.finalizarTemporal(temporal.id, {
        sede_retorno_id: retornos[temporal.id] ? Number(retornos[temporal.id]) : undefined,
      });
      onToast?.(retornos[temporal.id] ? 'Cambio finalizado y nueva sede base guardada' : 'Cambio finalizado; vuelve a su sede base');
      await cargar();
      onChanged?.();
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const alternarDia = (dia) => {
    setForm((prev) => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(dia)
        ? prev.dias_semana.filter((item) => item !== dia)
        : [...prev.dias_semana, dia].sort((a, b) => a - b),
    }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-texto-principal">
          <CalendarClock className="h-4 w-4 text-acento" aria-hidden="true" /> Cambio temporal de sede
        </h2>
        <p className="mt-1 text-xs leading-5 text-texto-secundario">
          La sede temporal reemplaza la sede base en los días seleccionados. Al terminar, la persona vuelve automáticamente a su sede base si no eliges otra.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {!empleadoId && (
            <Select
              label="Empleado"
              value={form.empleado_id}
              onChange={(e) => setForm((prev) => ({ ...prev, empleado_id: e.target.value }))}
              options={[{ value: '', label: 'Selecciona...' }, ...empleadosDisponibles]}
            />
          )}
          <Select
            label="Sede temporal"
            value={form.ubicacion_id}
            onChange={(e) => setForm((prev) => ({ ...prev, ubicacion_id: e.target.value }))}
            options={[{ value: '', label: 'Selecciona...' }, ...sedesDisponibles]}
          />
          <Input
            label="Desde"
            type="date"
            value={form.desde}
            onChange={(e) => setForm((prev) => ({ ...prev, desde: e.target.value }))}
          />
          <Input
            label="Hasta"
            type="date"
            value={form.hasta}
            onChange={(e) => setForm((prev) => ({ ...prev, hasta: e.target.value }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-texto-secundario">Días:</span>
          {DIAS.map((dia) => (
            <button
              key={dia.value}
              type="button"
              onClick={() => alternarDia(dia.value)}
              aria-pressed={form.dias_semana.includes(dia.value)}
              className={`h-8 rounded-md border px-2.5 text-[11px] font-medium transition-colors ${
                form.dias_semana.includes(dia.value)
                  ? 'border-primario bg-primario text-primario-texto'
                  : 'border-borde bg-superficie text-texto-secundario'
              }`}
            >
              {dia.label}
            </button>
          ))}
          <Button size="sm" onClick={crear} disabled={guardando}>
            {guardando ? <Spinner /> : <><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Guardar cambio</>}
          </Button>
        </div>
      </Card>

      <Card padding={false}>
        <div className="border-b border-borde p-4">
          <h3 className="text-sm font-semibold text-texto-principal">Cambios registrados</h3>
          <p className="mt-0.5 text-[11px] text-texto-secundario">
            Finaliza un cambio antes de tiempo o elige la sede a la que debe volver.
          </p>
        </div>
        {cargando ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : temporales.length === 0 ? (
          <p className="p-6 text-center text-sm text-texto-secundario">No hay cambios temporales registrados.</p>
        ) : (
          <div className="divide-y divide-regla">
            {temporales.map((temporal) => {
              const estado = estadoTemporal(temporal);
              return (
                <div key={temporal.id} className="flex flex-wrap items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-texto-principal">{temporal.ubicacion_nombre}</p>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                        estado === 'activo'
                          ? 'border-exito/30 bg-exito/10 text-exito'
                          : estado === 'programado'
                            ? 'border-acento/30 bg-acento/10 text-acento'
                            : 'border-borde bg-panel text-texto-secundario'
                      }`}>
                        {estado === 'activo' ? 'Activo' : estado === 'programado' ? 'Programado' : 'Finalizado'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-texto-secundario">
                      {etiquetaFecha(temporal.desde)} – {etiquetaFecha(temporal.hasta)}
                      {temporal.empleado_nombre ? ` · ${temporal.empleado_nombre} ${temporal.empleado_apellido || ''}` : ''}
                    </p>
                    <p className="mt-0.5 text-[10px] text-tenue">
                      {(temporal.dias_semana || []).map((dia) => DIAS.find((item) => item.value === Number(dia))?.label).join(', ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={retornos[temporal.id] || ''}
                      onChange={(e) => setRetornos((prev) => ({ ...prev, [temporal.id]: e.target.value }))}
                      options={[
                        { value: '', label: 'Volver a la sede base' },
                        ...sedesDisponibles.map((sede) => ({ value: sede.value, label: `Volver a ${sede.label}` })),
                      ]}
                      wrapperClassName="w-52"
                      className="text-xs"
                    />
                    <Button variant="outline" size="sm" onClick={() => finalizar(temporal)} disabled={guardando}>
                      Finalizar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
