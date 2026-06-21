-- ============================================================================
-- PROPOSED MIGRATION — REVIEW REQUIRED, NOT AUTO-APPLIED.
--
-- This file lives under docs/proposed-migrations/ (OUTSIDE supabase/migrations/)
-- specifically so `supabase db push` will NOT pick it up. To ship it: review the
-- assumption below, test against a database, then move it into supabase/migrations/
-- with a proper sequential timestamp.
--
-- Edge-case gap #5 (DB-side enforcement)
-- --------------------------------------
-- apply_booking_state_transition updates `WHERE status = p_history_from`, so it
-- permits ANY transition the caller declares — including a stale confirm passing
-- p_history_from='cancelled', p_status='confirmed', which would resurrect a
-- terminal booking (confirm-after-cancel race). confirmHoldAssignment now guards
-- this on the application side (AssignTablesRpcError 'BOOKING_STATE_CONFLICT'), but
-- the durable invariant belongs in the RPC so it holds for EVERY caller.
--
-- This adds a server-side guard rejecting transitions OUT of a terminal status
-- (cancelled, no_show, completed) INTO a non-terminal status. Because the existing
-- WHERE clause only updates when the real status equals p_history_from, guarding on
-- p_history_from is sufficient: a terminal p_history_from implies a terminal actual
-- status.
--
-- ⚠️ REVIEWER: confirm no legitimate flow reactivates a terminal booking via this
-- RPC (e.g. an "undo cancellation" / reinstate feature). If one exists, narrow the
-- guard to the specific illegal pairs instead of the blanket rule below.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_booking_state_transition(
  p_booking_id uuid,
  p_status public.booking_status,
  p_checked_in_at timestamptz,
  p_checked_out_at timestamptz,
  p_updated_at timestamptz,
  p_history_from public.booking_status,
  p_history_to public.booking_status,
  p_history_changed_by uuid,
  p_history_changed_at timestamptz,
  p_history_reason text,
  p_history_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  status public.booking_status,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  v_updated public.bookings%ROWTYPE;
  v_current public.booking_status;
  v_rows integer;
BEGIN
  -- (#5) Reject reactivating a terminal booking, regardless of the p_history_from
  -- the caller supplies. Terminal states never transition back into an active state.
  IF p_history_from IN ('cancelled', 'no_show', 'completed')
     AND p_status NOT IN ('cancelled', 'no_show', 'completed') THEN
    RAISE EXCEPTION 'booking_state_conflict'
      USING ERRCODE = 'P0004',
            DETAIL = format(
              'Illegal transition from terminal status %s to %s',
              p_history_from, p_status
            );
  END IF;

  UPDATE public.bookings
  SET status = p_status,
      checked_in_at = p_checked_in_at,
      checked_out_at = p_checked_out_at,
      updated_at = p_updated_at
  WHERE id = p_booking_id
    AND public.bookings.status = p_history_from
  RETURNING * INTO v_updated;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    SELECT b.status
    INTO v_current
    FROM public.bookings AS b
    WHERE b.id = p_booking_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
    END IF;

    RAISE EXCEPTION 'booking_state_conflict'
      USING ERRCODE = 'P0004',
            DETAIL = format('Current status %s does not match expected %s', v_current, p_history_from);
  END IF;

  INSERT INTO public.booking_state_history (
    booking_id, from_status, to_status, changed_by, changed_at, reason, metadata
  ) VALUES (
    p_booking_id,
    p_history_from,
    p_history_to,
    p_history_changed_by,
    p_history_changed_at,
    p_history_reason,
    COALESCE(p_history_metadata, '{}'::jsonb)
  );

  RETURN QUERY
  SELECT
    v_updated.status,
    v_updated.checked_in_at,
    v_updated.checked_out_at,
    v_updated.updated_at;
END;
$$;

NOTIFY pgrst, 'reload schema';
