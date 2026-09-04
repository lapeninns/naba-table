-- Review growth engine
-- One tenant-scoped journey per completed booking, an append-only event ledger,
-- channel sequencing controls, privacy-preserving Google review observations,
-- and an aggregate used by the operations dashboard.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  guest_key_hash text NOT NULL CHECK (guest_key_hash ~ '^[0-9a-f]{64}$'),
  campaign_key text NOT NULL DEFAULT 'review-growth-v1',
  experiment_arm text NOT NULL DEFAULT 'sequenced',
  state text NOT NULL DEFAULT 'scheduled'
    CHECK (state IN ('scheduled', 'active', 'clicked', 'observed', 'suppressed', 'expired')),
  primary_channel text CHECK (primary_channel IN ('whatsapp', 'email')),
  email_eligible boolean NOT NULL DEFAULT false,
  whatsapp_eligible boolean NOT NULL DEFAULT false,
  scheduled_for timestamptz NOT NULL,
  followup_scheduled_for timestamptz,
  first_sent_at timestamptz,
  first_clicked_at timestamptz,
  review_observed_at timestamptz,
  total_asks smallint NOT NULL DEFAULT 0 CHECK (total_asks BETWEEN 0 AND 2),
  suppression_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (restaurant_id, booking_id),
  UNIQUE (id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS review_requests_restaurant_scheduled_idx
  ON public.review_requests (restaurant_id, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS review_requests_guest_cooldown_idx
  ON public.review_requests (restaurant_id, guest_key_hash, scheduled_for DESC)
  WHERE state <> 'suppressed';
CREATE INDEX IF NOT EXISTS review_requests_due_followup_idx
  ON public.review_requests (followup_scheduled_for, restaurant_id)
  WHERE state IN ('scheduled', 'active') AND total_asks < 2;

CREATE TABLE IF NOT EXISTS public.review_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  review_request_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'eligible', 'scheduled', 'suppressed', 'sent', 'delivered', 'read', 'opened',
    'link_clicked', 'failed', 'bounced', 'complained', 'skipped', 'review_observed',
    'cost_settled'
  )),
  channel text CHECK (channel IN ('whatsapp', 'email')),
  provider text CHECK (provider IN ('twilio', 'resend', 'google_business_profile', 'nabatable')),
  provider_event_id text,
  idempotency_key text NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL,
  cost_microunits bigint CHECK (cost_microunits IS NULL OR cost_microunits >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT review_request_events_tenant_fkey
    FOREIGN KEY (review_request_id, restaurant_id)
    REFERENCES public.review_requests(id, restaurant_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS review_request_events_journey_idx
  ON public.review_request_events (restaurant_id, review_request_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS review_request_events_funnel_idx
  ON public.review_request_events (restaurant_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS review_request_events_provider_idx
  ON public.review_request_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS review_request_events_provider_status_unique_idx
  ON public.review_request_events (review_request_id, channel, event_type, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.review_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider = 'google_business_profile'),
  provider_event_hash text NOT NULL CHECK (provider_event_hash ~ '^[0-9a-f]{64}$'),
  event_type text NOT NULL CHECK (event_type IN ('NEW_REVIEW', 'UPDATED_REVIEW')),
  external_location_id text NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (restaurant_id, provider, provider_event_hash)
);

CREATE INDEX IF NOT EXISTS review_provider_events_restaurant_observed_idx
  ON public.review_provider_events (restaurant_id, observed_at DESC);

ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_provider_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.review_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.review_requests FROM anon;
REVOKE ALL ON TABLE public.review_requests FROM authenticated;
REVOKE ALL ON TABLE public.review_request_events FROM PUBLIC;
REVOKE ALL ON TABLE public.review_request_events FROM anon;
REVOKE ALL ON TABLE public.review_request_events FROM authenticated;
REVOKE ALL ON TABLE public.review_provider_events FROM PUBLIC;
REVOKE ALL ON TABLE public.review_provider_events FROM anon;
REVOKE ALL ON TABLE public.review_provider_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.review_requests TO service_role;
GRANT SELECT, INSERT ON TABLE public.review_request_events TO service_role;
GRANT SELECT, INSERT ON TABLE public.review_provider_events TO service_role;

DROP POLICY IF EXISTS "Service role manages review requests" ON public.review_requests;
CREATE POLICY "Service role manages review requests"
  ON public.review_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role appends review request events" ON public.review_request_events;
CREATE POLICY "Service role appends review request events"
  ON public.review_request_events FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service role reads review request events" ON public.review_request_events;
CREATE POLICY "Service role reads review request events"
  ON public.review_request_events FOR SELECT TO service_role USING (true);
DROP POLICY IF EXISTS "Service role appends provider review events" ON public.review_provider_events;
CREATE POLICY "Service role appends provider review events"
  ON public.review_provider_events FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service role reads provider review events" ON public.review_provider_events;
CREATE POLICY "Service role reads provider review events"
  ON public.review_provider_events FOR SELECT TO service_role USING (true);

ALTER TABLE public.mobile_notifications
  ADD COLUMN IF NOT EXISTS review_request_id uuid REFERENCES public.review_requests(id) ON DELETE SET NULL;
ALTER TABLE public.email_dispatch_intents
  ADD COLUMN IF NOT EXISTS review_request_id uuid REFERENCES public.review_requests(id) ON DELETE SET NULL;
ALTER TABLE public.email_delivery_log
  ADD COLUMN IF NOT EXISTS review_request_id uuid REFERENCES public.review_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS mobile_notifications_review_request_idx
  ON public.mobile_notifications (review_request_id) WHERE review_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_dispatch_intents_review_request_idx
  ON public.email_dispatch_intents (review_request_id) WHERE review_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_delivery_log_review_request_idx
  ON public.email_delivery_log (review_request_id) WHERE review_request_id IS NOT NULL;

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
    digest(p_restaurant_id::text || ':' || v_booking.customer_id::text, 'sha256'),
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

CREATE OR REPLACE FUNCTION public.record_review_request_event_v1(
  p_restaurant_id uuid,
  p_review_request_id uuid,
  p_event_type text,
  p_channel text,
  p_provider text,
  p_provider_event_id text,
  p_idempotency_key text,
  p_occurred_at timestamptz,
  p_cost_microunits bigint DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.review_requests AS request
    WHERE request.id = p_review_request_id AND request.restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'Review request does not belong to restaurant';
  END IF;

  INSERT INTO public.review_request_events (
    restaurant_id, review_request_id, event_type, channel, provider,
    provider_event_id, idempotency_key, occurred_at, cost_microunits, metadata
  ) VALUES (
    p_restaurant_id, p_review_request_id, p_event_type, p_channel, p_provider,
    p_provider_event_id, p_idempotency_key, COALESCE(p_occurred_at, timezone('utc', now())),
    p_cost_microunits, COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT DO NOTHING;
  v_inserted := FOUND;

  IF v_inserted THEN
    UPDATE public.review_requests AS request
    SET state = CASE
          WHEN p_event_type IN ('link_clicked', 'review_observed') THEN
            CASE WHEN p_event_type = 'link_clicked' THEN 'clicked' ELSE 'observed' END
          WHEN p_event_type IN ('sent', 'delivered', 'read', 'opened')
            AND request.state = 'scheduled' THEN 'active'
          ELSE request.state
        END,
        first_sent_at = CASE
          WHEN p_event_type = 'sent' THEN COALESCE(request.first_sent_at, p_occurred_at)
          ELSE request.first_sent_at
        END,
        first_clicked_at = CASE
          WHEN p_event_type = 'link_clicked' THEN COALESCE(request.first_clicked_at, p_occurred_at)
          ELSE request.first_clicked_at
        END,
        review_observed_at = CASE
          WHEN p_event_type = 'review_observed' THEN COALESCE(request.review_observed_at, p_occurred_at)
          ELSE request.review_observed_at
        END,
        total_asks = CASE
          WHEN p_event_type = 'sent' THEN LEAST(2, request.total_asks + 1)
          ELSE request.total_asks
        END,
        updated_at = timezone('utc', now())
    WHERE request.id = p_review_request_id
      AND request.restaurant_id = p_restaurant_id;
  END IF;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_send_review_request_v1(
  p_restaurant_id uuid,
  p_review_request_id uuid,
  p_channel text,
  p_now timestamptz DEFAULT timezone('utc', now())
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(bool_or(
    request.restaurant_id = p_restaurant_id
    AND request.state NOT IN ('clicked', 'observed', 'suppressed', 'expired')
    AND request.total_asks < 2
    AND CASE
      WHEN p_channel = 'whatsapp' THEN
        request.whatsapp_eligible
        AND request.primary_channel = 'whatsapp'
        AND request.scheduled_for <= p_now
      WHEN p_channel = 'email' THEN
        request.email_eligible
        AND (
          (request.primary_channel = 'email' AND request.scheduled_for <= p_now)
          OR
          (request.primary_channel = 'whatsapp' AND request.followup_scheduled_for <= p_now)
        )
      ELSE false
    END
  ), false)
  FROM public.review_requests AS request
  WHERE request.id = p_review_request_id;
$$;

CREATE OR REPLACE FUNCTION public.record_google_review_notification_v1(
  p_external_account_id text,
  p_external_location_id text,
  p_event_type text,
  p_provider_event_hash text,
  p_observed_at timestamptz DEFAULT timezone('utc', now())
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  SELECT profile.restaurant_id INTO v_restaurant_id
  FROM public.restaurant_external_profiles AS profile
  WHERE profile.provider = 'google_business_profile'
    AND profile.external_location_id = p_external_location_id
    AND (p_external_account_id IS NULL OR profile.external_account_id = p_external_account_id)
    AND profile.connection_status = 'linked'
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RETURN 'unmatched';
  END IF;

  INSERT INTO public.review_provider_events (
    restaurant_id, provider, provider_event_hash, event_type, external_location_id, observed_at
  ) VALUES (
    v_restaurant_id, 'google_business_profile', p_provider_event_hash,
    p_event_type, p_external_location_id, COALESCE(p_observed_at, timezone('utc', now()))
  )
  ON CONFLICT (restaurant_id, provider, provider_event_hash) DO NOTHING;

  RETURN CASE WHEN FOUND THEN 'accepted' ELSE 'duplicate' END;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_review_link_click_v1(
  p_booking_id uuid,
  p_restaurant_id uuid,
  p_channel text,
  p_event_id text,
  p_occurred_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review_request_id uuid;
BEGIN
  SELECT request.id INTO v_review_request_id
  FROM public.review_requests AS request
  WHERE request.booking_id = p_booking_id
    AND request.restaurant_id = p_restaurant_id;

  IF v_review_request_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.record_review_request_event_v1(
    p_restaurant_id,
    v_review_request_id,
    'link_clicked',
    p_channel,
    'nabatable',
    p_event_id,
    'short-link:' || p_event_id,
    p_occurred_at,
    NULL,
    '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accelerate_review_email_followup_v1(
  p_restaurant_id uuid,
  p_review_request_id uuid,
  p_now timestamptz DEFAULT timezone('utc', now())
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.review_requests AS request
  SET followup_scheduled_for = LEAST(request.followup_scheduled_for, p_now),
      updated_at = timezone('utc', now())
  WHERE request.id = p_review_request_id
    AND request.restaurant_id = p_restaurant_id
    AND request.email_eligible
    AND request.primary_channel = 'whatsapp'
    AND request.state IN ('scheduled', 'active')
    AND request.total_asks < 2;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.email_dispatch_intents AS intent
  SET scheduled_for = LEAST(intent.scheduled_for, p_now),
      updated_at = timezone('utc', now())
  WHERE intent.review_request_id = p_review_request_id
    AND intent.restaurant_id = p_restaurant_id
    AND intent.email_type = 'review_request'
    AND intent.status = 'pending';
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_review_growth_dashboard_v1(
  p_restaurant_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped_requests AS (
    SELECT request.*
    FROM public.review_requests AS request
    WHERE request.restaurant_id = p_restaurant_id
      AND request.scheduled_for >= p_from
      AND request.scheduled_for < p_to
  ),
  scoped_events AS (
    SELECT event.*
    FROM public.review_request_events AS event
    JOIN scoped_requests AS request ON request.id = event.review_request_id
    WHERE event.occurred_at >= p_from AND event.occurred_at < p_to
  ),
  completed AS (
    SELECT count(*)::integer AS value
    FROM public.bookings AS booking
    WHERE booking.restaurant_id = p_restaurant_id
      AND booking.status = 'completed'
      AND COALESCE(booking.checked_out_at, booking.updated_at) >= p_from
      AND COALESCE(booking.checked_out_at, booking.updated_at) < p_to
  ),
  funnel AS (
    SELECT
      count(*) FILTER (WHERE request.state <> 'suppressed')::integer AS eligible,
      count(*) FILTER (WHERE request.state = 'suppressed')::integer AS suppressed,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM scoped_events event
        WHERE event.review_request_id = request.id AND event.event_type = 'sent'
      ))::integer AS sent,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM scoped_events event
        WHERE event.review_request_id = request.id
          AND event.event_type IN ('delivered', 'read', 'opened', 'link_clicked')
      ))::integer AS reached,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM scoped_events event
        WHERE event.review_request_id = request.id AND event.event_type = 'link_clicked'
      ))::integer AS clicked
    FROM scoped_requests request
  ),
  channels AS (
    SELECT channel,
      count(*) FILTER (WHERE event_type = 'sent')::integer AS sent,
      count(*) FILTER (WHERE event_type = 'delivered')::integer AS delivered,
      count(*) FILTER (WHERE event_type = 'read')::integer AS read,
      count(*) FILTER (WHERE event_type = 'opened')::integer AS opened,
      count(*) FILTER (WHERE event_type = 'link_clicked')::integer AS clicked,
      count(*) FILTER (WHERE event_type IN ('failed', 'bounced', 'complained'))::integer AS failed,
      COALESCE(sum(cost_microunits), 0)::bigint AS cost_microunits,
      max(metadata ->> 'currency') FILTER (WHERE cost_microunits IS NOT NULL) AS cost_currency
    FROM scoped_events
    WHERE channel IS NOT NULL
    GROUP BY channel
  ),
  provider_reviews AS (
    SELECT count(*)::integer AS value
    FROM public.review_provider_events AS event
    WHERE event.restaurant_id = p_restaurant_id
      AND event.event_type = 'NEW_REVIEW'
      AND event.observed_at >= p_from
      AND event.observed_at < p_to
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'completedVisits', (SELECT value FROM completed),
    'eligible', COALESCE((SELECT eligible FROM funnel), 0),
    'suppressed', COALESCE((SELECT suppressed FROM funnel), 0),
    'sent', COALESCE((SELECT sent FROM funnel), 0),
    'reached', COALESCE((SELECT reached FROM funnel), 0),
    'clicked', COALESCE((SELECT clicked FROM funnel), 0),
    'newGoogleReviews', (SELECT value FROM provider_reviews),
    'channels', COALESCE((
      SELECT jsonb_object_agg(channel, jsonb_build_object(
        'sent', sent, 'delivered', delivered, 'read', read, 'opened', opened,
        'clicked', clicked, 'failed', failed, 'costMicrounits', cost_microunits,
        'costCurrency', cost_currency
      )) FROM channels
    ), '{}'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.schedule_review_request_v1(uuid, uuid, timestamptz, boolean, boolean, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_review_request_event_v1(uuid, uuid, text, text, text, text, text, timestamptz, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_send_review_request_v1(uuid, uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_google_review_notification_v1(text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_review_link_click_v1(uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accelerate_review_email_followup_v1(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_review_growth_dashboard_v1(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_review_request_v1(uuid, uuid, timestamptz, boolean, boolean, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_review_request_event_v1(uuid, uuid, text, text, text, text, text, timestamptz, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_send_review_request_v1(uuid, uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_google_review_notification_v1(text, text, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_review_link_click_v1(uuid, uuid, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.accelerate_review_email_followup_v1(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_review_growth_dashboard_v1(uuid, timestamptz, timestamptz) TO service_role;

COMMENT ON TABLE public.review_requests IS
  'One privacy-preserving, tenant-scoped post-visit review journey per booking.';
COMMENT ON TABLE public.review_request_events IS
  'Append-only, idempotent review funnel events. Guest content and contact details are forbidden.';
COMMENT ON TABLE public.review_provider_events IS
  'Privacy-preserving Google review counts; never stores reviewer identity or review content.';
