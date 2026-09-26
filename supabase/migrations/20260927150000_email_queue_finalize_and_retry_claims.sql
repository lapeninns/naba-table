-- Email queue finalize fencing and manual delivery-retry claims.
--
-- 1. finalize_email_dispatch_intent_v1: the drain used to finalize a claimed intent with an
--    UPDATE filtered only by id, so an operator or booking cancel that landed while the email
--    was being processed was overwritten back to sent/pending/failed. The finalize now only
--    applies while the row is still the same claim: status = 'processing', not cancelled, and
--    attempts_made equal to the attempt the worker claimed (a stale 15-minute reclaim bumps
--    attempts_made, which fences the older worker). No row returned = the worker lost the race.
--
-- 2. email_delivery_log retry claim columns and claim/complete RPCs: the manual "retry" from
--    the ops delivery log sent synchronously with no claim, so two clicks or two tabs could
--    send twice. claim_email_delivery_retry_v1 claims a failed/bounced entry atomically
--    (row lock + per-message advisory lock) and refuses while a sibling event of the same
--    message is already being retried or has been retried. The returned retry_attempt feeds a
--    fresh provider idempotency key; a stale 'sending' claim is reclaimed with the SAME attempt
--    number so the provider can deduplicate a send whose outcome was never recorded.
--
-- Backward-safe: new nullable/defaulted columns only, CREATE OR REPLACE functions, no data
-- rewrites. Old application code ignores the new columns and functions.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.finalize_email_dispatch_intent_v1(uuid, integer, text, text, timestamptz, jsonb);
--   DROP FUNCTION IF EXISTS public.claim_email_delivery_retry_v1(uuid, uuid, integer);
--   DROP FUNCTION IF EXISTS public.complete_email_delivery_retry_v1(uuid, uuid, integer, text, uuid);
--   ALTER TABLE public.email_delivery_log
--     DROP CONSTRAINT IF EXISTS email_delivery_log_retry_status_check,
--     DROP COLUMN IF EXISTS retry_delivery_log_id,
--     DROP COLUMN IF EXISTS retried_at,
--     DROP COLUMN IF EXISTS retry_claimed_at,
--     DROP COLUMN IF EXISTS retry_attempts,
--     DROP COLUMN IF EXISTS retry_status;
--   (Redeploy the previous application build first; it does not call these functions.)
BEGIN;

