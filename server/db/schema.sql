CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document text,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  sku text,
  barcode text,
  name text NOT NULL,
  category text,
  unit text NOT NULL DEFAULT 'UN',
  cost numeric(14,2) NOT NULL DEFAULT 0,
  sale_price numeric(14,2) NOT NULL DEFAULT 0,
  stock_qty numeric(14,3) NOT NULL DEFAULT 0,
  min_stock numeric(14,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  product_uuid uuid NOT NULL,
  type text NOT NULL,
  quantity numeric(14,3) NOT NULL,
  previous_qty numeric(14,3) NOT NULL,
  resulting_qty numeric(14,3) NOT NULL,
  reference_type text,
  reference_uuid uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  number bigint NOT NULL,
  customer_uuid uuid,
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric(14,2) NOT NULL,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  surcharge numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL,
  payment_method text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid
);

CREATE TABLE cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL,
  amount numeric(14,2) NOT NULL,
  payment_method text,
  reference_uuid uuid,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  number bigint NOT NULL,
  customer_uuid uuid NOT NULL,
  equipment text NOT NULL,
  brand text,
  model text,
  reported_issue text NOT NULL,
  diagnosis text,
  status text NOT NULL DEFAULT 'Entrada',
  technician text,
  expected_delivery text,
  labor numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]',
  warranty_days integer NOT NULL DEFAULT 90,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid
);

CREATE TABLE financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  due_date text NOT NULL,
  paid_date text,
  payment_method text,
  customer_uuid uuid,
  supplier_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid
);

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid
);

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  number bigint NOT NULL,
  supplier_uuid uuid NOT NULL,
  supplier_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  items jsonb NOT NULL DEFAULT '[]',
  total numeric(14,2) NOT NULL DEFAULT 0,
  expected_delivery text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_uuid uuid NOT NULL,
  action text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
