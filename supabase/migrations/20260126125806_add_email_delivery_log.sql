-- Migration: add_email_delivery_log
-- Source: supabase_migrations.schema_migrations (version 20260126125806)

-- Email delivery tracking log
CREATE TABLE IF NOT EXISTS public.email_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  email_type text,
  template_type text,
  recipient_email text NOT NULL,
  message_id text NOT NULL,
  status text NOT NULL,
  provider text,
  provider_event_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  error text,
  metadata jsonb
);

ALTER TABLE public.email_delivery_log
  ADD CONSTRAINT email_delivery_log_status_check
  CHECK (status IN (
    'sent',
    'delivered',
    'delivery_delayed',
    'bounced',
    'complained',
    'failed'
  ));

ALTER TABLE public.email_delivery_log
  ADD CONSTRAINT email_delivery_log_message_recipient_status_key
  UNIQUE (message_id, recipient_email, status);

CREATE INDEX IF NOT EXISTS email_delivery_log_message_id_idx
  ON public.email_delivery_log (message_id);

CREATE INDEX IF NOT EXISTS email_delivery_log_booking_id_idx
  ON public.email_delivery_log (booking_id);

CREATE INDEX IF NOT EXISTS email_delivery_log_restaurant_id_idx
  ON public.email_delivery_log (restaurant_id);

CREATE INDEX IF NOT EXISTS email_delivery_log_occurred_at_idx
  ON public.email_delivery_log (occurred_at DESC);

ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_delivery_log IS 'Tracks outbound email delivery events and webhook updates.';
