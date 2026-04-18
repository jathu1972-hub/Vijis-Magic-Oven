CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('CUSTOMER', 'OWNER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE order_status AS ENUM ('PLACED', 'PREPARING', 'READY', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(80)  NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  TEXT         NOT NULL,
  role           user_role    NOT NULL DEFAULT 'CUSTOMER',
  failed_logins  INTEGER      NOT NULL DEFAULT 0,
  locked_until   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Enforce a maximum of one OWNER row in the entire table
CREATE UNIQUE INDEX IF NOT EXISTS users_single_owner_idx
  ON users (role) WHERE role = 'OWNER';

CREATE TABLE IF NOT EXISTS cakes (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(120)  NOT NULL,
  image_url    TEXT          NOT NULL,
  image_public_id TEXT,
  price        NUMERIC(10,2) NOT NULL CHECK (price > 0),
  description  TEXT          NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           order_status  NOT NULL DEFAULT 'PLACED',
  delivery_address TEXT          NOT NULL,
  notes            TEXT,
  total            NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  cake_id    UUID          REFERENCES cakes(id) ON DELETE SET NULL,
  cake_name  VARCHAR(120)  NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price > 0),
  quantity   INTEGER       NOT NULL CHECK (quantity > 0)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON orders (customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_cakes_created_at
  ON cakes (created_at DESC);
