-- Sprint 2: Performance indices & query narrowing support
-- Safe, idempotent indexes to improve context and conflict queries

-- Bookings: support context narrowing by date/time
CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_date_start
  ON public.bookings (restaurant_id, booking_date, start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_date_end
  ON public.bookings (restaurant_id, booking_date, end_at);

-- Booking table assignments: overlap checks by booking window
CREATE INDEX IF NOT EXISTS idx_bta_booking_start
  ON public.booking_table_assignments (booking_id, start_at);
CREATE INDEX IF NOT EXISTS idx_bta_booking_end
  ON public.booking_table_assignments (booking_id, end_at);

-- Table holds: conflict and sweep queries
CREATE INDEX IF NOT EXISTS idx_table_holds_restaurant_start
  ON public.table_holds (restaurant_id, start_at);
CREATE INDEX IF NOT EXISTS idx_table_holds_restaurant_end
  ON public.table_holds (restaurant_id, end_at);
CREATE INDEX IF NOT EXISTS idx_table_holds_restaurant_expires
  ON public.table_holds (restaurant_id, expires_at);

-- Table hold members: membership lookups
CREATE INDEX IF NOT EXISTS idx_table_hold_members_table
  ON public.table_hold_members (table_id);
CREATE INDEX IF NOT EXISTS idx_table_hold_members_hold
  ON public.table_hold_members (hold_id);

-- Allocations: range lookups by restaurant
CREATE INDEX IF NOT EXISTS idx_allocations_restaurant
  ON public.allocations (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_allocations_window_gist
  ON public.allocations USING gist ("window");

