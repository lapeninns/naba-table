-- Migration: Add soft holds table for race condition prevention
-- Description: Implements soft-hold pattern to prevent race conditions during 
--              table evaluation and hold creation. Soft-holds are temporary
--              reservations that auto-expire and prevent concurrent selection.
-- Task: hold-race-condition-fix-20260117-2315
-- Author: AI Assistant
-- Date: 2026-01-17

-- =============================================================================
-- TABLE: table_soft_holds
-- =============================================================================
-- Temporary holds acquired during evaluation phase to prevent race conditions.
-- Key characteristics:
--   - Short TTL (default 10 seconds)
--   - Exclusion constraint prevents overlapping soft-holds for same table
--   - Session token links soft-hold to evaluation context
--   - Auto-expires via expires_at column

CREATE TABLE IF NOT EXISTS public.table_soft_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.table_inventory(id) ON DELETE CASCADE,
  hold_window tstzrange NOT NULL,
  session_token uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  
  -- Exclusion constraint: no overlapping soft-holds for same table
  -- Only applies to non-expired entries
  CONSTRAINT table_soft_holds_no_overlap 
    EXCLUDE USING gist (table_id WITH =, hold_window WITH &&)
    WHERE (expires_at > timezone('utc', now()))
);

-- Index for efficient cleanup of expired soft-holds
CREATE INDEX IF NOT EXISTS table_soft_holds_expires_idx 
  ON public.table_soft_holds (expires_at) 
  WHERE expires_at > timezone('utc', now());

-- Index for session token lookups (release/conversion)
CREATE INDEX IF NOT EXISTS table_soft_holds_session_idx 
  ON public.table_soft_holds (session_token);

-- Index for restaurant-scoped queries
CREATE INDEX IF NOT EXISTS table_soft_holds_restaurant_idx 
  ON public.table_soft_holds (restaurant_id, expires_at)
  WHERE expires_at > timezone('utc', now());

-- Index for booking-scoped queries  
CREATE INDEX IF NOT EXISTS table_soft_holds_booking_idx 
  ON public.table_soft_holds (booking_id)
  WHERE booking_id IS NOT NULL;

-- =============================================================================
-- FUNCTION: acquire_soft_holds_atomic
-- =============================================================================
-- Atomically acquires soft-holds for a set of tables.
-- Returns acquisition status for each table.
--
-- Parameters:
--   p_table_ids: Array of table IDs to acquire soft-holds for
--   p_window: Time window for the soft-holds (tstzrange)
--   p_session_token: Unique session identifier
--   p_restaurant_id: Restaurant ID for scoping
--   p_booking_id: Optional booking ID for context
--   p_ttl_seconds: TTL in seconds (default 10)
--
-- Returns:
--   table_id: The table ID
--   acquired: Whether the soft-hold was acquired
--   blocking_session: Session token of blocking soft-hold (if any)
--   blocking_expires_at: When the blocking soft-hold expires (if any)

