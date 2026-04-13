-- Migration: add_sms_delivery_log
-- Purpose: Persist outbound booking SMS delivery events and Twilio status updates.

CREATE TABLE IF NOT EXISTS public.sms_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  sms_type text,
  recipient_phone text NOT NULL,
  message_sid text NOT NULL,
  status text NOT NULL,
  provider text,
  provider_event_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  error text,
  metadata jsonb
);

ALTER TABLE public.sms_delivery_log
  ADD CONSTRAINT sms_delivery_log_status_check
  CHECK (status IN (
    'queued',
    'sent',
    'delivered',
    'undelivered',
    'failed'
  ));

ALTER TABLE public.sms_delivery_log
  ADD CONSTRAINT sms_delivery_log_message_phone_status_key
  UNIQUE (message_sid, recipient_phone, status);

CREATE INDEX IF NOT EXISTS sms_delivery_log_message_sid_idx
  ON public.sms_delivery_log (message_sid);

CREATE INDEX IF NOT EXISTS sms_delivery_log_booking_id_idx
  ON public.sms_delivery_log (booking_id);

CREATE INDEX IF NOT EXISTS sms_delivery_log_restaurant_id_idx
  ON public.sms_delivery_log (restaurant_id);

CREATE INDEX IF NOT EXISTS sms_delivery_log_occurred_at_idx
  ON public.sms_delivery_log (occurred_at DESC);

ALTER TABLE public.sms_delivery_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.sms_delivery_log IS 'Tracks outbound booking SMS delivery events and Twilio status callbacks.';
