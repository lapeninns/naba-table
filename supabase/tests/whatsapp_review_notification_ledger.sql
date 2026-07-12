BEGIN;

DO $$
DECLARE
  v_attempt_id uuid;
  v_booking_id uuid;
  v_notification_id uuid;
  v_other_restaurant_id uuid;
  v_restaurant_id uuid;
BEGIN
  SELECT booking.id, booking.restaurant_id
  INTO v_booking_id, v_restaurant_id
  FROM public.bookings booking
  ORDER BY booking.created_at
  LIMIT 1;

  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'Staging invariant proof requires one existing booking';
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
    'proof:booking_review_request:first',
    'booking_review_request',
    '+447000000001',
    v_restaurant_id
  )
  RETURNING id INTO v_notification_id;

  BEGIN
    INSERT INTO public.mobile_notifications (
      booking_id,
      logical_key,
      notification_type,
      recipient_phone,
      restaurant_id
    )
    VALUES (
      v_booking_id,
      'proof:booking_review_request:duplicate',
      'booking_review_request',
      '+447000000001',
      v_restaurant_id
    );
    RAISE EXCEPTION 'Duplicate review notification was accepted';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  INSERT INTO public.mobile_notification_attempts (
    channel,
    notification_id,
    recipient_phone,
    status,
    template_id
  )
  VALUES (
    'whatsapp',
    v_notification_id,
    '+447000000001',
    'failed',
    'HX-proof-review'
  )
  RETURNING id INTO v_attempt_id;

  BEGIN
    INSERT INTO public.mobile_notification_attempts (
      channel,
      notification_id,
      recipient_phone,
      status,
      template_id
    )
    VALUES (
      'whatsapp',
      v_notification_id,
      '+447000000099',
      'claimed',
      'HX-proof-review'
    );
    RAISE EXCEPTION 'Attempt recipient mismatch was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.mobile_notification_attempts (
      channel,
      fallback_for_attempt_id,
      notification_id,
      recipient_phone,
      status
    )
    VALUES (
      'sms',
      v_attempt_id,
      v_notification_id,
      '+447000000001',
      'claimed'
    );
    RAISE EXCEPTION 'Direct review SMS attempt was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    PERFORM public.claim_mobile_notification_fallback(
      v_notification_id,
      v_restaurant_id,
      '+447000000001',
      v_attempt_id
    );
    RAISE EXCEPTION 'Review fallback RPC was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  SELECT restaurant.id
  INTO v_other_restaurant_id
  FROM public.restaurants restaurant
  WHERE restaurant.id <> v_restaurant_id
  ORDER BY restaurant.created_at
  LIMIT 1;

  IF v_other_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Staging tenant proof requires a second restaurant';
  END IF;

  BEGIN
    INSERT INTO public.mobile_notifications (
      booking_id,
      logical_key,
      notification_type,
      recipient_phone,
      restaurant_id
    )
    VALUES (
      v_booking_id,
      'proof:booking_review_request:tenant-mismatch',
      'booking_review_request',
      '+447000000002',
      v_other_restaurant_id
    );
    RAISE EXCEPTION 'Cross-tenant review notification was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$$;

ROLLBACK;
