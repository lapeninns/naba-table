-- Atomic hold release with observability
CREATE OR REPLACE FUNCTION public.release_hold_and_emit(
  p_hold_id uuid,
  p_actor_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold public.table_holds%ROWTYPE;
  v_members jsonb;
BEGIN
  SELECT * INTO v_hold
    FROM public.table_holds
    WHERE id = p_hold_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  DELETE FROM public.table_hold_members
    WHERE hold_id = p_hold_id;
  DELETE FROM public.table_holds
    WHERE id = p_hold_id;

  v_members := (
    SELECT jsonb_agg(table_id)
      FROM jsonb_array_elements_text(
        COALESCE(
          (
            SELECT jsonb_agg(table_id)
              FROM public.table_hold_members
              WHERE hold_id = p_hold_id
          ),
          '[]'::jsonb
        )
      )
  );

  PERFORM public.record_observability_event(
    'capacity.holds',
    'hold.released',
    'info',
    v_hold.restaurant_id,
    v_hold.booking_id,
    jsonb_build_object(
      'holdId', p_hold_id,
      'actorId', p_actor_id,
      'tableIds', v_members,
      'startAt', v_hold.start_at,
      'endAt', v_hold.end_at,
      'expiresAt', v_hold.expires_at
    )
  );

  RETURN true;
END;
$$;

GRANT ALL ON FUNCTION public.release_hold_and_emit(uuid, uuid) TO service_role;
