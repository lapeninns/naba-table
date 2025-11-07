-- Time-overlap safety: GiST indexes, exclusion constraints, hot-path indexes
-- NOTE: no transaction (CREATE INDEX CONCURRENTLY)

-- Booking assignment GiST indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS bta_window_gist
  ON public.booking_table_assignments
  USING GIST (assignment_window);

CREATE INDEX CONCURRENTLY IF NOT EXISTS bta_table_window_gist
  ON public.booking_table_assignments
  USING GIST (table_id, assignment_window);

-- Table hold GiST indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS thw_window_gist
  ON public.table_hold_windows
  USING GIST (hold_window);

CREATE INDEX CONCURRENTLY IF NOT EXISTS thw_table_window_gist
  ON public.table_hold_windows
  USING GIST (table_id, hold_window);

-- Booking assignment exclusion constraint
ALTER TABLE public.booking_table_assignments
  DROP CONSTRAINT IF EXISTS bta_no_overlap;

ALTER TABLE public.booking_table_assignments
  ADD CONSTRAINT bta_no_overlap
  EXCLUDE USING GIST (table_id WITH =, assignment_window WITH &&)
  WHERE (table_id IS NOT NULL)
  NOT VALID;

-- Hold exclusion constraint (replace legacy one for NOT VALID semantics)
ALTER TABLE public.table_hold_windows
  DROP CONSTRAINT IF EXISTS table_hold_windows_no_overlap;

ALTER TABLE public.table_hold_windows
  DROP CONSTRAINT IF EXISTS thw_no_overlap;

ALTER TABLE public.table_hold_windows
  ADD CONSTRAINT thw_no_overlap
  EXCLUDE USING GIST (table_id WITH =, hold_window WITH &&)
  NOT VALID;

-- Hold member uniqueness (support concurrent enforcement)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS thm_unique
  ON public.table_hold_members (hold_id, table_id);

-- Ledger lookup hot-path
CREATE INDEX CONCURRENTLY IF NOT EXISTS bai_rest_bk_idx
  ON public.booking_assignment_idempotency (booking_id, idempotency_key);

-- Assignment FK helpers
CREATE INDEX CONCURRENTLY IF NOT EXISTS bta_booking_id_idx
  ON public.booking_table_assignments (booking_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS bta_table_id_idx
  ON public.booking_table_assignments (table_id);

-- Booking + hold timeline indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS bookings_restaurant_date_idx
  ON public.bookings (restaurant_id, booking_date, start_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS table_holds_restaurant_idx
  ON public.table_holds (restaurant_id, start_at, end_at, expires_at);
