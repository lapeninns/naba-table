-- Time-overlap safety: GiST indexes, exclusion constraints, hot-path indexes
-- NOTE: CONCURRENTLY removed due to supabase db push pipeline execution

-- Booking assignment GiST indexes
CREATE INDEX IF NOT EXISTS bta_window_gist
  ON public.booking_table_assignments
  USING GIST (assignment_window);
CREATE INDEX IF NOT EXISTS bta_table_window_gist
  ON public.booking_table_assignments
  USING GIST (table_id, assignment_window);
-- Table hold GiST indexes
CREATE INDEX IF NOT EXISTS thw_window_gist
  ON public.table_hold_windows
  USING GIST (hold_window);
CREATE INDEX IF NOT EXISTS thw_table_window_gist
  ON public.table_hold_windows
  USING GIST (table_id, hold_window);
-- Booking assignment exclusion constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bta_no_overlap'
      AND conrelid = 'public.booking_table_assignments'::regclass
  ) THEN
    ALTER TABLE public.booking_table_assignments
      ADD CONSTRAINT bta_no_overlap
      EXCLUDE USING GIST (table_id WITH =, assignment_window WITH &&)
      WHERE (table_id IS NOT NULL);
  END IF;
END$$;
-- Hold exclusion constraint (replace legacy one)
DO $$
BEGIN
  ALTER TABLE public.table_hold_windows
    DROP CONSTRAINT IF EXISTS table_hold_windows_no_overlap;

  ALTER TABLE public.table_hold_windows
    DROP CONSTRAINT IF EXISTS thw_no_overlap;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'thw_no_overlap'
      AND conrelid = 'public.table_hold_windows'::regclass
  ) THEN
    ALTER TABLE public.table_hold_windows
      ADD CONSTRAINT thw_no_overlap
      EXCLUDE USING GIST (table_id WITH =, hold_window WITH &&);
  END IF;
END$$;
-- Hold member uniqueness (support concurrent enforcement)
CREATE UNIQUE INDEX IF NOT EXISTS thm_unique
  ON public.table_hold_members (hold_id, table_id);
-- Ledger lookup hot-path
CREATE INDEX IF NOT EXISTS bai_rest_bk_idx
  ON public.booking_assignment_idempotency (booking_id, idempotency_key);
-- Assignment FK helpers
CREATE INDEX IF NOT EXISTS bta_booking_id_idx
  ON public.booking_table_assignments (booking_id);
CREATE INDEX IF NOT EXISTS bta_table_id_idx
  ON public.booking_table_assignments (table_id);
-- Booking + hold timeline indexes
CREATE INDEX IF NOT EXISTS bookings_restaurant_date_idx
  ON public.bookings (restaurant_id, booking_date, start_at);
CREATE INDEX IF NOT EXISTS table_holds_restaurant_idx
  ON public.table_holds (restaurant_id, start_at, end_at, expires_at);
