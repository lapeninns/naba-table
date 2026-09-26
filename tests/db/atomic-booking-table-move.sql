-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
--
-- Atomic booking table move (20260927110100_atomic_booking_table_move.sql).
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
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  v_customer_id constant uuid := '00000000-0000-4000-8000-00000000c001';
  v_zone_id constant uuid := '00000000-0000-4000-8000-00000000d001';
  v_table_a constant uuid := '00000000-0000-4000-8000-00000000e001';
  v_table_b constant uuid := '00000000-0000-4000-8000-00000000e311';
  v_table_c constant uuid := '00000000-0000-4000-8000-00000000e312';
  v_table_small constant uuid := '00000000-0000-4000-8000-00000000e313';
  v_completed_booking_id constant uuid := '00000000-0000-4000-8000-00000000b001';
  v_mover_id constant uuid := '00000000-0000-4000-8000-00000000b311';
  v_blocker_id constant uuid := '00000000-0000-4000-8000-00000000b312';
  v_big_party_id constant uuid := '00000000-0000-4000-8000-00000000b313';
  v_result record;
  v_sqlstate text;
  v_message text;
  v_detail text;
  v_count integer;
  v_status public.booking_status;
  v_history_before integer;
  v_history_after integer;
  v_archive_before integer;
  v_archive_after integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.table_inventory
    WHERE id = v_table_a AND restaurant_id = v_restaurant_id
  ) THEN
    RAISE EXCEPTION 'synthetic fixture table is missing; run through the sql-regression runner'
      USING ERRCODE = 'NB001';
  END IF;

  INSERT INTO public.allowed_capacities (restaurant_id, capacity)
  VALUES (v_restaurant_id, 2)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.table_inventory (id, restaurant_id, table_number, capacity, zone_id, category)
  VALUES
    (v_table_b, v_restaurant_id, 'SYN-311', 4, v_zone_id, 'dining'),
    (v_table_c, v_restaurant_id, 'SYN-312', 4, v_zone_id, 'dining'),
    (v_table_small, v_restaurant_id, 'SYN-313', 2, v_zone_id, 'dining');

  INSERT INTO public.bookings (
    id, restaurant_id, customer_id, booking_date, start_time, end_time, start_at, end_at,
    party_size, status, customer_name, customer_email, customer_phone, reference
  ) VALUES
    (v_mover_id, v_restaurant_id, v_customer_id, DATE '2099-04-04', TIME '19:00', TIME '20:30',
     TIMESTAMPTZ '2099-04-04 19:00:00+00', TIMESTAMPTZ '2099-04-04 20:30:00+00', 2, 'confirmed',
     'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000040', 'REG-S3A-MOVER'),
    (v_blocker_id, v_restaurant_id, v_customer_id, DATE '2099-04-04', TIME '19:30', TIME '21:00',
     TIMESTAMPTZ '2099-04-04 19:30:00+00', TIMESTAMPTZ '2099-04-04 21:00:00+00', 2, 'confirmed',
     'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000041', 'REG-S3A-BLOCKER'),
    (v_big_party_id, v_restaurant_id, v_customer_id, DATE '2099-04-05', TIME '19:00', TIME '20:30',
     TIMESTAMPTZ '2099-04-05 19:00:00+00', TIMESTAMPTZ '2099-04-05 20:30:00+00', 4, 'confirmed',
     'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000042', 'REG-S3A-BIG');

  PERFORM public.assign_tables_atomic_v2(
    v_mover_id, ARRAY[v_table_a], 'reg-s3a-move-initial', false, NULL,
    TIMESTAMPTZ '2099-04-04 19:00:00+00', TIMESTAMPTZ '2099-04-04 20:30:00+00'
  );
  PERFORM public.assign_tables_atomic_v2(
    v_blocker_id, ARRAY[v_table_c], 'reg-s3a-move-blocker', false, NULL,
    TIMESTAMPTZ '2099-04-04 19:30:00+00', TIMESTAMPTZ '2099-04-04 21:00:00+00'
  );
  PERFORM public.assign_tables_atomic_v2(
    v_big_party_id, ARRAY[v_table_a], 'reg-s3a-move-big', false, NULL,
    TIMESTAMPTZ '2099-04-05 19:00:00+00', TIMESTAMPTZ '2099-04-05 20:30:00+00'
  );

  SELECT count(*) INTO v_history_before FROM public.booking_state_history WHERE booking_id = v_mover_id;
  SELECT count(*) INTO v_archive_before FROM public.allocations_archive WHERE booking_id = v_mover_id;

  -- 1. Move A -> B: one transaction, status untouched, A released and archived.
  SELECT * INTO v_result
  FROM public.move_booking_tables(v_mover_id, v_restaurant_id, ARRAY[v_table_a], ARRAY[v_table_b],
                                  'reg-s3a-move-1', NULL);

  IF v_result.replayed OR v_result.booking_status <> 'confirmed' OR v_result.table_count <> 1
     OR v_result.total_capacity <> 4
     OR (v_result.assignments -> 0 ->> 'table_id')::uuid <> v_table_b THEN
    RAISE EXCEPTION 'move result unexpected: %', row_to_json(v_result) USING ERRCODE = 'NB001';
  END IF;

  SELECT count(*) INTO v_count FROM public.booking_table_assignments
  WHERE booking_id = v_mover_id AND table_id = v_table_a;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'moved-from table is still assigned' USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_count FROM public.allocations
  WHERE booking_id = v_mover_id AND resource_type = 'table' AND resource_id = v_table_b;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'moved-to table has % allocations', v_count USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_archive_after FROM public.allocations_archive WHERE booking_id = v_mover_id;
  IF v_archive_after <> v_archive_before + 1 THEN
    RAISE EXCEPTION 'released allocation was not archived' USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_history_after FROM public.booking_state_history WHERE booking_id = v_mover_id;
  SELECT status INTO v_status FROM public.bookings WHERE id = v_mover_id;
  IF v_history_after <> v_history_before OR v_status <> 'confirmed' THEN
    RAISE EXCEPTION 'move changed lifecycle state: history %->%, status %',
      v_history_before, v_history_after, v_status USING ERRCODE = 'NB001';
  END IF;

  -- 2. Replay with the same key and tables: no-op, replayed = true.
  SELECT * INTO v_result
  FROM public.move_booking_tables(v_mover_id, v_restaurant_id, ARRAY[v_table_a], ARRAY[v_table_b],
                                  'reg-s3a-move-1', NULL);
  IF NOT v_result.replayed OR (v_result.assignments -> 0 ->> 'table_id')::uuid <> v_table_b THEN
    RAISE EXCEPTION 'replay was not idempotent: %', row_to_json(v_result) USING ERRCODE = 'NB001';
  END IF;

  -- 3. Same key, different tables: idempotency_key_reused (P0003).
  v_sqlstate := NULL;
  BEGIN
    PERFORM public.move_booking_tables(v_mover_id, v_restaurant_id, ARRAY[v_table_b],
                                       ARRAY[v_table_a], 'reg-s3a-move-1', NULL);
    RAISE EXCEPTION 'key reuse unexpectedly succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_sqlstate IS DISTINCT FROM 'P0003' OR v_message <> 'idempotency_key_reused' THEN
    RAISE EXCEPTION 'key reuse raised % %', v_sqlstate, v_message USING ERRCODE = 'NB001';
  END IF;

  -- 4. Target taken by another live booking in an overlapping window: tables_unavailable,
  --    and nothing changes (B stays assigned, no partial release).
  v_sqlstate := NULL;
  BEGIN
    PERFORM public.move_booking_tables(v_mover_id, v_restaurant_id, ARRAY[v_table_b],
                                       ARRAY[v_table_c], 'reg-s3a-move-2', NULL);
    RAISE EXCEPTION 'move onto a taken table unexpectedly succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT,
        v_detail = PG_EXCEPTION_DETAIL;
  END;
  IF v_message IS DISTINCT FROM 'tables_unavailable'
     OR (v_detail::jsonb ->> 'reason') IS DISTINCT FROM 'CONFLICT'
     OR (v_detail::jsonb -> 'tableIds') IS DISTINCT FROM jsonb_build_array(v_table_c) THEN
    RAISE EXCEPTION 'taken-table move raised % % %', v_sqlstate, v_message, v_detail
      USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_count FROM public.booking_table_assignments
  WHERE booking_id = v_mover_id AND table_id = v_table_b;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'failed move released the original table' USING ERRCODE = 'NB001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.booking_table_moves
    WHERE booking_id = v_mover_id AND idempotency_key = 'reg-s3a-move-2'
  ) THEN
    RAISE EXCEPTION 'failed move kept its idempotency claim' USING ERRCODE = 'NB001';
  END IF;

  -- 5. Stale "from": ASSIGNMENTS_CHANGED conflict (P0004 = assert_failure, caught explicitly).
  v_sqlstate := NULL;
  BEGIN
    PERFORM public.move_booking_tables(v_mover_id, v_restaurant_id, ARRAY[v_table_a],
                                       ARRAY[v_table_small], 'reg-s3a-move-3', NULL);
    RAISE EXCEPTION 'stale move unexpectedly succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE 'P0004' THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT,
        v_detail = PG_EXCEPTION_DETAIL;
  END;
  IF v_message IS DISTINCT FROM 'booking_state_conflict'
     OR (v_detail::jsonb ->> 'reason') IS DISTINCT FROM 'ASSIGNMENTS_CHANGED'
     OR (v_detail::jsonb ->> 'currentStatus') IS DISTINCT FROM 'confirmed' THEN
    RAISE EXCEPTION 'stale move raised % % %', v_sqlstate, v_message, v_detail
      USING ERRCODE = 'NB001';
  END IF;

  -- 6. Terminal status: STATUS conflict.
  v_sqlstate := NULL;
  BEGIN
    PERFORM public.move_booking_tables(v_completed_booking_id, v_restaurant_id, ARRAY[v_table_a],
                                       ARRAY[v_table_b], 'reg-s3a-move-4', NULL);
    RAISE EXCEPTION 'moving a completed booking unexpectedly succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE 'P0004' THEN
      GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT, v_detail = PG_EXCEPTION_DETAIL;
  END;
  IF v_message IS DISTINCT FROM 'booking_state_conflict'
     OR (v_detail::jsonb ->> 'reason') IS DISTINCT FROM 'STATUS' THEN
    RAISE EXCEPTION 'completed move raised % %', v_message, v_detail USING ERRCODE = 'NB001';
  END IF;

  -- 7. Resulting set too small for the party: table_selection_invalid CAPACITY.
  v_message := NULL;
  BEGIN
    PERFORM public.move_booking_tables(v_big_party_id, v_restaurant_id, ARRAY[v_table_a],
                                       ARRAY[v_table_small], 'reg-s3a-move-5', NULL);
    RAISE EXCEPTION 'undersized move unexpectedly succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT, v_detail = PG_EXCEPTION_DETAIL;
  END;
  IF v_message IS DISTINCT FROM 'table_selection_invalid'
     OR (v_detail::jsonb ->> 'reason') IS DISTINCT FROM 'CAPACITY' THEN
    RAISE EXCEPTION 'undersized move raised % %', v_message, v_detail USING ERRCODE = 'NB001';
  END IF;

  -- 8. Another tenant's restaurant id cannot address the booking.
  v_sqlstate := NULL;
  BEGIN
    PERFORM public.move_booking_tables(v_mover_id, v_other_restaurant_id, ARRAY[v_table_b],
                                       ARRAY[v_table_a], 'reg-s3a-move-6', NULL);
    RAISE EXCEPTION 'cross-tenant move unexpectedly succeeded' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_sqlstate IS DISTINCT FROM 'P0002' OR v_message <> 'booking_not_found' THEN
    RAISE EXCEPTION 'cross-tenant move raised % %', v_sqlstate, v_message USING ERRCODE = 'NB001';
  END IF;

  -- 9. Moving back B -> A with a fresh key works (A is free again on 2099-04-04).
  SELECT * INTO v_result
  FROM public.move_booking_tables(v_mover_id, v_restaurant_id, ARRAY[v_table_b], ARRAY[v_table_a],
                                  'reg-s3a-move-7', NULL);
  IF v_result.booking_status <> 'confirmed'
     OR (v_result.assignments -> 0 ->> 'table_id')::uuid <> v_table_a THEN
    RAISE EXCEPTION 'move back failed: %', row_to_json(v_result) USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'nabatable-regression: atomic-booking-table-move passed';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'nabatable-regression: atomic-booking-table-move FAILED (SQLSTATE %)', SQLSTATE;
    RAISE;
END;
$regression$;

ROLLBACK;
