-- Time-overlap safety: range columns, hold hygiene, ledger checksum, FK corrections
-- Generated via Codex on 2025-11-07

BEGIN;

-- Assignment + hold windows -------------------------------------------------
ALTER TABLE public.booking_table_assignments
  ADD COLUMN IF NOT EXISTS assignment_window tstzrange
  GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED;

ALTER TABLE public.table_hold_windows
  ADD COLUMN IF NOT EXISTS hold_window tstzrange
  GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED;

-- Hold hygiene --------------------------------------------------------------
ALTER TABLE public.table_holds
  ADD CONSTRAINT IF NOT EXISTS th_times_consistent
  CHECK (expires_at >= end_at);

-- Ensure allowed capacity FK matches (restaurant_id, capacity) -------------
ALTER TABLE public.table_inventory
  DROP CONSTRAINT IF EXISTS table_inventory_allowed_capacity_fkey;

ALTER TABLE public.table_inventory
  ADD CONSTRAINT table_inventory_allowed_capacity_fk
  FOREIGN KEY (restaurant_id, capacity)
  REFERENCES public.allowed_capacities (restaurant_id, capacity)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- Idempotency ledger alignment ---------------------------------------------
ALTER TABLE public.booking_assignment_idempotency
  ADD COLUMN IF NOT EXISTS payload_checksum text;

-- Guard type conversions only if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_assignment_idempotency'
      AND column_name = 'table_ids'
      AND udt_name <> '_uuid'
  ) THEN
    EXECUTE 'ALTER TABLE public.booking_assignment_idempotency
      ALTER COLUMN table_ids TYPE uuid[] USING table_ids::uuid[]';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_assignment_idempotency'
      AND column_name = 'assignment_window'
      AND data_type <> 'tstzrange'
  ) THEN
    EXECUTE 'ALTER TABLE public.booking_assignment_idempotency
      ALTER COLUMN assignment_window TYPE tstzrange';
  END IF;
END$$;

COMMIT;
