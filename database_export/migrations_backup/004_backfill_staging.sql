-- 004_backfill_staging.sql
-- Backfill and cleanup to align existing data with new constraints.
-- Safe to run on staging snapshot; designed to be idempotent.

BEGIN;
-- email_normalized and phone_normalized are generated columns, so they're
-- automatically computed and don't need manual backfill

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
