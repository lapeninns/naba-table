-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
-- modify_booking_with_table_swap moves a booking to its new window and its newly
-- held tables in one transaction. Any failure keeps the booking's old window,
-- status and tables; a success releases the old tables and never leaves the
-- booking pending without a table.
BEGIN;

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  z constant uuid := '00000000-0000-4000-8000-00000000d001';
  t constant uuid := '00000000-0000-4000-8000-00000000e001';
  t2 constant uuid := '00000000-0000-4000-8000-00000000e041';
  b constant uuid := '00000000-0000-4000-8000-00000000b002';
  old_start constant timestamptz := TIMESTAMPTZ '2099-01-02 12:00:00+00';
  old_end constant timestamptz := TIMESTAMPTZ '2099-01-02 13:30:00+00';
  new_start constant timestamptz := TIMESTAMPTZ '2099-01-02 18:00:00+00';
  new_end constant timestamptz := TIMESTAMPTZ '2099-01-02 19:30:00+00';
  shift_start constant timestamptz := TIMESTAMPTZ '2099-01-02 18:30:00+00';
  shift_end constant timestamptz := TIMESTAMPTZ '2099-01-02 20:00:00+00';
  v_patch constant jsonb := jsonb_build_object(
    'start_time', '18:00', 'end_time', '19:30',
    'start_at', new_start, 'end_at', new_end,
    'party_size', 3, 'status', 'cancelled', 'restaurant_id', v_other_restaurant_id
  );
  h uuid;
  unbound_h uuid;
  v_booking public.bookings%ROWTYPE;
