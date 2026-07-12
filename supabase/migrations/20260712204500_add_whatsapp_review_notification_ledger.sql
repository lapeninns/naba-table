BEGIN;

ALTER TABLE public.mobile_notifications
  DROP CONSTRAINT IF EXISTS mobile_notifications_notification_type_check;
ALTER TABLE public.mobile_notifications
  ADD CONSTRAINT mobile_notifications_notification_type_check CHECK (
    notification_type IN (
      'booking_confirmation',
      'booking_update',
      'booking_cancellation',
      'restaurant_cancellation',
      'booking_review_request',
      'manager_daily_summary'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS mobile_notifications_one_review_per_booking_recipient_idx
  ON public.mobile_notifications (
    restaurant_id,
    booking_id,
    notification_type,
    recipient_phone
  )
  WHERE notification_type = 'booking_review_request';

ALTER TABLE public.mobile_notifications
  ADD COLUMN IF NOT EXISTS mobile_intent_status text,
  ADD COLUMN IF NOT EXISTS mobile_intent_scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS mobile_intent_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mobile_intent_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS mobile_intent_claim_token uuid,
  ADD COLUMN IF NOT EXISTS mobile_intent_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS mobile_intent_last_error text,
  ADD COLUMN IF NOT EXISTS mobile_intent_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS mobile_intent_provider_message_id text,
  ADD COLUMN IF NOT EXISTS mobile_intent_attempt_status text,
  ADD COLUMN IF NOT EXISTS mobile_intent_attempt_error_code text;

ALTER TABLE public.mobile_notifications
  DROP CONSTRAINT IF EXISTS mobile_notifications_intent_status_check;
ALTER TABLE public.mobile_notifications
  ADD CONSTRAINT mobile_notifications_intent_status_check CHECK (
    mobile_intent_status IS NULL
    OR mobile_intent_status IN ('pending', 'claimed', 'processed', 'skipped', 'failed')
  );

ALTER TABLE public.mobile_notifications
  DROP CONSTRAINT IF EXISTS mobile_notifications_intent_attempt_status_check;
ALTER TABLE public.mobile_notifications
  ADD CONSTRAINT mobile_notifications_intent_attempt_status_check CHECK (
    mobile_intent_attempt_status IS NULL
    OR mobile_intent_attempt_status IN (
      'claimed', 'accepted', 'queued', 'sent', 'delivered', 'read', 'undelivered', 'failed'
    )
  );

CREATE INDEX IF NOT EXISTS mobile_notifications_due_review_intents_idx
  ON public.mobile_notifications (mobile_intent_scheduled_for, created_at)
  WHERE notification_type = 'booking_review_request'
    AND mobile_intent_status = 'pending';

CREATE OR REPLACE FUNCTION public.schedule_mobile_review_notification(
  p_booking_id uuid,
  p_restaurant_id uuid,
  p_recipient_phone text,
  p_scheduled_for timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notification_id uuid;
  v_logical_key text := p_booking_id::text || ':booking_review_request';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.bookings booking
    WHERE booking.id = p_booking_id
      AND booking.restaurant_id = p_restaurant_id
      AND booking.status = 'completed'
      AND booking.whatsapp_opt_in = true
      AND booking.whatsapp_consent_version = 'booking-plus-review-v2'
      AND booking.whatsapp_consent_phone = p_recipient_phone
  ) THEN
    RETURN NULL;
  END IF;

  SELECT notification.id
  INTO v_notification_id
  FROM public.mobile_notifications notification
  WHERE notification.restaurant_id = p_restaurant_id
    AND notification.logical_key = v_logical_key
  FOR UPDATE;

  IF v_notification_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.mobile_notifications
      WHERE id = v_notification_id
        AND mobile_intent_status = 'claimed'
    ) THEN
      RETURN v_notification_id;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.mobile_notifications
      WHERE id = v_notification_id
        AND mobile_intent_status IN ('processed', 'skipped', 'failed')
    ) THEN
      RETURN v_notification_id;
    END IF;

    UPDATE public.mobile_notifications
    SET mobile_intent_status = 'pending',
        mobile_intent_scheduled_for = LEAST(
          COALESCE(mobile_intent_scheduled_for, p_scheduled_for),
          p_scheduled_for
        ),
        mobile_intent_claimed_at = NULL,
        mobile_intent_claim_token = NULL,
        mobile_intent_last_error = NULL,
        updated_at = now()
    WHERE id = v_notification_id;
    RETURN v_notification_id;
  END IF;

  INSERT INTO public.mobile_notifications (
    booking_id,
    logical_key,
    notification_type,
    recipient_phone,
    restaurant_id,
    mobile_intent_status,
    mobile_intent_scheduled_for
  )
  VALUES (
    p_booking_id,
    v_logical_key,
    'booking_review_request',
    p_recipient_phone,
    p_restaurant_id,
    'pending',
    p_scheduled_for
  )
  ON CONFLICT (restaurant_id, logical_key) DO NOTHING
  RETURNING id INTO v_notification_id;

  IF v_notification_id IS NULL THEN
    SELECT id INTO v_notification_id
    FROM public.mobile_notifications
    WHERE restaurant_id = p_restaurant_id
      AND logical_key = v_logical_key;
  END IF;

  RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_due_mobile_review_notifications(
  p_limit integer DEFAULT 100
)
RETURNS SETOF public.mobile_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.mobile_notifications
  SET mobile_intent_status = 'failed',
      mobile_intent_processed_at = now(),
      mobile_intent_last_error = 'REVIEW_WHATSAPP_CLAIM_EXHAUSTED',
      updated_at = now()
  WHERE notification_type = 'booking_review_request'
    AND mobile_intent_status = 'claimed'
    AND mobile_intent_claimed_at < now() - interval '15 minutes'
    AND mobile_intent_attempts >= 3;

  RETURN QUERY
  WITH due AS (
    SELECT notification.id
    FROM public.mobile_notifications notification
    WHERE notification.notification_type = 'booking_review_request'
      AND (
        (
          notification.mobile_intent_status = 'pending'
          AND notification.mobile_intent_scheduled_for <= now()
        )
        OR (
          notification.mobile_intent_status = 'claimed'
          AND notification.mobile_intent_claimed_at < now() - interval '15 minutes'
          AND notification.mobile_intent_attempts < 3
        )
      )
    ORDER BY notification.mobile_intent_scheduled_for, notification.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100)
  )
  UPDATE public.mobile_notifications notification
  SET mobile_intent_status = 'claimed',
      mobile_intent_attempts = notification.mobile_intent_attempts + 1,
      mobile_intent_claimed_at = now(),
      mobile_intent_claim_token = gen_random_uuid(),
      updated_at = now()
  FROM due
  WHERE notification.id = due.id
  RETURNING notification.*;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_mobile_review_notification(uuid, uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_mobile_review_notification(uuid, uuid, text, timestamptz)
  TO service_role;
REVOKE ALL ON FUNCTION public.claim_due_mobile_review_notifications(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_mobile_review_notifications(integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.guard_mobile_review_notification_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.notification_type = 'booking_review_request'
    AND (
      NEW.booking_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.bookings booking
        WHERE booking.id = NEW.booking_id
          AND booking.restaurant_id = NEW.restaurant_id
      )
    )
  THEN
    RAISE EXCEPTION 'Review notification booking does not belong to restaurant'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_mobile_review_notification_tenant
  ON public.mobile_notifications;
CREATE TRIGGER guard_mobile_review_notification_tenant
  BEFORE INSERT OR UPDATE OF booking_id, notification_type, restaurant_id
  ON public.mobile_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_mobile_review_notification_tenant();

CREATE OR REPLACE FUNCTION public.guard_mobile_notification_attempt_policy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notification_type text;
  v_recipient_phone text;
BEGIN
  SELECT notification.notification_type, notification.recipient_phone
  INTO v_notification_type, v_recipient_phone
  FROM public.mobile_notifications notification
  WHERE notification.id = NEW.notification_id;

  IF v_notification_type IS NULL THEN
    RAISE EXCEPTION 'Mobile notification does not exist'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.recipient_phone <> v_recipient_phone THEN
    RAISE EXCEPTION 'Mobile attempt recipient does not match notification'
      USING ERRCODE = '23514';
  END IF;

  IF v_notification_type = 'booking_review_request' AND NEW.channel = 'sms' THEN
    RAISE EXCEPTION 'Review notifications do not permit SMS attempts'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_mobile_notification_attempt_policy
  ON public.mobile_notification_attempts;
CREATE TRIGGER guard_mobile_notification_attempt_policy
  BEFORE INSERT OR UPDATE OF channel, notification_id, recipient_phone
  ON public.mobile_notification_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_mobile_notification_attempt_policy();

CREATE OR REPLACE FUNCTION public.claim_mobile_notification_fallback(
  p_notification_id uuid,
  p_restaurant_id uuid,
  p_recipient_phone text,
  p_fallback_for_attempt_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt_id uuid;
  v_notification_recipient_phone text;
  v_notification_restaurant_id uuid;
  v_notification_type text;
  v_whatsapp_status text;
BEGIN
  SELECT
    notification.notification_type,
    notification.recipient_phone,
    notification.restaurant_id
  INTO v_notification_type, v_notification_recipient_phone, v_notification_restaurant_id
  FROM public.mobile_notifications notification
  WHERE notification.id = p_notification_id;

  IF v_notification_type IS NULL
    OR v_notification_restaurant_id <> p_restaurant_id
    OR v_notification_recipient_phone <> p_recipient_phone
  THEN
    RAISE EXCEPTION 'mobile notification not found';
  END IF;

  IF v_notification_type = 'booking_review_request' THEN
    RAISE EXCEPTION 'Review notifications do not permit SMS attempts'
      USING ERRCODE = '23514';
  END IF;

  SELECT wa.status
  INTO v_whatsapp_status
  FROM public.mobile_notification_attempts wa
  WHERE wa.id = p_fallback_for_attempt_id
    AND wa.notification_id = p_notification_id
    AND wa.channel = 'whatsapp'
  FOR UPDATE;

  IF v_whatsapp_status IS NULL THEN
    RAISE EXCEPTION 'WhatsApp attempt not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.mobile_notification_attempts wa
    WHERE wa.id = p_fallback_for_attempt_id
      AND wa.status IN ('delivered', 'read')
  ) THEN
    RAISE EXCEPTION 'WhatsApp attempt is already successful';
  END IF;

  IF v_whatsapp_status NOT IN ('failed', 'undelivered') THEN
    RAISE EXCEPTION 'WhatsApp attempt is not eligible for fallback';
  END IF;

  INSERT INTO public.mobile_notification_attempts (
    notification_id,
    channel,
    provider,
    status,
    fallback_for_attempt_id,
    recipient_phone
  )
  VALUES (
    p_notification_id,
    'sms',
    'twilio',
    'claimed',
    p_fallback_for_attempt_id,
    p_recipient_phone
  )
  ON CONFLICT (notification_id, channel) DO NOTHING
  RETURNING id INTO v_attempt_id;

  RETURN v_attempt_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_mobile_whatsapp_attempt(
  p_attempt_id uuid,
  p_provider_message_id text,
  p_status text,
  p_error_code text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_status NOT IN (
    'claimed', 'accepted', 'queued', 'sent', 'delivered', 'read', 'undelivered', 'failed'
  ) THEN
    RAISE EXCEPTION 'Invalid mobile attempt status';
  END IF;

  UPDATE public.mobile_notification_attempts attempt
  SET provider_message_id = COALESCE(attempt.provider_message_id, p_provider_message_id),
      status = CASE
        WHEN attempt.status = p_status THEN attempt.status
        WHEN attempt.status = 'claimed' THEN p_status
        WHEN attempt.status IN ('accepted', 'queued')
          AND p_status IN ('sent', 'delivered', 'read', 'undelivered', 'failed') THEN p_status
        WHEN attempt.status = 'sent'
          AND p_status IN ('delivered', 'read', 'undelivered', 'failed') THEN p_status
        WHEN attempt.status = 'delivered' AND p_status = 'read' THEN p_status
        ELSE attempt.status
      END,
      error_code = CASE
        WHEN p_error_code IS NOT NULL
          AND (
            attempt.status = 'claimed'
            OR attempt.status IN ('accepted', 'queued', 'sent')
              AND p_status IN ('undelivered', 'failed')
          )
        THEN p_error_code
        ELSE attempt.error_code
      END,
      updated_at = now()
  WHERE attempt.id = p_attempt_id
    AND attempt.channel = 'whatsapp'
    AND (
      p_provider_message_id IS NULL
      OR attempt.provider_message_id IS NULL
      OR attempt.provider_message_id = p_provider_message_id
    )
  RETURNING attempt.status INTO v_status;

  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_mobile_notification_preaccept_fallback(
  p_notification_id uuid,
  p_restaurant_id uuid,
  p_recipient_phone text,
  p_fallback_for_attempt_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt_id uuid;
  v_notification_recipient_phone text;
  v_notification_restaurant_id uuid;
  v_notification_type text;
  v_whatsapp_status text;
BEGIN
  SELECT
    notification.notification_type,
    notification.recipient_phone,
    notification.restaurant_id
  INTO v_notification_type, v_notification_recipient_phone, v_notification_restaurant_id
  FROM public.mobile_notifications notification
  WHERE notification.id = p_notification_id;

  IF v_notification_type IS NULL
    OR v_notification_restaurant_id <> p_restaurant_id
    OR v_notification_recipient_phone <> p_recipient_phone
  THEN
    RAISE EXCEPTION 'mobile notification not found';
  END IF;
  IF v_notification_type = 'booking_review_request' THEN
    RAISE EXCEPTION 'Review notifications do not permit SMS attempts'
      USING ERRCODE = '23514';
  END IF;

  SELECT attempt.status
  INTO v_whatsapp_status
  FROM public.mobile_notification_attempts attempt
  WHERE attempt.id = p_fallback_for_attempt_id
    AND attempt.notification_id = p_notification_id
    AND attempt.channel = 'whatsapp'
  FOR UPDATE;

  IF v_whatsapp_status IS NULL OR v_whatsapp_status NOT IN ('claimed', 'failed') THEN
    RAISE EXCEPTION 'WhatsApp attempt is not a pre-accept failure';
  END IF;

  UPDATE public.mobile_notification_attempts
  SET status = 'failed',
      error_code = COALESCE(error_code, 'WHATSAPP_PREACCEPT_FAILURE'),
      updated_at = now()
  WHERE id = p_fallback_for_attempt_id
    AND notification_id = p_notification_id
    AND channel = 'whatsapp'
    AND recipient_phone = v_notification_recipient_phone;

  INSERT INTO public.mobile_notification_attempts (
    notification_id,
    channel,
    provider,
    status,
    fallback_for_attempt_id,
    recipient_phone
  )
  VALUES (
    p_notification_id,
    'sms',
    'twilio',
    'claimed',
    p_fallback_for_attempt_id,
    v_notification_recipient_phone
  )
  ON CONFLICT (notification_id, channel) DO NOTHING
  RETURNING id INTO v_attempt_id;

  RETURN v_attempt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_mobile_notification_fallback(uuid, uuid, text, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_mobile_notification_fallback(uuid, uuid, text, uuid)
  FROM anon;
REVOKE ALL ON FUNCTION public.claim_mobile_notification_fallback(uuid, uuid, text, uuid)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mobile_notification_fallback(uuid, uuid, text, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.finalize_mobile_whatsapp_attempt(uuid, text, text, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_mobile_whatsapp_attempt(uuid, text, text, text)
  FROM anon;
REVOKE ALL ON FUNCTION public.finalize_mobile_whatsapp_attempt(uuid, text, text, text)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_mobile_whatsapp_attempt(uuid, text, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.claim_mobile_notification_preaccept_fallback(uuid, uuid, text, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_mobile_notification_preaccept_fallback(uuid, uuid, text, uuid)
  FROM anon;
REVOKE ALL ON FUNCTION public.claim_mobile_notification_preaccept_fallback(uuid, uuid, text, uuid)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mobile_notification_preaccept_fallback(uuid, uuid, text, uuid)
  TO service_role;

COMMENT ON FUNCTION public.guard_mobile_review_notification_tenant() IS
  'Keeps booking review notifications attributable to the booking restaurant.';
COMMENT ON FUNCTION public.guard_mobile_notification_attempt_policy() IS
  'Keeps attempt recipients aligned and rejects SMS attempts for WhatsApp review notifications.';
COMMENT ON FUNCTION public.claim_mobile_notification_fallback(uuid, uuid, text, uuid) IS
  'Atomically claims one SMS fallback for lifecycle notifications and rejects review fallbacks.';
COMMENT ON FUNCTION public.finalize_mobile_whatsapp_attempt(uuid, text, text, text) IS
  'Binds provider truth while preserving callback statuses that already advanced the attempt.';
COMMENT ON FUNCTION public.claim_mobile_notification_preaccept_fallback(uuid, uuid, text, uuid) IS
  'Atomically marks a definite pre-accept lifecycle failure and claims its one SMS fallback.';

COMMIT;
