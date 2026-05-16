CREATE OR REPLACE FUNCTION public.record_booking_for_customer_profile_atomic(
  p_customer_id uuid,
  p_created_at timestamptz,
  p_party_size integer,
  p_marketing_opt_in boolean,
  p_is_cancelled boolean DEFAULT false
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.customer_profiles (
    customer_id,
    first_booking_at,
    last_booking_at,
    total_bookings,
    total_covers,
    total_cancellations,
    marketing_opt_in,
    last_marketing_opt_in_at,
    updated_at
  )
  VALUES (
    p_customer_id,
    p_created_at,
    p_created_at,
    1,
    GREATEST(COALESCE(p_party_size, 0), 0),
    CASE WHEN p_is_cancelled THEN 1 ELSE 0 END,
    COALESCE(p_marketing_opt_in, false),
    CASE WHEN COALESCE(p_marketing_opt_in, false) THEN p_created_at ELSE NULL END,
    timezone('utc', now())
  )
  ON CONFLICT (customer_id) DO UPDATE
  SET
    first_booking_at = LEAST(
      COALESCE(public.customer_profiles.first_booking_at, EXCLUDED.first_booking_at),
      EXCLUDED.first_booking_at
    ),
    last_booking_at = GREATEST(
      COALESCE(public.customer_profiles.last_booking_at, EXCLUDED.last_booking_at),
      EXCLUDED.last_booking_at
    ),
    total_bookings = public.customer_profiles.total_bookings + 1,
    total_covers = public.customer_profiles.total_covers + EXCLUDED.total_covers,
    total_cancellations = public.customer_profiles.total_cancellations + EXCLUDED.total_cancellations,
    marketing_opt_in = public.customer_profiles.marketing_opt_in OR EXCLUDED.marketing_opt_in,
    last_marketing_opt_in_at = CASE
      WHEN EXCLUDED.marketing_opt_in THEN GREATEST(
        COALESCE(public.customer_profiles.last_marketing_opt_in_at, EXCLUDED.last_marketing_opt_in_at),
        EXCLUDED.last_marketing_opt_in_at
      )
      ELSE public.customer_profiles.last_marketing_opt_in_at
    END,
    updated_at = timezone('utc', now());
$$;

CREATE OR REPLACE FUNCTION public.record_cancellation_for_customer_profile_atomic(
  p_customer_id uuid,
  p_cancelled_at timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.customer_profiles (
    customer_id,
    last_booking_at,
    total_cancellations,
    updated_at
  )
  VALUES (
    p_customer_id,
    p_cancelled_at,
    1,
    timezone('utc', now())
  )
  ON CONFLICT (customer_id) DO UPDATE
  SET
    total_cancellations = public.customer_profiles.total_cancellations + 1,
    last_booking_at = GREATEST(
      COALESCE(public.customer_profiles.last_booking_at, EXCLUDED.last_booking_at),
      EXCLUDED.last_booking_at
    ),
    updated_at = timezone('utc', now());
$$;

REVOKE ALL ON FUNCTION public.record_booking_for_customer_profile_atomic(
  uuid,
  timestamptz,
  integer,
  boolean,
  boolean
) FROM anon;
REVOKE ALL ON FUNCTION public.record_booking_for_customer_profile_atomic(
  uuid,
  timestamptz,
  integer,
  boolean,
  boolean
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_booking_for_customer_profile_atomic(
  uuid,
  timestamptz,
  integer,
  boolean,
  boolean
) TO service_role;

REVOKE ALL ON FUNCTION public.record_cancellation_for_customer_profile_atomic(
  uuid,
  timestamptz
) FROM anon;
REVOKE ALL ON FUNCTION public.record_cancellation_for_customer_profile_atomic(
  uuid,
  timestamptz
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_cancellation_for_customer_profile_atomic(
  uuid,
  timestamptz
) TO service_role;
