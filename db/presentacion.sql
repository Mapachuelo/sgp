CREATE TABLE IF NOT EXISTS presentacion_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_etiqueta VARCHAR(120) DEFAULT 'SGP · Sistema de Gestión de Peluquería',
  hero_titulo VARCHAR(180) DEFAULT 'El día del salón, en orden.',
  hero_subtitulo TEXT DEFAULT 'Citas, servicios y pagos en una sola línea de tiempo.',
  hero_cta_principal VARCHAR(80) DEFAULT 'Reservar cita',
  hero_cta_secundario VARCHAR(80) DEFAULT 'Ver servicios',
  seccion_cita_titulo VARCHAR(160) DEFAULT 'Una cita, cuatro momentos',
  seccion_cita_texto TEXT DEFAULT 'Elige sede, servicio y estilista. El resto queda ordenado.',
  seccion_servicios_titulo VARCHAR(160) DEFAULT 'Servicios',
  seccion_servicios_texto TEXT DEFAULT 'Cortes, color, barba y tratamientos con precio y duración claros.',
  seccion_salon_titulo VARCHAR(160) DEFAULT 'El salón',
  seccion_salon_texto TEXT DEFAULT 'Un vistazo a lo que te espera.',
  seccion_sedes_titulo VARCHAR(160) DEFAULT 'Sedes',
  seccion_sedes_texto TEXT DEFAULT 'Estamos cerca. Elige la sede que te quede mejor.',
  cierre_titulo VARCHAR(180) DEFAULT 'Tu próximo turno empieza aquí.',
  cierre_texto TEXT DEFAULT 'Reserva en línea, llega con tu QR y disfruta tu servicio.',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO presentacion_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS presentacion_media (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('imagen', 'video')),
  titulo VARCHAR(180),
  descripcion TEXT,
  alt VARCHAR(240),
  poster_url TEXT,
  orden INTEGER NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS presentacion_fuente (
  id SERIAL PRIMARY KEY,
  media_id INTEGER NOT NULL REFERENCES presentacion_media(id) ON DELETE CASCADE,
  archivo_url TEXT NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  codec VARCHAR(80),
  orden INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_presentacion_media_orden ON presentacion_media (activo, orden, id);
CREATE INDEX IF NOT EXISTS idx_presentacion_fuente_media ON presentacion_fuente (media_id, orden, id);
