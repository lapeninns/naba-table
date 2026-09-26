-- allow: SIZE_OK — the whole create RPC body is restated so the idempotent insert is reviewable in one place.
--
-- Booking creation idempotency is enforced by the database, not by check-then-insert.
--
-- Before this migration two concurrent create_booking_with_capacity_check calls with the same
-- p_idempotency_key both passed the plain SELECT idempotency check and both inserted a booking
-- (reproduced on the local harness: 2 rows, both duplicate:false). bookings.idempotency_key only
-- had the non-unique partial index idx_bookings_idempotency_key.
--
-- Changes:
--   1. Existing duplicate keys are resolved deterministically. For each
--      (restaurant_id, idempotency_key) group with more than one row, the earliest row
--      (created_at, then id) keeps its key and every later row gets idempotency_key = NULL.
--      Every nulled key is recorded in public.booking_idempotency_key_dedupe_audit first.
--      Key-less legacy rows are not touched. The BEFORE UPDATE trigger bookings_updated_at
--      bumps updated_at on the nulled rows; no other column changes.
--   2. A unique partial index bookings_restaurant_idempotency_key_unique on
--      (restaurant_id, idempotency_key) WHERE idempotency_key IS NOT NULL. The table is locked
--      in SHARE ROW EXCLUSIVE mode for the dedupe + index build so no new duplicate can be
--      written in between; writes to bookings wait for the migration (index build is
--      proportional to the bookings row count).
--   3. create_booking_with_capacity_check keeps its exact signature and grants, and:
--      - inserts with ON CONFLICT (restaurant_id, idempotency_key) DO NOTHING; the losing
--        concurrent call reads the winner's committed row and returns it with duplicate:true;
--      - a key reused with a different salient payload (customer_id, booking_date, start_time
--        to the minute, party_size) returns success:false, error IDEMPOTENCY_KEY_REUSED,
--        details.idempotencyConflict = true, and never the other booking. The app maps it to
--        409 IDEMPOTENCY_KEY_REUSED;
--      - p_details->>'initial_status' ('pending' or 'confirmed') selects the inserted status, so
--        the legacy create path no longer inserts 'confirmed' and flips it to 'pending' in a
--        second, non-atomic write. The key is stripped before details is stored. Callers that
--        do not send it keep the previous behaviour ('confirmed');
--      - p_details->>'idempotency_key_kind' = 'derived' marks a server-derived key (key-less
--        clients: sha256 of restaurant, customer, date, start, end and party size). A derived key
--        must not claim a slot forever: when it meets a cancelled or no_show booking, that row's
--        key is released (idempotency_key = NULL, details.idempotency_key_released_at stamped)
--        and the insert runs, so a guest can rebook a slot they cancelled. A client-supplied key
--        still replays its booking whatever its status. The marker is stripped before storing;
--      - retryable BOOKING_CONFLICT payloads carry details.bookingConflict = true, because the
--        unified validation path maps the RPC code to CAPACITY_EXCEEDED and would otherwise
--        lose the retry signal;
--      - the INTERNAL_ERROR payload no longer carries SQLERRM (it is still RAISE WARNING-ed).
--
-- Rollback notes:
--   * Function: re-apply the body from 20260124_fix_booking_rpc_day_of_week.sql (same signature;
--     grants are unchanged because CREATE OR REPLACE keeps them).
--   * Index: DROP INDEX public.bookings_restaurant_idempotency_key_unique;
--   * Nulled keys (only needed if the old duplicate keys must come back, after dropping the
--     unique index):
--       UPDATE public.bookings b SET idempotency_key = a.idempotency_key
--       FROM public.booking_idempotency_key_dedupe_audit a
--       WHERE a.booking_id = b.id AND b.idempotency_key IS NULL;
--   * Keys released from cancelled/no_show rows by derived-key rebooks are not restored; those
--     rows carry details.idempotency_key_released_at.
--   * The audit table can be dropped once the rollback window has passed:
--       DROP TABLE public.booking_idempotency_key_dedupe_audit;
BEGIN;