BEGIN
  INSERT INTO public.table_inventory(id,restaurant_id,table_number,capacity,zone_id,category)
  VALUES(t2,v_restaurant_id,'SYN-SWAP-2',4,z,'dining');
  PERFORM public.assign_tables_atomic_v2(b, ARRAY[t], 'nb-swap-initial', false, NULL, old_start, old_end);

  -- A failure after the patch step (the held table was disabled after the quote)
  -- rolls the whole modification back.
  SELECT id INTO h FROM public.create_table_hold_atomic(b,v_restaurant_id,z,ARRAY[t2],new_start,new_end,clock_timestamp()+interval '120 seconds');
  UPDATE public.table_inventory SET active = false WHERE id = t2;
  BEGIN
    PERFORM public.modify_booking_with_table_swap(b, v_restaurant_id, v_patch, h, 'confirmed', 'nb-swap-1');
    RAISE EXCEPTION 'Swap onto an inactive table succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN check_violation THEN NULL;
  END;
  SELECT * INTO v_booking FROM public.bookings WHERE id = b;
  IF v_booking.start_at <> old_start OR v_booking.status <> 'confirmed' OR v_booking.party_size <> 2
     OR NOT EXISTS (SELECT 1 FROM public.booking_table_assignments WHERE booking_id=b AND table_id=t AND start_at=old_start)
     OR NOT EXISTS (SELECT 1 FROM public.allocations WHERE booking_id=b AND resource_id=t)
     OR NOT EXISTS (SELECT 1 FROM public.table_holds WHERE id=h) THEN
    RAISE EXCEPTION 'Failed swap released the current assignment or changed the booking' USING ERRCODE = 'NB001';
  END IF;
  UPDATE public.table_inventory SET active = true WHERE id = t2;

  -- Stale caller state, unbound or foreign holds and other tenants are refused unchanged.
  BEGIN
    PERFORM public.modify_booking_with_table_swap(b, v_restaurant_id, v_patch, h, 'pending', 'nb-swap-2');
    RAISE EXCEPTION 'Swap ignored the expected status' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE 'P0004' THEN NULL;
  END;
  SELECT id INTO unbound_h FROM public.create_table_hold_atomic(NULL,v_restaurant_id,z,ARRAY[t2],shift_start + interval '4 hours',shift_end + interval '4 hours',clock_timestamp()+interval '120 seconds');
  BEGIN
    PERFORM public.modify_booking_with_table_swap(b, v_restaurant_id, v_patch, unbound_h, 'confirmed', 'nb-swap-3');
    RAISE EXCEPTION 'Swap consumed a hold not bound to the booking' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN raise_exception THEN NULL;
  END;
  BEGIN
    PERFORM public.modify_booking_with_table_swap(b, v_other_restaurant_id, v_patch, h, 'confirmed', 'nb-swap-4');
    RAISE EXCEPTION 'Cross-tenant swap succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    -- Booking-not-found is non-retryable (P0004); P0002 means only a vanished hold.
    WHEN SQLSTATE 'P0004' THEN NULL;
  END;
  BEGIN
    PERFORM public.modify_booking_with_table_swap(gen_random_uuid(), v_restaurant_id, v_patch, h, 'confirmed', 'nb-swap-5');
    RAISE EXCEPTION 'Swap of a missing booking succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE 'P0004' THEN NULL;
  END;
  BEGIN
    PERFORM public.modify_booking_with_table_swap(b, v_restaurant_id, v_patch, gen_random_uuid(), 'confirmed', 'nb-swap-6');
    RAISE EXCEPTION 'Swap with a missing hold succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN no_data_found THEN NULL;
  END;
  IF (SELECT start_at FROM public.bookings WHERE id = b) <> old_start
     OR NOT EXISTS (SELECT 1 FROM public.booking_table_assignments WHERE booking_id=b AND table_id=t) THEN
    RAISE EXCEPTION 'Refused swap changed the booking' USING ERRCODE = 'NB001';
  END IF;

  -- Success: new window, new table, old table released, still confirmed, and the
  -- patch cannot change status or tenant.
  SELECT * INTO v_booking
  FROM public.modify_booking_with_table_swap(b, v_restaurant_id, v_patch, h, 'confirmed', 'nb-swap-5');
  IF v_booking.start_at <> new_start OR v_booking.party_size <> 3 OR v_booking.status <> 'confirmed'
     OR v_booking.restaurant_id <> v_restaurant_id THEN
    RAISE EXCEPTION 'Swap did not apply the patch as confirmed (status %)', v_booking.status USING ERRCODE = 'NB001';
  END IF;
  IF (SELECT array_agg(table_id) FROM public.booking_table_assignments WHERE booking_id=b) IS DISTINCT FROM ARRAY[t2]
     OR NOT EXISTS (SELECT 1 FROM public.booking_table_assignments WHERE booking_id=b AND table_id=t2 AND start_at=new_start AND end_at=new_end)
     OR EXISTS (SELECT 1 FROM public.allocations WHERE booking_id=b AND resource_id=t)
     OR NOT EXISTS (SELECT 1 FROM public.allocations_archive WHERE booking_id=b AND resource_id=t)
     OR EXISTS (SELECT 1 FROM public.table_holds WHERE booking_id=b) THEN
    RAISE EXCEPTION 'Swap did not move the assignment to the held table' USING ERRCODE = 'NB001';
  END IF;

  -- A pending booking is confirmed by the swap, and a booking can keep a table it
  -- already holds when the new window overlaps the old one.
  UPDATE public.bookings SET status = 'pending' WHERE id = b;
  SELECT id INTO h FROM public.create_table_hold_atomic(b,v_restaurant_id,z,ARRAY[t2],shift_start,shift_end,clock_timestamp()+interval '120 seconds');
  SELECT * INTO v_booking
  FROM public.modify_booking_with_table_swap(
    b, v_restaurant_id,
    jsonb_build_object('start_time','18:30','end_time','20:00','start_at',shift_start,'end_at',shift_end),
    h, 'pending', 'nb-swap-6');
  IF v_booking.status <> 'confirmed' OR v_booking.start_at <> shift_start
     OR NOT EXISTS (SELECT 1 FROM public.booking_table_assignments WHERE booking_id=b AND table_id=t2 AND start_at=shift_start)
     OR NOT EXISTS (SELECT 1 FROM public.booking_state_history WHERE booking_id=b AND to_status='confirmed' AND reason='modification_table_swap') THEN
    RAISE EXCEPTION 'Pending booking was not confirmed on its held table' USING ERRCODE = 'NB001';
  END IF;

  IF has_function_privilege('authenticated', 'public.modify_booking_with_table_swap(uuid, uuid, jsonb, uuid, text, text, boolean, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.modify_booking_with_table_swap(uuid, uuid, jsonb, uuid, text, text, boolean, text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Swap RPC is executable by an API role' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'booking-modification-table-swap regression PASSED';
END
$regression$;

ROLLBACK;
