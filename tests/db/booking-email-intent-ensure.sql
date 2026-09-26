-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
-- A booking's confirmation intent is written once per (booking, email type) dedupe
-- key. Ensuring it again on an idempotent create replay never duplicates or resets
-- it, a failed inline send leaves it retryable, and only one caller can own it.
BEGIN;

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  v_booking_id constant uuid := '00000000-0000-4000-8000-00000000b002';
  v_other_booking_id constant uuid := '00000000-0000-4000-8000-00000000b001';
  v_key constant text := 'email__confirmation__00000000-0000-4000-8000-00000000b002';
  v_first record;
  v_again record;
  v_claimed public.email_dispatch_intents%ROWTYPE;
  v_status text;
  v_count bigint;
BEGIN
  SELECT * INTO v_first
  FROM public.ensure_booking_email_intent(v_booking_id, v_restaurant_id, 'confirmation', v_key);
  IF NOT v_first.created OR v_first.intent_status <> 'pending' THEN
    RAISE EXCEPTION 'First ensure did not create a pending intent' USING ERRCODE = 'NB001';
  END IF;

  -- Replay before anything was sent: still exactly one intent.
  SELECT * INTO v_again
  FROM public.ensure_booking_email_intent(v_booking_id, v_restaurant_id, 'confirmation', v_key);
  SELECT count(*) INTO v_count FROM public.email_dispatch_intents WHERE booking_id = v_booking_id;
  IF v_again.created OR v_again.intent_id <> v_first.intent_id OR v_count <> 1 THEN
    RAISE EXCEPTION 'Replay duplicated the confirmation intent (count %)', v_count USING ERRCODE = 'NB001';
  END IF;

  -- Exactly one owner per attempt.
  SELECT * INTO v_claimed FROM public.claim_booking_email_intent(v_key, v_restaurant_id);
  IF v_claimed.id IS DISTINCT FROM v_first.intent_id OR v_claimed.status <> 'processing'
     OR v_claimed.attempts_made <> 1 THEN
    RAISE EXCEPTION 'Inline claim did not take the intent' USING ERRCODE = 'NB001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.claim_booking_email_intent(v_key, v_restaurant_id)) THEN
    RAISE EXCEPTION 'A claimed intent was claimed twice' USING ERRCODE = 'NB001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.claim_due_email_dispatch_intents(100, ARRAY['confirmation']) AS c
             WHERE c.id = v_first.intent_id) THEN
    RAISE EXCEPTION 'The cron drain claimed an intent owned by an inline sender' USING ERRCODE = 'NB001';
  END IF;

  -- Simulated provider failure: the intent returns to pending for the queue.
  v_status := public.settle_booking_email_intent(v_first.intent_id, v_restaurant_id, 'retry', 'INLINE_SEND_FAILED', 60);
  IF v_status <> 'pending' OR (SELECT scheduled_for <= clock_timestamp() + interval '50 seconds'
       FROM public.email_dispatch_intents WHERE id = v_first.intent_id) THEN
    RAISE EXCEPTION 'Failed inline send was not left retryable with a delay' USING ERRCODE = 'NB001';
  END IF;

  -- Replay after the failure: ensure is a no-op, the retry claims and sends once.
  SELECT * INTO v_again
  FROM public.ensure_booking_email_intent(v_booking_id, v_restaurant_id, 'confirmation', v_key);
  IF v_again.created OR v_again.intent_status <> 'pending' THEN
    RAISE EXCEPTION 'Replay after failure recreated or reset the intent' USING ERRCODE = 'NB001';
  END IF;
  SELECT * INTO v_claimed FROM public.claim_booking_email_intent(v_key, v_restaurant_id);
  IF v_claimed.id IS DISTINCT FROM v_first.intent_id OR v_claimed.attempts_made <> 2 THEN
    RAISE EXCEPTION 'Retry claim did not take the intent' USING ERRCODE = 'NB001';
  END IF;
  IF public.settle_booking_email_intent(v_first.intent_id, v_restaurant_id, 'sent') <> 'sent' THEN
    RAISE EXCEPTION 'Sent outcome was not recorded' USING ERRCODE = 'NB001';
  END IF;
  -- Settling twice is a no-op.
  IF public.settle_booking_email_intent(v_first.intent_id, v_restaurant_id, 'retry') IS NOT NULL THEN
    RAISE EXCEPTION 'A settled intent was settled again' USING ERRCODE = 'NB001';
  END IF;

  -- Replay after the send: one intent, still sent, not claimable.
  SELECT * INTO v_again
  FROM public.ensure_booking_email_intent(v_booking_id, v_restaurant_id, 'confirmation', v_key);
  SELECT count(*) INTO v_count FROM public.email_dispatch_intents WHERE booking_id = v_booking_id;
  IF v_again.created OR v_again.intent_status <> 'sent' OR v_count <> 1 THEN
    RAISE EXCEPTION 'Replay after send reset or duplicated the intent' USING ERRCODE = 'NB001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.claim_booking_email_intent(v_key, v_restaurant_id)) THEN
    RAISE EXCEPTION 'A sent intent was claimable again' USING ERRCODE = 'NB001';
  END IF;

  -- Tenant scoping.
  BEGIN
    PERFORM public.ensure_booking_email_intent(v_booking_id, v_other_restaurant_id, 'confirmation', 'nb-cross-tenant');
    RAISE EXCEPTION 'Cross-tenant intent was written' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN no_data_found THEN NULL;
  END;
  UPDATE public.email_dispatch_intents SET status = 'pending', processed_at = NULL
  WHERE id = v_first.intent_id;
  IF EXISTS (SELECT 1 FROM public.claim_booking_email_intent(v_key, v_other_restaurant_id)) THEN
    RAISE EXCEPTION 'Another tenant claimed the intent' USING ERRCODE = 'NB001';
  END IF;

  -- A dedupe key can never be re-pointed at another booking.
  BEGIN
    PERFORM public.ensure_booking_email_intent(v_other_booking_id, v_restaurant_id, 'confirmation', v_key);
    RAISE EXCEPTION 'Dedupe key was reused for another booking' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN unique_violation THEN NULL;
  END;

  IF has_function_privilege('authenticated', 'public.ensure_booking_email_intent(uuid, uuid, text, text, timestamptz, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.claim_booking_email_intent(text, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.settle_booking_email_intent(uuid, uuid, text, text, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Email intent functions are executable by an API role' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'booking-email-intent-ensure regression PASSED';
END
$regression$;

ROLLBACK;
