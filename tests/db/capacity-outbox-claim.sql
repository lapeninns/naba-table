-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
-- claim_capacity_outbox_batch claims each due row once: a claimed row is leased
-- (status processing, next_attempt_at = lease expiry) and is not handed out again
-- until the lease elapses. Synthetic rows sort first (created 2000-01-01, no
-- next_attempt_at), so the small limits below never claim unrelated rows.
BEGIN;

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_booking_id constant uuid := '00000000-0000-4000-8000-00000000b002';
  due_row constant uuid := '00000000-0000-4000-8000-0000000c0b01';
  future_row constant uuid := '00000000-0000-4000-8000-0000000c0b02';
  done_row constant uuid := '00000000-0000-4000-8000-0000000c0b03';
  legacy_row constant uuid := '00000000-0000-4000-8000-0000000c0b04';
  poison_row constant uuid := '00000000-0000-4000-8000-0000000c0b05';
  v_claimed uuid[];
  v_row public.capacity_outbox%ROWTYPE;
BEGIN
  INSERT INTO public.capacity_outbox (
    id, event_type, dedupe_key, restaurant_id, booking_id, payload, status, attempt_count,
    next_attempt_at, created_at, updated_at
  ) VALUES
    (due_row, 'capacity.assignment.sync', 'nb-outbox-claim-due', v_restaurant_id, v_booking_id,
     '{}'::jsonb, 'pending', 0, NULL, TIMESTAMPTZ '2000-01-01 00:00:00+00', TIMESTAMPTZ '2000-01-01 00:00:00+00'),
    (future_row, 'capacity.assignment.sync', 'nb-outbox-claim-future', v_restaurant_id, v_booking_id,
     '{}'::jsonb, 'pending', 0, clock_timestamp() + interval '1 hour',
     TIMESTAMPTZ '2000-01-01 00:00:01+00', TIMESTAMPTZ '2000-01-01 00:00:01+00'),
    (done_row, 'capacity.assignment.sync', 'nb-outbox-claim-done', v_restaurant_id, v_booking_id,
     '{}'::jsonb, 'done', 1, NULL, TIMESTAMPTZ '2000-01-01 00:00:02+00', TIMESTAMPTZ '2000-01-01 00:00:02+00');

  SELECT array_agg(claimed.id) INTO v_claimed
  FROM public.claim_capacity_outbox_batch(1, 300) AS claimed;
  IF v_claimed IS DISTINCT FROM ARRAY[due_row] THEN
    RAISE EXCEPTION 'First claim did not return exactly the due row: %', v_claimed USING ERRCODE = 'NB001';
  END IF;

  SELECT * INTO v_row FROM public.capacity_outbox WHERE id = due_row;
  IF v_row.status <> 'processing' OR v_row.attempt_count <> 1
     OR v_row.next_attempt_at IS NULL
     OR v_row.next_attempt_at < clock_timestamp() + interval '290 seconds' THEN
    RAISE EXCEPTION 'Claim did not lease the row (status %, attempts %, lease %)',
      v_row.status, v_row.attempt_count, v_row.next_attempt_at USING ERRCODE = 'NB001';
  END IF;

  -- A second worker must not receive the leased, future or settled rows.
  IF EXISTS (
    SELECT 1 FROM public.claim_capacity_outbox_batch(5, 300) AS claimed
    WHERE claimed.id IN (due_row, future_row, done_row)
  ) THEN
    RAISE EXCEPTION 'A leased, future or done outbox row was claimed twice' USING ERRCODE = 'NB001';
  END IF;

  -- An expired lease means the first worker died: the row is claimable again.
  UPDATE public.capacity_outbox SET next_attempt_at = clock_timestamp() - interval '1 second'
  WHERE id = due_row;
  SELECT array_agg(claimed.id) INTO v_claimed
  FROM public.claim_capacity_outbox_batch(1, 300) AS claimed;
  IF v_claimed IS DISTINCT FROM ARRAY[due_row] THEN
    RAISE EXCEPTION 'Expired lease was not re-claimed: %', v_claimed USING ERRCODE = 'NB001';
  END IF;
  IF (SELECT attempt_count FROM public.capacity_outbox WHERE id = due_row) <> 2 THEN
    RAISE EXCEPTION 'Re-claim did not count the attempt' USING ERRCODE = 'NB001';
  END IF;

  -- Rows left processing by the pre-lease worker (no lease) are recovered once stale.
  UPDATE public.capacity_outbox SET status = 'done' WHERE id = due_row;
  INSERT INTO public.capacity_outbox (
    id, event_type, dedupe_key, restaurant_id, booking_id, payload, status, attempt_count,
    next_attempt_at, created_at, updated_at
  ) VALUES (
    legacy_row, 'capacity.assignment.sync', 'nb-outbox-claim-legacy', v_restaurant_id, v_booking_id,
    '{}'::jsonb, 'processing', 0, NULL, TIMESTAMPTZ '2000-01-01 00:00:03+00', TIMESTAMPTZ '2000-01-01 00:00:03+00'
  );
  SELECT array_agg(claimed.id) INTO v_claimed
  FROM public.claim_capacity_outbox_batch(1, 300) AS claimed;
  IF v_claimed IS DISTINCT FROM ARRAY[legacy_row] THEN
    RAISE EXCEPTION 'Stale lease-less processing row was not recovered: %', v_claimed USING ERRCODE = 'NB001';
  END IF;

  -- A row whose attempts are used up (its worker kept crashing before settling) is
  -- dead-lettered by the claim instead of being handed out again.
  UPDATE public.capacity_outbox SET status = 'done' WHERE id = legacy_row;
  INSERT INTO public.capacity_outbox (
    id, event_type, dedupe_key, restaurant_id, booking_id, payload, status, attempt_count,
    next_attempt_at, created_at, updated_at
  ) VALUES (
    poison_row, 'capacity.assignment.sync', 'nb-outbox-claim-poison', v_restaurant_id, v_booking_id,
    '{}'::jsonb, 'processing', 10, clock_timestamp() - interval '1 second',
    TIMESTAMPTZ '2000-01-01 00:00:04+00', TIMESTAMPTZ '2000-01-01 00:00:04+00'
  );
  SELECT array_agg(claimed.id) INTO v_claimed
  FROM public.claim_capacity_outbox_batch(1, 300, 10) AS claimed;
  IF v_claimed IS NOT NULL
     OR (SELECT status FROM public.capacity_outbox WHERE id = poison_row) <> 'dead'
     OR (SELECT attempt_count FROM public.capacity_outbox WHERE id = poison_row) <> 10 THEN
    RAISE EXCEPTION 'Exhausted row was re-claimed instead of dead-lettered: %', v_claimed USING ERRCODE = 'NB001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.claim_capacity_outbox_batch(5, 300, 10) AS claimed WHERE claimed.id = poison_row) THEN
    RAISE EXCEPTION 'Dead-lettered row was claimed' USING ERRCODE = 'NB001';
  END IF;

  IF has_function_privilege('authenticated', 'public.claim_capacity_outbox_batch(integer, integer, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.claim_capacity_outbox_batch(integer, integer, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Outbox claim is executable by an API role' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'capacity-outbox-claim regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'nabatable-regression: capacity-outbox-claim FAILED (SQLSTATE %)', SQLSTATE;
    RAISE;
END;
$regression$;

ROLLBACK;
