BEGIN;

DO $$
DECLARE
  v_attempt_id uuid;
  v_booking_id uuid;
  v_notification_id uuid;
  v_other_restaurant_id uuid;
  v_provider_message_id text;
  v_restaurant_id uuid;
  v_scheduled_id uuid;
  v_claimed_count integer;
  v_intent_status text;
  v_lifecycle_notification_id uuid;
  v_other_lifecycle_notification_id uuid;
  v_other_lifecycle_whatsapp_attempt_id uuid;
  v_lifecycle_sms_attempt_id uuid;
  v_lifecycle_whatsapp_attempt_id uuid;
  v_first_claim_token uuid;
  v_second_claim_token uuid;
  v_rows_affected integer;
BEGIN
  SELECT booking.id, booking.restaurant_id
  INTO v_booking_id, v_restaurant_id
  FROM public.bookings booking
  WHERE booking.status = 'completed'
  ORDER BY booking.created_at
  LIMIT 1;

  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'Staging invariant proof requires one existing booking';
  END IF;

  SELECT restaurant.id
  INTO v_other_restaurant_id
  FROM public.restaurants restaurant
  WHERE restaurant.id <> v_restaurant_id
  ORDER BY restaurant.created_at
  LIMIT 1;

  IF v_other_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Staging tenant proof requires a second restaurant';
  END IF;

  UPDATE public.bookings
  SET customer_phone = '+447000000003',
      whatsapp_opt_in = true,
      whatsapp_opt_in_at = now(),
      whatsapp_consent_phone = '+447000000003',
      whatsapp_consent_source = 'guest_reserve',
      whatsapp_consent_version = 'booking-plus-review-v2',
      whatsapp_consent_actor_id = NULL
  WHERE id = v_booking_id;

  v_scheduled_id := public.schedule_mobile_review_notification(
    v_booking_id,
    v_restaurant_id,
    '+447000000003',
    now() - interval '1 minute'
  );

  IF v_scheduled_id IS NULL THEN
    RAISE EXCEPTION 'Eligible review intent was not scheduled';
  END IF;

  SELECT count(*)
  INTO v_claimed_count
  FROM public.claim_due_mobile_review_notifications(100) claimed
  WHERE claimed.id = v_scheduled_id;

  IF v_claimed_count <> 1 THEN
    RAISE EXCEPTION 'Due review intent was not claimed exactly once';
  END IF;

  SELECT mobile_intent_claim_token
  INTO v_first_claim_token
  FROM public.mobile_notifications
  WHERE id = v_scheduled_id;

  UPDATE public.mobile_notifications
  SET mobile_intent_claimed_at = now() - interval '16 minutes'
  WHERE id = v_scheduled_id;

  PERFORM 1
  FROM public.claim_due_mobile_review_notifications(100) claimed
  WHERE claimed.id = v_scheduled_id;

  SELECT mobile_intent_claim_token
  INTO v_second_claim_token
  FROM public.mobile_notifications
  WHERE id = v_scheduled_id;

  IF v_first_claim_token IS NULL
    OR v_second_claim_token IS NULL
    OR v_first_claim_token = v_second_claim_token
  THEN
    RAISE EXCEPTION 'Reclaimed review intent did not rotate claim ownership';
  END IF;

  UPDATE public.mobile_notifications
  SET mobile_intent_status = 'processed'
  WHERE id = v_scheduled_id
    AND restaurant_id = v_restaurant_id
    AND mobile_intent_status = 'claimed'
    AND mobile_intent_claim_token = v_first_claim_token;
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected <> 0 THEN
    RAISE EXCEPTION 'Stale review worker finalized a newer claim';
  END IF;

  UPDATE public.mobile_notifications
  SET mobile_intent_status = 'processed',
      mobile_intent_processed_at = now(),
      mobile_intent_claim_token = NULL
  WHERE id = v_scheduled_id
    AND restaurant_id = v_restaurant_id
    AND mobile_intent_status = 'claimed'
    AND mobile_intent_claim_token = v_second_claim_token;
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected <> 1 THEN
    RAISE EXCEPTION 'Current review worker could not finalize its claim';
  END IF;

  PERFORM public.schedule_mobile_review_notification(
    v_booking_id,
    v_restaurant_id,
    '+447000000003',
    now() + interval '1 day'
  );

  SELECT mobile_intent_status
  INTO v_intent_status
  FROM public.mobile_notifications
  WHERE id = v_scheduled_id;

  IF v_intent_status <> 'processed' THEN
    RAISE EXCEPTION 'Terminal review intent was revived';
  END IF;

  SELECT count(*)
  INTO v_claimed_count
  FROM public.claim_due_mobile_review_notifications(100) claimed
  WHERE claimed.id = v_scheduled_id;

  IF v_claimed_count <> 0 THEN
    RAISE EXCEPTION 'Terminal review intent was claimed again';
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
    'claimed',
    'HX-proof-review'
  )
  RETURNING id INTO v_attempt_id;

  SELECT public.finalize_mobile_whatsapp_attempt(
    v_attempt_id,
    'WA-proof-review',
    'queued',
    NULL
  ) INTO v_intent_status;
  IF v_intent_status <> 'queued' THEN
    RAISE EXCEPTION 'Provider acceptance was not finalized';
  END IF;

  SELECT public.finalize_mobile_whatsapp_attempt(
    v_attempt_id,
    'WA-proof-review',
    'delivered',
    NULL
  ) INTO v_intent_status;
  SELECT public.finalize_mobile_whatsapp_attempt(
    v_attempt_id,
    'WA-proof-review',
    'queued',
    NULL
  ) INTO v_intent_status;
  SELECT provider_message_id
  INTO v_provider_message_id
  FROM public.mobile_notification_attempts
  WHERE id = v_attempt_id;

  IF v_intent_status <> 'delivered' OR v_provider_message_id <> 'WA-proof-review' THEN
    RAISE EXCEPTION 'Post-send finalization regressed callback truth or lost provider SID';
  END IF;

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

  BEGIN
    PERFORM public.claim_mobile_notification_preaccept_fallback(
      v_notification_id,
      v_restaurant_id,
      '+447000000001',
      v_attempt_id
    );
    RAISE EXCEPTION 'Review pre-accept fallback RPC was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.mobile_notifications (
    booking_id,
    logical_key,
    notification_type,
    recipient_phone,
    restaurant_id
  )
  VALUES (
    v_booking_id,
    'proof:booking_confirmation:preaccept-failure',
    'booking_confirmation',
    '+447000000003',
    v_restaurant_id
  )
  RETURNING id INTO v_lifecycle_notification_id;

  INSERT INTO public.mobile_notification_attempts (
    channel,
    notification_id,
    recipient_phone,
    status,
    template_id
  )
  VALUES (
    'whatsapp',
    v_lifecycle_notification_id,
    '+447000000003',
    'claimed',
    'HX-proof-confirmation'
  )
  RETURNING id INTO v_lifecycle_whatsapp_attempt_id;

  INSERT INTO public.mobile_notifications (
    booking_id,
    logical_key,
    notification_type,
    recipient_phone,
    restaurant_id
  )
  VALUES (
    v_booking_id,
    'proof:booking_update:foreign-attempt',
    'booking_update',
    '+447000000004',
    v_restaurant_id
  )
  RETURNING id INTO v_other_lifecycle_notification_id;

  INSERT INTO public.mobile_notification_attempts (
    channel,
    notification_id,
    recipient_phone,
    status,
    template_id
  )
  VALUES (
    'whatsapp',
    v_other_lifecycle_notification_id,
    '+447000000004',
    'claimed',
    'HX-proof-update'
  )
  RETURNING id INTO v_other_lifecycle_whatsapp_attempt_id;

  BEGIN
    PERFORM public.claim_mobile_notification_preaccept_fallback(
      v_lifecycle_notification_id,
      v_restaurant_id,
      '+447000000003',
      v_other_lifecycle_whatsapp_attempt_id
    );
    RAISE EXCEPTION 'Cross-notification pre-accept fallback was accepted';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'Cross-notification pre-accept fallback was accepted' THEN
        RAISE;
      END IF;
  END;

  SELECT status
  INTO v_intent_status
  FROM public.mobile_notification_attempts
  WHERE id = v_other_lifecycle_whatsapp_attempt_id;
  IF v_intent_status <> 'claimed' THEN
    RAISE EXCEPTION 'Cross-notification pre-accept fallback mutated the foreign attempt';
  END IF;

  BEGIN
    PERFORM public.claim_mobile_notification_preaccept_fallback(
      v_lifecycle_notification_id,
      v_other_restaurant_id,
      '+447000000003',
      v_lifecycle_whatsapp_attempt_id
    );
    RAISE EXCEPTION 'Cross-tenant pre-accept fallback was accepted';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'Cross-tenant pre-accept fallback was accepted' THEN
        RAISE;
      END IF;
  END;

  SELECT public.claim_mobile_notification_preaccept_fallback(
    v_lifecycle_notification_id,
    v_restaurant_id,
    '+447000000003',
    v_lifecycle_whatsapp_attempt_id
  ) INTO v_lifecycle_sms_attempt_id;

  SELECT status
  INTO v_intent_status
  FROM public.mobile_notification_attempts
  WHERE id = v_lifecycle_whatsapp_attempt_id;

  IF v_intent_status <> 'failed' OR v_lifecycle_sms_attempt_id IS NULL THEN
    RAISE EXCEPTION 'Lifecycle pre-accept failure was not atomically failed and backed by SMS';
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
