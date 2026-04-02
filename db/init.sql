CREATE TABLE IF NOT EXISTS app_user (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  phone VARCHAR(40) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'employee', 'admin')),
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservation (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  service_name VARCHAR(120) NOT NULL,
  stylist_name VARCHAR(120) NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_reservation_starts_at ON reservation(starts_at);
CREATE INDEX IF NOT EXISTS idx_reservation_client_id ON reservation(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_paid_at ON payment(paid_at);

INSERT INTO app_user (name, email, phone, role, password_hash)
VALUES
  ('Administrador', 'admin@sgp.local', '000000000', 'admin', '$2a$10$AQkDm1Ckoru4XwnucC1tN.COeCHnLKf7BTImcDDxKK4yQ/c8CKY1O'),
  ('Empleado', 'empleado@sgp.local', '111111111', 'employee', '$2a$10$5/.076IhfYTj6r2IJJ/yHOKgLgrIeZOE/lVvkr1YyUBDSz5pbfwj2')
ON CONFLICT (email) DO NOTHING;
