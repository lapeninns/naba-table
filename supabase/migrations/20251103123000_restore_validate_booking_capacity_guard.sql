-- Ensure post-assignment capacity validation tolerates missing overrides table
-- by guarding lookups with to_regclass and falling back to large defaults.

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.validate_booking_capacity_after_assignment(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking RECORD;
  v_service_period RECORD;
  v_timezone text;
  v_start timestamptz;
  v_end timestamptz;
  v_total_covers integer;
  v_total_parties integer;
  v_max_covers integer := 999999;
  v_max_parties integer := 999999;
  v_allow_after_hours boolean := false;
  v_policy RECORD;
  v_service_id uuid;
  v_capacity_table_exists boolean := to_regclass('public.restaurant_capacity_rules') IS NOT NULL;
  v_rule_max_covers integer;
  v_rule_max_parties integer;
BEGIN
  SELECT b.*, r.timezone AS restaurant_timezone
  INTO v_booking
  FROM public.bookings b
  JOIN public.restaurants r ON r.id = b.restaurant_id
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_timezone := COALESCE(NULLIF(v_booking.restaurant_timezone, ''), 'UTC');
  v_start := v_booking.start_at;
  v_end := v_booking.end_at;

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN;
  END IF;

  SELECT allow_after_hours
  INTO v_allow_after_hours
  FROM public.service_policy
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT sp.*
  INTO v_service_period
  FROM public.restaurant_service_periods sp
  WHERE sp.restaurant_id = v_booking.restaurant_id
    AND (sp.day_of_week IS NULL OR sp.day_of_week = EXTRACT(DOW FROM v_booking.booking_date)::smallint)
    AND v_booking.start_time >= sp.start_time
    AND v_booking.start_time < sp.end_time
  ORDER BY sp.day_of_week DESC NULLS LAST, sp.start_time ASC
  LIMIT 1;

  v_service_id := v_service_period.id;

  IF v_capacity_table_exists THEN
    SELECT
      COALESCE(cr.max_covers, v_max_covers),
      COALESCE(cr.max_parties, v_max_parties)
    INTO v_rule_max_covers, v_rule_max_parties
    FROM public.restaurant_capacity_rules cr
    WHERE cr.restaurant_id = v_booking.restaurant_id
      AND (cr.service_period_id IS NULL OR cr.service_period_id = v_service_id)
      AND (cr.day_of_week IS NULL OR cr.day_of_week = EXTRACT(DOW FROM v_booking.booking_date)::smallint)
      AND (cr.effective_date IS NULL OR cr.effective_date <= v_booking.booking_date)
    ORDER BY cr.effective_date DESC NULLS LAST,
             cr.day_of_week DESC NULLS LAST,
             cr.service_period_id DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;

    v_max_covers := COALESCE(v_rule_max_covers, v_max_covers);
    v_max_parties := COALESCE(v_rule_max_parties, v_max_parties);
  ELSE
    RAISE LOG 'Skipping capacity overrides for booking %, restaurant % because public.restaurant_capacity_rules is absent.',
      p_booking_id,
      v_booking.restaurant_id;
  END IF;

  SELECT
    COALESCE(SUM(b.party_size), 0) AS total_covers,
    COUNT(*) AS total_parties
  INTO v_total_covers, v_total_parties
  FROM public.bookings b
  WHERE b.restaurant_id = v_booking.restaurant_id
    AND b.booking_date = v_booking.booking_date
    AND b.status IN ('confirmed', 'pending', 'checked_in')
    AND (
      v_service_id IS NULL
      OR (b.start_time >= v_service_period.start_time AND b.start_time < v_service_period.end_time)
    );

  IF v_total_covers > v_max_covers OR v_total_parties > v_max_parties THEN
    RAISE EXCEPTION 'capacity_exceeded_post_assignment'
      USING ERRCODE = 'P0001',
            DETAIL = format('Capacity exceeded after assignment: covers %s/%s, parties %s/%s', v_total_covers, v_max_covers, v_total_parties, v_max_parties),
            HINT = 'Release tables or adjust capacity overrides before retrying.';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.validate_booking_capacity_after_assignment(uuid)
  IS 'Checks post-assignment capacity; tolerates missing restaurant_capacity_rules via to_regclass guard.';

