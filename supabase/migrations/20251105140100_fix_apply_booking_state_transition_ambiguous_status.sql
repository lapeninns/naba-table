-- Fix ambiguous reference to "status" in apply_booking_state_transition
-- Qualify the bookings table column to avoid conflict with OUT param "status"

CREATE OR REPLACE FUNCTION public.apply_booking_state_transition(
  p_booking_id uuid,
  p_status booking_status,
  p_checked_in_at timestamp with time zone,
  p_checked_out_at timestamp with time zone,
  p_updated_at timestamp with time zone,
  p_history_from booking_status,
  p_history_to booking_status,
  p_history_changed_by uuid,
  p_history_changed_at timestamp with time zone,
  p_history_reason text,
  p_history_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  status booking_status,
  checked_in_at timestamp with time zone,
  checked_out_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
  DECLARE
    v_updated public.bookings%ROWTYPE;
    v_current public.booking_status;
    v_rows integer;
  BEGIN
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
      SELECT status INTO v_current FROM public.bookings WHERE id = p_booking_id;
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
      p_booking_id, p_history_from, p_history_to, p_history_changed_by, p_history_changed_at, p_history_reason, COALESCE(p_history_metadata, '{}'::jsonb)
    );

    RETURN QUERY SELECT v_updated.status, v_updated.checked_in_at, v_updated.checked_out_at, v_updated.updated_at;
  END;
$$;

