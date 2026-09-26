-- Booking side-effect reliability: atomic claims for capacity_outbox and for
-- single booking email intents, plus an insert-if-absent intent writer.
--
-- 1. claim_capacity_outbox_batch(p_limit, p_lease_seconds)
--    Replaces the app-side SELECT-then-UPDATE claim in server/outbox.ts, which let
--    two workers process the same row. Rows are claimed with FOR UPDATE SKIP LOCKED
--    and moved to status 'processing' in the same statement. next_attempt_at becomes
--    the lease expiry while a row is processing, so a crashed worker's rows are only
--    re-claimed once their lease has elapsed. attempt_count is incremented on claim,
--    so a worker that dies mid-handler still moves the row towards 'dead'.
-- 2. ensure_booking_email_intent(...)
--    Inserts an email_dispatch_intents row only when its dedupe_key is absent
--    (ON CONFLICT DO NOTHING), after checking the booking belongs to the restaurant.
--    Safe to call on every booking create and every idempotent replay: a sent,
--    processing or cancelled intent is never reset.
-- 3. claim_booking_email_intent(p_dedupe_key, p_restaurant_id)
--    Atomic claim of one intent (pending, or processing with a claim older than the
--    15 minute lease used by claim_due_email_dispatch_intents). A concurrent cron
--    drain and an inline sender can never both own the same intent.
-- 4. settle_booking_email_intent(...)
--    Finishes an inline attempt: sent/skipped, or back to pending with a delay so
--    the cron drain retries it (failed once max_attempts is reached).
--
-- No table, column, index, constraint or data changes.
-- Rollback:
--   DROP FUNCTION IF EXISTS public.claim_capacity_outbox_batch(integer, integer);
--   DROP FUNCTION IF EXISTS public.ensure_booking_email_intent(uuid, uuid, text, text, timestamptz, integer);
--   DROP FUNCTION IF EXISTS public.claim_booking_email_intent(text, uuid);
--   DROP FUNCTION IF EXISTS public.settle_booking_email_intent(uuid, uuid, text, text, integer);
--   and redeploy the previous server/outbox.ts and server/jobs/booking-side-effects.ts.
BEGIN;

CREATE OR REPLACE FUNCTION public.claim_capacity_outbox_batch(
  p_limit integer DEFAULT 100,
  p_lease_seconds integer DEFAULT 300
)
RETURNS SETOF public.capacity_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
  v_lease interval := make_interval(secs => GREATEST(30, LEAST(COALESCE(p_lease_seconds, 300), 3600)));
  v_now timestamptz := clock_timestamp();
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT outbox.id
    FROM public.capacity_outbox AS outbox
    WHERE (
        outbox.status = 'pending'
        AND (outbox.next_attempt_at IS NULL OR outbox.next_attempt_at <= v_now)
      )
      OR (
        -- Lease expired: the worker that claimed this row stopped before settling it.
        outbox.status = 'processing'
        AND outbox.next_attempt_at IS NOT NULL
        AND outbox.next_attempt_at <= v_now
      )
      OR (
        -- Rows marked processing by the pre-lease worker carry no lease; treat
        -- updated_at as the claim time.
        outbox.status = 'processing'
        AND outbox.next_attempt_at IS NULL
        AND outbox.updated_at <= v_now - v_lease
      )
    ORDER BY outbox.next_attempt_at ASC NULLS FIRST, outbox.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  )
  UPDATE public.capacity_outbox AS outbox
  SET status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      next_attempt_at = v_now + v_lease,
      updated_at = v_now
  FROM candidate
  WHERE outbox.id = candidate.id
  RETURNING outbox.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_capacity_outbox_batch(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_capacity_outbox_batch(integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_booking_email_intent(
  p_booking_id uuid,
  p_restaurant_id uuid,
  p_email_type text,
  p_dedupe_key text,
  p_scheduled_for timestamptz DEFAULT NULL,
  p_max_attempts integer DEFAULT 5
)
RETURNS TABLE(intent_id uuid, created boolean, intent_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_booking_id uuid;
  v_status text;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_booking_id IS NULL OR p_restaurant_id IS NULL
     OR p_email_type IS NULL OR length(btrim(p_email_type)) = 0
     OR p_dedupe_key IS NULL OR length(btrim(p_dedupe_key)) = 0 THEN
    RAISE EXCEPTION 'ensure_booking_email_intent requires booking, restaurant, type and dedupe key'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id
    AND booking.restaurant_id = p_restaurant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found for restaurant-scoped email intent'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.email_dispatch_intents (
    dedupe_key,
    booking_id,
    restaurant_id,
    email_type,
    scheduled_for,
    status,
    attempts_made,
    max_attempts,
    payload,
    created_at,
    updated_at
  ) VALUES (
    p_dedupe_key,
    p_booking_id,
    p_restaurant_id,
    p_email_type,
    COALESCE(p_scheduled_for, v_now),
    'pending',
    0,
    GREATEST(1, COALESCE(p_max_attempts, 5)),
    jsonb_build_object(
      'bookingId', p_booking_id,
      'restaurantId', p_restaurant_id,
      'type', p_email_type
    ),
    v_now,
    v_now
  )
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, true, 'pending'::text;
    RETURN;
  END IF;

  SELECT intent.id, intent.booking_id, intent.status
  INTO v_id, v_booking_id, v_status
  FROM public.email_dispatch_intents AS intent
  WHERE intent.dedupe_key = p_dedupe_key;

  IF v_booking_id IS DISTINCT FROM p_booking_id THEN
    RAISE EXCEPTION 'Email intent dedupe key belongs to another booking'
      USING ERRCODE = '23505';
  END IF;

  RETURN QUERY SELECT v_id, false, v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_booking_email_intent(uuid, uuid, text, text, timestamptz, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_booking_email_intent(uuid, uuid, text, text, timestamptz, integer)
  TO service_role;

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

CREATE OR REPLACE FUNCTION public.settle_booking_email_intent(
  p_intent_id uuid,
  p_restaurant_id uuid,
  p_outcome text,
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
  IF p_outcome NOT IN ('sent', 'skipped', 'retry') THEN
    RAISE EXCEPTION 'Unsupported email intent outcome' USING ERRCODE = '22023';
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
  RETURNING intent.status INTO v_status;
  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_booking_email_intent(uuid, uuid, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_booking_email_intent(uuid, uuid, text, text, integer)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
