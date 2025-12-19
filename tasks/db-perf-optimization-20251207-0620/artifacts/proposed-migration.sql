-- Safe, additive DB performance improvements (staging first, then prod).
-- Run with psql or `supabase db push` (ensure DB_TARGET_ENV=staging). All CREATE INDEX use CONCURRENTLY.

-- 1) Bookings: active-window covering index to speed list/availability queries.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_active_window
  ON public.bookings USING btree (restaurant_id, booking_date, start_time, end_time)
  INCLUDE (status, party_size, seating_preference)
  WHERE status IN ('pending','pending_allocation','confirmed','checked_in');

-- 2) Booking table assignments: composite index for per-table window lookups.
CREATE INDEX CONCURRENTLY IF NOT EXISTS booking_table_assignments_table_window_idx
  ON public.booking_table_assignments USING btree (table_id, start_at, end_at, booking_id);

-- 3) De-duplicate redundant indexes to reduce write overhead/bloat.
DROP INDEX CONCURRENTLY IF EXISTS idx_allocations_window_gist;          -- duplicate of allocations_window_gist_idx
DROP INDEX CONCURRENTLY IF EXISTS idx_allocations_restaurant;           -- duplicate of allocations_restaurant_id_idx
DROP INDEX CONCURRENTLY IF EXISTS bookings_customer_id_idx;             -- duplicate of idx_bookings_customer

-- 4) (Optional, if table grows large) BRIN on bookings.booking_date for coarse pruning of archival rows.
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS bookings_booking_date_brin
--   ON public.bookings USING brin (booking_date) WITH (pages_per_range = 64);

-- After applying, regenerate types:
--   supabase gen types typescript --project-id mqtchcaavsucsdjskptc --schema public > types/supabase.ts
