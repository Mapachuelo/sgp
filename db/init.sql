CREATE TABLE IF NOT EXISTS app_user (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  phone VARCHAR(40) NOT NULL CHECK (phone ~ '^\+57[0-9]{10}$'),
  role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'empleado', 'admin')),
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservation (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  service_name VARCHAR(120) NOT NULL,
  stylist_name VARCHAR(120) NOT NULL,
  stylist_id INT REFERENCES app_user(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  client_count INT NOT NULL CHECK (client_count > 0),
  qr_token UUID NOT NULL UNIQUE,
  qr_data_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('booked', 'checked_in', 'cancelled')) DEFAULT 'booked',
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment (
  id SERIAL PRIMARY KEY,
  reservation_id INT NOT NULL UNIQUE REFERENCES reservation(id) ON DELETE CASCADE,
  stylist_id INT NOT NULL REFERENCES app_user(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('manual_cash')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_catalog (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  created_by INT REFERENCES app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_service_time (
  employee_id INT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  service_id INT NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  updated_by INT REFERENCES app_user(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (employee_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_reservation_starts_at ON reservation(starts_at);
CREATE INDEX IF NOT EXISTS idx_reservation_client_id ON reservation(client_id);
CREATE INDEX IF NOT EXISTS idx_reservation_stylist_id ON reservation(stylist_id);
CREATE INDEX IF NOT EXISTS idx_payment_paid_at ON payment(paid_at);

INSERT INTO app_user (name, email, phone, role, password_hash)
VALUES
  ('Administrador', 'admin@sgp.local', '+573000000001', 'admin', '$2a$10$AQkDm1Ckoru4XwnucC1tN.COeCHnLKf7BTImcDDxKK4yQ/c8CKY1O'),
  ('Empleado', 'empleado@sgp.local', '+573000000002', 'empleado', '$2a$10$5/.076IhfYTj6r2IJJ/yHOKgLgrIeZOE/lVvkr1YyUBDSz5pbfwj2')
ON CONFLICT (email) DO NOTHING;
