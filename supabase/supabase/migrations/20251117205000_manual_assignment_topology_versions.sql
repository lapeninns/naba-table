-- Expand manual assignment session versioning and add helpful indexes

BEGIN;

ALTER TABLE public.manual_assignment_sessions
  ADD COLUMN IF NOT EXISTS table_version text,
  ADD COLUMN IF NOT EXISTS adjacency_version text,
  ADD COLUMN IF NOT EXISTS flags_version text,
  ADD COLUMN IF NOT EXISTS window_version text,
  ADD COLUMN IF NOT EXISTS holds_version text,
  ADD COLUMN IF NOT EXISTS assignments_version text;

CREATE INDEX IF NOT EXISTS mas_active_state_idx
  ON public.manual_assignment_sessions (state)
  WHERE state IN ('none', 'proposed', 'held', 'conflicted');

CREATE INDEX IF NOT EXISTS table_holds_active_booking_idx
  ON public.table_holds (booking_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS table_holds_active_restaurant_idx
  ON public.table_holds (restaurant_id, start_at, end_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS table_hold_members_table_active_idx
  ON public.table_hold_members (table_id);

COMMIT;
