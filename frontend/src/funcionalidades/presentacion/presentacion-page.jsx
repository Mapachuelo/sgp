import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, ImageOff, MapPin, QrCode, Scissors, Sparkles } from 'lucide-react';
import api from '../../api/cliente.js';
import { useAuth } from '../../hooks/use-auth.js';
import BotonTema from '../../componentes/tema/boton-tema.jsx';
import MediaCarrusel from '../../componentes/presentacion/media-carrusel.jsx';
import CarruselServicios from '../../componentes/servicios/carrusel-servicios.jsx';
import DetalleServicioModal from '../../componentes/servicios/detalle-servicio-modal.jsx';
import ImagenSede from '../../componentes/ubicaciones/imagen-sede.jsx';

const CONFIG_DEFECTO = {
  hero_etiqueta: 'SGP · Sistema de Gestión de Peluquería',
  hero_titulo: 'El día del salón, en orden.',
  hero_subtitulo: 'Citas, servicios y pagos en una sola línea de tiempo. Elige tu sede, tu estilista y tu horario.',
  hero_cta_principal: 'Reservar cita',
  hero_cta_secundario: 'Ver servicios',
  seccion_cita_titulo: 'Una cita, cuatro momentos',
  seccion_cita_texto: 'Elige sede, servicio y estilista. El resto queda ordenado.',
  seccion_servicios_titulo: 'Servicios',
  seccion_servicios_texto: 'Cortes, color, barba y tratamientos con precio y duración claros.',
  seccion_salon_titulo: 'El salón',
  seccion_salon_texto: 'Un vistazo a lo que te espera.',
  seccion_sedes_titulo: 'Sedes',
  seccion_sedes_texto: 'Estamos cerca. Elige la sede que te quede mejor.',
  cierre_titulo: 'Tu próximo turno empieza aquí.',
  cierre_texto: 'Reserva en línea, llega con tu QR y disfruta tu servicio.',
};

const PASOS = [
  { icono: MapPin, titulo: 'Elige la sede', detalle: 'Filtra por departamento y ciudad. También puedes usar tu ubicación.' },
  { icono: Scissors, titulo: 'Elige el servicio', detalle: 'Por estilista o por servicio, con precios y duración visibles.' },
  { icono: CalendarDays, titulo: 'Encuentra el horario', detalle: 'El calendario solo muestra horas donde cabe tu cita completa.' },
  { icono: QrCode, titulo: 'Llega y paga', detalle: 'Muestra tu QR en recepción. Paga en línea o en el salón.' },
];

function PortadaMedia({ item }) {
  if (!item) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-borde bg-panel">
        <div className="px-6 text-center">
          <ImageOff className="mx-auto h-8 w-8 text-tenue" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-texto-principal">Muy pronto verás aquí el salón.</p>
        </div>
      </div>
    );
  }
  const fuente = item.fuentes?.[0]?.archivo_url;
  if (item.tipo === 'video') {
    return (
      <div className="overflow-hidden rounded-xl border border-borde bg-black">
        <video className="aspect-[4/3] w-full object-contain" controls playsInline preload="metadata" poster={item.poster_url || undefined}>
          {(item.fuentes || []).map((f) => <source key={f.id || f.archivo_url} src={f.archivo_url} type={f.mime_type} />)}
        </video>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-borde bg-panel">
      {fuente ? <img src={fuente} alt={item.alt || item.titulo || 'El salón'} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center"><ImageOff className="h-8 w-8 text-tenue" aria-hidden="true" /></div>}
    </div>
  );
}

function Marca() {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5" aria-label="SGP, inicio">
      <span className="flex h-6 items-end gap-[2px]" aria-hidden="true">
        <span className="h-2 w-[2px] rounded-full bg-texto-principal" />
        <span className="h-4 w-[2px] rounded-full bg-texto-principal" />
        <span className="h-1.5 w-[2px] rounded-full bg-acento" />
      </span>
      <span className="font-display text-[19px] font-bold tracking-[-0.04em] text-texto-principal">SGP</span>
    </Link>
  );
}

function EnlaceCuenta({ usuario }) {
  if (!usuario) {
    return (
      <Link to="/login" className="inline-flex h-9 items-center rounded-md border border-control bg-superficie px-3 text-xs font-medium text-texto-principal transition-colors hover:bg-panel">
        Iniciar sesión
      </Link>
    );
  }
  const destino = usuario.rol === 'admin' ? '/admin' : usuario.rol === 'empleado' ? '/empleado' : '/cliente';
  return (
    <Link to={destino} className="inline-flex h-9 items-center rounded-md border border-control bg-superficie px-3 text-xs font-medium text-texto-principal transition-colors hover:bg-panel">
      Mi cuenta
    </Link>
  );
}

