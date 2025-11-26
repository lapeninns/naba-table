-- Pre-migration check for bar drinks-only enforcement trigger
-- Run with: psql "$SUPABASE_DB_URL" -f tasks/reset-floorplan-20251125-2354/artifacts/pre-migration-check.sql

\pset format aligned
\pset tuples_only off
\set footer off

WITH bar_tables AS (
  SELECT id FROM public.table_inventory WHERE category::text = 'bar' OR id IN (
    SELECT t.id FROM public.table_inventory t JOIN public.zones z ON z.id = t.zone_id WHERE z.name ILIKE 'bar%'
  )
),
 violating AS (
  SELECT bta.id AS assignment_id, bta.booking_id, bta.table_id, b.booking_type
  FROM public.booking_table_assignments bta
  JOIN public.bookings b ON b.id = bta.booking_id
  WHERE bta.table_id IN (SELECT id FROM bar_tables)
    AND b.booking_type <> 'drinks'
)
SELECT 'violation' AS section, * FROM violating ORDER BY booking_id LIMIT 100;

-- Count how many violations exist
SELECT 'counts' AS section, COUNT(*) FROM violating;
