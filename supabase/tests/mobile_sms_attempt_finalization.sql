-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
--
-- finalize_mobile_sms_attempt must honour provider acceptance, terminal callback truth and
-- provider SID ownership for one synthetic booking.
--
-- Run through `DB_TARGET_ENV=staging pnpm db:sql-regression`. The fixtures create the
-- confirmed booking 00000000-0000-4000-8000-00000000b002 for restaurant
-- 00000000-0000-4000-8000-00000000a001 inside the same transaction; nothing is selected from
-- pre-existing data. Assertion failures raise SQLSTATE NB001. Ledger rows created here are
-- never committed and never reach the mobile dispatch workers; rollback does not recall a
-- message that was actually sent, so fixtures must never trigger a real delivery.
BEGIN;

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_booking_id constant uuid := '00000000-0000-4000-8000-00000000b002';
  v_attempt_id uuid;
  v_notification_id uuid;
  v_status text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = v_booking_id AND restaurant_id = v_restaurant_id
  ) THEN
    RAISE EXCEPTION 'synthetic fixture booking is missing; run through the sql-regression runner'
      USING ERRCODE = 'NB001';
  END IF;

  INSERT INTO public.mobile_notifications (
    booking_id,
    logical_key,
    notification_type,
    recipient_phone,
    restaurant_id
  )
  VALUES (
    v_booking_id,
    'proof:mobile_sms_attempt_finalization',
    'booking_confirmation',
    '+447000000010',
    v_restaurant_id
  )
  RETURNING id INTO v_notification_id;

  INSERT INTO public.mobile_notification_attempts (
    channel,
    notification_id,
    provider,
    recipient_phone,
    status
  )
  VALUES (
    'sms',
    v_notification_id,
    'twilio',
    '+447000000010',
    'claimed'
  )
  RETURNING id INTO v_attempt_id;

  SELECT public.finalize_mobile_sms_attempt(v_attempt_id, 'SM-proof', 'queued', NULL)
  INTO v_status;
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'SMS provider acceptance was not finalized (status=%)', v_status
      USING ERRCODE = 'NB001';
  END IF;

  SELECT public.finalize_mobile_sms_attempt(v_attempt_id, 'SM-proof', 'delivered', NULL)
  INTO v_status;
  SELECT public.finalize_mobile_sms_attempt(v_attempt_id, 'SM-proof', 'sent', NULL)
  INTO v_status;
  IF v_status IS DISTINCT FROM 'delivered' THEN
    RAISE EXCEPTION 'Delayed SMS finalization regressed terminal callback truth (status=%)', v_status
      USING ERRCODE = 'NB001';
  END IF;

  SELECT public.finalize_mobile_sms_attempt(v_attempt_id, 'SM-other', 'failed', '30005')
  INTO v_status;
  IF v_status IS NOT NULL THEN
    RAISE EXCEPTION 'SMS attempt accepted a conflicting provider SID (status=%)', v_status
      USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'nabatable-regression: mobile_sms_attempt_finalization passed';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'nabatable-regression: mobile_sms_attempt_finalization FAILED (SQLSTATE %)', SQLSTATE;
    RAISE;
END;
$regression$;

ROLLBACK;
