-- Email intent claim generation: a monotonic fencing token for the queue drain finalize.
--
-- Problem: finalize_email_dispatch_intent_v1 (20260927150000) fences on attempts_made, but
-- attempts_made is not monotonic. scheduleEmailIntent (server/queue/email-intents.ts) upserts
-- status 'pending' / attempts_made 0 onto an existing dedupe key, including one that is still
-- 'processing', and the operator requeue also restarts attempts_made at 0. The next drain then
-- claims the row as attempt 1 again, so a stale worker still holding attempt 1 finalizes the NEW
-- claim (ABA) and the new owner's real outcome is dropped as superseded.
--
-- Fix:
-- 1. email_dispatch_intents.claim_generation bigint NOT NULL DEFAULT 0. It is bumped by every
--    claim and never written by anything else (no application code writes it; the upsert and the
--    requeue do not include it), so it only ever grows.
-- 2. claim_due_email_dispatch_intents and claim_booking_email_intent: same bodies as before plus
--    `claim_generation = claim_generation + 1`. Their returned rows carry the new token.
-- 3. finalize_email_dispatch_intent_v2(p_intent_id, p_claim_generation, ...): v1's body, fenced on
--    status = 'processing', not cancelled and claim_generation = p_claim_generation.
--    finalize_email_dispatch_intent_v1 is left unchanged for the previous application build.
--
-- 4. claim_due_email_dispatch_intents is also revoked from anon and authenticated (it was only
--    revoked from PUBLIC, so Supabase's default privileges exposed it to API roles).
--
-- Not changed: settle_booking_email_intent (the inline sender in
-- server/jobs/booking-side-effect-intents.ts) still fences on attempts_made; moving it to the
-- claim generation needs an application change outside this migration's stream.
--
-- Backward-safe: ADD COLUMN with a constant default is metadata-only (PG11+ fast default) and takes
-- a brief ACCESS EXCLUSIVE lock on email_dispatch_intents; no rewrite, no index. CREATE OR REPLACE
-- keeps the claim functions' signatures, return types and grants. The previous application build
-- ignores the column and keeps calling v1.
--
-- Rollout: apply before the application change that calls v2 (under Option A a merge deploys the
-- web app). The drain falls back to v1 when a claimed row has no claim_generation, so an app
-- deployed first still finalizes (with v1's weaker fence) instead of stranding claims.
--
-- Rollback:
--   Redeploy the previous application build first, then:
--   DROP FUNCTION IF EXISTS public.finalize_email_dispatch_intent_v2(uuid, bigint, text, text, timestamptz, jsonb);
--   Re-apply claim_due_email_dispatch_intents from 20260327090000_add_email_dispatch_intents.sql and
--   claim_booking_email_intent from 20260927160000_booking_side_effect_claims.sql;
--   ALTER TABLE public.email_dispatch_intents DROP COLUMN IF EXISTS claim_generation;
BEGIN;

ALTER TABLE public.email_dispatch_intents
  ADD COLUMN IF NOT EXISTS claim_generation bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.email_dispatch_intents.claim_generation IS
  'Monotonic claim counter bumped by every claim; the fencing token for finalize_email_dispatch_intent_v2. Never reset.';

CREATE OR REPLACE FUNCTION public.claim_due_email_dispatch_intents(
  p_max_count integer DEFAULT 25,
  p_email_types text[] DEFAULT NULL
)
RETURNS SETOF public.email_dispatch_intents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_max_count, 25), 100));
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT intent.id
    FROM public.email_dispatch_intents AS intent
    WHERE (
      intent.status = 'pending'
      OR (
        intent.status = 'processing'
        AND intent.claimed_at IS NOT NULL
        AND intent.claimed_at <= timezone('utc', now()) - interval '15 minutes'
      )
    )
      AND intent.cancelled_at IS NULL
      AND intent.scheduled_for <= timezone('utc', now())
      AND (
        p_email_types IS NULL
        OR COALESCE(array_length(p_email_types, 1), 0) = 0
        OR intent.email_type = ANY (p_email_types)
      )
    ORDER BY intent.scheduled_for ASC, intent.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  ),
  updated AS (
    UPDATE public.email_dispatch_intents AS intent
    SET status = 'processing',
        attempts_made = intent.attempts_made + 1,
        claim_generation = intent.claim_generation + 1,
        claimed_at = timezone('utc', now()),
        last_attempt_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE intent.id IN (SELECT id FROM candidate)
    RETURNING intent.*
  )
  SELECT *
  FROM updated
  ORDER BY scheduled_for ASC, created_at ASC;
END;
$$;

-- 20260327090000 only revoked PUBLIC, so Supabase's default privileges left EXECUTE with anon and
-- authenticated on this SECURITY DEFINER claim (any API caller could claim, and read, due intents).
REVOKE ALL ON FUNCTION public.claim_due_email_dispatch_intents(integer, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_email_dispatch_intents(integer, text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_booking_email_intent(
  p_dedupe_key text,
  p_restaurant_id uuid
)
RETURNS SETOF public.email_dispatch_intents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  RETURN QUERY
  UPDATE public.email_dispatch_intents AS intent
  SET status = 'processing',
      attempts_made = intent.attempts_made + 1,
      claim_generation = intent.claim_generation + 1,
      claimed_at = v_now,
      last_attempt_at = v_now,
      updated_at = v_now
  WHERE intent.dedupe_key = p_dedupe_key
    AND intent.restaurant_id = p_restaurant_id
    AND intent.cancelled_at IS NULL
    AND intent.attempts_made < intent.max_attempts
    AND (
      intent.status = 'pending'
      OR (
        intent.status = 'processing'
        AND intent.claimed_at IS NOT NULL
        AND intent.claimed_at <= v_now - interval '15 minutes'
      )
    )
  RETURNING intent.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_booking_email_intent(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_booking_email_intent(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_email_dispatch_intent_v2(
  p_intent_id uuid,
  p_claim_generation bigint,
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
    RAISE EXCEPTION 'finalize_email_dispatch_intent_v2: invalid status' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'pending' AND p_next_scheduled_for IS NULL THEN
    RAISE EXCEPTION 'finalize_email_dispatch_intent_v2: pending requires a next schedule'
      USING ERRCODE = '22023';
  END IF;
  IF p_claim_generation IS NULL OR p_claim_generation < 1 THEN
    RAISE EXCEPTION 'finalize_email_dispatch_intent_v2: invalid claim generation'
      USING ERRCODE = '22023';
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
    AND intent.claim_generation = p_claim_generation
  RETURNING intent.*;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_email_dispatch_intent_v2(uuid, bigint, text, text, timestamptz, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_email_dispatch_intent_v2(uuid, bigint, text, text, timestamptz, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_email_dispatch_intent_v2(uuid, bigint, text, text, timestamptz, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_email_dispatch_intent_v2(uuid, bigint, text, text, timestamptz, jsonb) TO service_role;

COMMENT ON FUNCTION public.finalize_email_dispatch_intent_v2(uuid, bigint, text, text, timestamptz, jsonb) IS
  'Finalizes a claimed email intent only while it is still the same claim: processing, not cancelled and the same claim_generation (monotonic, never reset). Returns no row when the claim was lost.';

NOTIFY pgrst, 'reload schema';

COMMIT;
