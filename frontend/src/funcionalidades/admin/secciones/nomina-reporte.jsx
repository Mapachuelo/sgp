import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Receipt } from 'lucide-react';
import { Badge, Button, Card, Input, Select, Spinner } from '../../../componentes/ui/index.jsx';
import { avisarAdmin } from './avisos.js';
import api from '../../../api/cliente.js';

const dinero = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })
    .format(Number(valor) || 0)
    .replace(/\u00a0/g, '');

function hoyBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function fechasPeriodo(modo, fechaBase = hoyBogota()) {
  const [anio, mes] = fechaBase.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const prefijo = `${anio}-${String(mes).padStart(2, '0')}`;
  if (modo === 'quincena1') return { desde: `${prefijo}-01`, hasta: `${prefijo}-15` };
  if (modo === 'quincena2') return { desde: `${prefijo}-16`, hasta: `${prefijo}-${String(ultimoDia).padStart(2, '0')}` };
  return { desde: `${prefijo}-01`, hasta: `${prefijo}-${String(ultimoDia).padStart(2, '0')}` };
}

export default function NominaReporte() {
  const [empleados, setEmpleados] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [empleadoId, setEmpleadoId] = useState('');
  const [sedeId, setSedeId] = useState('');
  const [modoPeriodo, setModoPeriodo] = useState('mes');
  const [fechas, setFechas] = useState(() => fechasPeriodo('mes'));
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    Promise.all([
      api.auth.empleados.list().catch(() => []),
      api.ubicaciones.list().catch(() => []),
    ]).then(([listaEmpleados, listaSedes]) => {
      setEmpleados(Array.isArray(listaEmpleados) ? listaEmpleados : []);
      setSedes(Array.isArray(listaSedes) ? listaSedes : []);
    });
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api.reportes.nomina({
        empleado_id: empleadoId,
        ubicacion_id: sedeId,
        desde: fechas.desde,
        hasta: fechas.hasta,
      });
      setDatos(data);
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [empleadoId, sedeId, fechas]);

  const cambiarModo = (valor) => {
    setModoPeriodo(valor);
    if (valor !== 'personalizado') setFechas(fechasPeriodo(valor));
  };

  const descargar = async () => {
    setDescargando(true);
    try {
      const blob = await api.reportes.nominaPdf({
        empleado_id: empleadoId,
        ubicacion_id: sedeId,
        desde: fechas.desde,
        hasta: fechas.hasta,
      });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `nomina-${empleadoId || 'todos'}-${fechas.desde}-${fechas.hasta}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      avisarAdmin(error.message, 'error');
    } finally {
      setDescargando(false);
    }
  };

  const opcionesEmpleados = useMemo(
    () => empleados.map((empleado) => ({
      value: String(empleado.id),
      label: `${empleado.nombre} ${empleado.apellido || ''}`.trim(),
    })),
    [empleados]
  );
  const opcionesSedes = useMemo(
    () => sedes.map((sede) => ({ value: String(sede.id), label: sede.nombre })),
    [sedes]
  );

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-texto-principal">
              <Receipt className="h-4 w-4 text-acento" aria-hidden="true" /> Nómina
            </h2>
            <p className="mt-1 text-xs leading-5 text-texto-secundario">
              Solo servicios completados y pagados. El porcentaje del empleado se configura en Equipo; el salón recibe el resto.
            </p>
          </div>
          <Button onClick={descargar} disabled={!datos || descargando}>
            {descargando ? <Spinner /> : <><Download className="h-4 w-4" aria-hidden="true" /> Descargar PDF</>}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Select
            label="Empleado"
            value={empleadoId}
            onChange={(e) => setEmpleadoId(e.target.value)}
            options={[{ value: '', label: 'Todos los empleados' }, ...opcionesEmpleados]}
          />
          <Select
            label="Sede"
            value={sedeId}
            onChange={(e) => setSedeId(e.target.value)}
            options={[{ value: '', label: 'Todas las sedes' }, ...opcionesSedes]}
          />
          <Select
            label="Período"
            value={modoPeriodo}
            onChange={(e) => cambiarModo(e.target.value)}
            options={[
              { value: 'mes', label: 'Mes actual' },
              { value: 'quincena1', label: 'Quincena 1 (1–15)' },
              { value: 'quincena2', label: 'Quincena 2 (16–fin)' },
              { value: 'personalizado', label: 'Rango personalizado' },
            ]}
          />
          <Input
            label="Desde"
            type="date"
            value={fechas.desde}
            onChange={(e) => {
              setModoPeriodo('personalizado');
              setFechas((prev) => ({ ...prev, desde: e.target.value }));
            }}
          />
          <Input
            label="Hasta"
            type="date"
            value={fechas.hasta}
            onChange={(e) => {
              setModoPeriodo('personalizado');
              setFechas((prev) => ({ ...prev, hasta: e.target.value }));
            }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={cargar} disabled={cargando}>{cargando ? <Spinner /> : 'Calcular nómina'}</Button>
          <span className="text-[11px] text-texto-secundario">
            {fechas.desde} → {fechas.hasta}
          </span>
        </div>
      </Card>

      {cargando && !datos ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !datos ? (
        <Card className="py-12 text-center text-sm text-texto-secundario">
          Selecciona el período y calcula la nómina.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card><p className="text-[11px] text-texto-secundario">Total bruto</p><p className="num mt-1 text-2xl font-semibold text-texto-principal">{dinero(datos.totales.bruto)}</p></Card>
            <Card><p className="text-[11px] text-texto-secundario">Empleado(s)</p><p className="num mt-1 text-2xl font-semibold text-texto-principal">{dinero(datos.totales.empleado_parte)}</p></Card>
            <Card><p className="text-[11px] text-texto-secundario">Salón</p><p className="num mt-1 text-2xl font-semibold text-texto-principal">{dinero(datos.totales.salon_parte)}</p></Card>
          </div>

          <Card padding={false}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde p-4">
              <div>
                <h3 className="text-sm font-semibold text-texto-principal">Resumen por empleado</h3>
                <p className="mt-0.5 text-[11px] text-texto-secundario">{datos.empleado ? 'Detalle individual' : 'Consolidado de todos los empleados'}</p>
              </div>
              <Badge variant="default">{datos.resumen.length} empleado(s)</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-xs">
                <thead className="bg-fondo/60 text-texto-secundario">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Empleado</th>
                    <th className="px-4 py-2.5 text-right">% empleado</th>
                    <th className="px-4 py-2.5 text-right">Bruto</th>
                    <th className="px-4 py-2.5 text-right">Empleado</th>
                    <th className="px-4 py-2.5 text-right">Salón</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.resumen.length === 0 ? (
                    <tr><td colSpan="5" className="px-4 py-8 text-center text-texto-secundario">No hay servicios completados y pagados en el período.</td></tr>
                  ) : datos.resumen.map((fila) => (
                    <tr key={fila.empleado_id} className="border-t border-borde/60">
                      <td className="px-4 py-2.5 font-medium text-texto-principal">{fila.empleado_nombre}</td>
                      <td className="num px-4 py-2.5 text-right">{Number(fila.porcentaje).toFixed(2)}%</td>
                      <td className="num px-4 py-2.5 text-right">{dinero(fila.bruto)}</td>
                      <td className="num px-4 py-2.5 text-right font-semibold">{dinero(fila.empleado_parte)}</td>
                      <td className="num px-4 py-2.5 text-right">{dinero(fila.salon_parte)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {datos.empleado && datos.detalle.length > 0 && (
            <Card padding={false}>
              <div className="border-b border-borde p-4">
                <h3 className="text-sm font-semibold text-texto-principal">Detalle de servicios</h3>
                <p className="mt-0.5 text-[11px] text-texto-secundario">Solo aparecen citas cobradas y no reembolsadas.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="bg-fondo/60 text-texto-secundario">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Fecha</th>
                      <th className="px-4 py-2.5 text-left">Cliente</th>
                      <th className="px-4 py-2.5 text-left">Servicio</th>
                      <th className="px-4 py-2.5 text-left">Sede</th>
                      <th className="px-4 py-2.5 text-right">Bruto</th>
                      <th className="px-4 py-2.5 text-right">Empleado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.detalle.map((fila, indice) => (
                      <tr key={`${fila.reserva_id}-${indice}`} className="border-t border-borde/60">
                        <td className="px-4 py-2.5 text-texto-secundario">{String(fila.fecha).slice(0, 10)}</td>
                        <td className="px-4 py-2.5 text-texto-principal">{fila.cliente}</td>
                        <td className="px-4 py-2.5 text-texto-principal">{fila.servicio}</td>
                        <td className="px-4 py-2.5 text-texto-secundario">{fila.sede}</td>
                        <td className="num px-4 py-2.5 text-right">{dinero(fila.bruto)}</td>
                        <td className="num px-4 py-2.5 text-right font-semibold">{dinero(fila.empleado_parte)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
