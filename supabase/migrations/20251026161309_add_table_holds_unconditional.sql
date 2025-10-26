-- Create table_holds and table_hold_members unconditionally
-- This migration ensures these tables exist on the remote database

CREATE TABLE IF NOT EXISTS public.table_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  zone_id uuid NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  metadata jsonb,
  CONSTRAINT table_holds_window_check CHECK (start_at < end_at)
);

COMMENT ON TABLE public.table_holds IS
  'Ephemeral table reservations to guard allocations during quoting/confirmation flows.';

CREATE INDEX IF NOT EXISTS table_holds_expires_at_idx
  ON public.table_holds (expires_at);

CREATE INDEX IF NOT EXISTS table_holds_zone_start_idx
  ON public.table_holds (zone_id, start_at);

CREATE INDEX IF NOT EXISTS table_holds_booking_idx
  ON public.table_holds (booking_id);

-- Create table_hold_members
CREATE TABLE IF NOT EXISTS public.table_hold_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id uuid NOT NULL REFERENCES public.table_holds(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.table_inventory(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (hold_id, table_id)
);

CREATE INDEX IF NOT EXISTS table_hold_members_table_idx
  ON public.table_hold_members (table_id);
