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
  v_notification_type text;
  v_whatsapp_status text;
BEGIN
  SELECT notification.notification_type
  INTO v_notification_type
  FROM public.mobile_notifications notification
  WHERE notification.id = p_notification_id
    AND notification.restaurant_id = p_restaurant_id
    AND notification.recipient_phone = p_recipient_phone;

  IF v_notification_type IS NULL THEN
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

REVOKE ALL ON FUNCTION public.claim_mobile_notification_fallback(uuid, uuid, text, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_mobile_notification_fallback(uuid, uuid, text, uuid)
  FROM anon;
REVOKE ALL ON FUNCTION public.claim_mobile_notification_fallback(uuid, uuid, text, uuid)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mobile_notification_fallback(uuid, uuid, text, uuid)
  TO service_role;

COMMENT ON FUNCTION public.guard_mobile_review_notification_tenant() IS
  'Keeps booking review notifications attributable to the booking restaurant.';
COMMENT ON FUNCTION public.guard_mobile_notification_attempt_policy() IS
  'Keeps attempt recipients aligned and rejects SMS attempts for WhatsApp review notifications.';
COMMENT ON FUNCTION public.claim_mobile_notification_fallback(uuid, uuid, text, uuid) IS
  'Atomically claims one SMS fallback for lifecycle notifications and rejects review fallbacks.';

COMMIT;
