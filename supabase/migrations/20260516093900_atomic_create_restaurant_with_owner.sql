CREATE OR REPLACE FUNCTION public.create_restaurant_with_owner(
  p_user_id uuid,
  p_name text,
  p_slug text,
  p_timezone text,
  p_capacity integer DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_manager_daily_summary_enabled boolean DEFAULT false,
  p_manager_notification_phone text DEFAULT NULL,
  p_google_map_url text DEFAULT NULL,
  p_google_review_url text DEFAULT NULL,
  p_booking_policy text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_email_send_reminder_24h boolean DEFAULT true,
  p_email_send_reminder_short boolean DEFAULT true,
  p_email_send_review_request boolean DEFAULT true,
  p_reservation_interval_minutes integer DEFAULT 30,
  p_reservation_default_duration_minutes integer DEFAULT 90,
  p_reservation_last_seating_buffer_minutes integer DEFAULT NULL,
  p_reservation_lifecycle_grace_minutes integer DEFAULT 30
)
RETURNS public.restaurants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_restaurant public.restaurants;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('create_restaurant_with_owner:' || p_user_id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.restaurant_memberships
    WHERE user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User already has restaurant access'
      USING ERRCODE = '23505';
  END IF;

  IF p_reservation_last_seating_buffer_minutes IS NULL THEN
    INSERT INTO public.restaurants (
      name,
      slug,
      timezone,
      capacity,
      contact_email,
      contact_phone,
      address,
      manager_daily_summary_enabled,
      manager_notification_phone,
      google_map_url,
      google_review_url,
      booking_policy,
      logo_url,
      email_send_reminder_24h,
      email_send_reminder_short,
      email_send_review_request,
      reservation_interval_minutes,
      reservation_default_duration_minutes,
      reservation_lifecycle_grace_minutes
    )
    VALUES (
      p_name,
      p_slug,
      p_timezone,
      p_capacity,
      p_contact_email,
      p_contact_phone,
      p_address,
      p_manager_daily_summary_enabled,
      p_manager_notification_phone,
      p_google_map_url,
      p_google_review_url,
      p_booking_policy,
      p_logo_url,
      p_email_send_reminder_24h,
      p_email_send_reminder_short,
      p_email_send_review_request,
      p_reservation_interval_minutes,
      p_reservation_default_duration_minutes,
      p_reservation_lifecycle_grace_minutes
    )
    RETURNING * INTO created_restaurant;
  ELSE
    INSERT INTO public.restaurants (
      name,
      slug,
      timezone,
      capacity,
      contact_email,
      contact_phone,
      address,
      manager_daily_summary_enabled,
      manager_notification_phone,
      google_map_url,
      google_review_url,
      booking_policy,
      logo_url,
      email_send_reminder_24h,
      email_send_reminder_short,
      email_send_review_request,
      reservation_interval_minutes,
      reservation_default_duration_minutes,
      reservation_last_seating_buffer_minutes,
      reservation_lifecycle_grace_minutes
    )
    VALUES (
      p_name,
      p_slug,
      p_timezone,
      p_capacity,
      p_contact_email,
      p_contact_phone,
      p_address,
      p_manager_daily_summary_enabled,
      p_manager_notification_phone,
      p_google_map_url,
      p_google_review_url,
      p_booking_policy,
      p_logo_url,
      p_email_send_reminder_24h,
      p_email_send_reminder_short,
      p_email_send_review_request,
      p_reservation_interval_minutes,
      p_reservation_default_duration_minutes,
      p_reservation_last_seating_buffer_minutes,
      p_reservation_lifecycle_grace_minutes
    )
    RETURNING * INTO created_restaurant;
  END IF;

  INSERT INTO public.restaurant_memberships (
    user_id,
    restaurant_id,
    role
  )
  VALUES (
    p_user_id,
    created_restaurant.id,
    'owner'
  );

  RETURN created_restaurant;
END;
$$;

REVOKE ALL ON FUNCTION public.create_restaurant_with_owner(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  integer,
  integer,
  integer,
  integer
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_restaurant_with_owner(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  integer,
  integer,
  integer,
  integer
) FROM anon;
REVOKE ALL ON FUNCTION public.create_restaurant_with_owner(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  integer,
  integer,
  integer,
  integer
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_restaurant_with_owner(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  integer,
  integer,
  integer,
  integer
) TO service_role;