CREATE OR REPLACE FUNCTION public.finalize_email_dispatch_intent_v1(
  p_intent_id uuid,
  p_attempt integer,
  p_status text,
  p_last_error text DEFAULT NULL,
  p_next_scheduled_for timestamptz DEFAULT NULL,
  p_payload_patch jsonb DEFAULT '{}'::jsonb
)
RETURNS SETOF public.email_dispatch_intents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('sent', 'skipped', 'failed', 'pending') THEN
    RAISE EXCEPTION 'finalize_email_dispatch_intent_v1: invalid status' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'pending' AND p_next_scheduled_for IS NULL THEN
    RAISE EXCEPTION 'finalize_email_dispatch_intent_v1: pending requires a next schedule'
      USING ERRCODE = '22023';
  END IF;
  IF p_attempt IS NULL OR p_attempt < 1 THEN
    RAISE EXCEPTION 'finalize_email_dispatch_intent_v1: invalid attempt' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.email_dispatch_intents AS intent
  SET status = p_status,
      processed_at = CASE WHEN p_status = 'pending' THEN intent.processed_at ELSE v_now END,
      scheduled_for = CASE WHEN p_status = 'pending' THEN p_next_scheduled_for ELSE intent.scheduled_for END,
      claimed_at = NULL,
      last_error = CASE WHEN p_status IN ('sent', 'skipped') THEN NULL ELSE p_last_error END,
      updated_at = v_now,
      payload = COALESCE(intent.payload, '{}'::jsonb) || COALESCE(p_payload_patch, '{}'::jsonb)
  WHERE intent.id = p_intent_id
    AND intent.status = 'processing'
    AND intent.cancelled_at IS NULL
    AND intent.attempts_made = p_attempt
  RETURNING intent.*;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_email_dispatch_intent_v1(uuid, integer, text, text, timestamptz, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_email_dispatch_intent_v1(uuid, integer, text, text, timestamptz, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_email_dispatch_intent_v1(uuid, integer, text, text, timestamptz, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_email_dispatch_intent_v1(uuid, integer, text, text, timestamptz, jsonb) TO service_role;

COMMENT ON FUNCTION public.finalize_email_dispatch_intent_v1(uuid, integer, text, text, timestamptz, jsonb) IS
  'Finalizes a claimed email intent only while it is still the same processing claim (not cancelled, same attempt). Returns no row when the claim was lost.';

ALTER TABLE public.email_delivery_log
  ADD COLUMN IF NOT EXISTS retry_status text,
  ADD COLUMN IF NOT EXISTS retry_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS retried_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_delivery_log_id uuid REFERENCES public.email_delivery_log(id) ON DELETE SET NULL;

ALTER TABLE public.email_delivery_log
  DROP CONSTRAINT IF EXISTS email_delivery_log_retry_status_check;
ALTER TABLE public.email_delivery_log
  ADD CONSTRAINT email_delivery_log_retry_status_check
  CHECK (
    (retry_status IS NULL OR retry_status IN ('sending', 'sent', 'failed'))
    AND retry_attempts >= 0
  );

CREATE INDEX IF NOT EXISTS email_delivery_log_retry_in_flight_idx
  ON public.email_delivery_log (restaurant_id, message_id)
  WHERE retry_status IN ('sending', 'sent');

CREATE OR REPLACE FUNCTION public.claim_email_delivery_retry_v1(
  p_delivery_log_id uuid,
  p_restaurant_id uuid,
  p_stale_after_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_stale_after interval := make_interval(secs => GREATEST(30, LEAST(COALESCE(p_stale_after_seconds, 300), 3600)));
  v_entry public.email_delivery_log%ROWTYPE;
  v_attempt integer;
BEGIN
  IF p_delivery_log_id IS NULL OR p_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  SELECT * INTO v_entry
  FROM public.email_delivery_log AS entry
  WHERE entry.id = p_delivery_log_id
    AND entry.restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  -- Serialize claims across every event row of the same provider message, so a 'failed' and a
  -- 'bounced' event of one email cannot both be retried.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('email_delivery_retry:' || p_restaurant_id::text || ':' || v_entry.message_id, 0)
  );

  IF v_entry.status NOT IN ('failed', 'bounced') THEN
    RETURN jsonb_build_object('outcome', 'not_retryable');
  END IF;

  IF v_entry.booking_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'missing_booking');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.email_delivery_log AS sibling
    WHERE sibling.restaurant_id = p_restaurant_id
      AND sibling.message_id = v_entry.message_id
      AND sibling.retry_status = 'sent'
  ) THEN
    RETURN jsonb_build_object('outcome', 'already_retried');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.email_delivery_log AS sibling
    WHERE sibling.restaurant_id = p_restaurant_id
      AND sibling.message_id = v_entry.message_id
      AND sibling.retry_status = 'sending'
      AND sibling.retry_claimed_at > v_now - v_stale_after
  ) THEN
    RETURN jsonb_build_object('outcome', 'in_progress');
  END IF;

  -- A stale 'sending' claim has an unknown outcome: keep its attempt number so the provider
  -- idempotency key is reused and a send that did go through is deduplicated. A known failure
  -- (or a first retry) takes a new attempt number and therefore a fresh key.
  v_attempt := CASE
    WHEN v_entry.retry_status = 'sending' AND v_entry.retry_attempts > 0 THEN v_entry.retry_attempts
    ELSE v_entry.retry_attempts + 1
  END;

  UPDATE public.email_delivery_log AS entry
  SET retry_status = 'sending',
      retry_attempts = v_attempt,
      retry_claimed_at = v_now
  WHERE entry.id = v_entry.id;

  RETURN jsonb_build_object(
    'outcome', 'claimed',
    'retryAttempt', v_attempt,
    'deliveryLogId', v_entry.id,
    'bookingId', v_entry.booking_id,
    'emailType', v_entry.email_type,
    'templateType', v_entry.template_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_delivery_retry_v1(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_email_delivery_retry_v1(uuid, uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_email_delivery_retry_v1(uuid, uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_delivery_retry_v1(uuid, uuid, integer) TO service_role;

COMMENT ON FUNCTION public.claim_email_delivery_retry_v1(uuid, uuid, integer) IS
  'Atomically claims a failed/bounced delivery-log entry for one manual retry. Outcomes: claimed, not_found, not_retryable, missing_booking, in_progress, already_retried.';

CREATE OR REPLACE FUNCTION public.complete_email_delivery_retry_v1(
  p_delivery_log_id uuid,
  p_restaurant_id uuid,
  p_retry_attempt integer,
  p_outcome text,
  p_retry_delivery_log_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('sent', 'failed') THEN
    RAISE EXCEPTION 'complete_email_delivery_retry_v1: invalid outcome' USING ERRCODE = '22023';
  END IF;

  UPDATE public.email_delivery_log AS entry
  SET retry_status = p_outcome,
      retry_claimed_at = NULL,
      retried_at = CASE WHEN p_outcome = 'sent' THEN v_now ELSE entry.retried_at END,
      retry_delivery_log_id = CASE
        WHEN p_outcome = 'sent' THEN p_retry_delivery_log_id
        ELSE entry.retry_delivery_log_id
      END
  WHERE entry.id = p_delivery_log_id
    AND entry.restaurant_id = p_restaurant_id
    AND entry.retry_status = 'sending'
    AND entry.retry_attempts = p_retry_attempt;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_email_delivery_retry_v1(uuid, uuid, integer, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_email_delivery_retry_v1(uuid, uuid, integer, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.complete_email_delivery_retry_v1(uuid, uuid, integer, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_email_delivery_retry_v1(uuid, uuid, integer, text, uuid) TO service_role;

COMMENT ON FUNCTION public.complete_email_delivery_retry_v1(uuid, uuid, integer, text, uuid) IS
  'Records the outcome of a claimed manual delivery retry; a no-op (false) unless the same claim is still in flight.';

COMMIT;
