BEGIN;

DO $$
DECLARE
  v_attempt_id uuid;
  v_booking_id uuid;
  v_notification_id uuid;
  v_restaurant_id uuid;
  v_status text;
BEGIN
  SELECT booking.id, booking.restaurant_id
  INTO v_booking_id, v_restaurant_id
  FROM public.bookings booking
  ORDER BY booking.created_at
  LIMIT 1;

  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'SMS finalization proof requires one existing booking';
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
  IF v_status <> 'queued' THEN
    RAISE EXCEPTION 'SMS provider acceptance was not finalized';
  END IF;

  SELECT public.finalize_mobile_sms_attempt(v_attempt_id, 'SM-proof', 'delivered', NULL)
  INTO v_status;
  SELECT public.finalize_mobile_sms_attempt(v_attempt_id, 'SM-proof', 'sent', NULL)
  INTO v_status;
  IF v_status <> 'delivered' THEN
    RAISE EXCEPTION 'Delayed SMS finalization regressed terminal callback truth';
  END IF;

  SELECT public.finalize_mobile_sms_attempt(v_attempt_id, 'SM-other', 'failed', '30005')
  INTO v_status;
  IF v_status IS NOT NULL THEN
    RAISE EXCEPTION 'SMS attempt accepted a conflicting provider SID';
  END IF;
END;
$$;

ROLLBACK;
