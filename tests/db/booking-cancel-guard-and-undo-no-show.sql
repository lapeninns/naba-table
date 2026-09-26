-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
--
-- Cancellation status guard and undo-no-show table restoration
-- (20260927110000_booking_cancel_guard_and_undo_no_show_restore.sql).
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
  v_zone_id constant uuid := '00000000-0000-4000-8000-00000000d001';
  v_table_id constant uuid := '00000000-0000-4000-8000-00000000e001';
  v_completed_booking_id constant uuid := '00000000-0000-4000-8000-00000000b001';
  v_confirmed_booking_id constant uuid := '00000000-0000-4000-8000-00000000b002';
  v_checked_in_booking_id constant uuid := '00000000-0000-4000-8000-00000000b301';
  v_no_show_booking_id constant uuid := '00000000-0000-4000-8000-00000000b302';
  v_taker_booking_id constant uuid := '00000000-0000-4000-8000-00000000b303';
  v_legacy_booking_id constant uuid := '00000000-0000-4000-8000-00000000b304';
  v_tableless_booking_id constant uuid := '00000000-0000-4000-8000-00000000b305';
  v_second_table_id constant uuid := '00000000-0000-4000-8000-00000000e301';
  v_now constant timestamptz := TIMESTAMPTZ '2099-03-03 19:10:00+00';
  v_sqlstate text;
  v_detail text;
  v_message text;
  v_cancelled boolean;
  v_status public.booking_status;
  v_history_id bigint;
  v_metadata jsonb;
  v_restoration text;
  v_released uuid[];
  v_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.table_inventory
    WHERE id = v_table_id AND restaurant_id = v_restaurant_id
  ) THEN
    RAISE EXCEPTION 'synthetic fixture table is missing; run through the sql-regression runner'
      USING ERRCODE = 'NB001';
  END IF;

  INSERT INTO public.table_inventory (id, restaurant_id, table_number, capacity, zone_id, category)
  VALUES (v_second_table_id, v_restaurant_id, 'SYN-301', 4, v_zone_id, 'dining');

  INSERT INTO public.bookings (
    id, restaurant_id, customer_id, booking_date, start_time, end_time, start_at, end_at,
    party_size, status, customer_name, customer_email, customer_phone, reference, checked_in_at
  ) VALUES
    (v_checked_in_booking_id, v_restaurant_id, v_customer_id, DATE '2099-03-03', TIME '19:00',
     TIME '20:30', TIMESTAMPTZ '2099-03-03 19:00:00+00', TIMESTAMPTZ '2099-03-03 20:30:00+00',
     2, 'checked_in', 'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000030',
     'REG-S3A-CHECKED-IN', TIMESTAMPTZ '2099-03-03 19:01:00+00'),
    (v_no_show_booking_id, v_restaurant_id, v_customer_id, DATE '2099-03-03', TIME '19:00',
     TIME '20:30', TIMESTAMPTZ '2099-03-03 19:00:00+00', TIMESTAMPTZ '2099-03-03 20:30:00+00',
     2, 'confirmed', 'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000031',
     'REG-S3A-NO-SHOW', NULL),
    (v_taker_booking_id, v_restaurant_id, v_customer_id, DATE '2099-03-03', TIME '19:30',
     TIME '21:00', TIMESTAMPTZ '2099-03-03 19:30:00+00', TIMESTAMPTZ '2099-03-03 21:00:00+00',
     2, 'confirmed', 'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000032',
     'REG-S3A-TAKER', NULL),
    (v_legacy_booking_id, v_restaurant_id, v_customer_id, DATE '2099-03-04', TIME '19:00',
     TIME '20:30', TIMESTAMPTZ '2099-03-04 19:00:00+00', TIMESTAMPTZ '2099-03-04 20:30:00+00',
     2, 'confirmed', 'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000033',
     'REG-S3A-LEGACY', NULL),
    (v_tableless_booking_id, v_restaurant_id, v_customer_id, DATE '2099-03-05', TIME '19:00',
     TIME '20:30', TIMESTAMPTZ '2099-03-05 19:00:00+00', TIMESTAMPTZ '2099-03-05 20:30:00+00',
     2, 'confirmed', 'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000034',
     'REG-S3A-TABLELESS', NULL);

  -- 1. Cancellation guard: checked_in, completed and no_show are rejected with P0004.
  FOREACH v_status IN ARRAY ARRAY['checked_in', 'completed']::public.booking_status[] LOOP
    v_sqlstate := NULL;
    BEGIN
      PERFORM public.cancel_booking_and_release_table_state(
        CASE WHEN v_status = 'checked_in' THEN v_checked_in_booking_id ELSE v_completed_booking_id END,
        v_restaurant_id
      );
      RAISE EXCEPTION 'cancelling a % booking unexpectedly succeeded', v_status
        USING ERRCODE = 'NB001';
    EXCEPTION
      WHEN SQLSTATE 'NB001' THEN RAISE;
      -- P0004 is assert_failure, which WHEN OTHERS does not catch.
      WHEN SQLSTATE 'P0004' THEN
        GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT,
          v_detail = PG_EXCEPTION_DETAIL;
    END;
    IF v_sqlstate IS DISTINCT FROM 'P0004' OR v_message <> 'booking_not_cancellable'
       OR (v_detail::jsonb ->> 'currentStatus') IS DISTINCT FROM v_status::text THEN
      RAISE EXCEPTION 'cancel guard for % raised % / % / %', v_status, v_sqlstate, v_message, v_detail
        USING ERRCODE = 'NB001';
    END IF;
  END LOOP;

  SELECT status INTO v_status FROM public.bookings WHERE id = v_checked_in_booking_id;
  IF v_status <> 'checked_in' THEN
    RAISE EXCEPTION 'rejected cancellation changed the status to %', v_status USING ERRCODE = 'NB001';
  END IF;

  -- Cancellable status: first call cancels, the replay is an idempotent no-op.
  SELECT result.cancelled INTO v_cancelled
  FROM public.cancel_booking_and_release_table_state(v_confirmed_booking_id, v_restaurant_id) AS result;
  IF v_cancelled IS NOT TRUE THEN
    RAISE EXCEPTION 'confirmed booking was not cancelled' USING ERRCODE = 'NB001';
  END IF;
  SELECT result.cancelled INTO v_cancelled
  FROM public.cancel_booking_and_release_table_state(v_confirmed_booking_id, v_restaurant_id) AS result;
  IF v_cancelled IS NOT FALSE THEN
    RAISE EXCEPTION 'repeat cancellation was not idempotent' USING ERRCODE = 'NB001';
  END IF;

  -- 2. No-show through the releasing RPC records the released tables.
  PERFORM public.assign_tables_atomic_v2(
    v_no_show_booking_id, ARRAY[v_table_id], 'reg-s3a-no-show', false, NULL,
    TIMESTAMPTZ '2099-03-03 19:00:00+00', TIMESTAMPTZ '2099-03-03 20:30:00+00'
  );

  PERFORM public.apply_booking_state_transition_and_clear_assignments(
    v_no_show_booking_id, 'no_show', NULL, NULL, v_now, 'confirmed', 'no_show', NULL, v_now,
    'status_change', jsonb_build_object('action', 'no-show', 'previousStatus', 'confirmed')
  );

  SELECT id, metadata INTO v_history_id, v_metadata
  FROM public.booking_state_history
  WHERE booking_id = v_no_show_booking_id AND to_status = 'no_show'
  ORDER BY id DESC LIMIT 1;

  IF v_metadata -> 'releasedTables' -> 'tableIds' IS DISTINCT FROM jsonb_build_array(v_table_id)
     OR (v_metadata ->> 'action') IS DISTINCT FROM 'no-show' THEN
    RAISE EXCEPTION 'no-show history did not record released tables: %', v_metadata
      USING ERRCODE = 'NB001';
  END IF;

  SELECT count(*) INTO v_count FROM public.booking_table_assignments
  WHERE booking_id = v_no_show_booking_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'no-show kept % assignments', v_count USING ERRCODE = 'NB001';
  END IF;

  -- 3. Undo restores the table when it is still free, atomically with the status.
  SELECT result.table_restoration, result.released_table_ids, result.status
  INTO v_restoration, v_released, v_status
  FROM public.undo_booking_no_show(
    v_no_show_booking_id, v_restaurant_id, v_history_id, 'confirmed', NULL, NULL,
    v_now + interval '1 minute', NULL, v_now + interval '1 minute', 'undo', '{}'::jsonb
  ) AS result;

  IF v_restoration <> 'restored' OR v_status <> 'confirmed' OR v_released <> ARRAY[v_table_id] THEN
    RAISE EXCEPTION 'undo did not restore: % % %', v_restoration, v_status, v_released
      USING ERRCODE = 'NB001';
  END IF;

  SELECT count(*) INTO v_count FROM public.booking_table_assignments
  WHERE booking_id = v_no_show_booking_id AND table_id = v_table_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'restored assignment missing' USING ERRCODE = 'NB001';
  END IF;

  SELECT metadata INTO v_metadata FROM public.booking_state_history
  WHERE booking_id = v_no_show_booking_id AND from_status = 'no_show'
  ORDER BY id DESC LIMIT 1;
  IF (v_metadata ->> 'tableRestoration') IS DISTINCT FROM 'restored' THEN
    RAISE EXCEPTION 'undo history lacks the restoration outcome: %', v_metadata
      USING ERRCODE = 'NB001';
  END IF;

  -- A second undo of the same no-show loses the compare-and-set.
  v_sqlstate := NULL;
  BEGIN
    PERFORM public.undo_booking_no_show(
      v_no_show_booking_id, v_restaurant_id, v_history_id, 'confirmed', NULL, NULL,
      v_now + interval '2 minutes', NULL, v_now + interval '2 minutes', 'undo', '{}'::jsonb
    );
    RAISE EXCEPTION 'stale undo unexpectedly succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE 'P0004' THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_sqlstate IS DISTINCT FROM 'P0004' OR v_message <> 'booking_state_conflict' THEN
    RAISE EXCEPTION 'stale undo raised % %', v_sqlstate, v_message USING ERRCODE = 'NB001';
  END IF;

  -- 4. Undo reports unavailable (and assigns nothing) when the table was taken meanwhile.
  PERFORM public.apply_booking_state_transition_and_clear_assignments(
    v_no_show_booking_id, 'no_show', NULL, NULL, v_now + interval '3 minutes', 'confirmed',
    'no_show', NULL, v_now + interval '3 minutes', 'status_change',
    jsonb_build_object('previousStatus', 'confirmed')
  );
  SELECT id INTO v_history_id FROM public.booking_state_history
  WHERE booking_id = v_no_show_booking_id AND to_status = 'no_show'
  ORDER BY id DESC LIMIT 1;

  PERFORM public.assign_tables_atomic_v2(
    v_taker_booking_id, ARRAY[v_table_id], 'reg-s3a-taker', false, NULL,
    TIMESTAMPTZ '2099-03-03 19:30:00+00', TIMESTAMPTZ '2099-03-03 21:00:00+00'
  );

  SELECT result.table_restoration, result.status INTO v_restoration, v_status
  FROM public.undo_booking_no_show(
    v_no_show_booking_id, v_restaurant_id, v_history_id, 'confirmed', NULL, NULL,
    v_now + interval '4 minutes', NULL, v_now + interval '4 minutes', 'undo', '{}'::jsonb
  ) AS result;

  IF v_restoration <> 'unavailable' OR v_status <> 'confirmed' THEN
    RAISE EXCEPTION 'undo over a taken table returned % %', v_restoration, v_status
      USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_count FROM public.booking_table_assignments
  WHERE booking_id = v_no_show_booking_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'unavailable restore left % partial assignments', v_count USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_count FROM public.booking_table_assignments
  WHERE booking_id = v_taker_booking_id AND table_id = v_table_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'restore disturbed the other booking''s table' USING ERRCODE = 'NB001';
  END IF;

  -- 5. Legacy no-show (plain transition, trigger release, no record) reports unknown.
  PERFORM public.assign_tables_atomic_v2(
    v_legacy_booking_id, ARRAY[v_second_table_id], 'reg-s3a-legacy', false, NULL,
    TIMESTAMPTZ '2099-03-04 19:00:00+00', TIMESTAMPTZ '2099-03-04 20:30:00+00'
  );
  PERFORM public.apply_booking_state_transition(
    v_legacy_booking_id, 'no_show', NULL, NULL, v_now, 'confirmed', 'no_show', NULL, v_now,
    'status_change', '{}'::jsonb
  );
  SELECT id INTO v_history_id FROM public.booking_state_history
  WHERE booking_id = v_legacy_booking_id AND to_status = 'no_show' ORDER BY id DESC LIMIT 1;
  SELECT result.table_restoration INTO v_restoration
  FROM public.undo_booking_no_show(
    v_legacy_booking_id, v_restaurant_id, v_history_id, 'confirmed', NULL, NULL,
    v_now + interval '1 minute', NULL, v_now + interval '1 minute', 'undo', '{}'::jsonb
  ) AS result;
  IF v_restoration <> 'unknown' THEN
    RAISE EXCEPTION 'legacy undo returned %', v_restoration USING ERRCODE = 'NB001';
  END IF;

  -- 6. A no-show that released nothing reports not_needed.
  PERFORM public.apply_booking_state_transition_and_clear_assignments(
    v_tableless_booking_id, 'no_show', NULL, NULL, v_now, 'confirmed', 'no_show', NULL, v_now,
    'status_change', '{}'::jsonb
  );
  SELECT id INTO v_history_id FROM public.booking_state_history
  WHERE booking_id = v_tableless_booking_id AND to_status = 'no_show' ORDER BY id DESC LIMIT 1;
  SELECT result.table_restoration INTO v_restoration
  FROM public.undo_booking_no_show(
    v_tableless_booking_id, v_restaurant_id, v_history_id, 'confirmed', NULL, NULL,
    v_now + interval '1 minute', NULL, v_now + interval '1 minute', 'undo', '{}'::jsonb
  ) AS result;
  IF v_restoration <> 'not_needed' THEN
    RAISE EXCEPTION 'tableless undo returned %', v_restoration USING ERRCODE = 'NB001';
  END IF;

  -- 7. The now-restored no_show path: a no_show booking cannot be cancelled either.
  PERFORM public.apply_booking_state_transition(
    v_tableless_booking_id, 'no_show', NULL, NULL, v_now + interval '2 minutes', 'confirmed',
    'no_show', NULL, v_now + interval '2 minutes', 'status_change', '{}'::jsonb
  );
  v_sqlstate := NULL;
  BEGIN
    PERFORM public.cancel_booking_and_release_table_state(v_tableless_booking_id, v_restaurant_id);
    RAISE EXCEPTION 'cancelling a no_show booking unexpectedly succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE 'P0004' THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_sqlstate IS DISTINCT FROM 'P0004' OR v_message <> 'booking_not_cancellable' THEN
    RAISE EXCEPTION 'no_show cancel raised % %', v_sqlstate, v_message USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'nabatable-regression: booking-cancel-guard-and-undo-no-show passed';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'nabatable-regression: booking-cancel-guard-and-undo-no-show FAILED (SQLSTATE %)', SQLSTATE;
    RAISE;
END;
$regression$;

ROLLBACK;
