BEGIN;
SET LOCAL app.capacity.post_assignment.enabled = 'off';

DO $regression$
DECLARE
  v_restaurant_id uuid := gen_random_uuid();
  v_customer_id uuid := gen_random_uuid();
  v_zone_id uuid := gen_random_uuid();
  v_table_id uuid := gen_random_uuid();
  v_cancelled_booking_id uuid := gen_random_uuid();
  v_confirmed_booking_id uuid := gen_random_uuid();
  v_failed_booking_id uuid := gen_random_uuid();
  v_checked_in_booking_id uuid := gen_random_uuid();
  v_after_check_in_booking_id uuid := gen_random_uuid();
  v_assignment_count integer;
  v_allocation_count integer;
  v_cancelled_again boolean;
  v_failure text;
BEGIN
  INSERT INTO public.restaurants (id, name, slug)
  VALUES (
    v_restaurant_id,
    'Terminal allocation regression fixture',
    'terminal-allocation-' || replace(v_restaurant_id::text, '-', '')
  );

  INSERT INTO public.customers (id, restaurant_id, full_name, email)
  VALUES (v_customer_id, v_restaurant_id, 'Synthetic fixture', 'terminal-allocation@test.invalid');

  INSERT INTO public.zones (id, restaurant_id, name)
  VALUES (v_zone_id, v_restaurant_id, 'Regression zone');

  INSERT INTO public.allowed_capacities (restaurant_id, capacity)
  VALUES (v_restaurant_id, 4);

  INSERT INTO public.table_inventory (
    id,
    restaurant_id,
    table_number,
    capacity,
    zone_id,
    category
  ) VALUES (
    v_table_id,
    v_restaurant_id,
    'REG-1',
    4,
    v_zone_id,
    'dining'
  );

  INSERT INTO public.bookings (
    id,
    restaurant_id,
    customer_id,
    booking_date,
    start_time,
    end_time,
    start_at,
    end_at,
    party_size,
    status,
    customer_name,
    customer_email,
    customer_phone,
    reference
  ) VALUES
    (
      v_cancelled_booking_id,
      v_restaurant_id,
      v_customer_id,
      DATE '2099-08-08',
      TIME '19:00',
      TIME '20:30',
      TIMESTAMPTZ '2099-08-08 19:00:00+00',
      TIMESTAMPTZ '2099-08-08 20:30:00+00',
      2,
      'confirmed',
      'Synthetic fixture',
      'terminal-allocation@test.invalid',
      '0000000000',
      'REG-CANCELLED'
    ),
    (
      v_confirmed_booking_id,
      v_restaurant_id,
      v_customer_id,
      DATE '2099-08-08',
      TIME '19:00',
      TIME '20:30',
      TIMESTAMPTZ '2099-08-08 19:00:00+00',
      TIMESTAMPTZ '2099-08-08 20:30:00+00',
      2,
      'confirmed',
      'Synthetic fixture',
      'terminal-allocation@test.invalid',
      '0000000000',
      'REG-CONFIRMED'
    ),
    (
      v_failed_booking_id,
      v_restaurant_id,
      v_customer_id,
      DATE '2099-08-08',
      TIME '19:00',
      TIME '20:30',
      TIMESTAMPTZ '2099-08-08 19:00:00+00',
      TIMESTAMPTZ '2099-08-08 20:30:00+00',
      2,
      'confirmed',
      'Synthetic fixture',
      'terminal-allocation@test.invalid',
      '0000000000',
      'REG-FAILED'
    );

  PERFORM public.assign_tables_atomic_v2(
    v_cancelled_booking_id,
    ARRAY[v_table_id],
    'terminal-release-old',
    false,
    NULL,
    TIMESTAMPTZ '2099-08-08 19:00:00+00',
    TIMESTAMPTZ '2099-08-08 20:30:00+00'
  );

  UPDATE public.bookings
  SET status = 'cancelled'
  WHERE id = v_cancelled_booking_id
    AND restaurant_id = v_restaurant_id;

  SELECT count(*) INTO v_assignment_count
  FROM public.booking_table_assignments bta
  JOIN public.bookings b ON b.id = bta.booking_id
  WHERE bta.booking_id = v_cancelled_booking_id
    AND b.restaurant_id = v_restaurant_id;

  SELECT count(*) INTO v_allocation_count
  FROM public.allocations
  WHERE booking_id = v_cancelled_booking_id
    AND restaurant_id = v_restaurant_id;

  IF v_assignment_count <> 0 OR v_allocation_count <> 0 THEN
    RAISE EXCEPTION
      'cancelled booking retained active table state: assignments=%, allocations=%',
      v_assignment_count,
      v_allocation_count;
  END IF;

  SELECT result.cancelled
  INTO v_cancelled_again
  FROM public.cancel_booking_and_release_table_state(
    v_cancelled_booking_id,
    v_restaurant_id
  ) AS result;

  IF v_cancelled_again THEN
    RAISE EXCEPTION 'idempotent cancellation reported a duplicate state transition';
  END IF;

  IF NOT public.is_table_available_v2(
    v_table_id,
    TIMESTAMPTZ '2099-08-08 19:00:00+00',
    TIMESTAMPTZ '2099-08-08 20:30:00+00',
    v_confirmed_booking_id
  ) THEN
    RAISE EXCEPTION 'planner availability still treats the cancelled booking as blocking';
  END IF;

  PERFORM public.assign_tables_atomic_v2(
    v_confirmed_booking_id,
    ARRAY[v_table_id],
    'terminal-release-new',
    false,
    NULL,
    TIMESTAMPTZ '2099-08-08 19:00:00+00',
    TIMESTAMPTZ '2099-08-08 20:30:00+00'
  );

  PERFORM public.assign_tables_atomic_v2(
    v_confirmed_booking_id,
    ARRAY[v_table_id],
    'terminal-release-new',
    false,
    NULL,
    TIMESTAMPTZ '2099-08-08 19:00:00+00',
    TIMESTAMPTZ '2099-08-08 20:30:00+00'
  );

  SELECT count(*) INTO v_assignment_count
  FROM public.booking_table_assignments
  WHERE booking_id = v_confirmed_booking_id
    AND table_id = v_table_id;

  IF v_assignment_count <> 1 THEN
    RAISE EXCEPTION 'confirmation retry created % assignments instead of exactly one', v_assignment_count;
  END IF;

  BEGIN
    PERFORM public.assign_tables_atomic_v2(
      v_failed_booking_id,
      ARRAY[v_table_id],
      'terminal-release-failed',
      false,
      NULL,
      TIMESTAMPTZ '2099-08-08 19:00:00+00',
      TIMESTAMPTZ '2099-08-08 20:30:00+00'
    );
    RAISE EXCEPTION 'overlapping active booking assignment unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      v_failure := SQLERRM;
  END;

  SELECT count(*) INTO v_assignment_count
  FROM public.booking_table_assignments
  WHERE booking_id = v_failed_booking_id;

  SELECT count(*) INTO v_allocation_count
  FROM public.allocations
  WHERE booking_id = v_failed_booking_id
    AND restaurant_id = v_restaurant_id;

  IF v_assignment_count <> 0 OR v_allocation_count <> 0 THEN
    RAISE EXCEPTION
      'failed assignment left partial state: assignments=%, allocations=%, cause=%',
      v_assignment_count,
      v_allocation_count,
      v_failure;
  END IF;

  INSERT INTO public.bookings (
    id,
    restaurant_id,
    customer_id,
    booking_date,
    start_time,
    end_time,
    start_at,
    end_at,
    party_size,
    status,
    customer_name,
    customer_email,
    customer_phone,
    reference
  ) VALUES
    (
      v_checked_in_booking_id,
      v_restaurant_id,
      v_customer_id,
      DATE '2099-08-09',
      TIME '19:00',
      TIME '20:30',
      TIMESTAMPTZ '2099-08-09 19:00:00+00',
      TIMESTAMPTZ '2099-08-09 20:30:00+00',
      2,
      'confirmed',
      'Synthetic fixture',
      'terminal-allocation@test.invalid',
      '0000000000',
      'REG-CHECKED-IN'
    ),
    (
      v_after_check_in_booking_id,
      v_restaurant_id,
      v_customer_id,
      DATE '2099-08-09',
      TIME '19:00',
      TIME '20:30',
      TIMESTAMPTZ '2099-08-09 19:00:00+00',
      TIMESTAMPTZ '2099-08-09 20:30:00+00',
      2,
      'confirmed',
      'Synthetic fixture',
      'terminal-allocation@test.invalid',
      '0000000000',
      'REG-AFTER-CHECK-IN'
    );

  PERFORM public.assign_tables_atomic_v2(
    v_checked_in_booking_id,
    ARRAY[v_table_id],
    'terminal-release-checked-in',
    false,
    NULL,
    TIMESTAMPTZ '2099-08-09 19:00:00+00',
    TIMESTAMPTZ '2099-08-09 20:30:00+00'
  );

  UPDATE public.bookings
  SET
    status = 'checked_in',
    checked_in_at = TIMESTAMPTZ '2099-08-09 19:01:00+00'
  WHERE id = v_checked_in_booking_id
    AND restaurant_id = v_restaurant_id;

  IF NOT public.is_table_available_v2(
    v_table_id,
    TIMESTAMPTZ '2099-08-09 19:00:00+00',
    TIMESTAMPTZ '2099-08-09 20:30:00+00',
    v_after_check_in_booking_id
  ) THEN
    RAISE EXCEPTION 'planner availability still treats checked-in allocation state as blocking';
  END IF;

  PERFORM public.assign_tables_atomic_v2(
    v_after_check_in_booking_id,
    ARRAY[v_table_id],
    'terminal-release-after-check-in',
    false,
    NULL,
    TIMESTAMPTZ '2099-08-09 19:00:00+00',
    TIMESTAMPTZ '2099-08-09 20:30:00+00'
  );

  SELECT count(*) INTO v_assignment_count
  FROM public.booking_table_assignments
  WHERE booking_id = v_after_check_in_booking_id
    AND table_id = v_table_id;

  SELECT count(*) INTO v_allocation_count
  FROM public.allocations
  WHERE booking_id = v_checked_in_booking_id
    AND restaurant_id = v_restaurant_id;

  IF v_assignment_count <> 1 OR v_allocation_count <> 0 THEN
    RAISE EXCEPTION
      'checked-in state was not deactivated before reassignment: new assignments=%, old allocations=%',
      v_assignment_count,
      v_allocation_count;
  END IF;

  UPDATE public.bookings
  SET status = 'no_show'
  WHERE id = v_after_check_in_booking_id
    AND restaurant_id = v_restaurant_id;

  UPDATE public.bookings
  SET
    status = 'completed',
    checked_out_at = TIMESTAMPTZ '2099-08-09 20:31:00+00'
  WHERE id = v_checked_in_booking_id
    AND restaurant_id = v_restaurant_id;

  SELECT count(*) INTO v_assignment_count
  FROM public.booking_table_assignments
  WHERE booking_id IN (v_checked_in_booking_id, v_after_check_in_booking_id);

  SELECT count(*) INTO v_allocation_count
  FROM public.allocations
  WHERE booking_id IN (v_checked_in_booking_id, v_after_check_in_booking_id)
    AND restaurant_id = v_restaurant_id;

  IF v_assignment_count <> 0 OR v_allocation_count <> 0 THEN
    RAISE EXCEPTION
      'completed or no-show booking retained active table state: assignments=%, allocations=%',
      v_assignment_count,
      v_allocation_count;
  END IF;
END;
$regression$;

ROLLBACK;
