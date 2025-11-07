-- 003_index_triggers.sql
-- Performance indexes and updated_at trigger wiring.
-- Assumes 001_blockers.sql and 002_integrity.sql have run.

BEGIN;

-- Trigger function to maintain updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- Helper DO block to attach trigger to any table that has updated_at and not yet wired
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'updated_at'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = format('%I.%I', r.schema_name, r.table_name)::regclass
        AND tgname = format('%s_set_updated_at', r.table_name)
        AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
        r.table_name, r.schema_name, r.table_name
      );
    END IF;
  END LOOP;
END$$;

-- Index all FK columns that are missing an index (pragmatic subset for hot paths)
-- Bookings
CREATE INDEX IF NOT EXISTS bookings_restaurant_id_idx ON public.bookings(restaurant_id);
CREATE INDEX IF NOT EXISTS bookings_customer_id_idx ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS bookings_booking_date_start_time_idx ON public.bookings(restaurant_id, booking_date, start_time);

-- Booking table assignments
CREATE INDEX IF NOT EXISTS booking_table_assignments_booking_id_idx ON public.booking_table_assignments(booking_id);
CREATE INDEX IF NOT EXISTS booking_table_assignments_table_id_idx ON public.booking_table_assignments(table_id);
CREATE INDEX IF NOT EXISTS booking_table_assignments_slot_id_idx ON public.booking_table_assignments(slot_id);

-- Allocations
CREATE INDEX IF NOT EXISTS allocations_booking_id_idx ON public.allocations(booking_id);
CREATE INDEX IF NOT EXISTS allocations_restaurant_id_idx ON public.allocations(restaurant_id);
CREATE INDEX IF NOT EXISTS allocations_resource_idx ON public.allocations(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS allocations_window_gist_idx ON public.allocations USING gist("window");

-- Table holds / windows
CREATE INDEX IF NOT EXISTS table_holds_restaurant_id_idx ON public.table_holds(restaurant_id);
CREATE INDEX IF NOT EXISTS table_hold_windows_table_id_idx ON public.table_hold_windows(table_id);
CREATE INDEX IF NOT EXISTS table_hold_windows_window_gist_idx ON public.table_hold_windows USING gist(hold_window);

-- Booking slots availability partial index
CREATE INDEX IF NOT EXISTS booking_slots_available_idx
  ON public.booking_slots (restaurant_id, slot_date, slot_time)
  WHERE available_capacity > 0;

-- Events / outbox-style tables (if present)
DO $$
BEGIN
  IF to_regclass('public.observability_events') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS observability_events_restaurant_occurred_idx
      ON public.observability_events(restaurant_id, occurred_at DESC);
  END IF;

  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS analytics_events_restaurant_occurred_idx
      ON public.analytics_events(restaurant_id, occurred_at DESC);
  END IF;

  IF to_regclass('public.outbox') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS outbox_status_next_attempt_idx
      ON public.outbox(status, next_attempt_at)
      WHERE status IN ('pending', 'retry');
  END IF;
END$$;

COMMIT;
