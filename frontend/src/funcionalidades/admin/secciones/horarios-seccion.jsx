import { useState } from 'react';
import { CalendarCog, CalendarRange } from 'lucide-react';
import { PageHeader } from '../../../componentes/ui/index.jsx';
import CobroCitaSheet from '../../../componentes/pagos/cobro-cita-sheet.jsx';
import PlanificadorHorarios from './planificador-horarios.jsx';
import JornadaSede from './jornada-sede.jsx';
import { avisarAdmin } from './avisos.js';

const TABS = [
  { clave: 'planificador', etiqueta: 'Planificador por empleado', icono: CalendarCog },
  { clave: 'jornada', etiqueta: 'Jornada por sede', icono: CalendarRange },
];

export default function HorariosSeccion() {
  const [tab, setTab] = useState('planificador');
  const [cobro, setCobro] = useState(null);
  const [recarga, setRecarga] = useState(0);

  const cerrarCobro = () => {
    setCobro(null);
    setRecarga((valor) => valor + 1);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Horarios y planificación"
        subtitle="Organiza los turnos por empleado y la jornada de cada sede."
      />

      <div className="flex w-fit flex-wrap gap-1 rounded-xl border border-borde bg-fondo p-1">
        {TABS.map(({ clave, etiqueta, icono: Icono }) => (
          <button
            key={clave}
            type="button"
            onClick={() => setTab(clave)}
            aria-pressed={tab === clave}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition cursor-pointer ${
              tab === clave ? 'bg-superficie text-primario' : 'text-texto-secundario hover:text-texto-principal'
            }`}
          >
            <Icono className="h-4 w-4" aria-hidden="true" /> {etiqueta}
          </button>
        ))}
      </div>

      {tab === 'planificador' ? (
        <PlanificadorHorarios
          onToast={avisarAdmin}
          onValidarCita={(cita) => setCobro(cita)}
          recargarKey={recarga}
        />
      ) : (
        <JornadaSede onToast={avisarAdmin} />
      )}

      <CobroCitaSheet
        open={Boolean(cobro)}
        reserva={cobro}
        onClose={cerrarCobro}
        onActualizado={() => setRecarga((valor) => valor + 1)}
        onToast={avisarAdmin}
      />
    </div>
  );
}
