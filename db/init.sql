CREATE TABLE IF NOT EXISTS ubicacion (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  direccion TEXT NOT NULL,
  departamento VARCHAR(120) NOT NULL DEFAULT 'Sin departamento',
  ciudad VARCHAR(120) NOT NULL DEFAULT 'Sin ciudad',
  latitud DOUBLE PRECISION NOT NULL,
  longitud DOUBLE PRECISION NOT NULL,
  imagen_url TEXT
);

ALTER TABLE ubicacion ADD COLUMN IF NOT EXISTS departamento VARCHAR(120);
ALTER TABLE ubicacion ADD COLUMN IF NOT EXISTS ciudad VARCHAR(120);
ALTER TABLE ubicacion ADD COLUMN IF NOT EXISTS imagen_url TEXT;

UPDATE ubicacion
SET ciudad = CASE
  WHEN ciudad IS NULL OR BTRIM(ciudad) = '' THEN
    CASE
      WHEN POSITION(',' IN direccion) > 0
        THEN BTRIM(REGEXP_REPLACE(direccion, '^.*,', ''))
      ELSE 'Sin ciudad'
    END
  ELSE ciudad
END
WHERE ciudad IS NULL OR BTRIM(ciudad) = '';

UPDATE ubicacion
SET departamento = 'Sin departamento'
WHERE departamento IS NULL OR BTRIM(departamento) = '';

UPDATE ubicacion SET departamento = 'Bogotá D.C.', ciudad = 'Bogotá'
WHERE ciudad ILIKE 'bogot%' OR direccion ILIKE '%bogot%';

ALTER TABLE ubicacion ALTER COLUMN ciudad SET DEFAULT 'Sin ciudad';
ALTER TABLE ubicacion ALTER COLUMN departamento SET DEFAULT 'Sin departamento';
ALTER TABLE ubicacion ALTER COLUMN ciudad SET NOT NULL;
ALTER TABLE ubicacion ALTER COLUMN departamento SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ubicacion_departamento_ciudad
  ON ubicacion (departamento, ciudad);

CREATE TABLE IF NOT EXISTS app_user (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('cliente', 'empleado', 'admin')),
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  telefono TEXT,
  esta_bloqueado BOOLEAN DEFAULT FALSE,
  motivo_bloqueo TEXT,
  bloqueado_por INTEGER REFERENCES app_user(id),
  bloqueado_en TIMESTAMPTZ,
  verificado BOOLEAN DEFAULT FALSE,
  token_verificacion TEXT,
  token_verificacion_expiracion TIMESTAMPTZ,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS verificado BOOLEAN DEFAULT FALSE;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS token_verificacion TEXT;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS token_verificacion_expiracion TIMESTAMPTZ;
ALTER TABLE app_user ALTER COLUMN telefono TYPE TEXT;
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_telefono_check;

CREATE TABLE IF NOT EXISTS empleado_perfil (
  usuario_id INTEGER PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  identificacion VARCHAR(30),
  password_asignada_hash TEXT,
  ubicacion_base_id INTEGER REFERENCES ubicacion(id) ON DELETE SET NULL,
  foto_url TEXT
);

ALTER TABLE empleado_perfil ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE empleado_perfil ADD COLUMN IF NOT EXISTS comision_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 50;

CREATE TABLE IF NOT EXISTS servicio_categoria (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  orden INTEGER NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_servicio_categoria_nombre
  ON servicio_categoria (LOWER(nombre));

CREATE TABLE IF NOT EXISTS servicio_catalogo (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  precio_base DECIMAL(10, 2) NOT NULL,
  duracion_base_minutos INTEGER NOT NULL,
  categoria_id INTEGER REFERENCES servicio_categoria(id) ON DELETE RESTRICT,
  imagen_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE servicio_catalogo ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES servicio_categoria(id) ON DELETE RESTRICT;
ALTER TABLE servicio_catalogo ADD COLUMN IF NOT EXISTS imagen_url TEXT;
ALTER TABLE servicio_catalogo ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS servicio_imagen (
  id SERIAL PRIMARY KEY,
  servicio_id INTEGER NOT NULL REFERENCES servicio_catalogo(id) ON DELETE CASCADE,
  imagen_url TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 1,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(servicio_id, orden)
);

CREATE TABLE IF NOT EXISTS ubicacion_imagen (
  id SERIAL PRIMARY KEY,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicacion(id) ON DELETE CASCADE,
  imagen_url TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 1,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ubicacion_id, orden)
);

INSERT INTO ubicacion_imagen (ubicacion_id, imagen_url, orden)
SELECT u.id, u.imagen_url, 1
FROM ubicacion u
WHERE u.imagen_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ubicacion_imagen ui WHERE ui.ubicacion_id = u.id
  );