CREATE OR REPLACE FUNCTION public.acquire_soft_holds_atomic(
  p_table_ids uuid[],
  p_window tstzrange,
  p_session_token uuid,
  p_restaurant_id uuid,
  p_booking_id uuid DEFAULT NULL,
  p_ttl_seconds integer DEFAULT 10
) RETURNS TABLE(
  table_id uuid,
  acquired boolean,
  blocking_session uuid,
  blocking_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_expires_at timestamptz;
  v_table_id uuid;
  v_sorted_table_ids uuid[];
  v_blocking RECORD;
  v_all_acquired boolean := true;
  v_acquired_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Validate inputs
  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
    RAISE EXCEPTION 'acquire_soft_holds_atomic requires at least one table id'
      USING ERRCODE = '23514';
  END IF;

  IF p_window IS NULL THEN
    RAISE EXCEPTION 'acquire_soft_holds_atomic requires a valid window'
      USING ERRCODE = '23514';
  END IF;

  IF p_session_token IS NULL THEN
    RAISE EXCEPTION 'acquire_soft_holds_atomic requires a session token'
      USING ERRCODE = '23514';
  END IF;

  -- Calculate expiry
  v_expires_at := v_now + (p_ttl_seconds || ' seconds')::interval;

  -- Sort table IDs to prevent deadlocks (consistent acquisition order)
  SELECT array_agg(DISTINCT t.id ORDER BY t.id)
  INTO v_sorted_table_ids
  FROM unnest(p_table_ids) AS t(id);

  -- Clean up any expired soft-holds for these tables first
  DELETE FROM public.table_soft_holds
  WHERE table_id = ANY(v_sorted_table_ids)
    AND expires_at <= v_now;

  -- Check for blocking soft-holds and attempt acquisition
  FOREACH v_table_id IN ARRAY v_sorted_table_ids LOOP
    -- Check if table is already soft-held by another session
    SELECT sh.session_token, sh.expires_at
    INTO v_blocking
    FROM public.table_soft_holds sh
    WHERE sh.table_id = v_table_id
      AND sh.expires_at > v_now
      AND sh.hold_window && p_window
      AND sh.session_token <> p_session_token
    LIMIT 1;

    IF FOUND THEN
      -- Table is blocked by another session
      v_all_acquired := false;
      table_id := v_table_id;
      acquired := false;
      blocking_session := v_blocking.session_token;
      blocking_expires_at := v_blocking.expires_at;
      RETURN NEXT;
    ELSE
      -- Check if we already have a soft-hold for this table
      IF EXISTS (
        SELECT 1 FROM public.table_soft_holds sh
        WHERE sh.table_id = v_table_id
          AND sh.session_token = p_session_token
          AND sh.expires_at > v_now
          AND sh.hold_window && p_window
      ) THEN
        -- Extend existing soft-hold
        UPDATE public.table_soft_holds
        SET expires_at = v_expires_at
        WHERE table_id = v_table_id
          AND session_token = p_session_token
          AND expires_at > v_now;
      ELSE
        -- Attempt to insert new soft-hold
        BEGIN
          INSERT INTO public.table_soft_holds (
            table_id,
            hold_window,
            session_token,
            restaurant_id,
            booking_id,
            expires_at
          ) VALUES (
            v_table_id,
            p_window,
            p_session_token,
            p_restaurant_id,
            p_booking_id,
            v_expires_at
          );
        EXCEPTION
          WHEN exclusion_violation THEN
            -- Another session just acquired this table
            SELECT sh.session_token, sh.expires_at
            INTO v_blocking
            FROM public.table_soft_holds sh
            WHERE sh.table_id = v_table_id
              AND sh.expires_at > v_now
              AND sh.hold_window && p_window
            LIMIT 1;

            v_all_acquired := false;
            table_id := v_table_id;
            acquired := false;
            blocking_session := COALESCE(v_blocking.session_token, NULL);
            blocking_expires_at := COALESCE(v_blocking.expires_at, NULL);
            RETURN NEXT;
            CONTINUE;
        END;
      END IF;

      -- Successfully acquired
      v_acquired_ids := array_append(v_acquired_ids, v_table_id);
      table_id := v_table_id;
      acquired := true;
      blocking_session := NULL;
      blocking_expires_at := NULL;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- If not all acquired, release the ones we did acquire (rollback partial acquisition)
  IF NOT v_all_acquired AND array_length(v_acquired_ids, 1) > 0 THEN
    DELETE FROM public.table_soft_holds
    WHERE table_id = ANY(v_acquired_ids)
      AND session_token = p_session_token;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.acquire_soft_holds_atomic IS 
  'Atomically acquires soft-holds for a set of tables to prevent race conditions during evaluation.';

-- =============================================================================
-- FUNCTION: release_soft_holds
-- =============================================================================
-- Releases soft-holds by session token.

CREATE OR REPLACE FUNCTION public.release_soft_holds(
  p_session_token uuid,
  p_table_ids uuid[] DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
    DELETE FROM public.table_soft_holds
    WHERE session_token = p_session_token
      AND table_id = ANY(p_table_ids);
  ELSE
    DELETE FROM public.table_soft_holds
    WHERE session_token = p_session_token;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.release_soft_holds IS 
  'Releases soft-holds by session token, optionally limited to specific tables.';

-- =============================================================================
-- FUNCTION: cleanup_expired_soft_holds
-- =============================================================================
-- Background cleanup function for expired soft-holds.
-- Should be called periodically (e.g., every minute).

CREATE OR REPLACE FUNCTION public.cleanup_expired_soft_holds(
  p_batch_size integer DEFAULT 1000
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.table_soft_holds
  WHERE id IN (
    SELECT id FROM public.table_soft_holds
    WHERE expires_at <= timezone('utc', now())
    LIMIT p_batch_size
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_soft_holds IS 
  'Cleans up expired soft-holds in batches. Call periodically for maintenance.';

-- =============================================================================
-- FUNCTION: check_soft_hold_ownership
-- =============================================================================
-- Verifies a session owns soft-holds for specific tables.

CREATE OR REPLACE FUNCTION public.check_soft_hold_ownership(
  p_session_token uuid,
  p_table_ids uuid[],
  p_window tstzrange
) RETURNS TABLE(
  table_id uuid,
  owned boolean,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_table_id uuid;
  v_hold RECORD;
BEGIN
  FOREACH v_table_id IN ARRAY p_table_ids LOOP
    SELECT sh.expires_at
    INTO v_hold
    FROM public.table_soft_holds sh
    WHERE sh.table_id = v_table_id
      AND sh.session_token = p_session_token
      AND sh.expires_at > v_now
      AND sh.hold_window && p_window
    LIMIT 1;

    table_id := v_table_id;
    IF FOUND THEN
      owned := true;
      expires_at := v_hold.expires_at;
    ELSE
      owned := false;
      expires_at := NULL;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.check_soft_hold_ownership IS 
  'Verifies a session owns soft-holds for specific tables in a given window.';

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT ALL ON TABLE public.table_soft_holds TO authenticated;
GRANT ALL ON TABLE public.table_soft_holds TO service_role;

GRANT EXECUTE ON FUNCTION public.acquire_soft_holds_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_soft_holds_atomic TO service_role;

GRANT EXECUTE ON FUNCTION public.release_soft_holds TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_soft_holds TO service_role;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_soft_holds TO service_role;

GRANT EXECUTE ON FUNCTION public.check_soft_hold_ownership TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_soft_hold_ownership TO service_role;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.table_soft_holds ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY "Service role has full access to soft_holds"
  ON public.table_soft_holds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can manage their own soft-holds (session-based)
CREATE POLICY "Users can view soft holds"
  ON public.table_soft_holds
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert soft holds"
  ON public.table_soft_holds
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete their own soft holds"
  ON public.table_soft_holds
  FOR DELETE
  TO authenticated
  USING (true);
