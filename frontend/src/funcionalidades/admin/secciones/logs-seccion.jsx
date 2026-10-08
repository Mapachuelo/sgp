import { useCallback, useEffect, useState } from 'react';
import { Download, FileWarning, ScrollText, Search } from 'lucide-react';
import { Button, Card, Sheet, Spinner } from '../../../componentes/ui/index.jsx';
import api from '../../../api/cliente.js';
import { descargarTexto } from '../../../lib/descargas.js';
import { hoy } from '../utils.js';

const NIVELES = { 10: 'TRACE', 20: 'DEBUG', 30: 'INFO', 40: 'WARN', 50: 'ERROR', 60: 'FATAL' };

export default function LogsSeccion({ open, onClose, onToast }) {
  const [tab, setTab] = useState('actividad');
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [fecha, setFecha] = useState('');
  const [severidad, setSeveridad] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = {};
      if (filtro) params.filtro = filtro;
      if (fecha) params.fecha = fecha;
      if (severidad) params.severidad = severidad;
      const data = tab === 'actividad' ? await api.logs.actividad(params) : await api.logs.errores(params);
      setDatos(Array.isArray(data) ? data : []);
    } catch (error) {
      onToast?.(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [tab, filtro, fecha, severidad, onToast]);

  useEffect(() => {
    if (open) cargar();
  }, [open, cargar]);

  const exportar = async () => {
    try {
      const params = { tipo: tab };
      if (filtro) params.filtro = filtro;
      if (fecha) params.fecha = fecha;
      if (severidad) params.severidad = severidad;
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      const texto = await api.logs.exportarTexto(params);
      descargarTexto(`logs_${tab}_${hoy()}.txt`, texto);
      onToast?.('Archivo exportado');
    } catch (error) {
      onToast?.(error.message, 'error');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Logs del sistema" size="wide">
      <div className="space-y-4">
        <Card className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-texto-secundario" aria-hidden="true" />
            <input
              type="text"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar en los logs..."
              aria-label="Buscar en los logs"
              className="pl-9 pr-3 py-2 border border-borde rounded-lg text-xs bg-superficie focus:outline-none w-full"
            />
          </div>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            aria-label="Filtrar por fecha"
            className="px-3 py-2 border border-borde rounded-lg text-xs bg-superficie focus:outline-none"
          />
          <select
            value={severidad}
            onChange={(e) => setSeveridad(e.target.value)}
            aria-label="Filtrar por severidad"
            className="px-3 py-2 border border-borde rounded-lg text-xs bg-superficie focus:outline-none"
          >
            <option value="">Severidad</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
        </Card>

        <div className="flex gap-1 bg-fondo border border-borde rounded-xl p-1 w-fit">
          <button
            type="button"
            onClick={() => { setTab('actividad'); setDatos([]); }}
            aria-pressed={tab === 'actividad'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              tab === 'actividad' ? 'bg-superficie shadow-sm text-primario' : 'text-texto-secundario'
            }`}
          >
            <ScrollText className="w-4 h-4" aria-hidden="true" /> logs.txt (Actividad)
          </button>
          <button
            type="button"
            onClick={() => { setTab('errores'); setDatos([]); }}
            aria-pressed={tab === 'errores'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              tab === 'errores' ? 'bg-superficie shadow-sm text-primario' : 'text-texto-secundario'
            }`}
          >
            <FileWarning className="w-4 h-4" aria-hidden="true" /> errores.txt (Fallos)
          </button>
        </div>

        <div className="bg-gray-900 text-green-400 rounded-2xl p-4 font-mono text-[11px] h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
          {cargando ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : datos.length === 0 ? (
            <div className="text-white/40 italic">[Sin logs que coincidan con los filtros]</div>
          ) : (
            datos.map((log, indice) => {
              const timestamp = log.time ? new Date(log.time).toLocaleString('es-CO') : log.timestamp || '-';
              const nivel = log.level ? NIVELES[log.level] || String(log.level) : log.severidad || 'INFO';
              const mensaje = log.msg || log.mensaje || log.descripcion || JSON.stringify(log);
              let clase = 'text-green-400';
              if (nivel === 'WARN') clase = 'text-amber-400';
              else if (nivel === 'ERROR' || nivel === 'FATAL') clase = 'text-red-400 font-bold';
              return (
                <div key={indice} className="mb-1">
                  <span className="text-white/60">[{timestamp}]</span> <span className={clase}>{nivel}</span>{' '}
                  <span className="text-green-300">{mensaje}</span>
                </div>
              );
            })
          )}
        </div>

        <Card className="p-3 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-texto-secundario">
            <span className="font-semibold">Exportar rango de lineas:</span>
            <input
              type="number"
              min="0"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              placeholder="Desde"
              aria-label="Linea desde"
              className="px-2 py-1.5 border border-borde rounded text-[11px] bg-superficie w-24"
            />
            <span>a</span>
            <input
              type="number"
              min="0"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              placeholder="Hasta"
              aria-label="Linea hasta"
              className="px-2 py-1.5 border border-borde rounded text-[11px] bg-superficie w-24"
            />
          </div>
          <Button variant="secundario" size="sm" onClick={exportar}>
            <Download className="w-4 h-4 mr-2" aria-hidden="true" /> Exportar .txt
          </Button>
        </Card>
      </div>
    </Sheet>
  );
}
