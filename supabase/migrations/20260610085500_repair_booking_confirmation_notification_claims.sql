BEGIN;

CREATE TABLE IF NOT EXISTS public.booking_confirmation_notification_claims (
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, channel)
);

CREATE INDEX IF NOT EXISTS booking_confirmation_notification_claims_restaurant_idx
  ON public.booking_confirmation_notification_claims (restaurant_id, claimed_at DESC);

ALTER TABLE public.booking_confirmation_notification_claims ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.booking_confirmation_notification_claims FROM anon;
REVOKE ALL ON TABLE public.booking_confirmation_notification_claims FROM authenticated;
GRANT ALL ON TABLE public.booking_confirmation_notification_claims TO service_role;

DROP POLICY IF EXISTS "Service role can manage booking confirmation notification claims"
  ON public.booking_confirmation_notification_claims;
CREATE POLICY "Service role can manage booking confirmation notification claims"
  ON public.booking_confirmation_notification_claims
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.booking_confirmation_notification_claims IS
  'Atomic per-booking/channel claim table for first confirmation email and SMS dispatch.';

NOTIFY pgrst, 'reload schema';

COMMIT;
