-- Backfill: Mirror future booking assignments into public.allocations (shadow mode)
-- Usage:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/utilities/backfill_allocations.sql
--
-- The script is idempotent: allocations are upserted on (booking_id, resource_type, resource_id).

WITH future_assignments AS (
  SELECT 
    bta.booking_id,
    bta.table_id,
    bta.merge_group_id,
    b.restaurant_id,
    b.start_at,
    b.end_at
  FROM public.booking_table_assignments bta
  JOIN public.bookings b ON b.id = bta.booking_id
  WHERE b.start_at IS NOT NULL
    AND b.end_at IS NOT NULL
    AND b.start_at >= now()
),
upsert_tables AS (
  INSERT INTO public.allocations (
    booking_id,
    restaurant_id,
    resource_type,
    resource_id,
    window,
    created_by,
    shadow,
    created_at,
    updated_at
  )
  SELECT 
    fa.booking_id,
    fa.restaurant_id,
    'table'::text,
    fa.table_id,
    tstzrange(fa.start_at, fa.end_at, '[)'),
    NULL,
    true,
    now(),
    now()
  FROM future_assignments fa
  ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
  SET window = EXCLUDED.window,
      shadow = true,
      updated_at = now()
  RETURNING 1
)
SELECT COALESCE(SUM(1), 0) AS tables_backfilled FROM upsert_tables;
