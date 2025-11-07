-- 001_blockers.sql
-- DDL blockers cleanup: extensions, UUID/timestamp defaults, booking_assignment_idempotency, composite FK.
-- Idempotent and safe to run multiple times.

BEGIN;

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

-- Standardize UUID defaults from uuid_generate_v4() to gen_random_uuid()
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           c.relname AS table_name,
           a.attname AS column_name,
           pg_get_expr(d.adbin, d.adrelid) AS default_expr
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE n.nspname = 'public'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND pg_get_expr(d.adbin, d.adrelid) LIKE '%uuid_generate_v4%'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT gen_random_uuid();',
                   r.schema_name, r.table_name, r.column_name);
  END LOOP;
END$$;

-- Normalize timestamptz defaults: timezone('utc', now()) -> now()
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           c.relname AS table_name,
           a.attname AS column_name,
           pg_get_expr(d.adbin, d.adrelid) AS default_expr,
           t.typname
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    JOIN pg_type t ON a.atttypid = t.oid
    WHERE n.nspname = 'public'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND t.typname = 'timestamptz'
      AND pg_get_expr(d.adbin, d.adrelid) LIKE '%timezone(''utc'', now())%'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT now();',
                   r.schema_name, r.table_name, r.column_name);
  END LOOP;
END$$;

-- booking_assignment_idempotency.table_ids -> uuid[] with safe cast
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_assignment_idempotency'
      AND column_name = 'table_ids'
      AND data_type <> 'ARRAY'
  ) THEN
    ALTER TABLE public.booking_assignment_idempotency
      ALTER COLUMN table_ids TYPE uuid[] USING table_ids::uuid[];
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_assignment_idempotency'
      AND column_name = 'table_ids'
  ) THEN
    ALTER TABLE public.booking_assignment_idempotency
      ALTER COLUMN table_ids SET DEFAULT '{}'::uuid[];
  END IF;
END$$;

-- Composite FK: table_inventory(restaurant_id, capacity) -> allowed_capacities(restaurant_id, capacity)
-- Drop any legacy/broken FKs that touch allowed_capacities on table_inventory
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.table_inventory'::regclass
      AND confrelid = 'public.allowed_capacities'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.table_inventory DROP CONSTRAINT IF EXISTS %I;', r.conname);
  END LOOP;
END$$;

-- Ensure allowed_capacities PK exists (composite)
ALTER TABLE public.allowed_capacities
  ADD CONSTRAINT IF NOT EXISTS allowed_capacities_pkey
  PRIMARY KEY (restaurant_id, capacity);

-- Add composite FK (NOT VALID; to be validated after backfill)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'table_inventory_allowed_capacity_fkey'
      AND conrelid = 'public.table_inventory'::regclass
  ) THEN
    ALTER TABLE public.table_inventory
      ADD CONSTRAINT table_inventory_allowed_capacity_fkey
      FOREIGN KEY (restaurant_id, capacity)
      REFERENCES public.allowed_capacities(restaurant_id, capacity)
      NOT VALID;
  END IF;
END$$;

COMMIT;
