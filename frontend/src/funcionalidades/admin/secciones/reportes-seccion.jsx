import { useCallback, useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Badge, Card, Input, Spinner } from '../../../componentes/ui/index.jsx';
import { SheetAdmin } from './navegacion.jsx';
import api from '../../../api/cliente.js';
import { hoy } from '../utils.js';

const TABS = [
  { clave: 'ventas', etiqueta: 'Ventas diarias' },
  { clave: 'ocupacion', etiqueta: 'Ocupacion' },
  { clave: 'recurrentes', etiqueta: 'Clientes recurrentes' },
];

export default function ReportesSeccion({ open, onClose, onToast }) {
  const [tab, setTab] = useState('ventas');
  const [fecha, setFecha] = useState(hoy());
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      let respuesta = null;
      if (tab === 'ventas') respuesta = await api.reportes.ventasDiarias(fecha);
      else if (tab === 'ocupacion') respuesta = await api.reportes.ocupacion(fecha);
      else respuesta = await api.reportes.clientesRecurrentes();
      setDatos(respuesta ?? []);
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [tab, fecha, onToast]);

  useEffect(() => {
    if (open) cargar();
  }, [open, cargar]);

  return (
    <SheetAdmin open={open} onClose={onClose} title="Reportes">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1 bg-fondo border border-borde rounded-xl p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.clave}
              type="button"
              onClick={() => { setTab(t.clave); setDatos(null); }}
              aria-pressed={tab === t.clave}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                tab === t.clave ? 'bg-superficie shadow-sm text-primario' : 'text-texto-secundario hover:text-texto-principal'
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>

        {tab !== 'recurrentes' && (
          <div className="max-w-xs">
            <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        )}

        {cargando ? (
          <div className="flex justify-center py-14"><Spinner /></div>
        ) : tab === 'ventas' && datos ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-display text-lg font-bold text-texto-principal flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primario" aria-hidden="true" /> Ventas del {datos.fecha || fecha}
              </h3>
              <Badge variant="success">Total: ${Number(datos.total ?? 0).toLocaleString('es-CO')}</Badge>
            </div>
            {datos.desglose?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="bg-fondo/60">
                    <tr className="text-left text-texto-secundario text-xs uppercase">
                      <th className="py-2.5 px-3">Servicio</th>
                      <th className="py-2.5 px-3">Cantidad</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.desglose.map((fila, indice) => (
                      <tr key={indice} className="border-t border-borde/50">
                        <td className="py-2.5 px-3">{fila.servicio || `Servicio #${fila.servicio_id}`}</td>
                        <td className="py-2.5 px-3">{fila.cantidad}</td>
                        <td className="py-2.5 px-3 text-right font-semibold">${Number(fila.total).toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-texto-secundario py-10 text-center">Sin datos de ventas para esta fecha</p>
            )}
          </Card>
        ) : tab === 'ocupacion' && datos ? (
          <Card>
            <h3 className="font-display text-lg font-bold text-texto-principal mb-4">Ocupacion del {fecha}</h3>
            {Array.isArray(datos) && datos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-fondo/60">
                    <tr className="text-left text-texto-secundario text-xs uppercase">
                      <th className="py-2.5 px-3">Sede</th>
                      <th className="py-2.5 px-3">Total</th>
                      <th className="py-2.5 px-3">Completadas</th>
                      <th className="py-2.5 px-3">Canceladas</th>
                      <th className="py-2.5 px-3">No show</th>
                      <th className="py-2.5 px-3 text-right">Ocupacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.map((fila, indice) => (
                      <tr key={indice} className="border-t border-borde/50">
                        <td className="py-2.5 px-3">{fila.sede}</td>
                        <td className="py-2.5 px-3">{fila.total}</td>
                        <td className="py-2.5 px-3">{fila.completadas ?? 0}</td>
                        <td className="py-2.5 px-3">{fila.canceladas ?? 0}</td>
                        <td className="py-2.5 px-3">{fila.no_show ?? 0}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-20 h-1.5 bg-fondo rounded-full overflow-hidden">
                              <span className="block h-full bg-primario" style={{ width: `${Math.min(100, Number(fila.porcentaje) || 0)}%` }} />
                            </span>
                            <span className="font-semibold">{Number(fila.porcentaje || 0).toFixed(1)}%</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-texto-secundario py-10 text-center">Sin datos de ocupacion para esta fecha</p>
            )}
          </Card>
        ) : tab === 'recurrentes' && datos ? (
          <Card>
            <h3 className="font-display text-lg font-bold text-texto-principal mb-4">Clientes recurrentes</h3>
            {Array.isArray(datos) && datos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead className="bg-fondo/60">
                    <tr className="text-left text-texto-secundario text-xs uppercase">
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3 text-right">Total reservas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.map((fila, indice) => (
                      <tr key={indice} className="border-t border-borde/50">
                        <td className="py-2.5 px-3">{fila.nombre} {fila.apellido}</td>
                        <td className="py-2.5 px-3 text-xs text-texto-secundario">{fila.email}</td>
                        <td className="py-2.5 px-3 text-right font-semibold">{fila.total_reservas ?? fila.total ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-texto-secundario py-10 text-center">No hay clientes recurrentes</p>
            )}
          </Card>
        ) : null}
      </div>
    </SheetAdmin>
  );
}
