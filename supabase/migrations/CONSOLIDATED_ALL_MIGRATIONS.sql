-- =============================================================================
-- CONSOLIDATED MIGRATIONS FOR PRODUCTION
-- =============================================================================
-- Run this file in Supabase SQL Editor to apply all pending migrations.
-- Date: 2026-01-20
-- 
-- INCLUDES:
-- 1. 20251219002800_remove_seating_floorplan_capacity.sql
-- 2. 20251219003000_add_reservation_lifecycle_grace_minutes.sql
-- 3. 20251226_add_email_templates.sql
-- 4. 20251226_add_google_review_url.sql
-- 5. 20251231_optional_contact_fields.sql
-- 6. 20260117_add_soft_holds.sql
-- 7. 20260118_cascade_delete_table_assignments.sql
-- 8. 20260118_lock_down_table_soft_holds_access.sql
-- 9. 20260120_add_restaurant_capacity_rules.sql
-- 10. 20260120_restore_capacity_rules.sql (superset of #9)
-- 11. 20260120_fix_booking_rpc_type_casts.sql
-- =============================================================================

-- =============================================================================
-- MIGRATION 1: Remove seating/floorplan/capacity artifacts (if any)
-- =============================================================================
DROP TABLE IF EXISTS public.allowed_capacities;

ALTER TABLE IF EXISTS public.tables
  DROP COLUMN IF EXISTS position;

-- =============================================================================
-- MIGRATION 2: Add reservation_lifecycle_grace_minutes
-- =============================================================================
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS reservation_lifecycle_grace_minutes INTEGER DEFAULT 15;

COMMENT ON COLUMN public.restaurants.reservation_lifecycle_grace_minutes IS 
  'Grace period in minutes for reservation lifecycle state transitions (check-in, no-show, etc.)';

-- =============================================================================
-- MIGRATION 3: Add email_templates column
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'restaurants' 
    AND column_name = 'email_templates'
  ) THEN
    ALTER TABLE public.restaurants ADD COLUMN email_templates jsonb DEFAULT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.restaurants.email_templates IS 
  'Custom email templates overriding system defaults. Keyed by email type (e.g., "created", "reminder").';

-- =============================================================================
-- MIGRATION 4: Add google_review_url column
-- =============================================================================
ALTER TABLE restaurants 
  ADD COLUMN IF NOT EXISTS google_review_url TEXT;

COMMENT ON COLUMN restaurants.google_review_url IS 
  'Google Review URL for post-dining review request emails';

-- =============================================================================
-- MIGRATION 5: Make email and phone optional in customers table
-- =============================================================================
DO $$
BEGIN
  -- Make email nullable if it's currently NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'customers' 
    AND column_name = 'email'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;
  END IF;
  
  -- Make phone nullable if it's currently NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'customers' 
    AND column_name = 'phone'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;
  END IF;
  
  -- Add check constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customers_contact_required'
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_contact_required 
      CHECK (
        (email IS NOT NULL AND email != '') 
        OR 
        (phone IS NOT NULL AND phone != '')
      );
  END IF;
END $$;

-- =============================================================================
-- MIGRATION 6: Add soft holds table (with IF NOT EXISTS checks)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.table_soft_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.table_inventory(id) ON DELETE CASCADE,
  hold_window tstzrange NOT NULL,
  session_token uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Add exclusion constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'table_soft_holds_no_overlap'
  ) THEN
    ALTER TABLE public.table_soft_holds
      ADD CONSTRAINT table_soft_holds_no_overlap 
      EXCLUDE USING gist (table_id WITH =, hold_window WITH &&)
      WHERE (expires_at > timezone('utc', now()));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS table_soft_holds_expires_idx 
  ON public.table_soft_holds (expires_at) 
  WHERE expires_at > timezone('utc', now());

CREATE INDEX IF NOT EXISTS table_soft_holds_session_idx 
  ON public.table_soft_holds (session_token);

CREATE INDEX IF NOT EXISTS table_soft_holds_restaurant_idx 
  ON public.table_soft_holds (restaurant_id, expires_at)
  WHERE expires_at > timezone('utc', now());

