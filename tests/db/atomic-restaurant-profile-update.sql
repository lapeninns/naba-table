-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
BEGIN;

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  v_actor_id constant uuid := '00000000-0000-4000-8000-0000000000f1';
  v_second_actor_id constant uuid := '00000000-0000-4000-8000-0000000000f2';
  v_phone constant text := '+447000000091';
  v_new_phone constant text := '+447000000092';
  v_result jsonb;
  v_row public.restaurants%ROWTYPE;
  v_stamp timestamptz;
  v_other_before jsonb;
  v_other_after jsonb;
  v_state text;
  v_constraint text;
  v_message text;
  v_description_count integer;
  v_override_before timestamptz;
  v_override_after timestamptz;
BEGIN
  SELECT to_jsonb(r) INTO v_other_before FROM public.restaurants r WHERE r.id = v_other_restaurant_id;

  -- 1. Phone + WhatsApp enable stamps the consent with the actor.
  v_result := public.update_restaurant_profile_v1(
    v_restaurant_id,
    jsonb_build_object(
      'manager_notification_phone', v_phone,
      'manager_daily_summary_enabled', true,
      'manager_name', 'Sam'
    ),
    'enable',
    v_actor_id
  );
  SELECT * INTO v_row FROM public.restaurants WHERE id = v_restaurant_id;
  IF NOT v_row.manager_whatsapp_enabled
     OR v_row.manager_whatsapp_consent_actor_id IS DISTINCT FROM v_actor_id
     OR v_row.manager_whatsapp_consent_phone IS DISTINCT FROM v_phone
     OR v_row.manager_whatsapp_opt_in_at IS NULL THEN
    RAISE EXCEPTION 'consent was not stamped on enable: %', to_jsonb(v_row) USING ERRCODE = 'NB001';
  END IF;
  IF (v_result -> 'restaurant' ->> 'manager_name') IS DISTINCT FROM 'Sam' THEN
    RAISE EXCEPTION 'result does not carry the updated row' USING ERRCODE = 'NB001';
  END IF;
  v_stamp := v_row.manager_whatsapp_opt_in_at;

  -- Move the stored stamp into the past so a re-stamp is observable inside one transaction.
  UPDATE public.restaurants
  SET manager_whatsapp_opt_in_at = v_stamp - interval '1 day'
  WHERE id = v_restaurant_id;
  v_stamp := v_stamp - interval '1 day';

  -- 2. Changing only the manager name keeps the consent actor and timestamp.
  PERFORM public.update_restaurant_profile_v1(
    v_restaurant_id,
    jsonb_build_object('manager_name', 'Alex'),
    NULL,
    v_second_actor_id
  );
  SELECT * INTO v_row FROM public.restaurants WHERE id = v_restaurant_id;
  IF v_row.manager_name <> 'Alex'
     OR NOT v_row.manager_whatsapp_enabled
     OR v_row.manager_whatsapp_consent_actor_id IS DISTINCT FROM v_actor_id
     OR v_row.manager_whatsapp_opt_in_at IS DISTINCT FROM v_stamp THEN
    RAISE EXCEPTION 'manager name save touched the consent: %', to_jsonb(v_row) USING ERRCODE = 'NB001';
  END IF;

  -- 3. A legacy full payload (same phone, WhatsApp still on) also keeps the consent.
  PERFORM public.update_restaurant_profile_v1(
    v_restaurant_id,
    jsonb_build_object(
      'manager_name', 'Alex',
      'manager_notification_phone', v_phone,
      'manager_daily_summary_enabled', true
    ),
    'enable',
    v_second_actor_id
  );
  SELECT * INTO v_row FROM public.restaurants WHERE id = v_restaurant_id;
  IF v_row.manager_whatsapp_consent_actor_id IS DISTINCT FROM v_actor_id
     OR v_row.manager_whatsapp_opt_in_at IS DISTINCT FROM v_stamp THEN
    RAISE EXCEPTION 'unchanged enable re-stamped the consent' USING ERRCODE = 'NB001';
  END IF;

  -- 4. A new phone withdraws the consent unless the same request enables it again.
  PERFORM public.update_restaurant_profile_v1(
    v_restaurant_id,
    jsonb_build_object('manager_notification_phone', v_new_phone),
    NULL,
    v_second_actor_id
  );
  SELECT * INTO v_row FROM public.restaurants WHERE id = v_restaurant_id;
  IF v_row.manager_whatsapp_enabled
     OR v_row.manager_whatsapp_consent_actor_id IS NOT NULL
     OR v_row.manager_whatsapp_opt_in_at IS NOT NULL THEN
    RAISE EXCEPTION 'phone change kept the consent' USING ERRCODE = 'NB001';
  END IF;

  -- 4b. A phone change sent with an explicit re-consent stamps the new number and actor.
  PERFORM public.update_restaurant_profile_v1(
    v_restaurant_id,
    jsonb_build_object('manager_notification_phone', v_phone),
    'enable',
    v_second_actor_id
  );
  SELECT * INTO v_row FROM public.restaurants WHERE id = v_restaurant_id;
  IF NOT v_row.manager_whatsapp_enabled
     OR v_row.manager_whatsapp_consent_actor_id IS DISTINCT FROM v_second_actor_id
     OR v_row.manager_whatsapp_consent_phone IS DISTINCT FROM v_phone THEN
    RAISE EXCEPTION 'phone change with re-consent was not stamped' USING ERRCODE = 'NB001';
  END IF;

  -- 5. Enabling without a phone is refused (after clearing the phone, the summary turns off too).
  PERFORM public.update_restaurant_profile_v1(
    v_restaurant_id,
    jsonb_build_object('manager_notification_phone', NULL),
    NULL,
    v_actor_id
  );
  SELECT * INTO v_row FROM public.restaurants WHERE id = v_restaurant_id;
  IF v_row.manager_daily_summary_enabled THEN
    RAISE EXCEPTION 'daily summary stayed on without a phone' USING ERRCODE = 'NB001';
  END IF;
  -- Explicitly asking for the daily summary with no phone is refused, not silently dropped.
  BEGIN
    PERFORM public.update_restaurant_profile_v1(
      v_restaurant_id, jsonb_build_object('manager_daily_summary_enabled', true), NULL, v_actor_id
    );
    RAISE EXCEPTION 'daily summary without a phone was accepted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN invalid_parameter_value THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'MANAGER_PHONE_REQUIRED' THEN
      RAISE EXCEPTION 'unexpected refusal: %', v_message USING ERRCODE = 'NB001';
    END IF;
  END;
  -- Explicitly turning it off without a phone is fine.
  PERFORM public.update_restaurant_profile_v1(
    v_restaurant_id, jsonb_build_object('manager_daily_summary_enabled', false), NULL, v_actor_id
  );
  BEGIN
    PERFORM public.update_restaurant_profile_v1(v_restaurant_id, '{}'::jsonb, 'enable', v_actor_id);
    RAISE EXCEPTION 'enable without a phone was accepted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN invalid_parameter_value THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'MANAGER_PHONE_REQUIRED' THEN
      RAISE EXCEPTION 'unexpected refusal: %', v_message USING ERRCODE = 'NB001';
    END IF;
  END;

  -- 6. A taken slug raises 23505 on restaurants_slug_key and writes nothing (no partial write).
  BEGIN
    PERFORM public.update_restaurant_profile_v1(
      v_restaurant_id,
      jsonb_build_object('slug', (SELECT slug FROM public.restaurants WHERE id = v_other_restaurant_id)),
      NULL,
      v_actor_id,
      true,
      'Should not be saved'
    );
    RAISE EXCEPTION 'duplicate slug was accepted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'restaurants_slug_key' THEN
      RAISE EXCEPTION 'unexpected constraint: %', v_constraint USING ERRCODE = 'NB001';
    END IF;
  END;
  SELECT count(*) INTO v_description_count
  FROM public.restaurant_business_details
  WHERE restaurant_id = v_restaurant_id AND description = 'Should not be saved';
  IF v_description_count <> 0 THEN
    RAISE EXCEPTION 'description committed alongside a failed restaurant update' USING ERRCODE = 'NB001';
  END IF;

  -- 7. The restaurant row and the description are written together.
  v_result := public.update_restaurant_profile_v1(
    v_restaurant_id,
    jsonb_build_object('name', 'Synthetic renamed A'),
    NULL,
    v_actor_id,
    true,
    '  A cosy synthetic pub.  '
  );
  IF (v_result ->> 'business_description') IS DISTINCT FROM 'A cosy synthetic pub.'
     OR (v_result -> 'restaurant' ->> 'name') IS DISTINCT FROM 'Synthetic renamed A'
     OR (v_result -> 'previous' ->> 'name') IS NOT DISTINCT FROM 'Synthetic renamed A'
     OR (v_result -> 'previous' ->> 'slug') IS DISTINCT FROM (v_result -> 'restaurant' ->> 'slug') THEN
    RAISE EXCEPTION 'combined write returned %', v_result USING ERRCODE = 'NB001';
  END IF;
  SELECT last_manual_override_at INTO v_override_before
  FROM public.restaurant_business_details
  WHERE restaurant_id = v_restaurant_id AND source = 'nabatable' AND managed_by = 'nabatable';

  -- An unchanged description is not rewritten.
  PERFORM public.update_restaurant_profile_v1(
    v_restaurant_id, '{}'::jsonb, NULL, v_actor_id, true, 'A cosy synthetic pub.'
  );
  SELECT last_manual_override_at INTO v_override_after
  FROM public.restaurant_business_details
  WHERE restaurant_id = v_restaurant_id AND source = 'nabatable' AND managed_by = 'nabatable';
  IF v_override_after IS DISTINCT FROM v_override_before THEN
    RAISE EXCEPTION 'unchanged description was rewritten' USING ERRCODE = 'NB001';
  END IF;

  -- Any failure rolls back both writes: capacity 0 violates restaurants_capacity_check.
  BEGIN
    PERFORM public.update_restaurant_profile_v1(
      v_restaurant_id,
      jsonb_build_object('capacity', 0, 'name', 'Must not persist'),
      NULL,
      v_actor_id,
      true,
      'Must not persist either'
    );
    RAISE EXCEPTION 'capacity 0 was accepted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'restaurants_capacity_check' THEN
      RAISE EXCEPTION 'unexpected check: %', v_constraint USING ERRCODE = 'NB001';
    END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.restaurants WHERE id = v_restaurant_id AND name = 'Must not persist')
     OR EXISTS (
       SELECT 1 FROM public.restaurant_business_details
       WHERE restaurant_id = v_restaurant_id AND description = 'Must not persist either'
     ) THEN
    RAISE EXCEPTION 'failed update left a partial write' USING ERRCODE = 'NB001';
  END IF;

  -- 7b. previous.logo_url is the value the update replaced (read under the row lock).
  PERFORM public.update_restaurant_profile_v1(
    v_restaurant_id, jsonb_build_object('logo_url', 'https://example.test/logo-a.png')
  );
  v_result := public.update_restaurant_profile_v1(
    v_restaurant_id, jsonb_build_object('logo_url', 'https://example.test/logo-b.png')
  );
  IF (v_result -> 'previous' ->> 'logo_url') IS DISTINCT FROM 'https://example.test/logo-a.png'
     OR (v_result -> 'restaurant' ->> 'logo_url') IS DISTINCT FROM 'https://example.test/logo-b.png' THEN
    RAISE EXCEPTION 'previous logo_url not returned: %', v_result USING ERRCODE = 'NB001';
  END IF;

  -- 8. Unknown and derived keys are refused; missing restaurants raise P0002.
  BEGIN
    PERFORM public.update_restaurant_profile_v1(
      v_restaurant_id, jsonb_build_object('manager_whatsapp_consent_actor_id', v_actor_id)
    );
    RAISE EXCEPTION 'consent column accepted in patch' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN invalid_parameter_value THEN
    NULL;
  END;
  BEGIN
    PERFORM public.update_restaurant_profile_v1('00000000-0000-4000-8000-0000000000ff', '{}'::jsonb);
    RAISE EXCEPTION 'missing restaurant accepted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN no_data_found THEN
    NULL;
  END;

  -- 9. Only service_role may execute it.
  IF has_function_privilege('authenticated', 'public.update_restaurant_profile_v1(uuid, jsonb, text, uuid, boolean, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.update_restaurant_profile_v1(uuid, jsonb, text, uuid, boolean, text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.update_restaurant_profile_v1(uuid, jsonb, text, uuid, boolean, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'unexpected execute grants' USING ERRCODE = 'NB001';
  END IF;

  -- The other tenant is untouched throughout.
  SELECT to_jsonb(r) INTO v_other_after FROM public.restaurants r WHERE r.id = v_other_restaurant_id;
  IF v_other_after IS DISTINCT FROM v_other_before THEN
    RAISE EXCEPTION 'other restaurant changed' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'atomic-restaurant-profile-update regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'nabatable-regression: atomic-restaurant-profile-update FAILED (SQLSTATE %)', SQLSTATE;
    RAISE;
END;
$regression$;

ROLLBACK;