LOCK TABLE public.bookings IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS public.booking_idempotency_key_dedupe_audit (
  booking_id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  kept_booking_id uuid NOT NULL,
  deduped_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.booking_idempotency_key_dedupe_audit IS
  'Rollback record for 20260927100000: booking idempotency keys nulled to allow the unique (restaurant_id, idempotency_key) index.';

ALTER TABLE public.booking_idempotency_key_dedupe_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_idempotency_key_dedupe_audit FROM PUBLIC;
REVOKE ALL ON TABLE public.booking_idempotency_key_dedupe_audit FROM anon;
REVOKE ALL ON TABLE public.booking_idempotency_key_dedupe_audit FROM authenticated;
GRANT SELECT ON TABLE public.booking_idempotency_key_dedupe_audit TO service_role;

WITH ranked AS (
  SELECT
    b.id,
    b.restaurant_id,
    b.idempotency_key,
    first_value(b.id) OVER (
      PARTITION BY b.restaurant_id, b.idempotency_key
      ORDER BY b.created_at ASC NULLS LAST, b.id ASC
    ) AS kept_booking_id,
    row_number() OVER (
      PARTITION BY b.restaurant_id, b.idempotency_key
      ORDER BY b.created_at ASC NULLS LAST, b.id ASC
    ) AS position
  FROM public.bookings b
  WHERE b.idempotency_key IS NOT NULL
)
INSERT INTO public.booking_idempotency_key_dedupe_audit (
  booking_id,
  restaurant_id,
  idempotency_key,
  kept_booking_id
)
SELECT id, restaurant_id, idempotency_key, kept_booking_id
FROM ranked
WHERE position > 1
ON CONFLICT (booking_id) DO NOTHING;

UPDATE public.bookings b
SET idempotency_key = NULL
FROM public.booking_idempotency_key_dedupe_audit a
WHERE a.booking_id = b.id
  AND b.idempotency_key IS NOT NULL
  AND b.idempotency_key = a.idempotency_key;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_restaurant_idempotency_key_unique
  ON public.bookings (restaurant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_booking_with_capacity_check(
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
    p_idempotency_key text DEFAULT NULL::text,
    p_source text DEFAULT 'api'::text,
    p_auth_user_id uuid DEFAULT NULL::uuid,
    p_client_request_id text DEFAULT NULL::text,
    p_details jsonb DEFAULT '{}'::jsonb,
    p_loyalty_points_awarded integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
    v_service_period_id uuid;
    v_service_period_name text;
    v_max_covers integer;
    v_max_parties integer;
    v_booked_covers integer;
    v_booked_parties integer;
    v_booking_id uuid;
    v_booking_record jsonb;
    v_reference text;
    v_start_at timestamptz;
    v_end_at timestamptz;
    v_timezone text;
    v_timezone_raw text;
    v_allow_after_hours boolean;
    v_local_start timestamp without time zone;
    v_local_end timestamp without time zone;
    v_local_day smallint;
    v_is_open boolean;
    v_has_closure boolean;
    v_capacity_rules_exist boolean;
    v_idempotency_key text := NULLIF(BTRIM(p_idempotency_key), '');
    v_existing public.bookings%ROWTYPE;
    v_initial_status public.booking_status := 'confirmed';
    v_details jsonb := COALESCE(p_details, '{}'::jsonb);
    v_derived_key boolean := false;
    v_attempt integer;
BEGIN
    -- =====================================================
    -- STEP 0: Initial status (compatible opt-in through p_details)
    -- =====================================================
    IF jsonb_typeof(v_details) <> 'object' THEN
        v_details := '{}'::jsonb;
    END IF;

    IF v_details ->> 'initial_status' = 'pending' THEN
        v_initial_status := 'pending';
    END IF;
    v_derived_key := v_details ->> 'idempotency_key_kind' = 'derived';
    v_details := v_details - 'initial_status' - 'idempotency_key_kind';

    -- =====================================================
    -- STEP 1: Idempotency replay (fast path; the unique index below is the guarantee)
    -- =====================================================
    IF v_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing
        FROM public.bookings
        WHERE restaurant_id = p_restaurant_id
          AND idempotency_key = v_idempotency_key;

        IF FOUND THEN
            IF v_derived_key AND v_existing.status IN ('cancelled', 'no_show') THEN
                -- A derived key never replays a finished booking: release it and insert.
                UPDATE public.bookings
                SET idempotency_key = NULL,
                    details = COALESCE(details, '{}'::jsonb)
                        || jsonb_build_object('idempotency_key_released_at', now())
                WHERE id = v_existing.id
                  AND status IN ('cancelled', 'no_show');
            ELSE
                RETURN public.booking_create_idempotent_replay_result(
                    v_existing, p_customer_id, p_booking_date, p_start_time, p_party_size
                );
            END IF;
        END IF;
    END IF;

    -- =====================================================
    -- STEP 2: Find Applicable Service Period
    -- =====================================================
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

    -- =====================================================
    -- STEP 3: Timezone & Operating Hours Validation
    -- =====================================================
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

    v_local_start := (v_start_at AT TIME ZONE v_timezone);
    v_local_end := (v_end_at AT TIME ZONE v_timezone);
    v_local_day := EXTRACT(DOW FROM v_local_start)::smallint;

    SELECT allow_after_hours
    INTO v_allow_after_hours
    FROM service_policy
    ORDER BY created_at DESC
    LIMIT 1;

    v_allow_after_hours := COALESCE(v_allow_after_hours, false);

    IF NOT v_allow_after_hours THEN
        SELECT EXISTS (
            SELECT 1
            FROM restaurant_operating_hours h
            WHERE h.restaurant_id = p_restaurant_id
              AND h.is_closed = true
              AND (
                    (h.effective_date IS NOT NULL AND h.effective_date = v_local_start::date)
                 OR (h.effective_date IS NULL AND h.day_of_week = v_local_day)
              )
        ) INTO v_has_closure;

        IF v_has_closure THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_OUTSIDE_OPERATING_HOURS',
                'message', 'The restaurant is closed during the requested window.',
                'retryable', false,
                'details', jsonb_build_object(
                    'requestedStart', to_char(v_local_start, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'requestedEnd', to_char(v_local_end, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'timezone', v_timezone,
                    'allowAfterHours', v_allow_after_hours
                )
            );
        END IF;

        SELECT EXISTS (
            SELECT 1
            FROM restaurant_operating_hours h
            WHERE h.restaurant_id = p_restaurant_id
              AND h.is_closed = false
              AND (
                    (h.effective_date IS NOT NULL AND h.effective_date = v_local_start::date)
                 OR (h.effective_date IS NULL AND h.day_of_week = v_local_day)
              )
              AND v_local_start::time >= h.opens_at
              AND v_local_start::time < h.closes_at
        ) INTO v_is_open;

        IF NOT v_is_open THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_OUTSIDE_OPERATING_HOURS',
                'message', 'The requested time is outside configured operating hours.',
                'retryable', false,
                'details', jsonb_build_object(
                    'requestedStart', to_char(v_local_start, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'requestedEnd', to_char(v_local_end, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'timezone', v_timezone,
                    'allowAfterHours', v_allow_after_hours
                )
            );
        END IF;
    END IF;

    -- =====================================================
    -- STEP 4: Get Capacity Rules with Row-Level Lock
    -- =====================================================
    v_capacity_rules_exist := to_regclass('public.restaurant_capacity_rules') IS NOT NULL;

    IF v_capacity_rules_exist THEN
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
    END IF;

    v_max_covers := COALESCE(v_max_covers, 999999);
    v_max_parties := COALESCE(v_max_parties, 999999);

    -- =====================================================
    -- STEP 5: Count Existing Bookings in Same Period
    -- =====================================================
    SELECT
        COALESCE(SUM(b.party_size), 0) AS total_covers,
        COUNT(*) AS total_parties
    INTO v_booked_covers, v_booked_parties
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date = p_booking_date
      AND b.status NOT IN ('cancelled', 'no_show')
      AND (
            v_service_period_id IS NULL
         OR b.start_time >= (
                SELECT start_time FROM restaurant_service_periods WHERE id = v_service_period_id
            )
         AND b.start_time < (
                SELECT end_time FROM restaurant_service_periods WHERE id = v_service_period_id
            )
      );

    -- =====================================================
    -- STEP 6: Capacity Validation
    -- =====================================================
    IF v_booked_covers + p_party_size > v_max_covers THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('Maximum capacity of %s covers exceeded. Currently booked: %s, Requested: %s',
                v_max_covers, v_booked_covers, p_party_size),
            'details', jsonb_build_object(
                'maxCovers', v_max_covers,
                'bookedCovers', v_booked_covers,
                'requestedCovers', p_party_size,
                'availableCovers', v_max_covers - v_booked_covers,
                'servicePeriod', v_service_period_name
            )
        );
    END IF;

    IF v_booked_parties + 1 > v_max_parties THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('Maximum of %s bookings exceeded for this period. Currently booked: %s',
                v_max_parties, v_booked_parties),
            'details', jsonb_build_object(
                'maxParties', v_max_parties,
                'bookedParties', v_booked_parties,
                'availableParties', v_max_parties - v_booked_parties,
                'servicePeriod', v_service_period_name
            )
        );
    END IF;

    v_reference := public.generate_booking_reference();

    -- =====================================================
    -- STEP 7: Insert Booking; the unique (restaurant_id, idempotency_key) index arbitrates races
    -- =====================================================
    FOR v_attempt IN 1..2 LOOP
        INSERT INTO bookings (
            restaurant_id,
            customer_id,
            booking_date,
            start_time,
            end_time,
            start_at,
            end_at,
            party_size,
            booking_type,
            seating_preference,
            status,
            reference,
            customer_name,
            customer_email,
            customer_phone,
            notes,
            marketing_opt_in,
            loyalty_points_awarded,
            source,
            auth_user_id,
            idempotency_key,
            details
        ) VALUES (
            p_restaurant_id,
            p_customer_id,
            p_booking_date,
            p_start_time,
            p_end_time,
            v_start_at,
            v_end_at,
            p_party_size,
            p_booking_type,
            p_seating_preference::seating_preference_type,
            v_initial_status,
            v_reference,
            p_customer_name,
            p_customer_email,
            p_customer_phone,
            p_notes,
            p_marketing_opt_in,
            p_loyalty_points_awarded,
            p_source,
            p_auth_user_id,
            v_idempotency_key,
            jsonb_build_object(
                'channel', 'api.capacity_safe',
                'client_request_id', p_client_request_id,
                'capacity_check', jsonb_build_object(
                    'service_period_id', v_service_period_id,
                    'max_covers', v_max_covers,
                    'booked_covers_before', v_booked_covers,
                    'booked_covers_after', v_booked_covers + p_party_size
                ),
                'timezone', v_timezone,
                'original_timezone', NULLIF(v_timezone_raw, '')
            ) || v_details
        )
        ON CONFLICT (restaurant_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
        RETURNING id, to_jsonb(bookings.*) INTO v_booking_id, v_booking_record;

        EXIT WHEN v_booking_id IS NOT NULL;

        -- A concurrent call with the same key committed first. READ COMMITTED gives this new
        -- statement a snapshot that includes the winner's row.
        SELECT * INTO v_existing
        FROM public.bookings
        WHERE restaurant_id = p_restaurant_id
          AND idempotency_key = v_idempotency_key;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_CONFLICT',
                'message', 'Concurrent booking conflict detected. Please retry.',
                'retryable', true,
                'details', jsonb_build_object('bookingConflict', true)
            );
        END IF;

        IF v_derived_key AND v_attempt = 1 AND v_existing.status IN ('cancelled', 'no_show') THEN
            -- The keyed row was finished in between: release its derived key and insert again.
            UPDATE public.bookings
            SET idempotency_key = NULL,
                details = COALESCE(details, '{}'::jsonb)
                    || jsonb_build_object('idempotency_key_released_at', now())
            WHERE id = v_existing.id
              AND status IN ('cancelled', 'no_show');
            CONTINUE;
        END IF;

        RETURN public.booking_create_idempotent_replay_result(
            v_existing, p_customer_id, p_booking_date, p_start_time, p_party_size
        );
    END LOOP;

    IF v_booking_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BOOKING_CONFLICT',
            'message', 'Concurrent booking conflict detected. Please retry.',
            'retryable', true,
            'details', jsonb_build_object('bookingConflict', true)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'duplicate', false,
        'booking', v_booking_record,
        'capacity', jsonb_build_object(
            'servicePeriod', v_service_period_name,
            'maxCovers', v_max_covers,
            'bookedCovers', v_booked_covers + p_party_size,
            'availableCovers', v_max_covers - (v_booked_covers + p_party_size),
            'utilizationPercent', ROUND(((v_booked_covers + p_party_size)::numeric / v_max_covers) * 100, 1)
        ),
        'message', 'Booking created successfully'
    );

EXCEPTION
    WHEN serialization_failure THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BOOKING_CONFLICT',
            'message', 'Concurrent booking conflict detected. Please retry.',
            'retryable', true,
            'details', jsonb_build_object('bookingConflict', true)
        );

    WHEN deadlock_detected THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BOOKING_CONFLICT',
            'message', 'Database deadlock detected. Please retry.',
            'retryable', true,
            'details', jsonb_build_object('bookingConflict', true)
        );

    WHEN lock_not_available THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BOOKING_CONFLICT',
            'message', 'Capacity rule is currently locked by another transaction. Please retry.',
            'retryable', true,
            'details', jsonb_build_object('bookingConflict', true)
        );

    WHEN OTHERS THEN
        RAISE WARNING 'Unexpected error in create_booking_with_capacity_check: % %', SQLERRM, SQLSTATE;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INTERNAL_ERROR',
            'message', 'An unexpected error occurred while creating the booking',
            'retryable', false,
            'sqlstate', SQLSTATE
        );