CREATE INDEX IF NOT EXISTS table_soft_holds_booking_idx 
  ON public.table_soft_holds (booking_id)
  WHERE booking_id IS NOT NULL;

-- Function: acquire_soft_holds_atomic
CREATE OR REPLACE FUNCTION public.acquire_soft_holds_atomic(
  p_table_ids uuid[],
  p_window tstzrange,
  p_session_token uuid,
  p_restaurant_id uuid,
  p_booking_id uuid DEFAULT NULL,
  p_ttl_seconds integer DEFAULT 10
) RETURNS TABLE(
  table_id uuid,
  acquired boolean,
  blocking_session uuid,
  blocking_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_expires_at timestamptz;
  v_table_id uuid;
  v_sorted_table_ids uuid[];
  v_blocking RECORD;
  v_all_acquired boolean := true;
  v_acquired_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
    RAISE EXCEPTION 'acquire_soft_holds_atomic requires at least one table id'
      USING ERRCODE = '23514';
  END IF;

  IF p_window IS NULL THEN
    RAISE EXCEPTION 'acquire_soft_holds_atomic requires a valid window'
      USING ERRCODE = '23514';
  END IF;

  IF p_session_token IS NULL THEN
    RAISE EXCEPTION 'acquire_soft_holds_atomic requires a session token'
      USING ERRCODE = '23514';
  END IF;

  v_expires_at := v_now + (p_ttl_seconds || ' seconds')::interval;

  SELECT array_agg(DISTINCT t.id ORDER BY t.id)
  INTO v_sorted_table_ids
  FROM unnest(p_table_ids) AS t(id);

  DELETE FROM public.table_soft_holds
  WHERE table_id = ANY(v_sorted_table_ids)
    AND expires_at <= v_now;

  FOREACH v_table_id IN ARRAY v_sorted_table_ids LOOP
    SELECT sh.session_token, sh.expires_at
    INTO v_blocking
    FROM public.table_soft_holds sh
    WHERE sh.table_id = v_table_id
      AND sh.expires_at > v_now
      AND sh.hold_window && p_window
      AND sh.session_token <> p_session_token
    LIMIT 1;

    IF FOUND THEN
      v_all_acquired := false;
      table_id := v_table_id;
      acquired := false;
      blocking_session := v_blocking.session_token;
      blocking_expires_at := v_blocking.expires_at;
      RETURN NEXT;
    ELSE
      IF EXISTS (
        SELECT 1 FROM public.table_soft_holds sh
        WHERE sh.table_id = v_table_id
          AND sh.session_token = p_session_token
          AND sh.expires_at > v_now
          AND sh.hold_window && p_window
      ) THEN
        UPDATE public.table_soft_holds
        SET expires_at = v_expires_at
        WHERE table_id = v_table_id
          AND session_token = p_session_token
          AND expires_at > v_now;
      ELSE
        BEGIN
          INSERT INTO public.table_soft_holds (
            table_id, hold_window, session_token, restaurant_id, booking_id, expires_at
          ) VALUES (
            v_table_id, p_window, p_session_token, p_restaurant_id, p_booking_id, v_expires_at
          );
        EXCEPTION
          WHEN exclusion_violation THEN
            SELECT sh.session_token, sh.expires_at
            INTO v_blocking
            FROM public.table_soft_holds sh
            WHERE sh.table_id = v_table_id
              AND sh.expires_at > v_now
              AND sh.hold_window && p_window
            LIMIT 1;

            v_all_acquired := false;
            table_id := v_table_id;
            acquired := false;
            blocking_session := COALESCE(v_blocking.session_token, NULL);
            blocking_expires_at := COALESCE(v_blocking.expires_at, NULL);
            RETURN NEXT;
            CONTINUE;
        END;
      END IF;

      v_acquired_ids := array_append(v_acquired_ids, v_table_id);
      table_id := v_table_id;
      acquired := true;
      blocking_session := NULL;
      blocking_expires_at := NULL;
      RETURN NEXT;
    END IF;
  END LOOP;

  IF NOT v_all_acquired AND array_length(v_acquired_ids, 1) > 0 THEN
    DELETE FROM public.table_soft_holds
    WHERE table_id = ANY(v_acquired_ids)
      AND session_token = p_session_token;
  END IF;
END;
$$;

-- Function: release_soft_holds
CREATE OR REPLACE FUNCTION public.release_soft_holds(
  p_session_token uuid,
  p_table_ids uuid[] DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
    DELETE FROM public.table_soft_holds
    WHERE session_token = p_session_token
      AND table_id = ANY(p_table_ids);
  ELSE
    DELETE FROM public.table_soft_holds
    WHERE session_token = p_session_token;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function: cleanup_expired_soft_holds
CREATE OR REPLACE FUNCTION public.cleanup_expired_soft_holds(
  p_batch_size integer DEFAULT 1000
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.table_soft_holds
  WHERE id IN (
    SELECT id FROM public.table_soft_holds
    WHERE expires_at <= timezone('utc', now())
    LIMIT p_batch_size
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function: check_soft_hold_ownership
CREATE OR REPLACE FUNCTION public.check_soft_hold_ownership(
  p_session_token uuid,
  p_table_ids uuid[],
  p_window tstzrange
) RETURNS TABLE(
  table_id uuid,
  owned boolean,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_table_id uuid;
  v_hold RECORD;
BEGIN
  FOREACH v_table_id IN ARRAY p_table_ids LOOP
    SELECT sh.expires_at
    INTO v_hold
    FROM public.table_soft_holds sh
    WHERE sh.table_id = v_table_id
      AND sh.session_token = p_session_token
      AND sh.expires_at > v_now
      AND sh.hold_window && p_window
    LIMIT 1;

    table_id := v_table_id;
    IF FOUND THEN
      owned := true;
      expires_at := v_hold.expires_at;
    ELSE
      owned := false;
      expires_at := NULL;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Grants for soft holds
GRANT ALL ON TABLE public.table_soft_holds TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_soft_holds_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_soft_holds_atomic TO service_role;
GRANT EXECUTE ON FUNCTION public.release_soft_holds TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_soft_holds TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_soft_holds TO service_role;
GRANT EXECUTE ON FUNCTION public.check_soft_hold_ownership TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_soft_hold_ownership TO service_role;

-- RLS for soft holds
ALTER TABLE public.table_soft_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to soft_holds" ON public.table_soft_holds;
CREATE POLICY "Service role has full access to soft_holds"
  ON public.table_soft_holds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- MIGRATION 7: Cascade delete for table assignments
-- =============================================================================
ALTER TABLE public.booking_table_assignments
  DROP CONSTRAINT IF EXISTS booking_table_assignments_table_id_fkey;

ALTER TABLE public.booking_table_assignments
  ADD CONSTRAINT booking_table_assignments_table_id_fkey
    FOREIGN KEY (table_id)
    REFERENCES public.table_inventory(id)
    ON DELETE CASCADE;

ALTER TABLE public.booking_table_assignments
  DROP CONSTRAINT IF EXISTS booking_table_assignments_booking_id_fkey;

ALTER TABLE public.booking_table_assignments
  ADD CONSTRAINT booking_table_assignments_booking_id_fkey
    FOREIGN KEY (booking_id)
    REFERENCES public.bookings(id)
    ON DELETE CASCADE;

-- =============================================================================
-- MIGRATION 8: Lock down table_soft_holds access
-- =============================================================================
REVOKE ALL ON TABLE public.table_soft_holds FROM authenticated;
REVOKE ALL ON TABLE public.table_soft_holds FROM anon;
GRANT ALL ON TABLE public.table_soft_holds TO service_role;

DROP POLICY IF EXISTS "Users can view soft holds" ON public.table_soft_holds;
DROP POLICY IF EXISTS "Users can insert soft holds" ON public.table_soft_holds;
DROP POLICY IF EXISTS "Users can delete their own soft holds" ON public.table_soft_holds;

-- =============================================================================
-- MIGRATION 9 & 10: Restaurant capacity rules table
-- =============================================================================
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

CREATE TABLE IF NOT EXISTS public.restaurant_capacity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'update_updated_at function not found, skipping trigger';
END$$;

ALTER TABLE public.restaurant_capacity_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage capacity rules" ON public.restaurant_capacity_rules;
CREATE POLICY "Service role can manage capacity rules" 
  ON public.restaurant_capacity_rules 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can manage capacity rules" ON public.restaurant_capacity_rules;
DO $$
BEGIN
  CREATE POLICY "Staff can manage capacity rules" 
    ON public.restaurant_capacity_rules 
    USING ((restaurant_id IN (SELECT public.user_restaurants() AS user_restaurants))) 
    WITH CHECK ((restaurant_id IN (SELECT public.user_restaurants() AS user_restaurants)));
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'user_restaurants function not found, skipping staff policy';
END$$;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.restaurant_capacity_rules TO service_role;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.restaurant_capacity_rules TO authenticated;

-- =============================================================================
-- MIGRATION 11: Fix booking RPC type casts
-- =============================================================================
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
    -- STEP 1: Idempotency Check
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

    -- STEP 2: Find Applicable Service Period
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

    -- STEP 3: Timezone & Operating Hours Validation
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

    -- STEP 4: Get Capacity Rules (with existence check)
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

    -- STEP 5: Count Existing Bookings
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

    -- STEP 6: Capacity Validation
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

    -- STEP 7: Insert Booking (TEXT for booking_type, enum cast for seating_preference)
    INSERT INTO bookings (
        restaurant_id, customer_id, booking_date, start_time, end_time,
        start_at, end_at, party_size, booking_type, seating_preference,
        status, reference, customer_name, customer_email, customer_phone,
        notes, marketing_opt_in, loyalty_points_awarded, source,
        auth_user_id, idempotency_key, details
    ) VALUES (
        p_restaurant_id, p_customer_id, p_booking_date, p_start_time, p_end_time,
        v_start_at, v_end_at, p_party_size,
        p_booking_type,                          -- TEXT column
        p_seating_preference::seating_preference_type,  -- ENUM cast
        'confirmed'::booking_status,
        v_reference, p_customer_name, p_customer_email, p_customer_phone,
        p_notes, p_marketing_opt_in, p_loyalty_points_awarded, p_source,
        p_auth_user_id, p_idempotency_key,
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
            'success', false, 'error', 'BOOKING_CONFLICT',
            'message', 'Concurrent booking conflict detected. Please retry.',
            'retryable', true
        );
    WHEN deadlock_detected THEN
        RETURN jsonb_build_object(
            'success', false, 'error', 'BOOKING_CONFLICT',
            'message', 'Database deadlock detected. Please retry.',
            'retryable', true
        );
    WHEN lock_not_available THEN
        RETURN jsonb_build_object(
            'success', false, 'error', 'BOOKING_CONFLICT',
            'message', 'Capacity rule is currently locked by another transaction. Please retry.',
            'retryable', true
        );
    WHEN OTHERS THEN
        RAISE WARNING 'Unexpected error in create_booking_with_capacity_check: % %', SQLERRM, SQLSTATE;
        RETURN jsonb_build_object(
            'success', false, 'error', 'INTERNAL_ERROR',
            'message', 'An unexpected error occurred while creating the booking',
            'retryable', false,
            'sqlstate', SQLSTATE,
            'sqlerrm', SQLERRM,
            'timezone', v_timezone,
            'original_timezone', NULLIF(v_timezone_raw, '')
        );
END;
$$;

-- =============================================================================
-- FINAL: Notify PostgREST to reload schema
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICATION QUERIES (run these after migration to verify)
-- =============================================================================
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'restaurants' 
-- AND column_name IN ('reservation_lifecycle_grace_minutes', 'email_templates', 'google_review_url');

-- SELECT COUNT(*) FROM public.table_soft_holds;
-- SELECT COUNT(*) FROM public.restaurant_capacity_rules;
