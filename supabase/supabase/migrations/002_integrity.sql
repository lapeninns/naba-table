-- 002_integrity.sql
-- Integrity constraints: exclusions, ordering checks, uniqueness, graph hygiene.
-- Assumes 001_blockers.sql has run.

BEGIN;
-- Prevent overlapping allocations for non-shadow records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'allocations_no_overlap'
      AND conrelid = 'public.allocations'::regclass
  ) THEN
    ALTER TABLE public.allocations
      ADD CONSTRAINT allocations_no_overlap
      EXCLUDE USING gist (
        resource_type WITH =,
        resource_id  WITH =,
        "window"     WITH &&
      )
      WHERE (NOT shadow)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END$$;
-- Prevent overlapping table hold windows per table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'table_hold_windows_no_overlap'
      AND conrelid = 'public.table_hold_windows'::regclass
  ) THEN
    ALTER TABLE public.table_hold_windows
      ADD CONSTRAINT table_hold_windows_no_overlap
      EXCLUDE USING gist (
        table_id    WITH =,
        hold_window WITH &&
      );
  END IF;
END$$;
-- Time ordering checks (idempotent add-if-missing pattern)
-- Example: table_holds (already has some checks; ensure present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'table_holds_time_order_check'
      AND conrelid = 'public.table_holds'::regclass
  ) THEN
    ALTER TABLE public.table_holds
      ADD CONSTRAINT table_holds_time_order_check
      CHECK (start_at < end_at AND expires_at >= end_at);
  END IF;
END$$;
-- Uniqueness: table_inventory (restaurant_id, lower(table_number))
CREATE UNIQUE INDEX IF NOT EXISTS table_inventory_restaurant_table_number_key
  ON public.table_inventory (restaurant_id, lower(table_number));
-- Uniqueness: zones (restaurant_id, lower(name))
CREATE UNIQUE INDEX IF NOT EXISTS zones_restaurant_name_key
  ON public.zones (restaurant_id, lower(name));
-- Customers: normalized email/phone uniqueness (columns may already exist from prior migrations)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers'
      AND column_name = 'email_normalized'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS customers_email_normalized_uniq
      ON public.customers (restaurant_id, email_normalized)
      WHERE email_normalized IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers'
      AND column_name = 'phone_normalized'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_normalized_uniq
      ON public.customers (restaurant_id, phone_normalized)
      WHERE phone_normalized IS NOT NULL;
  END IF;
END$$;
-- table_adjacencies as undirected graph: canonical ordering + uniqueness
-- Backfill handled in 004; here we just enforce canonical uniqueness on (LEAST, GREATEST)
CREATE UNIQUE INDEX IF NOT EXISTS table_adjacencies_canonical_unique
  ON public.table_adjacencies (
    LEAST(table_a, table_b),
    GREATEST(table_a, table_b)
  );
COMMIT;
