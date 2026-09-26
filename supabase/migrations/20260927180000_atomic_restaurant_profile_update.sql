-- Atomic restaurant profile update (restaurants row + Nabatable business description).
--
-- Why: PATCH /api/ops/restaurants/:id wrote the restaurants row and then upserted the
-- business description in a second request, so a failure in the second write reported a 500
-- after the first had committed. The manager WhatsApp consent was also cleared or re-stamped
-- on every staff-communications save, because the app never compared the request with the
-- stored consent. This function does both writes in one transaction, under a row lock, and
-- only touches the consent columns when the stored state actually changes.
--
-- Contract:
--   p_patch                   snake_case restaurants columns to set. Unknown keys raise 22023.
--                             The consent columns are not accepted here; they are derived.
--   p_whatsapp_intent         'enable' | 'disable' | NULL (keep the stored consent unless the
--                             manager phone changes, which always withdraws it).
--   p_actor_id                the authenticated user stamped on a new consent.
--   p_set_business_description / p_business_description
--                             upsert the ('nabatable','nabatable') business details row.
--   Returns jsonb {restaurant: <restaurants row>, business_description: text|null}.
--   Raises P0002 RESTAURANT_NOT_FOUND, 22023 MANAGER_PHONE_REQUIRED / CONSENT_ACTOR_REQUIRED,
--   and lets 23505 (restaurants_slug_key) and 23514 (check constraints) propagate so the app
--   can map them to SLUG_TAKEN / VALIDATION_FAILED.
--
-- Rollback: DROP FUNCTION IF EXISTS public.update_restaurant_profile_v1(uuid, jsonb, text, uuid, boolean, text);
-- The previous app code (two PostgREST writes) does not depend on this function, so reverting
-- the app and dropping the function is safe in either order. No data is migrated.

