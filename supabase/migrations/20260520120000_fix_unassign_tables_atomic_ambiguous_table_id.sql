-- Fix ambiguous table_id in unassign_tables_atomic (RETURNS TABLE(table_id) vs DELETE WHERE).
CREATE OR REPLACE FUNCTION public.unassign_tables_atomic(
  p_booking_id uuid,
  p_table_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(table_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_removed_table_ids uuid[] := ARRAY[]::uuid[];
  v_table_ids uuid[] := NULLIF(p_table_ids, ARRAY[]::uuid[]);
BEGIN
  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking id is required' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
  END IF;

  WITH deleted AS (
    DELETE FROM public.booking_table_assignments AS bta
    WHERE bta.booking_id = p_booking_id
      AND (v_table_ids IS NULL OR bta.table_id = ANY(v_table_ids))
    RETURNING bta.table_id
  )
  SELECT COALESCE(array_agg(deleted.table_id), ARRAY[]::uuid[])
  INTO v_removed_table_ids
  FROM deleted;

  UPDATE public.bookings AS b
  SET
    status = 'pending',
    updated_at = NOW()
  WHERE b.id = p_booking_id
    AND b.status = 'confirmed'
    AND NOT EXISTS (
      SELECT 1
      FROM public.booking_table_assignments AS remaining
      WHERE remaining.booking_id = p_booking_id
    );

  RETURN QUERY
  SELECT unnest(v_removed_table_ids);
END;
$$;
