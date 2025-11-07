-- rollback_001_003.sql
-- Best-effort rollback for changes introduced by 001_blockers.sql, 002_integrity.sql, 003_index_triggers.sql.
-- Only drops additive constraints/indexes/triggers; does NOT recreate legacy behavior.

BEGIN;

-- Drop composite FK on table_inventory
ALTER TABLE IF EXISTS public.table_inventory
  DROP CONSTRAINT IF EXISTS table_inventory_allowed_capacity_fkey;

-- Drop integrity constraints
ALTER TABLE IF EXISTS public.allocations
  DROP CONSTRAINT IF EXISTS allocations_no_overlap;

ALTER TABLE IF EXISTS public.table_hold_windows
  DROP CONSTRAINT IF EXISTS table_hold_windows_no_overlap;

ALTER TABLE IF EXISTS public.table_holds
  DROP CONSTRAINT IF EXISTS table_holds_time_order_check;

ALTER TABLE IF EXISTS public.table_inventory
  DROP CONSTRAINT IF EXISTS table_inventory_restaurant_table_number_key;

ALTER TABLE IF EXISTS public.zones
  DROP CONSTRAINT IF EXISTS zones_restaurant_name_key;

-- Drop table_adjacencies canonical unique index
DROP INDEX IF EXISTS public.table_adjacencies_canonical_unique;

-- Drop updated_at triggers created by 003
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tgname, tgrelid::regclass AS tbl
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname LIKE '%_set_updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s;', r.tgname, r.tbl);
  END LOOP;
END$$;

-- Drop helper indexes (safe if they don't exist)
DROP INDEX IF EXISTS public.bookings_restaurant_id_idx;
DROP INDEX IF EXISTS public.bookings_customer_id_idx;
DROP INDEX IF EXISTS public.bookings_booking_date_start_time_idx;

DROP INDEX IF EXISTS public.booking_table_assignments_booking_id_idx;
DROP INDEX IF EXISTS public.booking_table_assignments_table_id_idx;
DROP INDEX IF EXISTS public.booking_table_assignments_slot_id_idx;

DROP INDEX IF EXISTS public.allocations_booking_id_idx;
DROP INDEX IF EXISTS public.allocations_restaurant_id_idx;
DROP INDEX IF EXISTS public.allocations_resource_idx;
DROP INDEX IF EXISTS public.allocations_window_gist_idx;

DROP INDEX IF EXISTS public.table_holds_restaurant_id_idx;
DROP INDEX IF EXISTS public.table_hold_windows_table_id_idx;
DROP INDEX IF EXISTS public.table_hold_windows_window_gist_idx;

DROP INDEX IF EXISTS public.booking_slots_available_idx;
DROP INDEX IF EXISTS public.observability_events_restaurant_occurred_idx;
DROP INDEX IF EXISTS public.analytics_events_restaurant_occurred_idx;
DROP INDEX IF EXISTS public.outbox_status_next_attempt_idx;

COMMIT;
