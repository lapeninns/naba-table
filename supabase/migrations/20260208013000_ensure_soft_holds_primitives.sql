-- Migration: Ensure soft-hold primitives exist (baseline-safe)
-- Description:
--   Some environments may have had migration history "repaired"/baselined without
--   executing older migrations. This migration re-asserts the soft-hold table,
--   RPCs, grants, and RLS policies in an idempotent way so application code and
--   generated Supabase types remain consistent.
--
-- Safety:
--   - Uses CREATE IF NOT EXISTS / CREATE OR REPLACE where possible.
--   - Wraps CREATE POLICY / ADD CONSTRAINT in DO blocks to avoid duplicate errors.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =============================================================================
-- TABLE: table_soft_holds
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.table_soft_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.table_inventory(id) ON DELETE CASCADE,
  hold_window tstzrange NOT NULL,
  session_token uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Ensure the exclusion constraint exists (no overlapping windows per table).
-- Note: this cannot be partial on "expires_at > now()" because predicates must be IMMUTABLE.
ALTER TABLE public.table_soft_holds
  DROP CONSTRAINT IF EXISTS table_soft_holds_no_overlap;
ALTER TABLE public.table_soft_holds
  ADD CONSTRAINT table_soft_holds_no_overlap
    EXCLUDE USING gist (table_id WITH =, hold_window WITH &&);

CREATE INDEX IF NOT EXISTS table_soft_holds_expires_idx
  ON public.table_soft_holds (expires_at);

CREATE INDEX IF NOT EXISTS table_soft_holds_session_idx
  ON public.table_soft_holds (session_token);

CREATE INDEX IF NOT EXISTS table_soft_holds_restaurant_idx
  ON public.table_soft_holds (restaurant_id, expires_at);

CREATE INDEX IF NOT EXISTS table_soft_holds_booking_idx
  ON public.table_soft_holds (booking_id)
  WHERE booking_id IS NOT NULL;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================
-- Functions and grants are applied in follow-up migrations to keep each file
-- free of multi-statement parsing edge-cases in remote migration execution.

-- =============================================================================
-- GRANTS + RLS
-- =============================================================================

-- Lock down direct table access; RPCs remain SECURITY DEFINER.
REVOKE ALL ON TABLE public.table_soft_holds FROM authenticated;
REVOKE ALL ON TABLE public.table_soft_holds FROM anon;
GRANT ALL ON TABLE public.table_soft_holds TO service_role;

ALTER TABLE public.table_soft_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to soft_holds" ON public.table_soft_holds;
CREATE POLICY "Service role has full access to soft_holds"
  ON public.table_soft_holds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete their own soft holds" ON public.table_soft_holds;
DROP POLICY IF EXISTS "Users can view soft holds" ON public.table_soft_holds;
DROP POLICY IF EXISTS "Users can insert soft holds" ON public.table_soft_holds;
