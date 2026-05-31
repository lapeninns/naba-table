CREATE OR REPLACE FUNCTION public.apply_booking_state_transition_and_clear_assignments(
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    transition.status,
    transition.checked_in_at,
    transition.checked_out_at,
    transition.updated_at
  FROM public.apply_booking_state_transition(
    p_booking_id,
    p_status,
    p_checked_in_at,
    p_checked_out_at,
    p_updated_at,
    p_history_from,
    p_history_to,
    p_history_changed_by,
    p_history_changed_at,
    p_history_reason,
    p_history_metadata
  ) AS transition;

  DELETE FROM public.booking_table_assignments
  WHERE booking_id = p_booking_id;

  DELETE FROM public.booking_assignment_idempotency
  WHERE booking_id = p_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_booking_state_transition_and_clear_assignments(
  uuid,
  public.booking_status,
  timestamptz,
  timestamptz,
  timestamptz,
  public.booking_status,
  public.booking_status,
  uuid,
  timestamptz,
  text,
  jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_booking_state_transition_and_clear_assignments(
  uuid,
  public.booking_status,
  timestamptz,
  timestamptz,
  timestamptz,
  public.booking_status,
  public.booking_status,
  uuid,
  timestamptz,
  text,
  jsonb
) FROM anon;
REVOKE ALL ON FUNCTION public.apply_booking_state_transition_and_clear_assignments(
  uuid,
  public.booking_status,
  timestamptz,
  timestamptz,
  timestamptz,
  public.booking_status,
  public.booking_status,
  uuid,
  timestamptz,
  text,
  jsonb
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_booking_state_transition_and_clear_assignments(
  uuid,
  public.booking_status,
  timestamptz,
  timestamptz,
  timestamptz,
  public.booking_status,
  public.booking_status,
  uuid,
  timestamptz,
  text,
  jsonb
) TO service_role;
