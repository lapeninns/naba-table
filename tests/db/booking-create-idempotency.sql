-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
--
-- Booking creation is idempotent per (restaurant_id, idempotency_key), enforced by the database.
--
-- Run through `DB_TARGET_ENV=staging pnpm db:sql-regression`, which executes the synthetic
-- fixtures inside the same transaction and verifies the trailing ROLLBACK by comparing row
-- counts. Assertion failures raise SQLSTATE NB001, which no handler in this file catches.
-- Transactional rollback undoes rows only; nothing here may enqueue an external message.
-- Concurrency (two sessions, same key) cannot run inside one transaction; it is covered by the
-- race script next to the local Postgres harness and by the unique index asserted below.
BEGIN;
SET LOCAL app.capacity.post_assignment.enabled = 'off';

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  v_customer_id constant uuid := '00000000-0000-4000-8000-00000000c001';
  v_key constant text := 'regression-create-idempotency-key-1';
  v_pending_key constant text := 'regression-create-idempotency-key-2';
  v_first jsonb;
  v_replay jsonb;
  v_reused jsonb;
  v_other_tenant jsonb;
  v_pending jsonb;
  v_internal jsonb;
  v_booking_id uuid;
  v_count integer;
  v_duplicate_rejected boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = v_customer_id AND restaurant_id = v_restaurant_id
  ) THEN
    RAISE EXCEPTION 'synthetic fixture customer is missing; run through the sql-regression runner'
      USING ERRCODE = 'NB001';
  END IF;

  -- Open every day 09:00-23:00 at both synthetic restaurants through the real schedule RPC.
  PERFORM public.replace_restaurant_operating_hours(
    v_restaurant_id,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id', ('00000000-0000-4000-8000-0000000f000' || d)::uuid,
        'day_of_week', d, 'opens_at', '09:00', 'closes_at', '23:00', 'is_closed', false))
      FROM generate_series(0, 6) d
    )
  );
  PERFORM public.replace_restaurant_operating_hours(
    v_other_restaurant_id,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id', ('00000000-0000-4000-8000-0000000f100' || d)::uuid,
        'day_of_week', d, 'opens_at', '09:00', 'closes_at', '23:00', 'is_closed', false))
      FROM generate_series(0, 6) d
    )
  );

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'bookings'
      AND indexname = 'bookings_restaurant_idempotency_key_unique'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%(restaurant_id, idempotency_key)%WHERE (idempotency_key IS NOT NULL)%'
  ) THEN
    RAISE EXCEPTION 'unique partial index on bookings(restaurant_id, idempotency_key) is missing'
      USING ERRCODE = 'NB001';
  END IF;

  -- 1. First call inserts one confirmed booking (the default initial status is unchanged).
  v_first := public.create_booking_with_capacity_check(
    v_restaurant_id, v_customer_id, DATE '2099-09-01', TIME '19:00', TIME '20:30', 2, 'dinner',
    'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000031', 'any',
    NULL, false, v_key, 'api', NULL, 'regression-request-1', '{}'::jsonb, 0
  );
  IF (v_first ->> 'success')::boolean IS NOT TRUE OR (v_first ->> 'duplicate')::boolean THEN
    RAISE EXCEPTION 'first create did not insert: %', v_first ->> 'error' USING ERRCODE = 'NB001';
  END IF;
  v_booking_id := (v_first -> 'booking' ->> 'id')::uuid;
  IF v_first -> 'booking' ->> 'status' <> 'confirmed' THEN
    RAISE EXCEPTION 'default initial status changed to %', v_first -> 'booking' ->> 'status'
      USING ERRCODE = 'NB001';
  END IF;

  -- 2. Same key, same payload: the same booking with duplicate:true, no second row.
  v_replay := public.create_booking_with_capacity_check(
    v_restaurant_id, v_customer_id, DATE '2099-09-01', TIME '19:00:00', TIME '20:30', 2, 'dinner',
    'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000031', 'any',
    NULL, false, v_key, 'api', NULL, 'regression-request-2', '{}'::jsonb, 0
  );
  IF (v_replay ->> 'success')::boolean IS NOT TRUE
     OR (v_replay ->> 'duplicate')::boolean IS NOT TRUE
     OR (v_replay -> 'booking' ->> 'id')::uuid IS DISTINCT FROM v_booking_id THEN
    RAISE EXCEPTION 'same-key replay did not return the original booking' USING ERRCODE = 'NB001';
  END IF;

  -- 3. Same key, different party size / date / time: IDEMPOTENCY_KEY_REUSED, no booking data.
  v_reused := public.create_booking_with_capacity_check(
    v_restaurant_id, v_customer_id, DATE '2099-09-01', TIME '19:00', TIME '20:30', 4, 'dinner',
    'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000031', 'any',
    NULL, false, v_key, 'api', NULL, 'regression-request-3', '{}'::jsonb, 0
  );
  IF (v_reused ->> 'success')::boolean IS NOT FALSE
     OR v_reused ->> 'error' <> 'IDEMPOTENCY_KEY_REUSED'
     OR (v_reused -> 'details' ->> 'idempotencyConflict')::boolean IS NOT TRUE
     OR v_reused ? 'booking' THEN
    RAISE EXCEPTION 'reused key with a different party size was not rejected: %', v_reused
      USING ERRCODE = 'NB001';
  END IF;

  v_reused := public.create_booking_with_capacity_check(
    v_restaurant_id, v_customer_id, DATE '2099-09-02', TIME '19:00', TIME '20:30', 2, 'dinner',
    'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000031', 'any',
    NULL, false, v_key, 'api', NULL, 'regression-request-4', '{}'::jsonb, 0
  );
  IF v_reused ->> 'error' IS DISTINCT FROM 'IDEMPOTENCY_KEY_REUSED' THEN
    RAISE EXCEPTION 'reused key with a different date was not rejected' USING ERRCODE = 'NB001';
  END IF;

  v_reused := public.create_booking_with_capacity_check(
    v_restaurant_id, v_customer_id, DATE '2099-09-01', TIME '19:30', TIME '21:00', 2, 'dinner',
    'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000031', 'any',
    NULL, false, v_key, 'api', NULL, 'regression-request-5', '{}'::jsonb, 0
  );
  IF v_reused ->> 'error' IS DISTINCT FROM 'IDEMPOTENCY_KEY_REUSED' THEN
    RAISE EXCEPTION 'reused key with a different time was not rejected' USING ERRCODE = 'NB001';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.bookings
  WHERE restaurant_id = v_restaurant_id AND idempotency_key = v_key;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one booking for the key, found %', v_count
      USING ERRCODE = 'NB001';
  END IF;

  -- 4. A key replay still returns the booking after it was cancelled (key semantics, not slot
  --    semantics); signature recovery in the app is what ignores cancelled bookings.
  UPDATE public.bookings SET status = 'cancelled'
  WHERE id = v_booking_id AND restaurant_id = v_restaurant_id;
  v_replay := public.create_booking_with_capacity_check(
    v_restaurant_id, v_customer_id, DATE '2099-09-01', TIME '19:00', TIME '20:30', 2, 'dinner',
    'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000031', 'any',
    NULL, false, v_key, 'api', NULL, 'regression-request-6', '{}'::jsonb, 0
  );
  IF (v_replay ->> 'duplicate')::boolean IS NOT TRUE
     OR v_replay -> 'booking' ->> 'status' <> 'cancelled' THEN
    RAISE EXCEPTION 'key replay after cancellation created a new booking' USING ERRCODE = 'NB001';
  END IF;

  -- 5. The same key at another restaurant is a different intent.
  v_other_tenant := public.create_booking_with_capacity_check(
    v_other_restaurant_id, v_customer_id, DATE '2099-09-01', TIME '19:00', TIME '20:30', 2, 'dinner',
    'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000031', 'any',
    NULL, false, v_key, 'api', NULL, 'regression-request-7', '{}'::jsonb, 0
  );
  IF (v_other_tenant ->> 'success')::boolean IS NOT TRUE
     OR (v_other_tenant ->> 'duplicate')::boolean
     OR (v_other_tenant -> 'booking' ->> 'restaurant_id')::uuid IS DISTINCT FROM v_other_restaurant_id THEN
    RAISE EXCEPTION 'same key at another restaurant was not an independent booking'
      USING ERRCODE = 'NB001';
  END IF;

  -- 6. The unique index rejects a direct duplicate insert (the race arbiter).
  BEGIN
    INSERT INTO public.bookings (
      restaurant_id, customer_id, booking_date, start_time, end_time, start_at, end_at,
      party_size, status, customer_name, customer_email, customer_phone, reference,
      idempotency_key
    ) VALUES (
      v_restaurant_id, v_customer_id, DATE '2099-09-03', TIME '19:00', TIME '20:30',
      TIMESTAMPTZ '2099-09-03 19:00:00+00', TIMESTAMPTZ '2099-09-03 20:30:00+00',
      2, 'confirmed', 'Synthetic fixture', 'synthetic-regression@test.invalid',
      '+447000000031', 'REG-IDEMP-DUP', v_key
    );
  EXCEPTION
    WHEN unique_violation THEN
      v_duplicate_rejected := true;
  END;
  IF NOT v_duplicate_rejected THEN
    RAISE EXCEPTION 'duplicate (restaurant_id, idempotency_key) insert was accepted'
      USING ERRCODE = 'NB001';
  END IF;

  -- 7. p_details.initial_status = pending inserts pending in the same statement and is not stored.
  v_pending := public.create_booking_with_capacity_check(
    v_restaurant_id, v_customer_id, DATE '2099-09-04', TIME '19:00', TIME '20:30', 2, 'dinner',
    'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000031', 'any',
    NULL, false, v_pending_key, 'api', NULL, 'regression-request-8',
    jsonb_build_object('initial_status', 'pending', 'channel_hint', 'regression'), 0
  );
  IF (v_pending ->> 'success')::boolean IS NOT TRUE
     OR v_pending -> 'booking' ->> 'status' <> 'pending'
     OR (v_pending -> 'booking' -> 'details') ? 'initial_status'
     OR v_pending -> 'booking' -> 'details' ->> 'channel_hint' IS DISTINCT FROM 'regression' THEN
    RAISE EXCEPTION 'initial_status pending was not applied atomically: %', v_pending -> 'booking'
      USING ERRCODE = 'NB001';
  END IF;

  -- 8. Unexpected failures no longer return raw SQLERRM to the caller.
  v_internal := public.create_booking_with_capacity_check(
    v_restaurant_id, v_customer_id, DATE '2099-09-05', TIME '19:00', TIME '20:30', 2, 'dinner',
    'Synthetic fixture', 'synthetic-regression@test.invalid', '+447000000031', 'not-a-seating',
    NULL, false, NULL, 'api', NULL, 'regression-request-9', '{}'::jsonb, 0
  );
  IF v_internal ->> 'error' IS DISTINCT FROM 'INTERNAL_ERROR' OR v_internal ? 'sqlerrm' THEN
    RAISE EXCEPTION 'internal error payload leaked database text' USING ERRCODE = 'NB001';
  END IF;

  -- 9. The RPCs stay service-role only.
  IF has_function_privilege(
       'anon',
       'public.create_booking_with_capacity_check(uuid,uuid,date,time,time,integer,text,text,text,text,text,text,boolean,text,text,uuid,text,jsonb,integer)',
       'EXECUTE')
     OR has_function_privilege(
       'authenticated',
       'public.booking_create_idempotent_replay_result(public.bookings,uuid,date,time,integer)',
       'EXECUTE')
     OR NOT has_function_privilege(
       'service_role',
       'public.create_booking_with_capacity_check(uuid,uuid,date,time,time,integer,text,text,text,text,text,text,boolean,text,text,uuid,text,jsonb,integer)',
       'EXECUTE') THEN
    RAISE EXCEPTION 'booking create RPC privileges drifted' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'nabatable-regression: booking-create-idempotency passed';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'nabatable-regression: booking-create-idempotency FAILED (SQLSTATE %)', SQLSTATE;
    RAISE;
END;
$regression$;

ROLLBACK;
