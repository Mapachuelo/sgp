import { Badge, Button, Modal } from '../ui/index.jsx';
import GaleriaServicio from './galeria-servicio.jsx';

const dinero = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(Number(valor) || 0)
    .replace(/\u00a0/g, '');

export default function DetalleServicioModal({
  abierto,
  servicio,
  onClose,
  cta = null,
  duracionAsignada = null,
  nota = '',
}) {
  const duracionMostrada = duracionAsignada != null ? duracionAsignada : (servicio?.duracion_base_minutos || 30);

  return (
    <Modal
      open={abierto && Boolean(servicio)}
      onClose={onClose}
      title={servicio?.nombre || 'Detalle del servicio'}
      size="xl"
    >
      {servicio && (
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <GaleriaServicio servicio={servicio} />

            <div className="min-w-0">
              <Badge variant="accent">{servicio.categoria_nombre || 'Servicio'}</Badge>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-texto-principal">{servicio.nombre}</h3>
              {servicio.descripcion ? (
                <p className="mt-2 text-sm leading-6 text-texto-secundario">{servicio.descripcion}</p>
              ) : (
                <p className="mt-2 text-sm text-tenue">Sin descripción.</p>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-borde pt-4">
                <div>
                  <p className="text-[11px] text-tenue">Precio</p>
                  <p className="num mt-0.5 text-lg font-semibold text-texto-principal">{dinero(servicio.precio_base)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-tenue">Duración base</p>
                  <p className="num mt-0.5 text-lg font-semibold text-texto-principal">{servicio.duracion_base_minutos || 30} min</p>
                </div>
                {duracionAsignada != null && (
                  <div className="col-span-2 rounded-md border border-borde bg-panel px-3 py-2">
                    <p className="text-[11px] text-tenue">Tu duración para este servicio</p>
                    <p className="num mt-0.5 text-base font-semibold text-texto-principal">{duracionAsignada} min</p>
                  </div>
                )}
              </div>

              {nota && <p className="mt-4 text-[11px] leading-5 text-texto-secundario">{nota}</p>}
            </div>
          </div>

          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-col gap-2 border-t border-borde bg-superficie p-4 sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <span className="num text-sm font-semibold text-texto-principal">
              {dinero(servicio.precio_base)} · {duracionMostrada} min
            </span>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secundario" onClick={onClose}>Cerrar</Button>
              {cta}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