export default function PresentacionPage() {
  const { usuario } = useAuth();
  const [config, setConfig] = useState(CONFIG_DEFECTO);
  const [media, setMedia] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [servicioDetalle, setServicioDetalle] = useState(null);

  useEffect(() => {
    document.title = 'SGP — Tu salón, en orden';
    Promise.all([
      api.presentacion.publica().catch(() => null),
      api.reservas.servicios().catch(() => []),
      api.ubicaciones.list().catch(() => []),
    ]).then(([presentacion, catalogo, ubicaciones]) => {
      if (presentacion?.config) setConfig({ ...CONFIG_DEFECTO, ...presentacion.config });
      if (Array.isArray(presentacion?.media) && presentacion.media.length > 0) {
        setMedia(presentacion.media);
      }
      setServicios(Array.isArray(catalogo) ? catalogo.filter((servicio) => servicio.activo !== false) : []);
      setSedes(Array.isArray(ubicaciones) ? ubicaciones : []);
    });
  }, []);

  useEffect(() => {
    if (media.length > 0) return;
    if (servicios.length === 0) return;
    setMedia(
      servicios
        .filter((servicio) => servicio.imagen_url)
        .slice(0, 6)
        .map((servicio, indice) => ({
          id: `servicio-${servicio.id}`,
          tipo: 'imagen',
          titulo: servicio.nombre,
          descripcion: servicio.categoria_nombre,
          fuentes: [{ id: indice, archivo_url: servicio.imagen_url, mime_type: 'image/*' }],
        }))
    );
  }, [media.length, servicios]);

  const destinoReserva = usuario?.rol === 'cliente' ? '/cliente/reservar' : '/login';
  const anio = new Date().getFullYear();

  return (
    <div className="min-h-[100dvh] bg-fondo">
      <header className="sticky top-0 z-40 border-b border-borde bg-fondo/95">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
          <Marca />
          <nav className="hidden items-center gap-6 text-[12px] text-texto-secundario md:flex" aria-label="Secciones de la presentación">
            <a href="#como-funciona" className="transition-colors hover:text-texto-principal">Cómo funciona</a>
            <a href="#servicios" className="transition-colors hover:text-texto-principal">Servicios</a>
            <a href="#salon" className="transition-colors hover:text-texto-principal">El salón</a>
            <a href="#sedes" className="transition-colors hover:text-texto-principal">Sedes</a>
          </nav>
          <div className="flex items-center gap-2">
            <BotonTema />
            <EnlaceCuenta usuario={usuario} />
          </div>
        </div>
      </header>

      <main id="contenido-principal">
        <section className="mx-auto grid max-w-[1200px] gap-8 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:items-center lg:pb-24 lg:pt-16">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-acento">{config.hero_etiqueta}</p>
            <h1 className="mt-4 max-w-[620px] font-display text-[clamp(2.6rem,6vw,5.4rem)] font-semibold leading-[0.96] tracking-[-0.065em] text-texto-principal">
              {config.hero_titulo}
            </h1>
            <p className="mt-5 max-w-[470px] text-base leading-7 text-texto-secundario">{config.hero_subtitulo}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link to={destinoReserva} className="inline-flex h-10 items-center gap-2 rounded-md bg-primario px-4 text-sm font-medium text-primario-texto transition-transform active:scale-[0.97]">
                {config.hero_cta_principal || 'Reservar cita'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#servicios" className="inline-flex h-10 items-center rounded-md border border-control bg-superficie px-4 text-sm font-medium text-texto-principal transition-colors hover:bg-panel">
                {config.hero_cta_secundario || 'Ver servicios'}
              </a>
            </div>
            <div className="mt-10 grid max-w-[520px] grid-cols-3 gap-4 border-t border-borde pt-5">
              <div><p className="text-lg font-semibold text-texto-principal">{sedes.length}</p><p className="mt-0.5 text-[11px] text-tenue">sedes</p></div>
              <div><p className="text-lg font-semibold text-texto-principal">{servicios.length}</p><p className="mt-0.5 text-[11px] text-tenue">servicios</p></div>
              <div><p className="text-lg font-semibold text-texto-principal">4</p><p className="mt-0.5 text-[11px] text-tenue">pasos</p></div>
            </div>
          </div>
          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-tenue">El salón, ahora</p>
              <span className="text-[10px] text-tenue">Galería</span>
            </div>
            <PortadaMedia item={media[0]} />
          </div>
        </section>

        <section id="como-funciona" className="border-y border-borde bg-superficie">
          <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:py-20">
            <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-acento">01 / La cita</p>
                <h2 className="mt-3 max-w-[280px] font-display text-3xl font-semibold leading-[1.02] tracking-[-0.045em] text-texto-principal">{config.seccion_cita_titulo}</h2>
                <p className="mt-3 max-w-[280px] text-sm leading-6 text-texto-secundario">{config.seccion_cita_texto}</p>
              </div>
              <ol className="grid gap-0 border-t border-borde sm:grid-cols-2">
                {PASOS.map((paso, indice) => {
                  const Icono = paso.icono;
                  return (
                    <li key={paso.titulo} className="flex gap-4 border-b border-borde py-5 sm:px-5 sm:first:pl-0">
                      <span className="font-mono text-[11px] text-tenue">0{indice + 1}</span>
                      <div>
                        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-borde bg-panel text-acento"><Icono className="h-4 w-4" aria-hidden="true" /></span>
                        <p className="mt-2 text-sm font-medium text-texto-principal">{paso.titulo}</p>
                        <p className="mt-1 max-w-[240px] text-xs leading-5 text-texto-secundario">{paso.detalle}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>

        <section id="servicios" className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:py-20">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-acento">02 / Servicios</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.045em] text-texto-principal">{config.seccion_servicios_titulo}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-texto-secundario">{config.seccion_servicios_texto}</p>
            </div>
            <Link to={destinoReserva} className="inline-flex items-center gap-1 text-xs font-medium text-acento underline-offset-2 hover:underline">Reservar mi cita <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          </div>
          <CarruselServicios servicios={servicios} onVerDetalle={setServicioDetalle} />
        </section>

        <section id="salon" className="border-y border-borde bg-superficie">
          <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:py-20">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-acento">03 / El salón</p>
                <h2 className="mt-3 max-w-[360px] font-display text-3xl font-semibold leading-[1.02] tracking-[-0.045em] text-texto-principal">{config.seccion_salon_titulo}</h2>
                <p className="mt-3 max-w-[340px] text-sm leading-6 text-texto-secundario">{config.seccion_salon_texto}</p>
                <div className="mt-6 space-y-2 text-xs text-texto-secundario">
                  <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-exito" aria-hidden="true" /> Elige entre varias sedes y estilistas.</p>
                  <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-exito" aria-hidden="true" /> Consulta precios y duración antes de reservar.</p>
                  <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-exito" aria-hidden="true" /> Tu QR queda listo para la llegada.</p>
                </div>
              </div>
              <MediaCarrusel items={media} etiqueta="Imágenes y videos del salón" />
            </div>
          </div>
        </section>

        <section id="sedes" className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:py-20">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-acento">04 / Sedes</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.045em] text-texto-principal">{config.seccion_sedes_titulo}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-texto-secundario">{config.seccion_sedes_texto}</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sedes.length === 0 ? (
              <p className="col-span-full rounded-lg border border-dashed border-control bg-superficie p-8 text-center text-sm text-texto-secundario">Pronto publicaremos nuestras sedes.</p>
            ) : sedes.map((sede) => (
              <div key={sede.id} className="overflow-hidden rounded-lg border border-borde bg-superficie">
                {sede.imagen_url && (
                  <ImagenSede sede={sede} className="aspect-[4/3] w-full" />
                )}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-acento" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-texto-principal">{sede.nombre}</p>
                      <p className="mt-0.5 text-xs leading-5 text-texto-secundario">{sede.direccion}</p>
                      <p className="mt-1 text-[10px] text-tenue">{[sede.ciudad, sede.departamento].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-borde bg-primario">
          <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-end lg:py-16">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-primario-texto/60">SGP / Reserva</p>
              <h2 className="mt-3 max-w-[620px] font-display text-3xl font-semibold leading-[1.02] tracking-[-0.045em] text-primario-texto sm:text-4xl">{config.cierre_titulo}</h2>
              <p className="mt-3 max-w-[480px] text-sm leading-6 text-primario-texto/70">{config.cierre_texto}</p>
            </div>
            <Link to={destinoReserva} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-superficie px-5 text-sm font-medium text-texto-principal transition-transform active:scale-[0.97]">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> {config.hero_cta_principal || 'Reservar cita'}
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-fondo">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-6 text-[11px] text-tenue sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3"><Marca /><span>SGP · Sistema de Gestión de Peluquería</span></div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/login" className="hover:text-texto-principal">Iniciar sesión</Link>
            <Link to="/register" className="hover:text-texto-principal">Crear cuenta</Link>
            <span>© {anio}</span>
          </div>
        </div>
      </footer>
      <DetalleServicioModal
        abierto={Boolean(servicioDetalle)}
        servicio={servicioDetalle}
        onClose={() => setServicioDetalle(null)}
        cta={
          <Link
            to={destinoReserva}
            onClick={() => setServicioDetalle(null)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-primario bg-primario px-3.5 text-sm font-medium text-primario-texto transition-colors hover:bg-primario-hover"
          >
            Reservar cita <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />
    </div>
  );
}
