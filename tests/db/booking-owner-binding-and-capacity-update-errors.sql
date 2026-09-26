-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
-- 1. Guest-auth §12.21: changing a booking's contact email clears bookings.auth_user_id in
--    the same write, on every path (direct UPDATE and update_booking_with_capacity_check,
--    which COALESCEs a null p_auth_user_id back to the old binding), unless the write sets
--    auth_user_id to a different value itself.
-- 2. update_booking_with_capacity_check no longer returns SQLERRM (top level or details).
BEGIN;

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_customer_id constant uuid := '00000000-0000-4000-8000-00000000c001';
  b constant uuid := '00000000-0000-4000-8000-00000000b002';
  v_owner constant uuid := '00000000-0000-4000-8000-0000000fa001';
  v_other_owner constant uuid := '00000000-0000-4000-8000-0000000fa002';
  v_result jsonb;
  v_auth uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (v_owner, 'owner-binding-regression@example.invalid'),
    (v_other_owner, 'owner-binding-regression-2@example.invalid');
  UPDATE public.bookings SET auth_user_id = v_owner WHERE id = b;

  -- Same address (case and whitespace ignored) and unrelated edits keep the binding.
  UPDATE public.bookings
  SET customer_email = '  SYNTHETIC-regression@test.invalid ', party_size = 3
  WHERE id = b;
  IF (SELECT auth_user_id FROM public.bookings WHERE id = b) IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'A same-address write cleared the owner binding' USING ERRCODE = 'NB001';
  END IF;

  -- A different address clears it.
  UPDATE public.bookings SET customer_email = 'new-contact@test.invalid' WHERE id = b;
  IF (SELECT auth_user_id FROM public.bookings WHERE id = b) IS NOT NULL THEN
    RAISE EXCEPTION 'A contact email change kept the owner binding' USING ERRCODE = 'NB001';
  END IF;

  -- A write that sets a different binding explicitly keeps it.
  UPDATE public.bookings SET auth_user_id = v_owner WHERE id = b;
  UPDATE public.bookings
  SET customer_email = 'owner-binding-regression-2@example.invalid', auth_user_id = v_other_owner
  WHERE id = b;
  IF (SELECT auth_user_id FROM public.bookings WHERE id = b) IS DISTINCT FROM v_other_owner THEN
    RAISE EXCEPTION 'An explicit owner binding was overwritten' USING ERRCODE = 'NB001';
  END IF;

  -- The capacity RPC path: p_auth_user_id null used to COALESCE the old binding back.
  UPDATE public.bookings SET auth_user_id = v_owner WHERE id = b;
  v_result := public.update_booking_with_capacity_check(
    b, v_restaurant_id, v_customer_id, DATE '2099-01-02', TIME '12:00', TIME '13:30', 2,
    'dinner', 'Synthetic fixture', 'rpc-changed-contact@test.invalid', '+447000000010', 'any'
  );
  IF COALESCE((v_result ->> 'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Capacity update RPC failed: %', v_result ->> 'error' USING ERRCODE = 'NB001';
  END IF;
  SELECT auth_user_id INTO v_auth FROM public.bookings WHERE id = b;
  IF v_auth IS NOT NULL THEN
    RAISE EXCEPTION 'Capacity update RPC changed the contact email but kept the owner binding'
      USING ERRCODE = 'NB001';
  END IF;

  -- An unexpected error inside the RPC (FK violation on booking_type) returns no SQLERRM.
  v_result := public.update_booking_with_capacity_check(
    b, v_restaurant_id, v_customer_id, DATE '2099-01-02', TIME '12:00', TIME '13:30', 2,
    'no-such-occasion', 'Synthetic fixture', 'rpc-changed-contact@test.invalid', '+447000000010', 'any'
  );
  IF v_result ->> 'error' IS DISTINCT FROM 'INTERNAL_ERROR' THEN
    RAISE EXCEPTION 'Expected INTERNAL_ERROR from the capacity RPC, got %', v_result ->> 'error'
      USING ERRCODE = 'NB001';
  END IF;
  IF v_result ? 'sqlerrm' OR (v_result -> 'details') ? 'sqlerrm'
     OR v_result::text ILIKE '%bookings_booking_type_fkey%' THEN
    RAISE EXCEPTION 'Capacity update RPC returned Postgres error text' USING ERRCODE = 'NB001';
  END IF;
  IF v_result ->> 'sqlstate' IS NULL THEN
    RAISE EXCEPTION 'Capacity update RPC dropped the SQLSTATE code' USING ERRCODE = 'NB001';
  END IF;

  IF has_function_privilege('authenticated', 'public.update_booking_with_capacity_check_unsanitized(uuid, uuid, uuid, date, time without time zone, time without time zone, integer, text, text, text, text, text, text, boolean, uuid, text, jsonb, integer, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.update_booking_with_capacity_check(uuid, uuid, uuid, date, time without time zone, time without time zone, integer, text, text, text, text, text, text, boolean, uuid, text, jsonb, integer, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Capacity update RPC is executable by an API role' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'booking-owner-binding-and-capacity-update-errors regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'nabatable-regression: booking-owner-binding-and-capacity-update-errors FAILED (SQLSTATE %)', SQLSTATE;
    RAISE;
END;
$regression$;

ROLLBACK;
