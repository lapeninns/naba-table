-- Migration: Restore restaurant_capacity_rules for capacity enforcement
-- Description: Recreate capacity rules table, enum, policies, and trigger for booking RPCs
-- Task: fix-capacity-rules-20260120-1016
-- Author: AI Assistant
-- Date: 2026-01-20

BEGIN;

-- Ensure enum exists for override_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'capacity_override_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.capacity_override_type AS ENUM (
      'holiday',
      'event',
      'manual',
      'emergency'
    );
  END IF;
END$$;

-- Restore capacity rules table
CREATE TABLE IF NOT EXISTS public.restaurant_capacity_rules (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  service_period_id uuid REFERENCES public.restaurant_service_periods(id) ON DELETE CASCADE,
  day_of_week smallint,
  effective_date date,
  max_covers integer,
  max_parties integer,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  label text,
  override_type public.capacity_override_type,
  CONSTRAINT restaurant_capacity_rules_non_negative CHECK (
    ((max_covers IS NULL) OR (max_covers >= 0))
    AND ((max_parties IS NULL) OR (max_parties >= 0))
  ),
  CONSTRAINT restaurant_capacity_rules_scope CHECK (
    (service_period_id IS NOT NULL)
    OR (day_of_week IS NOT NULL)
    OR (effective_date IS NOT NULL)
  )
);

ALTER TABLE public.restaurant_capacity_rules OWNER TO postgres;

COMMENT ON COLUMN public.restaurant_capacity_rules.label
  IS 'Human-friendly name for this capacity rule or override (e.g., “Christmas Eve Dinner”).';
COMMENT ON COLUMN public.restaurant_capacity_rules.override_type
  IS 'Categorizes overrides (holiday, event, manual adjustments, emergencies).';

CREATE INDEX IF NOT EXISTS idx_restaurant_capacity_rules_scope
  ON public.restaurant_capacity_rules (
    restaurant_id,
    COALESCE(day_of_week::integer, -1),
    effective_date
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'restaurant_capacity_rules_updated_at'
      AND tgrelid = 'public.restaurant_capacity_rules'::regclass
  ) THEN
    CREATE TRIGGER restaurant_capacity_rules_updated_at
      BEFORE UPDATE ON public.restaurant_capacity_rules
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
END$$;

-- RLS policies
ALTER TABLE public.restaurant_capacity_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_capacity_rules'
      AND policyname = 'Service role can manage capacity rules'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role can manage capacity rules" ON public.restaurant_capacity_rules TO service_role USING (true) WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_capacity_rules'
      AND policyname = 'Staff can manage capacity rules'
  ) THEN
    EXECUTE 'CREATE POLICY "Staff can manage capacity rules" ON public.restaurant_capacity_rules USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)))';
  END IF;
END$$;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.restaurant_capacity_rules TO service_role;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.restaurant_capacity_rules TO authenticated;

COMMIT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- MERGED FROM: 20260120_fix_booking_rpc_type_casts.sql
-- ---------------------------------------------------------------------------

-- Migration: Fix create_booking_with_capacity_check type casts
-- Description: Remove casts to non-existent booking_type and seating_preference_type enums
-- The bookings table uses TEXT columns, not enums, so casts are unnecessary
-- Date: 2026-01-20

BEGIN;

-- Drop and recreate the function with corrected type handling
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
BEGIN
    -- =====================================================
    -- STEP 1: Idempotency Check
    -- =====================================================
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_booking_id
        FROM bookings
        WHERE restaurant_id = p_restaurant_id
          AND idempotency_key = p_idempotency_key
        LIMIT 1;

        IF FOUND THEN
            SELECT to_jsonb(b.*) INTO v_booking_record
            FROM bookings b
            WHERE id = v_booking_id;

            RETURN jsonb_build_object(
                'success', true,
                'duplicate', true,
                'booking', v_booking_record,
                'message', 'Booking already exists (idempotency)'
            );
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
    v_local_day := EXTRACT(ISODOW FROM v_local_start)::smallint;

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
    -- Check if the table exists first to avoid errors
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
    -- STEP 7: Insert Booking (using TEXT columns directly, no enum casts)
    -- =====================================================
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
        p_booking_type,                          -- TEXT column, no cast needed
        p_seating_preference::seating_preference_type,  -- This enum EXISTS, cast required
        'confirmed'::booking_status, -- This enum DOES exist
        v_reference,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        p_notes,
        p_marketing_opt_in,
        p_loyalty_points_awarded,
        p_source,
        p_auth_user_id,
        p_idempotency_key,
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
        ) || COALESCE(p_details, '{}'::jsonb)
    )
    RETURNING id, to_jsonb(bookings.*) INTO v_booking_id, v_booking_record;

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
        RAISE WARNING 'Unexpected error in create_booking_with_capacity_check: % %', SQLERRM, SQLSTATE;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INTERNAL_ERROR',
            'message', 'An unexpected error occurred while creating the booking',
            'retryable', false,
            'sqlstate', SQLSTATE,
            'sqlerrm', SQLERRM,
            'timezone', v_timezone,
            'original_timezone', NULLIF(v_timezone_raw, '')
        );
