BEGIN;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_phone text,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_source text,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_version text,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_actor_id uuid;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_whatsapp_consent_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_whatsapp_consent_check CHECK (
    (
      whatsapp_opt_in = false
      AND whatsapp_opt_in_at IS NULL
      AND whatsapp_consent_phone IS NULL
      AND whatsapp_consent_source IS NULL
      AND whatsapp_consent_version IS NULL
      AND whatsapp_consent_actor_id IS NULL
    )
    OR (
      whatsapp_opt_in = true
      AND whatsapp_opt_in_at IS NOT NULL
      AND whatsapp_consent_phone ~ '^\+[1-9][0-9]{6,14}$'
      AND whatsapp_consent_source IN ('guest_reserve', 'ops_staff')
      AND length(trim(whatsapp_consent_version)) > 0
      AND (
        (whatsapp_consent_source = 'guest_reserve' AND whatsapp_consent_actor_id IS NULL)
        OR (whatsapp_consent_source = 'ops_staff' AND whatsapp_consent_actor_id IS NOT NULL)
      )
    )
  ) NOT VALID;

ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_whatsapp_consent_check;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS manager_whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_whatsapp_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_whatsapp_consent_phone text,
  ADD COLUMN IF NOT EXISTS manager_whatsapp_consent_version text,
  ADD COLUMN IF NOT EXISTS manager_whatsapp_consent_actor_id uuid;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_manager_whatsapp_consent_check;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_manager_whatsapp_consent_check CHECK (
    (
      manager_whatsapp_enabled = false
      AND manager_whatsapp_opt_in_at IS NULL
      AND manager_whatsapp_consent_phone IS NULL
      AND manager_whatsapp_consent_version IS NULL
      AND manager_whatsapp_consent_actor_id IS NULL
    )
    OR (
      manager_whatsapp_enabled = true
      AND manager_whatsapp_opt_in_at IS NOT NULL
      AND manager_whatsapp_consent_phone ~ '^\+[1-9][0-9]{6,14}$'
      AND length(trim(manager_whatsapp_consent_version)) > 0
      AND manager_whatsapp_consent_actor_id IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE public.restaurants
  VALIDATE CONSTRAINT restaurants_manager_whatsapp_consent_check;

CREATE TABLE IF NOT EXISTS public.mobile_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  logical_key text NOT NULL,
  notification_type text NOT NULL CHECK (
    notification_type IN (
      'booking_confirmation',
      'booking_update',
      'booking_cancellation',
      'restaurant_cancellation',
      'manager_daily_summary'
    )
  ),
  recipient_phone text NOT NULL CHECK (recipient_phone ~ '^\+[1-9][0-9]{6,14}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, logical_key)
);

CREATE INDEX IF NOT EXISTS mobile_notifications_booking_idx
  ON public.mobile_notifications (booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mobile_notifications_restaurant_idx
  ON public.mobile_notifications (restaurant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mobile_notification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.mobile_notifications(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'sms')),
  provider text NOT NULL DEFAULT 'twilio' CHECK (provider IN ('twilio', 'mock')),
  provider_message_id text,
  template_id text,
  status text NOT NULL CHECK (
    status IN (
      'claimed',
      'accepted',
      'queued',
      'sent',
      'delivered',
      'read',
      'undelivered',
      'failed'
    )
  ),
  fallback_for_attempt_id uuid REFERENCES public.mobile_notification_attempts(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL CHECK (recipient_phone ~ '^\+[1-9][0-9]{6,14}$'),
  error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, channel)
);

CREATE UNIQUE INDEX IF NOT EXISTS mobile_notification_attempts_provider_message_idx
  ON public.mobile_notification_attempts (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mobile_notification_attempts_status_idx
  ON public.mobile_notification_attempts (status, updated_at)
  WHERE status IN ('accepted', 'queued', 'sent');

ALTER TABLE public.mobile_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_notification_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mobile_notifications FROM PUBLIC;
REVOKE ALL ON TABLE public.mobile_notifications FROM anon;
REVOKE ALL ON TABLE public.mobile_notifications FROM authenticated;
GRANT ALL ON TABLE public.mobile_notifications TO service_role;

REVOKE ALL ON TABLE public.mobile_notification_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.mobile_notification_attempts FROM anon;
REVOKE ALL ON TABLE public.mobile_notification_attempts FROM authenticated;
GRANT ALL ON TABLE public.mobile_notification_attempts TO service_role;

DROP POLICY IF EXISTS "Service role can manage mobile notifications"
  ON public.mobile_notifications;
CREATE POLICY "Service role can manage mobile notifications"
  ON public.mobile_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage mobile notification attempts"
  ON public.mobile_notification_attempts;
CREATE POLICY "Service role can manage mobile notification attempts"
  ON public.mobile_notification_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

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
  v_whatsapp_status text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.mobile_notifications notification
    WHERE notification.id = p_notification_id
      AND notification.restaurant_id = p_restaurant_id
      AND notification.recipient_phone = p_recipient_phone
  ) THEN
    RAISE EXCEPTION 'mobile notification not found';
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

COMMENT ON TABLE public.mobile_notifications IS
  'Logical WhatsApp-first mobile notifications, separate from provider channel attempts.';
COMMENT ON TABLE public.mobile_notification_attempts IS
  'WhatsApp and SMS attempts for one logical mobile notification, including fallback linkage.';
COMMENT ON FUNCTION public.claim_mobile_notification_fallback(uuid, uuid, text, uuid) IS
  'Atomically claims the single SMS fallback for a terminal failed WhatsApp attempt.';

COMMIT;