CREATE TABLE IF NOT EXISTS empleado_tiempo_servicio (
  id SERIAL PRIMARY KEY,
  empleado_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  servicio_id INTEGER NOT NULL REFERENCES servicio_catalogo(id) ON DELETE CASCADE,
  duracion_minutos INTEGER NOT NULL,
  UNIQUE(empleado_id, servicio_id)
);

CREATE TABLE IF NOT EXISTS jornada (
  id SERIAL PRIMARY KEY,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicacion(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  UNIQUE(ubicacion_id, fecha)
);

ALTER TABLE jornada ADD COLUMN IF NOT EXISTS cerrado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE jornada ADD COLUMN IF NOT EXISTS motivo VARCHAR(200);

CREATE TABLE IF NOT EXISTS jornada_plantilla (
  id SERIAL PRIMARY KEY,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicacion(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  abierto BOOLEAN NOT NULL DEFAULT TRUE,
  hora_inicio TIME NOT NULL DEFAULT '09:00',
  hora_fin TIME NOT NULL DEFAULT '18:00',
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ubicacion_id, dia_semana)
);

CREATE TABLE IF NOT EXISTS empleado_disponibilidad (
  id SERIAL PRIMARY KEY,
  empleado_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicacion(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  UNIQUE(empleado_id, ubicacion_id, dia_semana)
);

ALTER TABLE empleado_disponibilidad
  ADD COLUMN IF NOT EXISTS descansos JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE empleado_disponibilidad
  ADD COLUMN IF NOT EXISTS descanso BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS empleado_sede_temporal (
  id SERIAL PRIMARY KEY,
  empleado_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicacion(id) ON DELETE CASCADE,
  desde DATE NOT NULL,
  hasta DATE NOT NULL,
  dias_semana INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7],
  creado_por INTEGER REFERENCES app_user(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (hasta >= desde),
  CHECK (dias_semana <@ ARRAY[1,2,3,4,5,6,7])
);

CREATE INDEX IF NOT EXISTS idx_sede_temporal_empleado_fechas
  ON empleado_sede_temporal (empleado_id, desde, hasta);

CREATE TABLE IF NOT EXISTS empleado_bloqueo_fecha (
  id SERIAL PRIMARY KEY,
  empleado_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  motivo VARCHAR(240) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(empleado_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_bloqueo_fecha
  ON empleado_bloqueo_fecha (fecha, empleado_id);

CREATE TABLE IF NOT EXISTS empleado_descanso_temporal (
  id SERIAL PRIMARY KEY,
  empleado_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  descanso BOOLEAN NOT NULL DEFAULT FALSE,
  descansos JSONB NOT NULL DEFAULT '[]'::jsonb,
  motivo VARCHAR(240),
  creado_por INTEGER REFERENCES app_user(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(empleado_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_descanso_temporal_empleado_fecha
  ON empleado_descanso_temporal (empleado_id, fecha);

CREATE TABLE IF NOT EXISTS empleado_festivo (
  id SERIAL PRIMARY KEY,
  empleado_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicacion(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  descansos JSONB NOT NULL DEFAULT '[]'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(empleado_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_festivo_fecha_sede
  ON empleado_festivo (fecha, ubicacion_id);

CREATE TABLE IF NOT EXISTS reserva (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  empleado_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  servicio_id INTEGER NOT NULL REFERENCES servicio_catalogo(id) ON DELETE CASCADE,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicacion(id) ON DELETE CASCADE,
  inicia_en TIMESTAMPTZ NOT NULL,
  termina_en TIMESTAMPTZ NOT NULL,
  cantidad_personas INTEGER NOT NULL DEFAULT 1 CHECK (cantidad_personas BETWEEN 1 AND 5),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'en_curso', 'cobrado', 'cancelada')),
  qr_token UUID DEFAULT gen_random_uuid(),
  qr_data_url TEXT,
  motivo_cancelacion TEXT,
  llego_en TIMESTAMPTZ,
  inicio_servicio TIMESTAMPTZ,
  fin_servicio TIMESTAMPTZ,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reserva ADD COLUMN IF NOT EXISTS llego_en TIMESTAMPTZ;
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS inicio_servicio TIMESTAMPTZ;
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS fin_servicio TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS reserva_servicio (
  id SERIAL PRIMARY KEY,
  reserva_id INTEGER NOT NULL REFERENCES reserva(id) ON DELETE CASCADE,
  servicio_id INTEGER REFERENCES servicio_catalogo(id) ON DELETE SET NULL,
  empleado_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  nombre VARCHAR(200) NOT NULL,
  precio DECIMAL(10, 2) NOT NULL,
  duracion_minutos INTEGER NOT NULL,
  inicia_en TIMESTAMPTZ NOT NULL,
  termina_en TIMESTAMPTZ NOT NULL,
  orden INTEGER NOT NULL DEFAULT 1,
  UNIQUE (reserva_id, orden)
);

CREATE TABLE IF NOT EXISTS configuracion (
  clave VARCHAR(80) PRIMARY KEY,
  valor TEXT NOT NULL,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cobro (
  id SERIAL PRIMARY KEY,
  reserva_id INTEGER UNIQUE NOT NULL REFERENCES reserva(id) ON DELETE CASCADE,
  monto DECIMAL(10, 2) NOT NULL,
  metodo VARCHAR(10) NOT NULL CHECK (metodo IN ('fisico', 'online')),
  cobrado_en TIMESTAMPTZ DEFAULT NOW(),
  registrado_por INTEGER REFERENCES app_user(id)
);

CREATE TABLE IF NOT EXISTS pago (
  id SERIAL PRIMARY KEY,
  reserva_id INTEGER NOT NULL REFERENCES reserva(id) ON DELETE CASCADE,
  proveedor VARCHAR(20) NOT NULL DEFAULT 'wompi',
  referencia VARCHAR(100) UNIQUE NOT NULL,
  transaction_id VARCHAR(100) UNIQUE,
  monto DECIMAL(10, 2) NOT NULL,
  moneda VARCHAR(3) NOT NULL DEFAULT 'COP',
  metodo VARCHAR(30),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'declinado', 'error', 'anulado')),
  payload JSONB,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cobro ADD COLUMN IF NOT EXISTS pago_id INTEGER REFERENCES pago(id) ON DELETE SET NULL;
ALTER TABLE cobro ADD COLUMN IF NOT EXISTS pagado_antes BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE cobro ADD COLUMN IF NOT EXISTS reembolsado_en TIMESTAMPTZ;
ALTER TABLE pago ADD COLUMN IF NOT EXISTS reembolso_estado VARCHAR(20);
ALTER TABLE pago ADD COLUMN IF NOT EXISTS reembolsado_en TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS notificacion (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  reserva_id INTEGER REFERENCES reserva(id) ON DELETE SET NULL,
  tipo VARCHAR(40) NOT NULL DEFAULT 'reserva',
  titulo VARCHAR(160) NOT NULL,
  mensaje TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  leida_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacion_usuario_leida
  ON notificacion (usuario_id, leida_en, creado_en DESC);

CREATE TABLE IF NOT EXISTS preferencia_usuario (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER UNIQUE NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  rango_hora_desde TIME DEFAULT '06:00',
  rango_hora_hasta TIME DEFAULT '22:00',
  granularidad_calendario INTEGER DEFAULT 30,
  tema VARCHAR(10) DEFAULT 'claro',
  departamento_preferido VARCHAR(120),
  ciudad_preferida VARCHAR(120)
);

ALTER TABLE preferencia_usuario ADD COLUMN IF NOT EXISTS departamento_preferido VARCHAR(120);
ALTER TABLE preferencia_usuario ADD COLUMN IF NOT EXISTS ciudad_preferida VARCHAR(120);
ALTER TABLE preferencia_usuario DROP COLUMN IF EXISTS idioma;

CREATE INDEX IF NOT EXISTS idx_reserva_inicia_en ON reserva(inicia_en);
CREATE INDEX IF NOT EXISTS idx_reserva_cliente_id ON reserva(cliente_id);
CREATE INDEX IF NOT EXISTS idx_reserva_empleado_id ON reserva(empleado_id);
CREATE INDEX IF NOT EXISTS idx_reserva_estado ON reserva(estado);
CREATE INDEX IF NOT EXISTS idx_reserva_ubicacion_id ON reserva(ubicacion_id);
CREATE INDEX IF NOT EXISTS idx_reserva_llego_en ON reserva(llego_en);
CREATE INDEX IF NOT EXISTS idx_cobro_cobrado_en ON cobro(cobrado_en);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cobro_pago_id ON cobro(pago_id);
CREATE INDEX IF NOT EXISTS idx_pago_reserva_id ON pago(reserva_id);
CREATE INDEX IF NOT EXISTS idx_pago_estado ON pago(estado);
CREATE INDEX IF NOT EXISTS idx_pago_referencia ON pago(referencia);
CREATE INDEX IF NOT EXISTS idx_app_user_rol_bloqueado ON app_user(rol, esta_bloqueado);
CREATE INDEX IF NOT EXISTS idx_servicio_catalogo_categoria_id ON servicio_catalogo(categoria_id);
CREATE INDEX IF NOT EXISTS idx_servicio_imagen_servicio ON servicio_imagen(servicio_id, orden);
CREATE INDEX IF NOT EXISTS idx_ubicacion_imagen_ubicacion ON ubicacion_imagen(ubicacion_id, orden);
CREATE INDEX IF NOT EXISTS idx_reserva_servicio_reserva_id ON reserva_servicio(reserva_id);
CREATE INDEX IF NOT EXISTS idx_reserva_servicio_empleado_inicia ON reserva_servicio(empleado_id, inicia_en);
CREATE INDEX IF NOT EXISTS idx_reserva_servicio_servicio_id ON reserva_servicio(servicio_id);

-- Seed data

INSERT INTO configuracion (clave, valor)
SELECT 'max_servicios_reserva', '5'
WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'max_servicios_reserva');

INSERT INTO ubicacion (nombre, direccion, departamento, ciudad, latitud, longitud)
SELECT 'Sede Centro', 'Calle 123 #45-67, Bogota', 'Bogotá D.C.', 'Bogotá', 4.60971, -74.08175
WHERE NOT EXISTS (SELECT 1 FROM ubicacion WHERE nombre = 'Sede Centro');

UPDATE ubicacion
SET departamento = 'Bogotá D.C.', ciudad = 'Bogotá'
WHERE nombre IN ('Sede Centro') OR direccion ILIKE '%bogot%';

INSERT INTO servicio_categoria (nombre, descripcion, orden)
SELECT 'Peluqueada', 'Cortes y peinados de cabello', 1
WHERE NOT EXISTS (SELECT 1 FROM servicio_categoria WHERE LOWER(nombre) = 'peluqueada');

INSERT INTO servicio_categoria (nombre, descripcion, orden)
SELECT 'Planchada', 'Alisados y planchados', 2
WHERE NOT EXISTS (SELECT 1 FROM servicio_categoria WHERE LOWER(nombre) = 'planchada');

INSERT INTO servicio_categoria (nombre, descripcion, orden)
SELECT 'Barba', 'Arreglo y perfilado de barba', 3
WHERE NOT EXISTS (SELECT 1 FROM servicio_categoria WHERE LOWER(nombre) = 'barba');

INSERT INTO servicio_categoria (nombre, descripcion, orden)
SELECT 'Color', 'Tintes y coloracion', 4
WHERE NOT EXISTS (SELECT 1 FROM servicio_categoria WHERE LOWER(nombre) = 'color');

INSERT INTO servicio_categoria (nombre, descripcion, orden)
SELECT 'Peinado', 'Peinados para eventos', 5
WHERE NOT EXISTS (SELECT 1 FROM servicio_categoria WHERE LOWER(nombre) = 'peinado');

INSERT INTO servicio_categoria (nombre, descripcion, orden)
SELECT 'Tratamientos', 'Manicure, masajes e hidratacion', 6
WHERE NOT EXISTS (SELECT 1 FROM servicio_categoria WHERE LOWER(nombre) = 'tratamientos');

INSERT INTO servicio_categoria (nombre, descripcion, orden)
SELECT 'Otros', 'Servicios sin clasificar', 99
WHERE NOT EXISTS (SELECT 1 FROM servicio_categoria WHERE LOWER(nombre) = 'otros');

INSERT INTO servicio_catalogo (nombre, descripcion, precio_base, duracion_base_minutos, categoria_id)
SELECT 'Corte clasico', 'Corte de cabello clasico', 25000.00, 30,
       (SELECT id FROM servicio_categoria WHERE LOWER(nombre) = 'peluqueada')
WHERE NOT EXISTS (SELECT 1 FROM servicio_catalogo WHERE nombre = 'Corte clasico');

INSERT INTO servicio_catalogo (nombre, descripcion, precio_base, duracion_base_minutos, categoria_id)
SELECT 'Barba', 'Arreglo de barba', 15000.00, 20,
       (SELECT id FROM servicio_categoria WHERE LOWER(nombre) = 'barba')
WHERE NOT EXISTS (SELECT 1 FROM servicio_catalogo WHERE nombre = 'Barba');

INSERT INTO servicio_catalogo (nombre, descripcion, precio_base, duracion_base_minutos, categoria_id)
SELECT 'Tinte', 'Tinte de cabello', 60000.00, 90,
       (SELECT id FROM servicio_categoria WHERE LOWER(nombre) = 'color')
WHERE NOT EXISTS (SELECT 1 FROM servicio_catalogo WHERE nombre = 'Tinte');

INSERT INTO servicio_catalogo (nombre, descripcion, precio_base, duracion_base_minutos, categoria_id)
SELECT 'Corte + Barba', 'Combo corte y barba', 35000.00, 45,
       (SELECT id FROM servicio_categoria WHERE LOWER(nombre) = 'peluqueada')
WHERE NOT EXISTS (SELECT 1 FROM servicio_catalogo WHERE nombre = 'Corte + Barba');

UPDATE servicio_catalogo s
SET categoria_id = (
  SELECT c.id
  FROM servicio_categoria c
  WHERE c.nombre = CASE
    WHEN s.nombre ILIKE '%corte%' OR s.nombre ILIKE '%peluqu%' OR s.descripcion ILIKE '%corte%' THEN 'Peluqueada'
    WHEN s.nombre ILIKE '%barba%' THEN 'Barba'
    WHEN s.nombre ILIKE '%alisado%' OR s.nombre ILIKE '%planch%' THEN 'Planchada'
    WHEN s.nombre ILIKE '%tinte%' OR s.nombre ILIKE '%color%' THEN 'Color'
    WHEN s.nombre ILIKE '%peinado%' THEN 'Peinado'
    WHEN s.nombre ILIKE '%uña%' OR s.nombre ILIKE '%manicure%' OR s.nombre ILIKE '%masaje%' OR s.nombre ILIKE '%hidrat%' THEN 'Tratamientos'
    ELSE 'Otros'
  END
  LIMIT 1
)
WHERE s.categoria_id IS NULL;

INSERT INTO reserva_servicio (reserva_id, servicio_id, empleado_id, nombre, precio, duracion_minutos, inicia_en, termina_en, orden)
SELECT r.id,
       r.servicio_id,
       r.empleado_id,
       s.nombre,
       COALESCE(
         (SELECT c.monto / GREATEST(r.cantidad_personas, 1) FROM cobro c WHERE c.reserva_id = r.id LIMIT 1),
         s.precio_base
       ),
       GREATEST(
         1,
         COALESCE(
           NULLIF(ROUND(EXTRACT(EPOCH FROM (r.termina_en - r.inicia_en)) / 60)::int, 0),
           s.duracion_base_minutos
         )
       ),
       r.inicia_en,
       r.termina_en,
       1
FROM reserva r
JOIN servicio_catalogo s ON s.id = r.servicio_id
WHERE NOT EXISTS (SELECT 1 FROM reserva_servicio rs WHERE rs.reserva_id = r.id);

DO $$
DECLARE
  admin_password_hash TEXT;
  empleado_password_hash TEXT;
  sede_id INTEGER;
BEGIN
  admin_password_hash := '$2a$12$OKLNQLCSiMtT7YgbpZYWaO1uRYE32s4u1ydgErygYSeOogQhIhOsO';
  empleado_password_hash := '$2a$12$2s7S5OvZjNfyjyy1npvgVOQHCv8J3MbPvi3VXlbHs25TqErlRLGPa';

  IF NOT EXISTS (SELECT 1 FROM app_user WHERE email = 'admin@sgp.local') THEN
    INSERT INTO app_user (email, password_hash, rol, nombre, apellido, telefono)
    VALUES ('admin@sgp.local', admin_password_hash, 'admin', 'Admin', 'SGP', '+573001111111');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM app_user WHERE email = 'empleado@sgp.local') THEN
    INSERT INTO app_user (email, password_hash, rol, nombre, apellido, telefono)
    VALUES ('empleado@sgp.local', empleado_password_hash, 'empleado', 'Carlos', 'Gomez', '+573002222222');

    SELECT id INTO sede_id FROM ubicacion WHERE nombre = 'Sede Centro' LIMIT 1;

    INSERT INTO empleado_perfil (usuario_id, identificacion, ubicacion_base_id)
    SELECT id, '1234567890', sede_id FROM app_user WHERE email = 'empleado@sgp.local'
    ON CONFLICT (usuario_id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM app_user WHERE email = 'cliente@sgp.local') THEN
    INSERT INTO app_user (email, password_hash, rol, nombre, apellido, telefono, verificado)
    VALUES ('cliente@sgp.local',
            '$2a$12$ui.KdbhGZ3GGyrO/m2VIc.uo6D.RwC.F/3N2vvUcQSyo6AbyYIPDe',
            'cliente', 'Cliente', 'Prueba', '+573003334455', TRUE);
  END IF;
END $$;

DO $$
DECLARE
  sede_id INTEGER;
BEGIN
  SELECT id INTO sede_id FROM ubicacion WHERE nombre = 'Sede Centro' LIMIT 1;

  IF sede_id IS NOT NULL THEN
    INSERT INTO jornada (ubicacion_id, fecha, hora_inicio, hora_fin)
    SELECT sede_id, '2026-06-01', '09:00', '18:00'
    WHERE NOT EXISTS (SELECT 1 FROM jornada WHERE ubicacion_id = sede_id AND fecha = '2026-06-01');

    INSERT INTO jornada (ubicacion_id, fecha, hora_inicio, hora_fin)
    SELECT sede_id, '2026-06-02', '09:00', '18:00'
    WHERE NOT EXISTS (SELECT 1 FROM jornada WHERE ubicacion_id = sede_id AND fecha = '2026-06-02');

    INSERT INTO jornada (ubicacion_id, fecha, hora_inicio, hora_fin)
    SELECT sede_id, '2026-06-03', '09:00', '18:00'
    WHERE NOT EXISTS (SELECT 1 FROM jornada WHERE ubicacion_id = sede_id AND fecha = '2026-06-03');

    INSERT INTO jornada (ubicacion_id, fecha, hora_inicio, hora_fin)
    SELECT sede_id, '2026-06-04', '09:00', '18:00'
    WHERE NOT EXISTS (SELECT 1 FROM jornada WHERE ubicacion_id = sede_id AND fecha = '2026-06-04');

    INSERT INTO jornada (ubicacion_id, fecha, hora_inicio, hora_fin)
    SELECT sede_id, '2026-06-05', '09:00', '18:00'
    WHERE NOT EXISTS (SELECT 1 FROM jornada WHERE ubicacion_id = sede_id AND fecha = '2026-06-05');

    INSERT INTO jornada (ubicacion_id, fecha, hora_inicio, hora_fin)
    SELECT sede_id, '2026-06-06', '09:00', '14:00'
    WHERE NOT EXISTS (SELECT 1 FROM jornada WHERE ubicacion_id = sede_id AND fecha = '2026-06-06');
  END IF;
END $$;

-- Seed empleado_disponibilidad (horario semanal del empleado)
DO $$
DECLARE
  emp_id INTEGER;
  sede_id INTEGER;
  d INTEGER;
  h_ini TIME;
  h_fin TIME;
BEGIN
  SELECT id INTO emp_id FROM app_user WHERE email = 'empleado@sgp.local';
  SELECT id INTO sede_id FROM ubicacion WHERE nombre = 'Sede Centro';

  IF emp_id IS NOT NULL AND sede_id IS NOT NULL THEN
    FOR d IN 1..7 LOOP
      IF d BETWEEN 1 AND 5 THEN
        h_ini := '09:00'; h_fin := '18:00';
      ELSIF d = 6 THEN
        h_ini := '09:00'; h_fin := '14:00';
      ELSE
        h_ini := NULL; h_fin := NULL;
      END IF;

      IF h_ini IS NOT NULL THEN
        INSERT INTO empleado_disponibilidad (empleado_id, ubicacion_id, dia_semana, hora_inicio, hora_fin)
        SELECT emp_id, sede_id, d, h_ini, h_fin
        WHERE NOT EXISTS (
          SELECT 1 FROM empleado_disponibilidad
          WHERE empleado_id = emp_id AND ubicacion_id = sede_id AND dia_semana = d
        );
      END IF;
    END LOOP;
  END IF;
END $$;

-- Seed jornada (julio-agosto 2026, L-V 09-18, S 09-14)
DO $$
DECLARE
  sede_id INTEGER;
  d DATE := '2026-07-01';
  fin DATE := '2026-08-31';
  h_ini TIME;
  h_fin TIME;
  dow INTEGER;
BEGIN
  SELECT id INTO sede_id FROM ubicacion WHERE nombre = 'Sede Centro';

  IF sede_id IS NOT NULL THEN
    WHILE d <= fin LOOP
      dow := EXTRACT(DOW FROM d);
      IF dow = 0 THEN
        NULL; -- Domingo sin jornada
      ELSIF dow = 6 THEN
        h_ini := '09:00'; h_fin := '14:00';
      ELSE
        h_ini := '09:00'; h_fin := '18:00';
      END IF;

      IF h_ini IS NOT NULL THEN
        INSERT INTO jornada (ubicacion_id, fecha, hora_inicio, hora_fin)
        SELECT sede_id, d, h_ini, h_fin
        WHERE NOT EXISTS (SELECT 1 FROM jornada WHERE ubicacion_id = sede_id AND fecha = d);
      END IF;

      d := d + 1;
      h_ini := NULL;
      h_fin := NULL;
    END LOOP;
  END IF;
END $$;

-- Seed empleado_tiempo_servicio (servicios y duraciones del empleado semilla)
INSERT INTO empleado_tiempo_servicio (empleado_id, servicio_id, duracion_minutos)
SELECT u.id, s.id, s.duracion_base_minutos
FROM app_user u
CROSS JOIN servicio_catalogo s
WHERE u.email = 'empleado@sgp.local'
  AND NOT EXISTS (
    SELECT 1 FROM empleado_tiempo_servicio etp
    WHERE etp.empleado_id = u.id AND etp.servicio_id = s.id
  );

-- Backfill: usuarios creados antes del sistema de verificacion quedan verificados
UPDATE app_user SET verificado = TRUE
WHERE verificado IS FALSE AND token_verificacion IS NULL AND token_verificacion_expiracion IS NULL;

-- Backfill de imagenes: la portada anterior pasa a ser la primera imagen de la galeria
INSERT INTO servicio_imagen (servicio_id, imagen_url, orden)
SELECT s.id, s.imagen_url, 1
FROM servicio_catalogo s
WHERE s.imagen_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM servicio_imagen si WHERE si.servicio_id = s.id);

-- Mantiene la portada sincronizada con la primera imagen de la galeria
UPDATE servicio_catalogo s
SET imagen_url = primera.imagen_url
FROM (
  SELECT DISTINCT ON (servicio_id) servicio_id, imagen_url
  FROM servicio_imagen
  ORDER BY servicio_id, orden
) primera
WHERE s.id = primera.servicio_id
  AND s.imagen_url IS DISTINCT FROM primera.imagen_url;
