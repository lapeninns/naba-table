CREATE OR REPLACE FUNCTION public.sync_confirmed_assignment_windows(
  p_booking_id uuid,
  p_table_ids uuid[],
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_actor_id uuid DEFAULT NULL,
  p_hold_id uuid DEFAULT NULL,
  p_merge_group_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_payload_checksum text DEFAULT NULL
) RETURNS SETOF public.booking_table_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window tstzrange := tstzrange(p_window_start, p_window_end, '[)');
BEGIN
  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'sync_confirmed_assignment_windows requires booking id';
  END IF;

  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) IS NULL THEN
    RETURN QUERY
      SELECT *
      FROM public.booking_table_assignments
      WHERE booking_id = p_booking_id;
    RETURN;
  END IF;

  UPDATE public.booking_table_assignments
     SET start_at = p_window_start,
         end_at = p_window_end
   WHERE booking_id = p_booking_id
     AND table_id = ANY(p_table_ids);

  UPDATE public.allocations
     SET "window" = v_window,
         merge_group_id = COALESCE(p_merge_group_id, merge_group_id)
   WHERE booking_id = p_booking_id
     AND resource_type = 'table'
     AND resource_id = ANY(p_table_ids);

  IF p_idempotency_key IS NOT NULL THEN
    UPDATE public.booking_assignment_idempotency
       SET assignment_window = v_window,
           merge_group_allocation_id = p_merge_group_id,
           payload_checksum = p_payload_checksum
     WHERE booking_id = p_booking_id
       AND idempotency_key = p_idempotency_key;
  END IF;

  INSERT INTO public.capacity_outbox (
    event_type,
    dedupe_key,
    restaurant_id,
    booking_id,
    idempotency_key,
    payload
  )
  SELECT
    'capacity.assignment.window_synced',
    format('%s:%s:window_synced', p_booking_id, coalesce(p_hold_id, 'none')),
    b.restaurant_id,
    p_booking_id,
    p_idempotency_key,
    jsonb_build_object(
      'bookingId', p_booking_id,
      'tableIds', p_table_ids,
      'startAt', to_char(p_window_start AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'endAt', to_char(p_window_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'actorId', p_actor_id,
      'holdId', p_hold_id,
      'mergeGroupId', p_merge_group_id
    )
  FROM public.bookings b
  WHERE b.id = p_booking_id
  ON CONFLICT ON CONSTRAINT capacity_outbox_dedupe_unique DO NOTHING;

  RETURN QUERY
    SELECT *
      FROM public.booking_table_assignments
     WHERE booking_id = p_booking_id
       AND table_id = ANY(p_table_ids);
END;
$$;

GRANT ALL ON FUNCTION public.sync_confirmed_assignment_windows(
  uuid,
  uuid[],
  timestamptz,
  timestamptz,
  uuid,
  uuid,
  uuid,
  text,
  text
) TO service_role;
