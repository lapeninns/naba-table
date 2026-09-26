-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
BEGIN;
SET LOCAL search_path = public;
DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant constant uuid := '00000000-0000-4000-8000-00000000a002';
  v_booking constant uuid := '00000000-0000-4000-8000-00000000b002';
  v_intent uuid;
  v_claimed public.email_dispatch_intents%ROWTYPE;
  v_rows integer;
  v_status text;
  v_failed_event uuid;
  v_bounced_event uuid;
  v_delivered_event uuid;
  v_claim jsonb;
  v_attempt integer;
  v_done boolean;
BEGIN
  -- Park every other due intent so the claim below only sees the synthetic rows.
  INSERT INTO public.email_dispatch_intents (dedupe_key, booking_id, restaurant_id, email_type, scheduled_for, status)
  VALUES ('regression__reminder_24h__' || v_booking::text, v_booking, v_restaurant_id, 'reminder_24h', '1900-01-01', 'pending')
  RETURNING id INTO v_intent;

  -- Cancel-vs-finalize: a cancel that lands while the intent is processing must win.
  SELECT * INTO v_claimed FROM public.claim_due_email_dispatch_intents(100, ARRAY['reminder_24h'])
  WHERE id = v_intent;
  IF v_claimed.id IS NULL OR v_claimed.status <> 'processing' OR v_claimed.attempts_made <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Claim did not mark the intent processing';
  END IF;
  UPDATE public.email_dispatch_intents
  SET status = 'cancelled', cancelled_at = now(), processed_at = now(), claimed_at = NULL
  WHERE id = v_intent AND status IN ('pending', 'processing') AND cancelled_at IS NULL;
  SELECT count(*) INTO v_rows FROM public.finalize_email_dispatch_intent_v1(v_intent, 1, 'sent', NULL, NULL, '{"cronAttemptsMade":1}'::jsonb);
  SELECT status INTO v_status FROM public.email_dispatch_intents WHERE id = v_intent;
  IF v_rows <> 0 OR v_status <> 'cancelled' THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Finalize overwrote a cancelled intent';
  END IF;

  -- A stale worker (older attempt) is fenced after a reclaim bumps attempts_made.
  UPDATE public.email_dispatch_intents
  SET status = 'processing', cancelled_at = NULL, processed_at = NULL, attempts_made = 2, claimed_at = now()
  WHERE id = v_intent;
  SELECT count(*) INTO v_rows FROM public.finalize_email_dispatch_intent_v1(v_intent, 1, 'failed', 'EMAIL_JOB_FAILED');
  IF v_rows <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Stale attempt was not fenced';
  END IF;

  -- The current claim finalizes a retry and merges the payload patch.
  SELECT count(*) INTO v_rows FROM public.finalize_email_dispatch_intent_v1(
    v_intent, 2, 'pending', 'EMAIL_JOB_FAILED', '2099-01-01', '{"failedReason":"EMAIL_JOB_FAILED"}'::jsonb);
  IF v_rows <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.email_dispatch_intents
    WHERE id = v_intent AND status = 'pending' AND claimed_at IS NULL
      AND scheduled_for = '2099-01-01' AND last_error = 'EMAIL_JOB_FAILED'
      AND payload->>'failedReason' = 'EMAIL_JOB_FAILED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Current claim did not finalize';
  END IF;
  -- A finalize on a row that is no longer processing is a no-op.
  SELECT count(*) INTO v_rows FROM public.finalize_email_dispatch_intent_v1(v_intent, 2, 'sent');
  IF v_rows <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Finalize applied to a pending row';
  END IF;
  BEGIN
    PERFORM public.finalize_email_dispatch_intent_v1(v_intent, 2, 'cancelled');
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Invalid finalize status accepted';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN invalid_parameter_value THEN NULL;
  END;

  -- Manual delivery retry claims.
  INSERT INTO public.email_delivery_log (booking_id, restaurant_id, email_type, template_type, recipient_email, message_id, status, provider)
  VALUES (v_booking, v_restaurant_id, 'created', 'confirmation', 'fixture@example.invalid', 'regression-msg-1', 'failed', 'resend')
  RETURNING id INTO v_failed_event;
  INSERT INTO public.email_delivery_log (booking_id, restaurant_id, email_type, template_type, recipient_email, message_id, status, provider)
  VALUES (v_booking, v_restaurant_id, 'created', 'confirmation', 'fixture@example.invalid', 'regression-msg-1', 'bounced', 'resend')
  RETURNING id INTO v_bounced_event;
  INSERT INTO public.email_delivery_log (booking_id, restaurant_id, email_type, template_type, recipient_email, message_id, status, provider)
  VALUES (v_booking, v_restaurant_id, 'created', 'confirmation', 'fixture@example.invalid', 'regression-msg-2', 'delivered', 'resend')
  RETURNING id INTO v_delivered_event;

  IF public.claim_email_delivery_retry_v1(v_failed_event, v_other_restaurant)->>'outcome' <> 'not_found' THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Cross-tenant retry claim allowed';
  END IF;
  IF public.claim_email_delivery_retry_v1(v_delivered_event, v_restaurant_id)->>'outcome' <> 'not_retryable' THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Delivered email was retryable';
  END IF;

  v_claim := public.claim_email_delivery_retry_v1(v_failed_event, v_restaurant_id);
  IF v_claim->>'outcome' <> 'claimed' OR (v_claim->>'retryAttempt')::integer <> 1
     OR (v_claim->>'bookingId')::uuid <> v_booking THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'First retry claim failed';
  END IF;
  -- Second click, and a sibling event of the same message, are refused while in flight.
  IF public.claim_email_delivery_retry_v1(v_failed_event, v_restaurant_id)->>'outcome' <> 'in_progress'
     OR public.claim_email_delivery_retry_v1(v_bounced_event, v_restaurant_id)->>'outcome' <> 'in_progress' THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Concurrent retry claim allowed';
  END IF;
  -- A known failure frees the claim and the next attempt gets a new number (fresh provider key).
  IF NOT public.complete_email_delivery_retry_v1(v_failed_event, v_restaurant_id, 1, 'failed') THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Retry failure was not recorded';
  END IF;
  v_claim := public.claim_email_delivery_retry_v1(v_failed_event, v_restaurant_id);
  v_attempt := (v_claim->>'retryAttempt')::integer;
  IF v_claim->>'outcome' <> 'claimed' OR v_attempt <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Retry after failure did not take a new attempt';
  END IF;
  -- A stale 'sending' claim is reclaimed with the same attempt (same provider idempotency key).
  UPDATE public.email_delivery_log SET retry_claimed_at = now() - interval '10 minutes' WHERE id = v_failed_event;
  v_claim := public.claim_email_delivery_retry_v1(v_failed_event, v_restaurant_id);
  IF v_claim->>'outcome' <> 'claimed' OR (v_claim->>'retryAttempt')::integer <> v_attempt THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Stale retry claim was not reclaimed with the same attempt';
  END IF;
  -- Completion is fenced by attempt and by tenant.
  IF public.complete_email_delivery_retry_v1(v_failed_event, v_restaurant_id, v_attempt + 5, 'sent', v_delivered_event)
     OR public.complete_email_delivery_retry_v1(v_failed_event, v_other_restaurant, v_attempt, 'sent', v_delivered_event) THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Retry completion was not fenced';
  END IF;
  v_done := public.complete_email_delivery_retry_v1(v_failed_event, v_restaurant_id, v_attempt, 'sent', v_delivered_event);
  IF NOT v_done OR NOT EXISTS (
    SELECT 1 FROM public.email_delivery_log
    WHERE id = v_failed_event AND retry_status = 'sent' AND retried_at IS NOT NULL
      AND retry_delivery_log_id = v_delivered_event AND retry_claimed_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Retry success was not recorded';
  END IF;
  IF public.claim_email_delivery_retry_v1(v_failed_event, v_restaurant_id)->>'outcome' <> 'already_retried'
     OR public.claim_email_delivery_retry_v1(v_bounced_event, v_restaurant_id)->>'outcome' <> 'already_retried' THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'A retried email could be retried again';
  END IF;

  IF has_function_privilege('authenticated', 'public.claim_email_delivery_retry_v1(uuid, uuid, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.complete_email_delivery_retry_v1(uuid, uuid, integer, text, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finalize_email_dispatch_intent_v1(uuid, integer, text, text, timestamptz, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Email queue RPCs exposed to API roles';
  END IF;

  RAISE NOTICE 'Email queue finalize and retry claim regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Email queue finalize and retry claim regression FAILED';
    RAISE;
END;
$regression$;
ROLLBACK;
