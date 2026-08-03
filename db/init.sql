CREATE TABLE IF NOT EXISTS ubicacion (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  direccion TEXT NOT NULL,
  latitud DOUBLE PRECISION NOT NULL,
  longitud DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS app_user (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('cliente', 'empleado', 'admin')),
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  telefono VARCHAR(15) CHECK (telefono ~ '^\+57[0-9]{10}$'),
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

CREATE TABLE IF NOT EXISTS empleado_perfil (
  usuario_id INTEGER PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  identificacion VARCHAR(30),
  password_asignada_hash TEXT,
  ubicacion_base_id INTEGER REFERENCES ubicacion(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS servicio_catalogo (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  precio_base DECIMAL(10, 2) NOT NULL,
  duracion_base_minutos INTEGER NOT NULL
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

CREATE TABLE IF NOT EXISTS empleado_disponibilidad (
  id SERIAL PRIMARY KEY,
  empleado_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicacion(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  UNIQUE(empleado_id, ubicacion_id, dia_semana)
);

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
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cobro (
  id SERIAL PRIMARY KEY,
  reserva_id INTEGER UNIQUE NOT NULL REFERENCES reserva(id) ON DELETE CASCADE,
  monto DECIMAL(10, 2) NOT NULL,
  metodo VARCHAR(10) NOT NULL CHECK (metodo IN ('fisico', 'online')),
  cobrado_en TIMESTAMPTZ DEFAULT NOW(),
  registrado_por INTEGER REFERENCES app_user(id)
);

CREATE TABLE IF NOT EXISTS preferencia_usuario (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER UNIQUE NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  rango_hora_desde TIME DEFAULT '06:00',
  rango_hora_hasta TIME DEFAULT '22:00',
  granularidad_calendario INTEGER DEFAULT 30,
  tema VARCHAR(10) DEFAULT 'claro'
);

CREATE INDEX IF NOT EXISTS idx_reserva_inicia_en ON reserva(inicia_en);
CREATE INDEX IF NOT EXISTS idx_reserva_cliente_id ON reserva(cliente_id);
CREATE INDEX IF NOT EXISTS idx_reserva_empleado_id ON reserva(empleado_id);
CREATE INDEX IF NOT EXISTS idx_reserva_estado ON reserva(estado);
CREATE INDEX IF NOT EXISTS idx_reserva_ubicacion_id ON reserva(ubicacion_id);
CREATE INDEX IF NOT EXISTS idx_cobro_cobrado_en ON cobro(cobrado_en);
CREATE INDEX IF NOT EXISTS idx_app_user_rol_bloqueado ON app_user(rol, esta_bloqueado);

-- Seed data

INSERT INTO ubicacion (nombre, direccion, latitud, longitud)
SELECT 'Sede Centro', 'Calle 123 #45-67, Bogota', 4.60971, -74.08175
WHERE NOT EXISTS (SELECT 1 FROM ubicacion WHERE nombre = 'Sede Centro');

INSERT INTO servicio_catalogo (nombre, descripcion, precio_base, duracion_base_minutos)
SELECT 'Corte clasico', 'Corte de cabello clasico', 25000.00, 30
WHERE NOT EXISTS (SELECT 1 FROM servicio_catalogo WHERE nombre = 'Corte clasico');

INSERT INTO servicio_catalogo (nombre, descripcion, precio_base, duracion_base_minutos)
SELECT 'Barba', 'Arreglo de barba', 15000.00, 20
WHERE NOT EXISTS (SELECT 1 FROM servicio_catalogo WHERE nombre = 'Barba');

INSERT INTO servicio_catalogo (nombre, descripcion, precio_base, duracion_base_minutos)
SELECT 'Tinte', 'Tinte de cabello', 60000.00, 90
WHERE NOT EXISTS (SELECT 1 FROM servicio_catalogo WHERE nombre = 'Tinte');

INSERT INTO servicio_catalogo (nombre, descripcion, precio_base, duracion_base_minutos)
SELECT 'Corte + Barba', 'Combo corte y barba', 35000.00, 45
WHERE NOT EXISTS (SELECT 1 FROM servicio_catalogo WHERE nombre = 'Corte + Barba');

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

-- Backfill: usuarios creados antes del sistema de verificacion quedan verificados
UPDATE app_user SET verificado = TRUE
WHERE verificado IS FALSE AND token_verificacion IS NULL AND token_verificacion_expiracion IS NULL;
