import { useEffect, useState } from 'react';
import { CalendarCog, CalendarRange } from 'lucide-react';
import { SheetAdmin } from './navegacion.jsx';
import PlanificadorHorarios from './planificador-horarios.jsx';
import JornadaSede from './jornada-sede.jsx';

const TABS = [
  { clave: 'planificador', etiqueta: 'Planificador por empleado', icono: CalendarCog },
  { clave: 'jornada', etiqueta: 'Jornada por sede', icono: CalendarRange },
];

export default function HorariosSeccion({ open, onClose, onToast, onValidarCita }) {
  const [tab, setTab] = useState('planificador');

  useEffect(() => {
    if (open) setTab('planificador');
  }, [open]);

  return (
    <SheetAdmin open={open} onClose={onClose} title="Horarios y planificacion">
      <div className="flex flex-wrap gap-1 bg-fondo border border-borde rounded-xl p-1 mb-5 w-fit">
        {TABS.map(({ clave, etiqueta, icono: Icono }) => (
          <button
            key={clave}
            type="button"
            onClick={() => setTab(clave)}
            aria-pressed={tab === clave}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              tab === clave ? 'bg-superficie shadow-sm text-primario' : 'text-texto-secundario hover:text-texto-principal'
            }`}
          >
            <Icono className="w-4 h-4" aria-hidden="true" /> {etiqueta}
          </button>
        ))}
      </div>
      {tab === 'planificador' ? (
        <PlanificadorHorarios onToast={onToast} onValidarCita={onValidarCita} />
      ) : (
        <JornadaSede onToast={onToast} />
      )}
    </SheetAdmin>
  );
}
