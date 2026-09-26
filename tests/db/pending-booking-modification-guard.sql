-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
-- modify_pending_booking_and_clear_assignments applies a modification that found no
-- table to a booking that is still awaiting allocation. It compares-and-sets the
-- status the app read: a booking confirmed (or cancelled) while the planner ran is
-- refused with P0004 and left exactly as it is. On success the booking stays pending
-- and loses its assignments AND its allocations, so no table is blocked by a stale
-- window (the old update_booking_and_clear_assignments path left the allocation).
BEGIN;

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  t constant uuid := '00000000-0000-4000-8000-00000000e001';
  b constant uuid := '00000000-0000-4000-8000-00000000b002';
  old_start constant timestamptz := TIMESTAMPTZ '2099-01-02 12:00:00+00';
  old_end constant timestamptz := TIMESTAMPTZ '2099-01-02 13:30:00+00';
  new_start constant timestamptz := TIMESTAMPTZ '2099-01-02 18:00:00+00';
  new_end constant timestamptz := TIMESTAMPTZ '2099-01-02 19:30:00+00';
  v_patch constant jsonb := jsonb_build_object(
    'start_time', '18:00', 'end_time', '19:30',
    'start_at', new_start, 'end_at', new_end,
    'party_size', 3, 'status', 'confirmed', 'restaurant_id', v_other_restaurant_id
  );
  v_booking public.bookings%ROWTYPE;
BEGIN
  -- The race: the app read 'pending', then auto-assign confirmed the booking onto t.
  PERFORM public.assign_tables_atomic_v2(b, ARRAY[t], 'nb-pending-guard-1', false, NULL, old_start, old_end);
  IF (SELECT status FROM public.bookings WHERE id = b) <> 'confirmed' THEN
    RAISE EXCEPTION 'Fixture booking is not confirmed' USING ERRCODE = 'NB001';
  END IF;

  BEGIN
    PERFORM public.modify_pending_booking_and_clear_assignments(b, v_restaurant_id, v_patch, 'pending');
    RAISE EXCEPTION 'Pending-path modification ignored a concurrent confirmation' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE 'P0004' THEN NULL;
  END;
  SELECT * INTO v_booking FROM public.bookings WHERE id = b;
  IF v_booking.status <> 'confirmed' OR v_booking.start_at <> old_start OR v_booking.party_size <> 2
     OR NOT EXISTS (SELECT 1 FROM public.booking_table_assignments WHERE booking_id = b AND table_id = t)
     OR NOT EXISTS (SELECT 1 FROM public.allocations WHERE booking_id = b AND resource_id = t) THEN
    RAISE EXCEPTION 'Refused pending-path modification changed the booking' USING ERRCODE = 'NB001';
  END IF;

  -- A confirmed booking is never cleared through this path, even when the caller says so.
  BEGIN
    PERFORM public.modify_pending_booking_and_clear_assignments(b, v_restaurant_id, v_patch, 'confirmed');
    RAISE EXCEPTION 'Pending-path modification cleared a confirmed booking' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE 'P0004' THEN NULL;
  END;

  -- Other tenants and missing bookings are refused as non-retryable.
  UPDATE public.bookings SET status = 'pending' WHERE id = b;
  BEGIN
    PERFORM public.modify_pending_booking_and_clear_assignments(b, v_other_restaurant_id, v_patch, 'pending');
    RAISE EXCEPTION 'Cross-tenant pending-path modification succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE 'P0004' THEN NULL;
  END;
  BEGIN
    PERFORM public.modify_pending_booking_and_clear_assignments(
      '00000000-0000-4000-8000-0000004d0101'::uuid, v_restaurant_id, v_patch, 'pending');
    RAISE EXCEPTION 'Pending-path modification of a missing booking succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE 'P0004' THEN NULL;
  END;

  -- Success on a pending booking that still carries a table: the patch applies, status
  -- and tenant cannot be changed by it, and both assignments and allocations are gone.
  SELECT * INTO v_booking
  FROM public.modify_pending_booking_and_clear_assignments(b, v_restaurant_id, v_patch, 'pending');
  IF v_booking.status <> 'pending' OR v_booking.start_at <> new_start OR v_booking.party_size <> 3
     OR v_booking.restaurant_id <> v_restaurant_id THEN
    RAISE EXCEPTION 'Pending-path modification did not apply the patch as pending (status %)', v_booking.status
      USING ERRCODE = 'NB001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.booking_table_assignments WHERE booking_id = b)
     OR EXISTS (SELECT 1 FROM public.allocations WHERE booking_id = b)
     OR NOT EXISTS (SELECT 1 FROM public.allocations_archive WHERE booking_id = b AND resource_id = t) THEN
    RAISE EXCEPTION 'Pending-path modification left an orphaned assignment or allocation' USING ERRCODE = 'NB001';
  END IF;

  IF has_function_privilege('authenticated', 'public.modify_pending_booking_and_clear_assignments(uuid, uuid, jsonb, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.modify_pending_booking_and_clear_assignments(uuid, uuid, jsonb, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Pending-path RPC is executable by an API role' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'pending-booking-modification-guard regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'nabatable-regression: pending-booking-modification-guard FAILED (SQLSTATE %)', SQLSTATE;
    RAISE;
END;
$regression$;

ROLLBACK;