END;
$$;

ALTER FUNCTION public.create_booking_with_capacity_check(
    uuid, uuid, date, time, time, integer, text, text, text, text, text, 
    text, boolean, text, text, uuid, text, jsonb, integer
) OWNER TO postgres;

COMMENT ON FUNCTION public.create_booking_with_capacity_check(
    uuid, uuid, date, time, time, integer, text, text, text, text, text,
    text, boolean, text, text, uuid, text, jsonb, integer
) IS 'Race-safe booking creation enforcing capacity and operating hours. Returns JSON response with success/error detail. Fixed to use TEXT columns instead of non-existent enum types.';

COMMIT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- MERGED FROM: 20260120_add_restaurant_capacity_rules.sql
-- ---------------------------------------------------------------------------

-- Migration: Restore restaurant_capacity_rules for booking capacity checks
-- Purpose: Add capacity override rules for restaurants/service periods/days with optional scoping.

BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_capacity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  service_period_id uuid,
  day_of_week smallint,
  effective_date date,
  max_covers integer,
  max_parties integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_capacity_rules_restaurant_id_fkey'
  ) THEN
    ALTER TABLE public.restaurant_capacity_rules
      ADD CONSTRAINT restaurant_capacity_rules_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES public.restaurants(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_capacity_rules_service_period_id_fkey'
  ) THEN
    ALTER TABLE public.restaurant_capacity_rules
      ADD CONSTRAINT restaurant_capacity_rules_service_period_id_fkey
      FOREIGN KEY (service_period_id)
      REFERENCES public.restaurant_service_periods(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS restaurant_capacity_rules_lookup_idx
  ON public.restaurant_capacity_rules (
    restaurant_id,
    service_period_id,
    day_of_week,
    effective_date
  );

ALTER TABLE public.restaurant_capacity_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'restaurant_capacity_rules_updated_at'
  ) THEN
    CREATE TRIGGER restaurant_capacity_rules_updated_at
      BEFORE UPDATE ON public.restaurant_capacity_rules
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

COMMENT ON TABLE public.restaurant_capacity_rules IS
  'Capacity override rules scoped by restaurant, optional service period/day/date.';

COMMENT ON COLUMN public.restaurant_capacity_rules.id IS
  'Primary key for capacity rule.';
COMMENT ON COLUMN public.restaurant_capacity_rules.restaurant_id IS
  'Restaurant this capacity rule applies to.';
COMMENT ON COLUMN public.restaurant_capacity_rules.service_period_id IS
  'Optional service period override; null means all periods.';
COMMENT ON COLUMN public.restaurant_capacity_rules.day_of_week IS
  'Optional day-of-week override (0=Sunday..6=Saturday); null means all days.';
COMMENT ON COLUMN public.restaurant_capacity_rules.effective_date IS
  'Optional effective date; null means always active.';
COMMENT ON COLUMN public.restaurant_capacity_rules.max_covers IS
  'Maximum total covers for the rule scope.';
COMMENT ON COLUMN public.restaurant_capacity_rules.max_parties IS
  'Maximum total parties for the rule scope.';
COMMENT ON COLUMN public.restaurant_capacity_rules.created_at IS
  'Creation timestamp.';
COMMENT ON COLUMN public.restaurant_capacity_rules.updated_at IS
  'Last update timestamp.';

GRANT ALL ON TABLE public.restaurant_capacity_rules TO authenticated;
GRANT ALL ON TABLE public.restaurant_capacity_rules TO service_role;

COMMIT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
