-- Inline booking email settle fenced on the monotonic claim generation.
--
-- Problem: settle_booking_email_intent (20260927160000) fences on attempts_made. attempts_made
-- is not monotonic: scheduleEmailIntent's upsert and the operator requeue restart it at 0, so a
-- later claim can reuse the same attempt number. An inline sender whose claim was lost (lease
-- expired, row reset and re-claimed) could then settle the NEWER claim (ABA). 20260927210000
-- added email_dispatch_intents.claim_generation, bumped by every claim (including
-- claim_booking_email_intent) and never reset, and fenced the drain's finalize on it.
--
-- Fix: settle_booking_email_intent_v2(p_intent_id, p_restaurant_id, p_outcome,
-- p_claim_generation, p_error_code, p_retry_delay_seconds). Same body as v1, but the fence is
-- status = 'processing', not cancelled, and claim_generation = p_claim_generation.
-- settle_booking_email_intent (v1) is left unchanged for the previous application build.
--
-- Requires 20260927210000 (claim_generation column).
--
-- Backward-safe: a new function only; no table, column, index, constraint or data changes.
-- The previous application build keeps calling v1.
--
-- Rollout: apply before the application change that calls v2 (under Option A a merge deploys the
-- web app). The app falls back to v1 when a claimed row carries no claim_generation.
--
-- Rollback:
--   Redeploy the previous application build first, then:
--   DROP FUNCTION IF EXISTS public.settle_booking_email_intent_v2(uuid, uuid, text, bigint, text, integer);
BEGIN;

CREATE OR REPLACE FUNCTION public.settle_booking_email_intent_v2(
  p_intent_id uuid,
  p_restaurant_id uuid,
  p_outcome text,
  p_claim_generation bigint,
  p_error_code text DEFAULT NULL,
  p_retry_delay_seconds integer DEFAULT 60
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_status text;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('sent', 'skipped', 'retry') THEN
    RAISE EXCEPTION 'Unsupported email intent outcome' USING ERRCODE = '22023';
  END IF;
  IF p_claim_generation IS NULL OR p_claim_generation < 1 THEN
    RAISE EXCEPTION 'settle_booking_email_intent_v2 requires the claim generation'
      USING ERRCODE = '22023';
  END IF;

  IF p_outcome IN ('sent', 'skipped') THEN
    UPDATE public.email_dispatch_intents AS intent
    SET status = p_outcome,
        processed_at = v_now,
        claimed_at = NULL,
        last_error = NULL,
        updated_at = v_now
    WHERE intent.id = p_intent_id
      AND intent.restaurant_id = p_restaurant_id
      AND intent.status = 'processing'
      AND intent.cancelled_at IS NULL
      AND intent.claim_generation = p_claim_generation
    RETURNING intent.status INTO v_status;
    RETURN v_status;
  END IF;

  UPDATE public.email_dispatch_intents AS intent
  SET status = CASE WHEN intent.attempts_made >= intent.max_attempts THEN 'failed' ELSE 'pending' END,
      processed_at = CASE WHEN intent.attempts_made >= intent.max_attempts THEN v_now ELSE NULL END,
      scheduled_for = CASE
        WHEN intent.attempts_made >= intent.max_attempts THEN intent.scheduled_for
        ELSE v_now + make_interval(secs => GREATEST(0, LEAST(COALESCE(p_retry_delay_seconds, 60), 3600)))
      END,
      claimed_at = NULL,
      last_error = left(COALESCE(NULLIF(btrim(p_error_code), ''), 'INLINE_SEND_FAILED'), 120),
      updated_at = v_now
  WHERE intent.id = p_intent_id
    AND intent.restaurant_id = p_restaurant_id
    AND intent.status = 'processing'
    AND intent.cancelled_at IS NULL
    AND intent.claim_generation = p_claim_generation
  RETURNING intent.status INTO v_status;
  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_booking_email_intent_v2(uuid, uuid, text, bigint, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_booking_email_intent_v2(uuid, uuid, text, bigint, text, integer)
  TO service_role;

COMMENT ON FUNCTION public.settle_booking_email_intent_v2(uuid, uuid, text, bigint, text, integer) IS
  'Settles an inline booking email claim only while it is still the same claim: processing, not cancelled and the same claim_generation (monotonic, never reset). Returns NULL when the claim was lost.';

NOTIFY pgrst, 'reload schema';

COMMIT;