END;
$$;

COMMENT ON FUNCTION public.create_booking_with_capacity_check(
    uuid, uuid, date, time, time, integer, text, text, text, text, text,
    text, boolean, text, text, uuid, text, jsonb, integer
) IS 'Race-safe booking creation enforcing capacity and operating hours. Idempotent per (restaurant_id, idempotency_key) through a unique index; a reused key with a different payload returns IDEMPOTENCY_KEY_REUSED. p_details.initial_status = pending inserts a pending booking.';

-- Shared replay decision: same salient payload -> the existing booking (duplicate:true);
-- different payload -> IDEMPOTENCY_KEY_REUSED without the other booking's data.
CREATE OR REPLACE FUNCTION public.booking_create_idempotent_replay_result(
    p_existing public.bookings,
    p_customer_id uuid,
    p_booking_date date,
    p_start_time time without time zone,
    p_party_size integer
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
    IF p_existing.customer_id IS DISTINCT FROM p_customer_id
       OR p_existing.booking_date IS DISTINCT FROM p_booking_date
       OR to_char(p_existing.start_time, 'HH24:MI') IS DISTINCT FROM to_char(p_start_time, 'HH24:MI')
       OR p_existing.party_size IS DISTINCT FROM p_party_size THEN
        RETURN jsonb_build_object(
            'success', false,
            'duplicate', false,
            'error', 'IDEMPOTENCY_KEY_REUSED',
            'message', 'This request key was already used for a different booking.',
            'retryable', false,
            'details', jsonb_build_object('idempotencyConflict', true)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'duplicate', true,
        'booking', to_jsonb(p_existing),
        'message', 'Booking already exists (idempotency)'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.booking_create_idempotent_replay_result(
    public.bookings, uuid, date, time without time zone, integer
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_create_idempotent_replay_result(
    public.bookings, uuid, date, time without time zone, integer
) FROM anon;
REVOKE ALL ON FUNCTION public.booking_create_idempotent_replay_result(
    public.bookings, uuid, date, time without time zone, integer
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_create_idempotent_replay_result(
    public.bookings, uuid, date, time without time zone, integer
) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
