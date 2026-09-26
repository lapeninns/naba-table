-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
-- The inline booking email settle is fenced on the monotonic claim generation, not
-- attempts_made. scheduleEmailIntent's upsert and the operator requeue restart attempts_made,
-- so a newer claim can reuse attempt 1; a stale inline sender holding that attempt must not
-- settle it (ABA).
BEGIN;
SET LOCAL search_path = public;
DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  v_booking constant uuid := '00000000-0000-4000-8000-00000000b002';
  v_key constant text := 'regression__settle_generation__00000000-0000-4000-8000-00000000b002';
  v_intent uuid;
  v_first public.email_dispatch_intents%ROWTYPE;
  v_second public.email_dispatch_intents%ROWTYPE;
  v_third public.email_dispatch_intents%ROWTYPE;
  v_status text;
BEGIN
  INSERT INTO public.email_dispatch_intents (dedupe_key, booking_id, restaurant_id, email_type, scheduled_for, status)
  VALUES (v_key, v_booking, v_restaurant_id, 'modification_confirmed', '1900-01-01', 'pending')
  RETURNING id INTO v_intent;

  -- Inline sender A claims attempt 1.
  SELECT * INTO v_first FROM public.claim_booking_email_intent(v_key, v_restaurant_id);
  IF v_first.id IS DISTINCT FROM v_intent OR v_first.attempts_made <> 1 OR v_first.claim_generation < 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Inline claim did not take the intent';
  END IF;

  -- scheduleEmailIntent's upsert resets the row while A is still sending.
  UPDATE public.email_dispatch_intents
  SET status = 'pending', attempts_made = 0, claimed_at = NULL, last_attempt_at = NULL,
      processed_at = NULL, cancelled_at = NULL, last_error = NULL, scheduled_for = '1900-01-01'
  WHERE id = v_intent;

  -- Sender B claims it again: the same attempt number, a newer generation.
  SELECT * INTO v_second FROM public.claim_booking_email_intent(v_key, v_restaurant_id);
  IF v_second.attempts_made <> v_first.attempts_made
     OR v_second.claim_generation <= v_first.claim_generation THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Reset claim did not get a newer generation';
  END IF;

  -- A's stale settle, for any outcome, matches nothing and leaves B's claim alone.
  IF public.settle_booking_email_intent_v2(v_intent, v_restaurant_id, 'sent', v_first.claim_generation) IS NOT NULL
     OR public.settle_booking_email_intent_v2(v_intent, v_restaurant_id, 'retry', v_first.claim_generation) IS NOT NULL
     OR (SELECT status FROM public.email_dispatch_intents WHERE id = v_intent) <> 'processing' THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'A stale inline sender settled a newer claim (ABA)';
  END IF;

  -- Another tenant cannot settle the claim even with the right generation.
  IF public.settle_booking_email_intent_v2(v_intent, v_other_restaurant_id, 'sent', v_second.claim_generation) IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Settle crossed the restaurant boundary';
  END IF;

  -- B's retry puts it back to pending with a delay.
  v_status := public.settle_booking_email_intent_v2(v_intent, v_restaurant_id, 'retry', v_second.claim_generation, 'INLINE_SEND_FAILED', 60);
  IF v_status IS DISTINCT FROM 'pending' OR NOT EXISTS (
    SELECT 1 FROM public.email_dispatch_intents
    WHERE id = v_intent AND claimed_at IS NULL AND last_error = 'INLINE_SEND_FAILED'
      AND scheduled_for > clock_timestamp() + interval '50 seconds'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Current claim retry was not recorded';
  END IF;
  -- Settling the same claim twice is a no-op.
  IF public.settle_booking_email_intent_v2(v_intent, v_restaurant_id, 'sent', v_second.claim_generation) IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'A settled claim was settled again';
  END IF;

  -- The next claim settles as sent with its own generation.
  UPDATE public.email_dispatch_intents SET scheduled_for = '1900-01-01' WHERE id = v_intent;
  SELECT * INTO v_third FROM public.claim_booking_email_intent(v_key, v_restaurant_id);
  IF v_third.claim_generation <> v_second.claim_generation + 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Retry claim did not bump the generation';
  END IF;
  -- Settle and verify in separate statements: a check in the same statement would read
  -- the snapshot taken before the settle's UPDATE.
  v_status := public.settle_booking_email_intent_v2(v_intent, v_restaurant_id, 'sent', v_third.claim_generation);
  IF v_status IS DISTINCT FROM 'sent'
     OR NOT EXISTS (
       SELECT 1 FROM public.email_dispatch_intents
       WHERE id = v_intent AND status = 'sent' AND claimed_at IS NULL AND processed_at IS NOT NULL AND last_error IS NULL
     ) THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Current claim did not settle as sent';
  END IF;

  -- A cancel wins over the current claim.
  UPDATE public.email_dispatch_intents
  SET status = 'processing', claimed_at = now(), claim_generation = claim_generation + 1
  WHERE id = v_intent
  RETURNING * INTO v_third;
  UPDATE public.email_dispatch_intents SET cancelled_at = now() WHERE id = v_intent;
  IF public.settle_booking_email_intent_v2(v_intent, v_restaurant_id, 'sent', v_third.claim_generation) IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Settle overwrote a cancelled intent';
  END IF;

  BEGIN
    PERFORM public.settle_booking_email_intent_v2(v_intent, v_restaurant_id, 'sent', 0);
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Generation 0 accepted';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.settle_booking_email_intent_v2(v_intent, v_restaurant_id, 'failed', v_third.claim_generation);
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Unsupported outcome accepted';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN invalid_parameter_value THEN NULL;
  END;

  IF has_function_privilege('authenticated', 'public.settle_booking_email_intent_v2(uuid, uuid, text, bigint, text, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.settle_booking_email_intent_v2(uuid, uuid, text, bigint, text, integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.settle_booking_email_intent_v2(uuid, uuid, text, bigint, text, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'settle_booking_email_intent_v2 grants are wrong';
  END IF;

  RAISE NOTICE 'Booking email intent settle generation regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Booking email intent settle generation regression FAILED';
    RAISE;
END;
$regression$;
ROLLBACK;
