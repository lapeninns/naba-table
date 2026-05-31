CREATE OR REPLACE FUNCTION public.remove_booking_table_assignments_and_reopen_if_empty(
  p_booking_id uuid,
  p_table_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed_count integer := 0;
  remaining_count integer := 0;
  current_status public.booking_status;
BEGIN
  PERFORM 1
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found for table unassignment'
      USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.booking_table_assignments
  WHERE booking_id = p_booking_id
    AND table_id = ANY(p_table_ids);

  GET DIAGNOSTICS removed_count = ROW_COUNT;

  SELECT count(*)
  INTO remaining_count
  FROM public.booking_table_assignments
  WHERE booking_id = p_booking_id;

  IF remaining_count = 0 THEN
    SELECT status
    INTO current_status
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF current_status = 'confirmed' THEN
      UPDATE public.bookings
      SET
        status = 'pending',
        updated_at = now()
      WHERE id = p_booking_id
        AND status = 'confirmed';
    END IF;
  END IF;

  RETURN removed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_booking_table_assignments_and_reopen_if_empty(uuid, uuid[])
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_booking_table_assignments_and_reopen_if_empty(uuid, uuid[])
  FROM anon;
REVOKE ALL ON FUNCTION public.remove_booking_table_assignments_and_reopen_if_empty(uuid, uuid[])
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.remove_booking_table_assignments_and_reopen_if_empty(uuid, uuid[])
  TO service_role;
