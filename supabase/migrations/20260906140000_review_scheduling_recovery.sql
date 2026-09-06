-- Qualify pgcrypto without broadening the SECURITY DEFINER search path.
BEGIN;

CREATE OR REPLACE FUNCTION public.schedule_review_request_v1(
  p_booking_id uuid,
  p_restaurant_id uuid,
  p_scheduled_for timestamptz,
  p_email_eligible boolean,
  p_whatsapp_eligible boolean,
  p_campaign_key text DEFAULT 'review-growth-v1',
  p_experiment_arm text DEFAULT 'sequenced'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_guest_key_hash text;
  v_primary_channel text;
  v_followup_scheduled_for timestamptz;
  v_suppression_reason text;
  v_request public.review_requests%ROWTYPE;
BEGIN
  SELECT booking.* INTO v_booking
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id
    AND booking.restaurant_id = p_restaurant_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking does not belong to restaurant';
  END IF;
  IF v_booking.status <> 'completed' THEN
    RAISE EXCEPTION 'Review requests require a completed booking';
  END IF;

  v_guest_key_hash := encode(
    extensions.digest(p_restaurant_id::text || ':' || v_booking.customer_id::text, 'sha256'),
    'hex'
  );
  PERFORM pg_advisory_xact_lock(hashtextextended('review-cooldown:' || v_guest_key_hash, 0));

  IF p_whatsapp_eligible THEN
    v_primary_channel := 'whatsapp';
    IF p_email_eligible THEN
      v_followup_scheduled_for := p_scheduled_for + interval '48 hours';
    END IF;
  ELSIF p_email_eligible THEN
    v_primary_channel := 'email';
  ELSE
    v_suppression_reason := 'no_eligible_channel';
  END IF;

  IF v_suppression_reason IS NULL AND EXISTS (
    SELECT 1
    FROM public.review_requests AS previous
    WHERE previous.restaurant_id = p_restaurant_id
      AND previous.guest_key_hash = v_guest_key_hash
      AND previous.booking_id <> p_booking_id
      AND previous.state <> 'suppressed'
      AND previous.scheduled_for >= p_scheduled_for - interval '90 days'
      AND previous.scheduled_for <= p_scheduled_for
  ) THEN
    v_suppression_reason := 'guest_cooldown';
  END IF;

  INSERT INTO public.review_requests (
    restaurant_id, booking_id, guest_key_hash, campaign_key, experiment_arm,
    state, primary_channel, email_eligible, whatsapp_eligible, scheduled_for,
    followup_scheduled_for, suppression_reason
  ) VALUES (
    p_restaurant_id, p_booking_id, v_guest_key_hash,
    COALESCE(NULLIF(p_campaign_key, ''), 'review-growth-v1'),
    COALESCE(NULLIF(p_experiment_arm, ''), 'sequenced'),
    CASE WHEN v_suppression_reason IS NULL THEN 'scheduled' ELSE 'suppressed' END,
    v_primary_channel, p_email_eligible, p_whatsapp_eligible, p_scheduled_for,
    v_followup_scheduled_for, v_suppression_reason
  )
  ON CONFLICT (restaurant_id, booking_id) DO UPDATE
    SET updated_at = timezone('utc', now())
  RETURNING * INTO v_request;

  INSERT INTO public.review_request_events (
    restaurant_id, review_request_id, event_type, provider, idempotency_key, occurred_at,
    metadata
  ) VALUES (
    p_restaurant_id,
    v_request.id,
    CASE WHEN v_request.state = 'suppressed' THEN 'suppressed' ELSE 'eligible' END,
    'nabatable',
    'review-request:' || v_request.id::text || ':eligibility',
    timezone('utc', now()),
    jsonb_strip_nulls(jsonb_build_object('reason', v_request.suppression_reason))
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'reviewRequestId', v_request.id,
    'state', v_request.state,
    'primaryChannel', v_request.primary_channel,
    'scheduledFor', v_request.scheduled_for,
    'followupScheduledFor', v_request.followup_scheduled_for,
    'suppressionReason', v_request.suppression_reason
  );
END;
$$;

-- One durable scheduling obligation per booking. No historical bookings are enrolled here.
CREATE TABLE public.review_scheduling_jobs (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claim_token uuid,
  claimed_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX review_scheduling_jobs_due_idx ON public.review_scheduling_jobs(next_attempt_at)
  WHERE status IN ('pending', 'processing');
ALTER TABLE public.review_scheduling_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_scheduling_jobs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.review_scheduling_jobs TO service_role;

CREATE FUNCTION public.enqueue_completed_review_scheduling_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.restaurant_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.review_scheduling_jobs(booking_id, restaurant_id)
        VALUES (NEW.id, NEW.restaurant_id) ON CONFLICT DO NOTHING;
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.review_scheduling_jobs(booking_id, restaurant_id)
        VALUES (NEW.id, NEW.restaurant_id)
      ON CONFLICT (booking_id) DO UPDATE SET status = 'pending', next_attempt_at = now(),
        completed_at = NULL, claim_token = NULL, claimed_at = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enqueue_completed_review_scheduling
AFTER INSERT OR UPDATE OF status ON public.bookings FOR EACH ROW
EXECUTE FUNCTION public.enqueue_completed_review_scheduling_v1();

CREATE FUNCTION public.claim_review_scheduling_jobs_v1(p_limit integer DEFAULT 50)
RETURNS TABLE (booking_id uuid, restaurant_id uuid, claim_token uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH due AS (
    SELECT job.booking_id FROM public.review_scheduling_jobs job
    WHERE (job.status = 'pending' AND job.next_attempt_at <= now())
       OR (job.status = 'processing' AND job.claimed_at < now() - interval '15 minutes')
    ORDER BY job.next_attempt_at, job.booking_id
    LIMIT greatest(1, least(coalesce(p_limit, 50), 200)) FOR UPDATE SKIP LOCKED
  )
  UPDATE public.review_scheduling_jobs job SET status = 'processing', claimed_at = now(),
    claim_token = gen_random_uuid(), attempt_count = job.attempt_count + 1
  FROM due WHERE job.booking_id = due.booking_id
  RETURNING job.booking_id, job.restaurant_id, job.claim_token;
$$;

CREATE FUNCTION public.finish_review_scheduling_job_v1(
  p_booking_id uuid, p_restaurant_id uuid, p_claim_token uuid, p_error_code text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.review_scheduling_jobs SET
    status = CASE WHEN p_error_code IS NULL THEN 'done' ELSE 'pending' END,
    completed_at = CASE WHEN p_error_code IS NULL THEN now() ELSE NULL END,
    next_attempt_at = now() + make_interval(mins => least(60, greatest(5, attempt_count * 5))),
    last_error_code = CASE WHEN p_error_code IS NULL THEN NULL
      WHEN p_error_code ~ '^[A-Z0-9]{5}$' THEN p_error_code ELSE 'scheduling_failed' END,
    claim_token = NULL, claimed_at = NULL
  WHERE booking_id = p_booking_id AND restaurant_id = p_restaurant_id
    AND claim_token = p_claim_token AND status = 'processing';
  RETURN FOUND;
END;
$$;

-- Explicit tenant + booking list for operator-reviewed recovery. No broad date-range write.
CREATE FUNCTION public.recover_review_scheduling_jobs_v1(p_restaurant_id uuid, p_booking_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF cardinality(p_booking_ids) IS NULL OR cardinality(p_booking_ids) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Recovery requires 1 to 200 explicit booking IDs';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_booking_ids) id WHERE NOT EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.id = id AND b.restaurant_id = p_restaurant_id
      AND b.status = 'completed'
  )) THEN RAISE EXCEPTION 'Recovery booking does not belong to completed tenant scope'; END IF;
  INSERT INTO public.review_scheduling_jobs (booking_id, restaurant_id)
    SELECT DISTINCT id, p_restaurant_id FROM unnest(p_booking_ids) id
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_completed_review_scheduling_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_review_scheduling_jobs_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_review_scheduling_job_v1(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recover_review_scheduling_jobs_v1(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_review_scheduling_jobs_v1(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_review_scheduling_job_v1(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_review_scheduling_jobs_v1(uuid, uuid[]) TO service_role;
COMMIT;
