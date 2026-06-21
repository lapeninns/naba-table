CREATE OR REPLACE FUNCTION public.update_booking_and_clear_assignments(
  p_booking_id uuid,
  p_restaurant_id uuid,
  p_patch jsonb
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_booking public.bookings;
BEGIN
  UPDATE public.bookings
  SET
    booking_date = CASE WHEN p_patch ? 'booking_date' THEN (p_patch->>'booking_date')::date ELSE booking_date END,
    start_time = CASE WHEN p_patch ? 'start_time' THEN (p_patch->>'start_time')::time ELSE start_time END,
    end_time = CASE WHEN p_patch ? 'end_time' THEN (p_patch->>'end_time')::time ELSE end_time END,
    start_at = CASE WHEN p_patch ? 'start_at' THEN NULLIF(p_patch->>'start_at', '')::timestamptz ELSE start_at END,
    end_at = CASE WHEN p_patch ? 'end_at' THEN NULLIF(p_patch->>'end_at', '')::timestamptz ELSE end_at END,
    party_size = CASE WHEN p_patch ? 'party_size' THEN (p_patch->>'party_size')::integer ELSE party_size END,
    booking_type = CASE WHEN p_patch ? 'booking_type' THEN p_patch->>'booking_type' ELSE booking_type END,
    seating_preference = CASE
      WHEN p_patch ? 'seating_preference'
      THEN (p_patch->>'seating_preference')::public.seating_preference_type
      ELSE seating_preference
    END,
    status = CASE
      WHEN p_patch ? 'status'
      THEN (p_patch->>'status')::public.booking_status
      ELSE status
    END,
    customer_name = CASE WHEN p_patch ? 'customer_name' THEN p_patch->>'customer_name' ELSE customer_name END,
    customer_email = CASE WHEN p_patch ? 'customer_email' THEN p_patch->>'customer_email' ELSE customer_email END,
    customer_phone = CASE WHEN p_patch ? 'customer_phone' THEN p_patch->>'customer_phone' ELSE customer_phone END,
    notes = CASE WHEN p_patch ? 'notes' THEN p_patch->>'notes' ELSE notes END,
    marketing_opt_in = CASE
      WHEN p_patch ? 'marketing_opt_in'
      THEN (p_patch->>'marketing_opt_in')::boolean
      ELSE marketing_opt_in
    END,
    loyalty_points_awarded = CASE
      WHEN p_patch ? 'loyalty_points_awarded'
      THEN (p_patch->>'loyalty_points_awarded')::integer
      ELSE loyalty_points_awarded
    END,
    source = CASE WHEN p_patch ? 'source' THEN p_patch->>'source' ELSE source END,
    auth_user_id = CASE
      WHEN p_patch ? 'auth_user_id'
      THEN NULLIF(p_patch->>'auth_user_id', '')::uuid
      ELSE auth_user_id
    END,
    details = CASE WHEN p_patch ? 'details' THEN p_patch->'details' ELSE details END,
    idempotency_key = CASE WHEN p_patch ? 'idempotency_key' THEN p_patch->>'idempotency_key' ELSE idempotency_key END,
    auto_assign_last_result = CASE
      WHEN p_patch ? 'auto_assign_last_result'
      THEN p_patch->'auto_assign_last_result'
      ELSE auto_assign_last_result
    END,
    assigned_zone_id = NULL
  WHERE id = p_booking_id
    AND restaurant_id = p_restaurant_id
  RETURNING * INTO updated_booking;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found for atomic modification cleanup'
      USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.booking_table_assignments
  WHERE booking_id = p_booking_id;

  DELETE FROM public.booking_assignment_idempotency
  WHERE booking_id = p_booking_id;

  RETURN updated_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.update_booking_and_clear_assignments(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_booking_and_clear_assignments(uuid, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.update_booking_and_clear_assignments(uuid, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_booking_and_clear_assignments(uuid, uuid, jsonb) TO service_role;
