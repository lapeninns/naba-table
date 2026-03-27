-- Migration: add_email_dispatch_intents
-- Purpose:
--   Introduce a DB-backed source of truth for delayed email scheduling so
--   long-delay reminders and review requests no longer depend on queue-native
--   delay limits or Durable Object storage state.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.email_dispatch_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  email_type text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts_made integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  backoff_type text NOT NULL DEFAULT 'exponential',
  backoff_delay_ms integer NOT NULL DEFAULT 60000,
  claimed_at timestamptz,
  last_attempt_at timestamptz,
  processed_at timestamptz,
  cancelled_at timestamptz,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.email_dispatch_intents
  DROP CONSTRAINT IF EXISTS email_dispatch_intents_status_check;
ALTER TABLE public.email_dispatch_intents
  ADD CONSTRAINT email_dispatch_intents_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'skipped', 'failed', 'cancelled'));

ALTER TABLE public.email_dispatch_intents
  DROP CONSTRAINT IF EXISTS email_dispatch_intents_attempts_nonnegative_check;
ALTER TABLE public.email_dispatch_intents
  ADD CONSTRAINT email_dispatch_intents_attempts_nonnegative_check
  CHECK (attempts_made >= 0 AND max_attempts >= 1);

ALTER TABLE public.email_dispatch_intents
  DROP CONSTRAINT IF EXISTS email_dispatch_intents_backoff_type_check;
ALTER TABLE public.email_dispatch_intents
  ADD CONSTRAINT email_dispatch_intents_backoff_type_check
  CHECK (backoff_type IN ('fixed', 'exponential'));

CREATE INDEX IF NOT EXISTS email_dispatch_intents_due_idx
  ON public.email_dispatch_intents (status, scheduled_for ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS email_dispatch_intents_restaurant_status_idx
  ON public.email_dispatch_intents (restaurant_id, status, scheduled_for ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS email_dispatch_intents_booking_idx
  ON public.email_dispatch_intents (booking_id);

ALTER TABLE public.email_dispatch_intents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_dispatch_intents FROM authenticated;
REVOKE ALL ON TABLE public.email_dispatch_intents FROM anon;
GRANT ALL ON TABLE public.email_dispatch_intents TO service_role;

DROP POLICY IF EXISTS "Service role has full access to email_dispatch_intents" ON public.email_dispatch_intents;
CREATE POLICY "Service role has full access to email_dispatch_intents"
  ON public.email_dispatch_intents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

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

REVOKE ALL ON FUNCTION public.claim_due_email_dispatch_intents(integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_email_dispatch_intents(integer, text[]) TO service_role;

COMMENT ON TABLE public.email_dispatch_intents IS
  'Tracks scheduled email intents independently of queue transport so long-delay reminders and review requests remain durable.';

COMMENT ON FUNCTION public.claim_due_email_dispatch_intents(integer, text[]) IS
  'Atomically claims due email intents for processing, recovering stale processing claims after 15 minutes.';