CREATE OR REPLACE FUNCTION public.update_restaurant_profile_v1(
  p_restaurant_id uuid,
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_whatsapp_intent text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_set_business_description boolean DEFAULT false,
  p_business_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed constant text[] := ARRAY[
    'name', 'slug', 'is_active', 'timezone', 'capacity', 'contact_email', 'contact_phone',
    'address', 'manager_name', 'manager_notification_phone', 'manager_daily_summary_enabled',
    'google_map_url', 'google_review_url', 'booking_policy', 'logo_url',
    'email_send_reminder_24h', 'email_send_reminder_short', 'email_send_review_request',
    'reservation_interval_minutes', 'reservation_default_duration_minutes',
    'reservation_last_seating_buffer_minutes', 'reservation_lifecycle_grace_minutes'
  ];
  v_patch jsonb := COALESCE(p_patch, '{}'::jsonb);
  v_unknown text;
  v_current public.restaurants%ROWTYPE;
  v_next public.restaurants%ROWTYPE;
  v_row public.restaurants%ROWTYPE;
  v_phone_changed boolean;
  v_want_whatsapp boolean;
  v_description text;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'RESTAURANT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF jsonb_typeof(v_patch) <> 'object' THEN
    RAISE EXCEPTION 'PATCH_NOT_OBJECT' USING ERRCODE = '22023';
  END IF;

  IF p_whatsapp_intent IS NOT NULL AND p_whatsapp_intent NOT IN ('enable', 'disable') THEN
    RAISE EXCEPTION 'INVALID_WHATSAPP_INTENT' USING ERRCODE = '22023';
  END IF;

  SELECT key INTO v_unknown
  FROM jsonb_object_keys(v_patch) AS key
  WHERE key <> ALL (v_allowed)
  LIMIT 1;

  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'UNSUPPORTED_PATCH_FIELD' USING ERRCODE = '22023', DETAIL = v_unknown;
  END IF;

  SELECT * INTO v_current
  FROM public.restaurants
  WHERE id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESTAURANT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Keys present in the patch override the stored row; absent keys keep their stored value.
  v_next := jsonb_populate_record(v_current, v_patch);

  -- A manager phone that is cleared cannot receive the daily summary.
  IF v_next.manager_notification_phone IS NULL THEN
    v_next.manager_daily_summary_enabled := false;
  END IF;

  v_phone_changed :=
    v_next.manager_notification_phone IS DISTINCT FROM v_current.manager_notification_phone;
  v_want_whatsapp := CASE p_whatsapp_intent
    WHEN 'enable' THEN true
    WHEN 'disable' THEN false
    ELSE v_current.manager_whatsapp_enabled AND NOT v_phone_changed
  END;

  IF v_want_whatsapp THEN
    IF v_next.manager_notification_phone IS NULL THEN
      RAISE EXCEPTION 'MANAGER_PHONE_REQUIRED' USING ERRCODE = '22023';
    END IF;

    IF v_current.manager_whatsapp_enabled
       AND NOT v_phone_changed
       AND v_current.manager_whatsapp_consent_phone = v_next.manager_notification_phone THEN
      -- Same consent for the same number: keep the original actor and timestamp.
      NULL;
    ELSE
      IF p_actor_id IS NULL THEN
        RAISE EXCEPTION 'CONSENT_ACTOR_REQUIRED' USING ERRCODE = '22023';
      END IF;
      v_next.manager_whatsapp_enabled := true;
      v_next.manager_whatsapp_opt_in_at := now();
      v_next.manager_whatsapp_consent_phone := v_next.manager_notification_phone;
      v_next.manager_whatsapp_consent_version := 'manager-summary-v1';
      v_next.manager_whatsapp_consent_actor_id := p_actor_id;
    END IF;
  ELSE
    v_next.manager_whatsapp_enabled := false;
    v_next.manager_whatsapp_opt_in_at := NULL;
    v_next.manager_whatsapp_consent_phone := NULL;
    v_next.manager_whatsapp_consent_version := NULL;
    v_next.manager_whatsapp_consent_actor_id := NULL;
  END IF;

  IF v_next IS DISTINCT FROM v_current THEN
    UPDATE public.restaurants AS r
    SET
      name = v_next.name,
      slug = v_next.slug,
      is_active = v_next.is_active,
      timezone = v_next.timezone,
      capacity = v_next.capacity,
      contact_email = v_next.contact_email,
      contact_phone = v_next.contact_phone,
      address = v_next.address,
      manager_name = v_next.manager_name,
      manager_notification_phone = v_next.manager_notification_phone,
      manager_daily_summary_enabled = v_next.manager_daily_summary_enabled,
      manager_whatsapp_enabled = v_next.manager_whatsapp_enabled,
      manager_whatsapp_opt_in_at = v_next.manager_whatsapp_opt_in_at,
      manager_whatsapp_consent_phone = v_next.manager_whatsapp_consent_phone,
      manager_whatsapp_consent_version = v_next.manager_whatsapp_consent_version,
      manager_whatsapp_consent_actor_id = v_next.manager_whatsapp_consent_actor_id,
      google_map_url = v_next.google_map_url,
      google_review_url = v_next.google_review_url,
      booking_policy = v_next.booking_policy,
      logo_url = v_next.logo_url,
      email_send_reminder_24h = v_next.email_send_reminder_24h,
      email_send_reminder_short = v_next.email_send_reminder_short,
      email_send_review_request = v_next.email_send_review_request,
      reservation_interval_minutes = v_next.reservation_interval_minutes,
      reservation_default_duration_minutes = v_next.reservation_default_duration_minutes,
      reservation_last_seating_buffer_minutes = v_next.reservation_last_seating_buffer_minutes,
      reservation_lifecycle_grace_minutes = v_next.reservation_lifecycle_grace_minutes
    WHERE r.id = p_restaurant_id
    RETURNING r.* INTO v_row;
  ELSE
    v_row := v_current;
  END IF;

  IF p_set_business_description THEN
    INSERT INTO public.restaurant_business_details AS d (
      restaurant_id,
      description,
      source,
      managed_by,
      last_manual_override_at,
      change_origin,
      changed_by_user_id,
      changed_via,
      change_reason
    )
    VALUES (
      p_restaurant_id,
      NULLIF(btrim(p_business_description), ''),
      'nabatable',
      'nabatable',
      now(),
      'owner',
      p_actor_id,
      'ops_restaurant_profile',
      'Owner/admin restaurant profile update.'
    )
    ON CONFLICT (restaurant_id, source, managed_by) DO UPDATE
    SET
      description = EXCLUDED.description,
      last_manual_override_at = EXCLUDED.last_manual_override_at,
      change_origin = EXCLUDED.change_origin,
      changed_by_user_id = EXCLUDED.changed_by_user_id,
      changed_via = EXCLUDED.changed_via,
      change_reason = EXCLUDED.change_reason
    -- An unchanged description is not a new owner override (and enqueues no GBP change).
    WHERE d.description IS DISTINCT FROM EXCLUDED.description;
  END IF;

  SELECT d.description INTO v_description
  FROM public.restaurant_business_details AS d
  WHERE d.restaurant_id = p_restaurant_id
    AND d.source = 'nabatable'
    AND d.managed_by = 'nabatable';

  RETURN jsonb_build_object(
    'restaurant', to_jsonb(v_row),
    'business_description', v_description
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_restaurant_profile_v1(uuid, jsonb, text, uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_restaurant_profile_v1(uuid, jsonb, text, uuid, boolean, text) FROM anon;
REVOKE ALL ON FUNCTION public.update_restaurant_profile_v1(uuid, jsonb, text, uuid, boolean, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_restaurant_profile_v1(uuid, jsonb, text, uuid, boolean, text) TO service_role;
