-- 004_backfill_staging.sql
-- Backfill and cleanup to align existing data with new constraints.
-- Safe to run on staging snapshot; designed to be idempotent.

BEGIN;

-- Normalize customer emails
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers'
      AND column_name = 'email' AND
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customers'
          AND column_name = 'email_normalized'
      )
  ) THEN
    UPDATE public.customers
    SET email_normalized = lower(trim(email))
    WHERE email IS NOT NULL
      AND (email_normalized IS NULL OR email_normalized <> lower(trim(email)));
  END IF;
END$$;

-- Normalize customer phones (very conservative E.164-lite)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers'
      AND column_name = 'phone' AND
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customers'
          AND column_name = 'phone_normalized'
      )
  ) THEN
    UPDATE public.customers
    SET phone_normalized = regexp_replace(phone, '[^0-9]+', '', 'g')
    WHERE phone IS NOT NULL
      AND (phone_normalized IS NULL OR phone_normalized <> regexp_replace(phone, '[^0-9]+', '', 'g'));
  END IF;
END$$;

-- Ensure allowed_capacities covers all table_inventory capacities
INSERT INTO public.allowed_capacities (restaurant_id, capacity, created_at, updated_at)
SELECT DISTINCT ti.restaurant_id, ti.capacity, now(), now()
FROM public.table_inventory ti
LEFT JOIN public.allowed_capacities ac
  ON ac.restaurant_id = ti.restaurant_id
 AND ac.capacity = ti.capacity
WHERE ac.restaurant_id IS NULL;

-- Canonicalize table_adjacencies: enforce table_a < table_b and remove duplicates
WITH normalized AS (
  SELECT DISTINCT
    LEAST(table_a, table_b) AS a,
    GREATEST(table_a, table_b) AS b
  FROM public.table_adjacencies
)
DELETE FROM public.table_adjacencies ta
USING public.table_adjacencies tb
WHERE ta.ctid < tb.ctid
  AND LEAST(ta.table_a, ta.table_b) = LEAST(tb.table_a, tb.table_b)
  AND GREATEST(ta.table_a, ta.table_b) = GREATEST(tb.table_a, tb.table_b);

UPDATE public.table_adjacencies
SET table_a = LEAST(table_a, table_b),
    table_b = GREATEST(table_a, table_b);

-- Backfill updated_at where missing
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_attribute a1 ON a1.attrelid = c.oid AND a1.attname = 'created_at'
    JOIN pg_attribute a2 ON a2.attrelid = c.oid AND a2.attname = 'updated_at'
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET updated_at = created_at WHERE updated_at IS NULL;',
      r.schema_name, r.table_name
    );
  END LOOP;
END$$;

COMMIT;
