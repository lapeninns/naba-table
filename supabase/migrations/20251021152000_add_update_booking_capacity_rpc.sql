-- Introduce transactional update RPC with capacity enforcement
DO $migration$
BEGIN
  EXECUTE $create$
    CREATE OR REPLACE FUNCTION public.update_booking_with_capacity_check(
        p_booking_id uuid,
        p_restaurant_id uuid,
        p_customer_id uuid,
        p_booking_date date,
        p_start_time time without time zone,
        p_end_time time without time zone,
        p_party_size integer,
        p_booking_type text,
        p_customer_name text,
        p_customer_email text,
        p_customer_phone text,
        p_seating_preference text,
        p_notes text DEFAULT NULL::text,
        p_marketing_opt_in boolean DEFAULT false,
        p_auth_user_id uuid DEFAULT NULL::uuid,
        p_client_request_id text DEFAULT NULL::text,
        p_details jsonb DEFAULT '{}'::jsonb,
        p_loyalty_points_awarded integer DEFAULT 0,
        p_source text DEFAULT 'api'::text
    ) RETURNS jsonb
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = 'public'
    AS $function$
    DECLARE
        v_existing bookings%ROWTYPE;
        v_service_period_id uuid;
        v_service_period_name text;
        v_max_covers integer;
        v_max_parties integer;
        v_booked_covers integer;
        v_booked_parties integer;
        v_timezone_raw text;
        v_timezone text;
        v_start_at timestamptz;
        v_end_at timestamptz;
        v_booking_record jsonb;
        v_booking_type bookings.booking_type%TYPE;
        v_seating_preference bookings.seating_preference%TYPE;
    BEGIN
        SELECT * INTO v_existing
        FROM bookings
        WHERE id = p_booking_id
          AND restaurant_id = p_restaurant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INVALID_PARAMS',
                'message', 'Booking not found for update'
            );
        END IF;

        SELECT sp.id, sp.name INTO v_service_period_id, v_service_period_name
        FROM restaurant_service_periods sp
        WHERE sp.restaurant_id = p_restaurant_id
          AND (sp.day_of_week IS NULL OR sp.day_of_week = EXTRACT(DOW FROM p_booking_date)::smallint)
          AND p_start_time >= sp.start_time
          AND p_start_time < sp.end_time
        ORDER BY
            sp.day_of_week DESC NULLS LAST,
            sp.start_time ASC
        LIMIT 1;

        SELECT
            COALESCE(cr.max_covers, 999999) AS max_covers,
            COALESCE(cr.max_parties, 999999) AS max_parties
        INTO v_max_covers, v_max_parties
        FROM restaurant_capacity_rules cr
        WHERE cr.restaurant_id = p_restaurant_id
          AND (cr.service_period_id IS NULL OR cr.service_period_id = v_service_period_id)
          AND (cr.day_of_week IS NULL OR cr.day_of_week = EXTRACT(DOW FROM p_booking_date)::smallint)
          AND (cr.effective_date IS NULL OR cr.effective_date <= p_booking_date)
        ORDER BY
            cr.effective_date DESC NULLS LAST,
            cr.day_of_week DESC NULLS LAST,
            cr.service_period_id DESC NULLS LAST
        LIMIT 1
        FOR UPDATE NOWAIT;

        v_max_covers := COALESCE(v_max_covers, 999999);
        v_max_parties := COALESCE(v_max_parties, 999999);

        SELECT
            COALESCE(SUM(b.party_size), 0) AS total_covers,
            COUNT(*) AS total_parties
        INTO v_booked_covers, v_booked_parties
        FROM bookings b
        WHERE b.restaurant_id = p_restaurant_id
          AND b.booking_date = p_booking_date
          AND b.status NOT IN ('cancelled', 'no_show')
          AND b.id <> p_booking_id
          AND (
            v_service_period_id IS NULL
            OR (
                b.start_time >= (SELECT start_time FROM restaurant_service_periods WHERE id = v_service_period_id)
                AND b.start_time < (SELECT end_time FROM restaurant_service_periods WHERE id = v_service_period_id)
            )
          );

        IF v_booked_covers + p_party_size > v_max_covers THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'CAPACITY_EXCEEDED',
                'message', 'No capacity available for this time slot',
                'details', jsonb_build_object(
                    'requestedCovers', p_party_size,
                    'maxCovers', v_max_covers,
                    'bookedCovers', v_booked_covers,
                    'availableCovers', GREATEST(v_max_covers - v_booked_covers, 0),
                    'servicePeriod', v_service_period_name,
                    'maxParties', v_max_parties,
                    'bookedParties', v_booked_parties
                )
            );
        END IF;

        IF v_booked_parties + 1 > v_max_parties THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'CAPACITY_EXCEEDED',
                'message', 'Too many simultaneous parties in this slot',
                'details', jsonb_build_object(
                    'requestedParties', 1,
                    'maxParties', v_max_parties,
                    'bookedParties', v_booked_parties,
                    'servicePeriod', v_service_period_name,
                    'availableParties', GREATEST(v_max_parties - v_booked_parties, 0)
                )
            );
        END IF;

        SELECT timezone INTO v_timezone_raw
        FROM restaurants
        WHERE id = p_restaurant_id;

        v_timezone_raw := COALESCE(BTRIM(v_timezone_raw), '');

        IF v_timezone_raw = '' THEN
            v_timezone := 'Europe/London';
        ELSE
            SELECT name INTO v_timezone
            FROM pg_timezone_names
            WHERE lower(name) = lower(v_timezone_raw)
            LIMIT 1;

            IF NOT FOUND OR v_timezone IS NULL THEN
                v_timezone := 'Europe/London';
            END IF;
        END IF;

        v_start_at := make_timestamptz(
            EXTRACT(YEAR FROM p_booking_date)::int,
            EXTRACT(MONTH FROM p_booking_date)::int,
            EXTRACT(DAY FROM p_booking_date)::int,
            EXTRACT(HOUR FROM p_start_time)::int,
            EXTRACT(MINUTE FROM p_start_time)::int,
            EXTRACT(SECOND FROM p_start_time),
            v_timezone
        );

        v_end_at := make_timestamptz(
            EXTRACT(YEAR FROM p_booking_date)::int,
            EXTRACT(MONTH FROM p_booking_date)::int,
            EXTRACT(DAY FROM p_booking_date)::int,
            EXTRACT(HOUR FROM p_end_time)::int,
            EXTRACT(MINUTE FROM p_end_time)::int,
            EXTRACT(SECOND FROM p_end_time),
            v_timezone
        );

        v_booking_type := p_booking_type;
        v_seating_preference := p_seating_preference;

        UPDATE bookings
        SET
            booking_date = p_booking_date,
            start_time = p_start_time,
            end_time = p_end_time,
            start_at = v_start_at,
            end_at = v_end_at,
            party_size = p_party_size,
            booking_type = v_booking_type,
            seating_preference = v_seating_preference,
            customer_name = p_customer_name,
            customer_email = p_customer_email,
            customer_phone = p_customer_phone,
            notes = p_notes,
            marketing_opt_in = p_marketing_opt_in,
            customer_id = p_customer_id,
            auth_user_id = COALESCE(p_auth_user_id, v_existing.auth_user_id),
            client_request_id = COALESCE(p_client_request_id, v_existing.client_request_id),
            loyalty_points_awarded = COALESCE(p_loyalty_points_awarded, v_existing.loyalty_points_awarded),
            source = COALESCE(p_source, v_existing.source),
            details = COALESCE(v_existing.details, '{}'::jsonb)
                || COALESCE(p_details, '{}'::jsonb)
                || jsonb_build_object(
                    'channel', 'api.capacity_safe',
                    'client_request_id', COALESCE(p_client_request_id, v_existing.client_request_id),
                    'capacity_check', jsonb_build_object(
                        'service_period_id', v_service_period_id,
                        'max_covers', v_max_covers,
                        'booked_covers_before', v_booked_covers,
                        'booked_covers_after', v_booked_covers + p_party_size
                    ),
                    'timezone', v_timezone,
                    'original_timezone', NULLIF(v_timezone_raw, '')
                )
        WHERE id = p_booking_id
        RETURNING to_jsonb(bookings.*) INTO v_booking_record;

        RETURN jsonb_build_object(
            'success', true,
            'booking', v_booking_record,
            'capacity', jsonb_build_object(
                'servicePeriod', v_service_period_name,
                'maxCovers', v_max_covers,
                'bookedCovers', v_booked_covers + p_party_size,
                'availableCovers', GREATEST(v_max_covers - (v_booked_covers + p_party_size), 0),
                'utilizationPercent', CASE
                    WHEN COALESCE(v_max_covers, 0) = 0 THEN 0
                    ELSE ROUND(((v_booked_covers + p_party_size)::numeric / NULLIF(v_max_covers, 0)) * 100, 1)
                END
            ),
            'message', 'Booking updated successfully'
        );

    EXCEPTION
        WHEN serialization_failure THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_CONFLICT',
                'message', 'Concurrent booking conflict detected. Please retry.',
                'retryable', true
            );
        WHEN deadlock_detected THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_CONFLICT',
                'message', 'Database deadlock detected. Please retry.',
                'retryable', true
            );
        WHEN lock_not_available THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_CONFLICT',
                'message', 'Capacity rule is currently locked by another transaction. Please retry.',
                'retryable', true
            );
        WHEN OTHERS THEN
            RAISE WARNING 'Unexpected error in update_booking_with_capacity_check: % %', SQLERRM, SQLSTATE;
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INTERNAL_ERROR',
                'message', 'An unexpected error occurred while updating the booking',
                'retryable', false,
                'details', jsonb_build_object(
                    'sqlstate', SQLSTATE,
                    'sqlerrm', SQLERRM,
                    'timezone', v_timezone,
                    'original_timezone', NULLIF(v_timezone_raw, '')
                ),
                'sqlstate', SQLSTATE,
                'sqlerrm', SQLERRM,
                'timezone', v_timezone,
                'original_timezone', NULLIF(v_timezone_raw, '')
            );
    END;
    $function$
  $create$;

  EXECUTE $grant_service$
    GRANT ALL ON FUNCTION public.update_booking_with_capacity_check(
        uuid,
        uuid,
        uuid,
        date,
        time without time zone,
        time without time zone,
        integer,
        text,
        text,
        text,
        text,
        text,
        text,
        boolean,
        uuid,
        text,
        jsonb,
        integer,
        text
    ) TO service_role
  $grant_service$;

  EXECUTE $grant_authenticated$
    GRANT ALL ON FUNCTION public.update_booking_with_capacity_check(
        uuid,
        uuid,
        uuid,
        date,
        time without time zone,
        time without time zone,
        integer,
        text,
        text,
        text,
        text,
        text,
        text,
        boolean,
        uuid,
        text,
        jsonb,
        integer,
        text
    ) TO authenticated
  $grant_authenticated$;

  EXECUTE $grant_anon$
    GRANT ALL ON FUNCTION public.update_booking_with_capacity_check(
        uuid,
        uuid,
        uuid,
        date,
        time without time zone,
        time without time zone,
        integer,
        text,
        text,
        text,
        text,
        text,
        text,
        boolean,
        uuid,
        text,
        jsonb,
        integer,
        text
    ) TO anon
  $grant_anon$;
END;
$migration$;
