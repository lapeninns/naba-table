-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
--
-- Terminal booking states must release table state atomically.
--
-- Run through `DB_TARGET_ENV=staging pnpm db:sql-regression`, which executes the synthetic
-- fixtures inside the same transaction and verifies the trailing ROLLBACK by comparing row
-- counts. Assertion failures raise SQLSTATE NB001, which no handler in this file catches.
-- Transactional rollback undoes rows only; nothing here may enqueue an external message.
BEGIN;
SET LOCAL app.capacity.post_assignment.enabled = 'off';

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_customer_id constant uuid := '00000000-0000-4000-8000-00000000c001';
  v_table_id constant uuid := '00000000-0000-4000-8000-00000000e001';
  v_cancelled_booking_id constant uuid := '00000000-0000-4000-8000-00000000b101';
  v_confirmed_booking_id constant uuid := '00000000-0000-4000-8000-00000000b102';
  v_failed_booking_id constant uuid := '00000000-0000-4000-8000-00000000b103';
  v_checked_in_booking_id constant uuid := '00000000-0000-4000-8000-00000000b104';
  v_after_check_in_booking_id constant uuid := '00000000-0000-4000-8000-00000000b105';
  v_assignment_count integer;
  v_allocation_count integer;
  v_cancelled_again boolean;
  v_failure text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.table_inventory
    WHERE id = v_table_id AND restaurant_id = v_restaurant_id
  ) THEN
    RAISE EXCEPTION 'synthetic fixture table is missing; run through the sql-regression runner'
      USING ERRCODE = 'NB001';
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
      'synthetic-regression@test.invalid',
      '+447000000020',
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
      'synthetic-regression@test.invalid',
      '+447000000020',
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
      'synthetic-regression@test.invalid',
      '+447000000020',
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
      v_allocation_count
      USING ERRCODE = 'NB001';
  END IF;

  SELECT result.cancelled
  INTO v_cancelled_again
  FROM public.cancel_booking_and_release_table_state(
    v_cancelled_booking_id,
    v_restaurant_id
  ) AS result;

  IF v_cancelled_again THEN
    RAISE EXCEPTION 'idempotent cancellation reported a duplicate state transition'
      USING ERRCODE = 'NB001';
  END IF;

  IF NOT public.is_table_available_v2(
    v_table_id,
    TIMESTAMPTZ '2099-08-08 19:00:00+00',
    TIMESTAMPTZ '2099-08-08 20:30:00+00',
    v_confirmed_booking_id
  ) THEN
    RAISE EXCEPTION 'planner availability still treats the cancelled booking as blocking'
      USING ERRCODE = 'NB001';
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
    RAISE EXCEPTION 'confirmation retry created % assignments instead of exactly one',
      v_assignment_count
      USING ERRCODE = 'NB001';
  END IF;

  -- Negative test: the assertion (NB001) is re-raised before the generic handler runs.
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
    RAISE EXCEPTION 'overlapping active booking assignment unexpectedly succeeded'
      USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN
      RAISE;
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
      v_failure
      USING ERRCODE = 'NB001';
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
      'synthetic-regression@test.invalid',
      '+447000000020',
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
      'synthetic-regression@test.invalid',
      '+447000000020',
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
    RAISE EXCEPTION 'planner availability still treats checked-in allocation state as blocking'
      USING ERRCODE = 'NB001';
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
      v_allocation_count
      USING ERRCODE = 'NB001';
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
      v_allocation_count
      USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'nabatable-regression: terminal-booking-table-release passed';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'nabatable-regression: terminal-booking-table-release FAILED (SQLSTATE %)', SQLSTATE;
    RAISE;
END;
$regression$;

ROLLBACK;
