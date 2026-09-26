-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
-- The email intent finalize fence uses a monotonic claim generation, not attempts_made.
-- scheduleEmailIntent's upsert (and the operator requeue) reset attempts_made to 0, so a new
-- claim reuses attempt 1; a stale worker still holding that attempt must not finalize it (ABA).
BEGIN;
SET LOCAL search_path = public;
DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_booking constant uuid := '00000000-0000-4000-8000-00000000b002';
  v_key constant text := 'regression__modification_confirmed__00000000-0000-4000-8000-00000000b002';
  v_intent uuid;
  v_first public.email_dispatch_intents%ROWTYPE;
  v_second public.email_dispatch_intents%ROWTYPE;
  v_inline public.email_dispatch_intents%ROWTYPE;
  v_rows integer;
  v_status text;
BEGIN
  INSERT INTO public.email_dispatch_intents (dedupe_key, booking_id, restaurant_id, email_type, scheduled_for, status)
  VALUES (v_key, v_booking, v_restaurant_id, 'modification_confirmed', '1900-01-01', 'pending')
  RETURNING id INTO v_intent;

  -- Worker A claims attempt 1.
  SELECT * INTO v_first FROM public.claim_due_email_dispatch_intents(100, ARRAY['modification_confirmed'])
  WHERE id = v_intent;
  IF v_first.id IS NULL OR v_first.attempts_made <> 1 OR v_first.claim_generation < 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Claim did not bump the claim generation';
  END IF;

  -- scheduleEmailIntent's upsert lands while A is sending (same columns it writes).
  UPDATE public.email_dispatch_intents
  SET status = 'pending', attempts_made = 0, claimed_at = NULL, last_attempt_at = NULL,
      processed_at = NULL, cancelled_at = NULL, last_error = NULL, scheduled_for = '1900-01-01'
  WHERE id = v_intent;

  -- Worker B claims the reset row: attempt 1 again, but a new generation.
  SELECT * INTO v_second FROM public.claim_due_email_dispatch_intents(100, ARRAY['modification_confirmed'])
  WHERE id = v_intent;
  IF v_second.attempts_made <> 1 OR v_second.claim_generation <= v_first.claim_generation THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Reset claim reused the claim generation';
  END IF;

  -- A's stale finalize is fenced; B's own outcome still lands.
  SELECT count(*) INTO v_rows FROM public.finalize_email_dispatch_intent_v2(
    v_intent, v_first.claim_generation, 'pending', 'EMAIL_JOB_FAILED', '2099-01-01');
  SELECT status INTO v_status FROM public.email_dispatch_intents WHERE id = v_intent;
  IF v_rows <> 0 OR v_status <> 'processing' THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Stale worker finalized the newer claim (ABA)';
  END IF;
  SELECT count(*) INTO v_rows FROM public.finalize_email_dispatch_intent_v2(
    v_intent, v_second.claim_generation, 'sent', NULL, NULL, '{"cronAttemptsMade":1}'::jsonb);
  IF v_rows <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.email_dispatch_intents
    WHERE id = v_intent AND status = 'sent' AND claimed_at IS NULL AND payload->>'cronAttemptsMade' = '1'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Current claim did not finalize';
  END IF;

  -- The operator requeue also restarts attempts_made; the generation keeps growing.
  UPDATE public.email_dispatch_intents
  SET status = 'pending', attempts_made = 0, claimed_at = NULL, processed_at = NULL, scheduled_for = '1900-01-01'
  WHERE id = v_intent;
  -- The inline claimer bumps the same generation.
  SELECT * INTO v_inline FROM public.claim_booking_email_intent(v_key, v_restaurant_id);
  IF v_inline.claim_generation <> v_second.claim_generation + 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Inline claim did not bump the claim generation';
  END IF;
  SELECT count(*) INTO v_rows FROM public.finalize_email_dispatch_intent_v2(
    v_intent, v_second.claim_generation, 'sent');
  IF v_rows <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Earlier generation finalized an inline claim';
  END IF;

  -- A cancel still wins over the current claim.
  UPDATE public.email_dispatch_intents SET status = 'cancelled', cancelled_at = now(), claimed_at = NULL
  WHERE id = v_intent;
  SELECT count(*) INTO v_rows FROM public.finalize_email_dispatch_intent_v2(
    v_intent, v_inline.claim_generation, 'sent');
  IF v_rows <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Finalize overwrote a cancelled intent';
  END IF;

  BEGIN
    PERFORM public.finalize_email_dispatch_intent_v2(v_intent, 0, 'sent');
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Generation 0 accepted';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.finalize_email_dispatch_intent_v2(v_intent, v_inline.claim_generation, 'cancelled');
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Invalid finalize status accepted';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN invalid_parameter_value THEN NULL;
  END;

  IF has_function_privilege('authenticated', 'public.finalize_email_dispatch_intent_v2(uuid, bigint, text, text, timestamptz, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.finalize_email_dispatch_intent_v2(uuid, bigint, text, text, timestamptz, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.claim_booking_email_intent(text, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.claim_due_email_dispatch_intents(integer, text[])', 'EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Email intent RPCs exposed to API roles';
  END IF;

  RAISE NOTICE 'Email intent claim generation regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Email intent claim generation regression FAILED';
    RAISE;
END;
$regression$;
ROLLBACK;
