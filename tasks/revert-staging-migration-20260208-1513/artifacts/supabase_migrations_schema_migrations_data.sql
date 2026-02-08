SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict G0mXHOKzDnLKBNMpDFLWNyZL3fruTJO830Sdc3B8D3575u2n512R3VVRFrHTKZi

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: supabase_migrations; Owner: postgres
--

INSERT INTO "supabase_migrations"."schema_migrations" ("version", "statements", "name") VALUES
	('20251219002800', '{"-- NOTE: This migration is generated to remove seating/floor-plan/capacity features.
-- Review against your actual schema before applying (remote-only policy).

-- Drop floor plan layout storage artifacts table if it exists (if you had one).
-- The current implementation stores layout JSON in Supabase Storage, not a DB table.

-- Allowed capacities feature: remove table if present.
DROP TABLE IF EXISTS public.allowed_capacities","-- If your table inventory stored a position column for floor-plan, drop it.
-- Adjust table name/column name if different.
ALTER TABLE IF EXISTS public.tables
  DROP COLUMN IF EXISTS position","-- If you have any capacity configuration fields used only by the seating/capacity pages,
-- drop them here once confirmed. Examples (commented out):
-- ALTER TABLE IF EXISTS public.restaurants DROP COLUMN IF EXISTS max_covers;
-- ALTER TABLE IF EXISTS public.restaurants DROP COLUMN IF EXISTS capacity_enabled;"}', 'remove_seating_floorplan_capacity'),
	('20251219003000', '{"-- Add missing reservation_lifecycle_grace_minutes column to restaurants table
-- This column stores the grace period in minutes for reservation lifecycle transitions

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS reservation_lifecycle_grace_minutes INTEGER DEFAULT 15","COMMENT ON COLUMN public.restaurants.reservation_lifecycle_grace_minutes IS ''Grace period in minutes for reservation lifecycle state transitions (check-in, no-show, etc.)''"}', 'add_reservation_lifecycle_grace_minutes'),
	('20251226', '{"-- Add email_templates column to restaurants table
alter table \"public\".\"restaurants\"
add column \"email_templates\" jsonb default null","comment on column \"public\".\"restaurants\".\"email_templates\" is ''Custom email templates overriding system defaults. Keyed by email type (e.g., \"created\", \"reminder\").''"}', 'add_email_templates'),
	('20251231', '{"-- Migration: Make email and phone optional in customers table
-- Date: 2025-12-31
-- Purpose: Allow ops staff to create walk-in bookings with either email OR phone
--
-- ROLLBACK PLAN:
-- If rollback is needed, execute the following in order:
--   1. UPDATE any customers with null email/phone to have valid values
--   2. ALTER TABLE customers DROP CONSTRAINT customers_contact_required;
--   3. ALTER TABLE customers 
--        ALTER COLUMN email SET NOT NULL,
--        ALTER COLUMN phone SET NOT NULL;
-- NOTE: Step 3 will fail if any customers exist with null email or phone.
--       Before rollback, ensure all customer records have both fields populated.

BEGIN","-- Make email and phone nullable
ALTER TABLE customers 
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL","-- Add check constraint to ensure at least one contact method exists
ALTER TABLE customers
  ADD CONSTRAINT customers_contact_required 
  CHECK (
    (email IS NOT NULL AND email != '''') 
    OR 
    (phone IS NOT NULL AND phone != '''')
  )","-- Add comment for documentation
COMMENT ON CONSTRAINT customers_contact_required ON customers IS 
  ''Ensures at least one contact method (email or phone) is provided''",COMMIT}', 'optional_contact_fields'),
	('20260117', '{"-- Migration: Add soft holds table for race condition prevention
-- Description: Implements soft-hold pattern to prevent race conditions during 
--              table evaluation and hold creation. Soft-holds are temporary
--              reservations that auto-expire and prevent concurrent selection.
-- Task: hold-race-condition-fix-20260117-2315
-- Author: AI Assistant
-- Date: 2026-01-17

-- =============================================================================
-- TABLE: table_soft_holds
-- =============================================================================
-- Temporary holds acquired during evaluation phase to prevent race conditions.
-- Key characteristics:
--   - Short TTL (default 10 seconds)
--   - Exclusion constraint prevents overlapping soft-holds for same table
--   - Session token links soft-hold to evaluation context
--   - Auto-expires via expires_at column

CREATE TABLE IF NOT EXISTS public.table_soft_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.table_inventory(id) ON DELETE CASCADE,
  hold_window tstzrange NOT NULL,
  session_token uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now()),
  
  -- Exclusion constraint: no overlapping soft-holds for same table
  -- Only applies to non-expired entries
  CONSTRAINT table_soft_holds_no_overlap 
    EXCLUDE USING gist (table_id WITH =, hold_window WITH &&)
    WHERE (expires_at > timezone(''utc'', now()))
)","-- Index for efficient cleanup of expired soft-holds
CREATE INDEX IF NOT EXISTS table_soft_holds_expires_idx 
  ON public.table_soft_holds (expires_at) 
  WHERE expires_at > timezone(''utc'', now())","-- Index for session token lookups (release/conversion)
CREATE INDEX IF NOT EXISTS table_soft_holds_session_idx 
  ON public.table_soft_holds (session_token)","-- Index for restaurant-scoped queries
CREATE INDEX IF NOT EXISTS table_soft_holds_restaurant_idx 
  ON public.table_soft_holds (restaurant_id, expires_at)
  WHERE expires_at > timezone(''utc'', now())","-- Index for booking-scoped queries  
CREATE INDEX IF NOT EXISTS table_soft_holds_booking_idx 
  ON public.table_soft_holds (booking_id)
  WHERE booking_id IS NOT NULL","-- =============================================================================
-- FUNCTION: acquire_soft_holds_atomic
-- =============================================================================
-- Atomically acquires soft-holds for a set of tables.
-- Returns acquisition status for each table.
--
-- Parameters:
--   p_table_ids: Array of table IDs to acquire soft-holds for
--   p_window: Time window for the soft-holds (tstzrange)
--   p_session_token: Unique session identifier
--   p_restaurant_id: Restaurant ID for scoping
--   p_booking_id: Optional booking ID for context
--   p_ttl_seconds: TTL in seconds (default 10)
--
-- Returns:
--   table_id: The table ID
--   acquired: Whether the soft-hold was acquired
--   blocking_session: Session token of blocking soft-hold (if any)
--   blocking_expires_at: When the blocking soft-hold expires (if any)

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
SET search_path TO ''public''
AS $$
DECLARE
  v_now timestamptz := timezone(''utc'', now());
  v_expires_at timestamptz;
  v_table_id uuid;
  v_sorted_table_ids uuid[];
  v_blocking RECORD;
  v_all_acquired boolean := true;
  v_acquired_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Validate inputs
  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
    RAISE EXCEPTION ''acquire_soft_holds_atomic requires at least one table id''
      USING ERRCODE = ''23514'';
  END IF;

  IF p_window IS NULL THEN
    RAISE EXCEPTION ''acquire_soft_holds_atomic requires a valid window''
      USING ERRCODE = ''23514'';
  END IF;

  IF p_session_token IS NULL THEN
    RAISE EXCEPTION ''acquire_soft_holds_atomic requires a session token''
      USING ERRCODE = ''23514'';
  END IF;

  -- Calculate expiry
  v_expires_at := v_now + (p_ttl_seconds || '' seconds'')::interval;

  -- Sort table IDs to prevent deadlocks (consistent acquisition order)
  SELECT array_agg(DISTINCT t.id ORDER BY t.id)
  INTO v_sorted_table_ids
  FROM unnest(p_table_ids) AS t(id);

  -- Clean up any expired soft-holds for these tables first
  DELETE FROM public.table_soft_holds
  WHERE table_id = ANY(v_sorted_table_ids)
    AND expires_at <= v_now;

  -- Check for blocking soft-holds and attempt acquisition
  FOREACH v_table_id IN ARRAY v_sorted_table_ids LOOP
    -- Check if table is already soft-held by another session
    SELECT sh.session_token, sh.expires_at
    INTO v_blocking
    FROM public.table_soft_holds sh
    WHERE sh.table_id = v_table_id
      AND sh.expires_at > v_now
      AND sh.hold_window && p_window
      AND sh.session_token <> p_session_token
    LIMIT 1;

    IF FOUND THEN
      -- Table is blocked by another session
      v_all_acquired := false;
      table_id := v_table_id;
      acquired := false;
      blocking_session := v_blocking.session_token;
      blocking_expires_at := v_blocking.expires_at;
      RETURN NEXT;
    ELSE
      -- Check if we already have a soft-hold for this table
      IF EXISTS (
        SELECT 1 FROM public.table_soft_holds sh
        WHERE sh.table_id = v_table_id
          AND sh.session_token = p_session_token
          AND sh.expires_at > v_now
          AND sh.hold_window && p_window
      ) THEN
        -- Extend existing soft-hold
        UPDATE public.table_soft_holds
        SET expires_at = v_expires_at
        WHERE table_id = v_table_id
          AND session_token = p_session_token
          AND expires_at > v_now;
      ELSE
        -- Attempt to insert new soft-hold
        BEGIN
          INSERT INTO public.table_soft_holds (
            table_id,
            hold_window,
            session_token,
            restaurant_id,
            booking_id,
            expires_at
          ) VALUES (
            v_table_id,
            p_window,
            p_session_token,
            p_restaurant_id,
            p_booking_id,
            v_expires_at
          );
        EXCEPTION
          WHEN exclusion_violation THEN
            -- Another session just acquired this table
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

      -- Successfully acquired
      v_acquired_ids := array_append(v_acquired_ids, v_table_id);
      table_id := v_table_id;
      acquired := true;
      blocking_session := NULL;
      blocking_expires_at := NULL;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- If not all acquired, release the ones we did acquire (rollback partial acquisition)
  IF NOT v_all_acquired AND array_length(v_acquired_ids, 1) > 0 THEN
    DELETE FROM public.table_soft_holds
    WHERE table_id = ANY(v_acquired_ids)
      AND session_token = p_session_token;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.acquire_soft_holds_atomic IS 
  ''Atomically acquires soft-holds for a set of tables to prevent race conditions during evaluation.'';

-- =============================================================================
-- FUNCTION: release_soft_holds
-- =============================================================================
-- Releases soft-holds by session token.

CREATE OR REPLACE FUNCTION public.release_soft_holds(
  p_session_token uuid,
  p_table_ids uuid[] DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''public''
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

COMMENT ON FUNCTION public.release_soft_holds IS 
  ''Releases soft-holds by session token, optionally limited to specific tables.'';

-- =============================================================================
-- FUNCTION: cleanup_expired_soft_holds
-- =============================================================================
-- Background cleanup function for expired soft-holds.
-- Should be called periodically (e.g., every minute).

CREATE OR REPLACE FUNCTION public.cleanup_expired_soft_holds(
  p_batch_size integer DEFAULT 1000
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''public''
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.table_soft_holds
  WHERE id IN (
    SELECT id FROM public.table_soft_holds
    WHERE expires_at <= timezone(''utc'', now())
    LIMIT p_batch_size
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_soft_holds IS 
  ''Cleans up expired soft-holds in batches. Call periodically for maintenance.'';

-- =============================================================================
-- FUNCTION: check_soft_hold_ownership
-- =============================================================================
-- Verifies a session owns soft-holds for specific tables.

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
SET search_path TO ''public''
AS $$
DECLARE
  v_now timestamptz := timezone(''utc'', now());
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

COMMENT ON FUNCTION public.check_soft_hold_ownership IS 
  ''Verifies a session owns soft-holds for specific tables in a given window.'';

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT ALL ON TABLE public.table_soft_holds TO authenticated;
GRANT ALL ON TABLE public.table_soft_holds TO service_role;

GRANT EXECUTE ON FUNCTION public.acquire_soft_holds_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_soft_holds_atomic TO service_role;

GRANT EXECUTE ON FUNCTION public.release_soft_holds TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_soft_holds TO service_role;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_soft_holds TO service_role;

GRANT EXECUTE ON FUNCTION public.check_soft_hold_ownership TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_soft_hold_ownership TO service_role;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.table_soft_holds ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY \"Service role has full access to soft_holds\"
  ON public.table_soft_holds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can manage their own soft-holds (session-based)
CREATE POLICY \"Users can view soft holds\"
  ON public.table_soft_holds
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY \"Users can insert soft holds\"
  ON public.table_soft_holds
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY \"Users can delete their own soft holds\"
  ON public.table_soft_holds
  FOR DELETE
  TO authenticated
  USING (true);"}', 'add_soft_holds'),
	('20260118', '{"-- Migration: Change booking_table_assignments FK to CASCADE on table deletion
-- Issue: [7b] Orphaned assignments when tables are deleted from inventory
-- Fix: ON DELETE CASCADE ensures automatic cleanup when tables are removed

-- Purpose: When a table is deleted from table_inventory, any booking_table_assignments
-- referencing that table should be automatically removed. This prevents:
-- 1. TABLES_NOT_FOUND errors when loading assignment context
-- 2. Need for reactive background cleanup jobs
-- 3. Orphaned data accumulation

BEGIN","-- Drop the existing RESTRICT constraint
ALTER TABLE public.booking_table_assignments
  DROP CONSTRAINT IF EXISTS booking_table_assignments_table_id_fkey","-- Re-add with CASCADE behavior
ALTER TABLE public.booking_table_assignments
  ADD CONSTRAINT booking_table_assignments_table_id_fkey
    FOREIGN KEY (table_id)
    REFERENCES public.table_inventory(id)
    ON DELETE CASCADE","-- Also ensure booking FK cascades (for when bookings are deleted)
ALTER TABLE public.booking_table_assignments
  DROP CONSTRAINT IF EXISTS booking_table_assignments_booking_id_fkey","ALTER TABLE public.booking_table_assignments
  ADD CONSTRAINT booking_table_assignments_booking_id_fkey
    FOREIGN KEY (booking_id)
    REFERENCES public.bookings(id)
    ON DELETE CASCADE",COMMIT,"-- Notify PostgREST to reload schema
NOTIFY pgrst, ''reload schema''"}', 'cascade_delete_table_assignments'),
	('20260120', '{"-- Migration: Restore restaurant_capacity_rules for booking capacity checks
-- Purpose: Add capacity override rules for restaurants/service periods/days with optional scoping.

BEGIN","CREATE TABLE IF NOT EXISTS public.restaurant_capacity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  service_period_id uuid,
  day_of_week smallint,
  effective_date date,
  max_covers integer,
  max_parties integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)","DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = ''restaurant_capacity_rules_restaurant_id_fkey''
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
    WHERE conname = ''restaurant_capacity_rules_service_period_id_fkey''
  ) THEN
    ALTER TABLE public.restaurant_capacity_rules
      ADD CONSTRAINT restaurant_capacity_rules_service_period_id_fkey
      FOREIGN KEY (service_period_id)
      REFERENCES public.restaurant_service_periods(id)
      ON DELETE SET NULL;
  END IF;
END $$","CREATE INDEX IF NOT EXISTS restaurant_capacity_rules_lookup_idx
  ON public.restaurant_capacity_rules (
    restaurant_id,
    service_period_id,
    day_of_week,
    effective_date
  )","ALTER TABLE public.restaurant_capacity_rules ENABLE ROW LEVEL SECURITY","DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = ''restaurant_capacity_rules_updated_at''
  ) THEN
    CREATE TRIGGER restaurant_capacity_rules_updated_at
      BEFORE UPDATE ON public.restaurant_capacity_rules
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$","COMMENT ON TABLE public.restaurant_capacity_rules IS
  ''Capacity override rules scoped by restaurant, optional service period/day/date.''","COMMENT ON COLUMN public.restaurant_capacity_rules.id IS
  ''Primary key for capacity rule.''","COMMENT ON COLUMN public.restaurant_capacity_rules.restaurant_id IS
  ''Restaurant this capacity rule applies to.''","COMMENT ON COLUMN public.restaurant_capacity_rules.service_period_id IS
  ''Optional service period override; null means all periods.''","COMMENT ON COLUMN public.restaurant_capacity_rules.day_of_week IS
  ''Optional day-of-week override (0=Sunday..6=Saturday); null means all days.''","COMMENT ON COLUMN public.restaurant_capacity_rules.effective_date IS
  ''Optional effective date; null means always active.''","COMMENT ON COLUMN public.restaurant_capacity_rules.max_covers IS
  ''Maximum total covers for the rule scope.''","COMMENT ON COLUMN public.restaurant_capacity_rules.max_parties IS
  ''Maximum total parties for the rule scope.''","COMMENT ON COLUMN public.restaurant_capacity_rules.created_at IS
  ''Creation timestamp.''","COMMENT ON COLUMN public.restaurant_capacity_rules.updated_at IS
  ''Last update timestamp.''","GRANT ALL ON TABLE public.restaurant_capacity_rules TO authenticated","GRANT ALL ON TABLE public.restaurant_capacity_rules TO service_role",COMMIT,"-- Notify PostgREST to reload schema
NOTIFY pgrst, ''reload schema''"}', 'add_restaurant_capacity_rules'),
	('20260124', '{"-- Fix day-of-week mapping for operating hours (Sunday should be 0)
-- Migration: Fix create_booking_with_capacity_check type casts
-- Description: Remove casts to non-existent booking_type and seating_preference_type enums
-- The bookings table uses TEXT columns, not enums, so casts are unnecessary
-- Date: 2026-01-20

BEGIN","-- Drop and recreate the function with corrected type handling
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
    p_source text DEFAULT ''api''::text,
    p_auth_user_id uuid DEFAULT NULL::uuid,
    p_client_request_id text DEFAULT NULL::text,
    p_details jsonb DEFAULT ''{}''::jsonb,
    p_loyalty_points_awarded integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''public'', ''extensions''
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
                ''success'', true,
                ''duplicate'', true,
                ''booking'', v_booking_record,
                ''message'', ''Booking already exists (idempotency)''
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

    v_timezone_raw := COALESCE(BTRIM(v_timezone_raw), '''');

    IF v_timezone_raw = '''' THEN
        v_timezone := ''Europe/London'';
    ELSE
        SELECT name INTO v_timezone
        FROM pg_timezone_names
        WHERE lower(name) = lower(v_timezone_raw)
        LIMIT 1;

        IF NOT FOUND OR v_timezone IS NULL THEN
            v_timezone := ''Europe/London'';
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
                ''success'', false,
                ''error'', ''BOOKING_OUTSIDE_OPERATING_HOURS'',
                ''message'', ''The restaurant is closed during the requested window.'',
                ''retryable'', false,
                ''details'', jsonb_build_object(
                    ''requestedStart'', to_char(v_local_start, ''YYYY-MM-DD\"T\"HH24:MI:SS''),
                    ''requestedEnd'', to_char(v_local_end, ''YYYY-MM-DD\"T\"HH24:MI:SS''),
                    ''timezone'', v_timezone,
                    ''allowAfterHours'', v_allow_after_hours
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
                ''success'', false,
                ''error'', ''BOOKING_OUTSIDE_OPERATING_HOURS'',
                ''message'', ''The requested time is outside configured operating hours.'',
                ''retryable'', false,
                ''details'', jsonb_build_object(
                    ''requestedStart'', to_char(v_local_start, ''YYYY-MM-DD\"T\"HH24:MI:SS''),
                    ''requestedEnd'', to_char(v_local_end, ''YYYY-MM-DD\"T\"HH24:MI:SS''),
                    ''timezone'', v_timezone,
                    ''allowAfterHours'', v_allow_after_hours
                )
            );
        END IF;
    END IF;

    -- =====================================================
    -- STEP 4: Get Capacity Rules with Row-Level Lock
    -- Check if the table exists first to avoid errors
    -- =====================================================
    v_capacity_rules_exist := to_regclass(''public.restaurant_capacity_rules'') IS NOT NULL;
    
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
      AND b.status NOT IN (''cancelled'', ''no_show'')
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
            ''success'', false,
            ''error'', ''CAPACITY_EXCEEDED'',
            ''message'', format(''Maximum capacity of %s covers exceeded. Currently booked: %s, Requested: %s'',
                v_max_covers, v_booked_covers, p_party_size),
            ''details'', jsonb_build_object(
                ''maxCovers'', v_max_covers,
                ''bookedCovers'', v_booked_covers,
                ''requestedCovers'', p_party_size,
                ''availableCovers'', v_max_covers - v_booked_covers,
                ''servicePeriod'', v_service_period_name
            )
        );
    END IF;

    IF v_booked_parties + 1 > v_max_parties THEN
        RETURN jsonb_build_object(
            ''success'', false,
            ''error'', ''CAPACITY_EXCEEDED'',
            ''message'', format(''Maximum of %s bookings exceeded for this period. Currently booked: %s'',
                v_max_parties, v_booked_parties),
            ''details'', jsonb_build_object(
                ''maxParties'', v_max_parties,
                ''bookedParties'', v_booked_parties,
                ''availableParties'', v_max_parties - v_booked_parties,
                ''servicePeriod'', v_service_period_name
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
        ''confirmed''::booking_status, -- This enum DOES exist
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
            ''channel'', ''api.capacity_safe'',
            ''client_request_id'', p_client_request_id,
            ''capacity_check'', jsonb_build_object(
                ''service_period_id'', v_service_period_id,
                ''max_covers'', v_max_covers,
                ''booked_covers_before'', v_booked_covers,
                ''booked_covers_after'', v_booked_covers + p_party_size
            ),
            ''timezone'', v_timezone,
            ''original_timezone'', NULLIF(v_timezone_raw, '''')
        ) || COALESCE(p_details, ''{}''::jsonb)
    )
    RETURNING id, to_jsonb(bookings.*) INTO v_booking_id, v_booking_record;

    RETURN jsonb_build_object(
        ''success'', true,
        ''duplicate'', false,
        ''booking'', v_booking_record,
        ''capacity'', jsonb_build_object(
            ''servicePeriod'', v_service_period_name,
            ''maxCovers'', v_max_covers,
            ''bookedCovers'', v_booked_covers + p_party_size,
            ''availableCovers'', v_max_covers - (v_booked_covers + p_party_size),
            ''utilizationPercent'', ROUND(((v_booked_covers + p_party_size)::numeric / v_max_covers) * 100, 1)
        ),
        ''message'', ''Booking created successfully''
    );

EXCEPTION
    WHEN serialization_failure THEN
        RETURN jsonb_build_object(
            ''success'', false,
            ''error'', ''BOOKING_CONFLICT'',
            ''message'', ''Concurrent booking conflict detected. Please retry.'',
            ''retryable'', true
        );

    WHEN deadlock_detected THEN
        RETURN jsonb_build_object(
            ''success'', false,
            ''error'', ''BOOKING_CONFLICT'',
            ''message'', ''Database deadlock detected. Please retry.'',
            ''retryable'', true
        );

    WHEN lock_not_available THEN
        RETURN jsonb_build_object(
            ''success'', false,
            ''error'', ''BOOKING_CONFLICT'',
            ''message'', ''Capacity rule is currently locked by another transaction. Please retry.'',
            ''retryable'', true
        );

    WHEN OTHERS THEN
        RAISE WARNING ''Unexpected error in create_booking_with_capacity_check: % %'', SQLERRM, SQLSTATE;
        RETURN jsonb_build_object(
            ''success'', false,
            ''error'', ''INTERNAL_ERROR'',
            ''message'', ''An unexpected error occurred while creating the booking'',
            ''retryable'', false,
            ''sqlstate'', SQLSTATE,
            ''sqlerrm'', SQLERRM,
            ''timezone'', v_timezone,
            ''original_timezone'', NULLIF(v_timezone_raw, '''')
        );
END;
$$","ALTER FUNCTION public.create_booking_with_capacity_check(
    uuid, uuid, date, time, time, integer, text, text, text, text, text, 
    text, boolean, text, text, uuid, text, jsonb, integer
) OWNER TO postgres","COMMENT ON FUNCTION public.create_booking_with_capacity_check(
    uuid, uuid, date, time, time, integer, text, text, text, text, text,
    text, boolean, text, text, uuid, text, jsonb, integer
) IS ''Race-safe booking creation enforcing capacity and operating hours. Returns JSON response with success/error detail. Fixed to use TEXT columns instead of non-existent enum types.''",COMMIT,"-- Notify PostgREST to reload schema
NOTIFY pgrst, ''reload schema''"}', 'fix_booking_rpc_day_of_week'),
	('20260208013100', '{"CREATE OR REPLACE FUNCTION public.acquire_soft_holds_atomic(
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
SET search_path TO ''public''
AS $$
DECLARE
  v_now timestamptz := timezone(''utc'', now());
  v_expires_at timestamptz;
  v_table_id uuid;
  v_sorted_table_ids uuid[];
  v_blocking RECORD;
  v_all_acquired boolean := true;
  v_acquired_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
    RAISE EXCEPTION ''acquire_soft_holds_atomic requires at least one table id''
      USING ERRCODE = ''23514'';
  END IF;

  IF p_window IS NULL THEN
    RAISE EXCEPTION ''acquire_soft_holds_atomic requires a valid window''
      USING ERRCODE = ''23514'';
  END IF;

  IF p_session_token IS NULL THEN
    RAISE EXCEPTION ''acquire_soft_holds_atomic requires a session token''
      USING ERRCODE = ''23514'';
  END IF;

  v_expires_at := v_now + (p_ttl_seconds || '' seconds'')::interval;

  -- Sort IDs so concurrent acquisitions always lock in the same order (deadlock avoidance).
  SELECT array_agg(DISTINCT t.id ORDER BY t.id)
  INTO v_sorted_table_ids
  FROM unnest(p_table_ids) AS t(id);

  -- Best-effort cleanup for these tables.
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
      -- If already held by this session, extend expiry; else insert.
      IF EXISTS (
        SELECT 1
        FROM public.table_soft_holds sh
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
            table_id,
            hold_window,
            session_token,
            restaurant_id,
            booking_id,
            expires_at
          ) VALUES (
            v_table_id,
            p_window,
            p_session_token,
            p_restaurant_id,
            p_booking_id,
            v_expires_at
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

  -- Roll back partial acquisitions.
  IF NOT v_all_acquired AND array_length(v_acquired_ids, 1) > 0 THEN
    DELETE FROM public.table_soft_holds
    WHERE table_id = ANY(v_acquired_ids)
      AND session_token = p_session_token;
  END IF;
END;
$$;"}', 'create_acquire_soft_holds_atomic'),
	('20260126125806', '{"-- Migration: add_email_delivery_log
-- Source: supabase_migrations.schema_migrations (version 20260126125806)

-- Email delivery tracking log
CREATE TABLE IF NOT EXISTS public.email_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  email_type text,
  template_type text,
  recipient_email text NOT NULL,
  message_id text NOT NULL,
  status text NOT NULL,
  provider text,
  provider_event_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  error text,
  metadata jsonb
)","ALTER TABLE public.email_delivery_log
  ADD CONSTRAINT email_delivery_log_status_check
  CHECK (status IN (
    ''sent'',
    ''delivered'',
    ''delivery_delayed'',
    ''bounced'',
    ''complained'',
    ''failed''
  ))","ALTER TABLE public.email_delivery_log
  ADD CONSTRAINT email_delivery_log_message_recipient_status_key
  UNIQUE (message_id, recipient_email, status)","CREATE INDEX IF NOT EXISTS email_delivery_log_message_id_idx
  ON public.email_delivery_log (message_id)","CREATE INDEX IF NOT EXISTS email_delivery_log_booking_id_idx
  ON public.email_delivery_log (booking_id)","CREATE INDEX IF NOT EXISTS email_delivery_log_restaurant_id_idx
  ON public.email_delivery_log (restaurant_id)","CREATE INDEX IF NOT EXISTS email_delivery_log_occurred_at_idx
  ON public.email_delivery_log (occurred_at DESC)","ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY","COMMENT ON TABLE public.email_delivery_log IS ''Tracks outbound email delivery events and webhook updates.''"}', 'add_email_delivery_log'),
	('20260203', '{"alter table public.restaurant_operating_hours
  add column if not exists reservation_interval_minutes integer,
  add column if not exists reservation_slot_times text[]","comment on column public.restaurant_operating_hours.reservation_interval_minutes is
  ''Optional per-day reservation interval override (minutes).''","comment on column public.restaurant_operating_hours.reservation_slot_times is
  ''Optional fixed reservation slot times (HH:MM) for the day; overrides interval when set.''","notify pgrst, ''reload schema''"}', 'add_operating_hours_reservation_slots'),
	('20260206213430', '{"-- Migration: ops_email_delivery_attempts_dashboard
-- Purpose: Attempt-level Ops Email Delivery feed + summary for deliverability dashboard.
--
-- Notes:
-- - Attempt identity: (message_id, lower(recipient_email)) scoped to restaurant_id.
-- - \"Current status\" = latest occurred_at (tie-break: id DESC).
-- - Functions are designed for service-role RPC use via the Next.js API route.

-- Feed access pattern index: scope by restaurant_id and time range, newest first.
CREATE INDEX IF NOT EXISTS email_delivery_log_restaurant_occurred_at_id_idx
  ON public.email_delivery_log (restaurant_id, occurred_at DESC, id DESC)","CREATE OR REPLACE FUNCTION public.ops_email_delivery_attempts_feed(
  p_restaurant_id uuid,
  p_range text,
  p_page integer,
  p_page_size integer,
  p_statuses text[] DEFAULT NULL,
  p_recipient_email text DEFAULT NULL,
  p_message_id text DEFAULT NULL,
  p_booking_ref text DEFAULT NULL,
  p_template_type text DEFAULT NULL,
  p_email_type text DEFAULT NULL
)
RETURNS TABLE (
  \"messageId\" text,
  \"recipientEmail\" text,
  \"bookingId\" uuid,
  \"emailType\" text,
  \"templateType\" text,
  \"provider\" text,
  \"currentStatus\" text,
  \"currentOccurredAt\" timestamptz,
  \"events\" jsonb,
  \"booking\" jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_since_ts timestamptz;
  v_page integer;
  v_page_size integer;
  v_offset integer;
  v_limit integer;
  v_recipient_email text;
  v_message_id text;
  v_booking_ref text;
  v_template_type text;
  v_email_type text;
  v_statuses text[];
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION ''p_restaurant_id is required'' USING ERRCODE = ''22004'';
  END IF;

  v_since_ts := CASE p_range
    WHEN ''24h'' THEN now() - interval ''24 hours''
    WHEN ''30d'' THEN now() - interval ''30 days''
    ELSE now() - interval ''7 days''
  END;

  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
  v_offset := (v_page - 1) * v_page_size;
  v_limit := v_page_size + 1;

  v_recipient_email := NULLIF(trim(p_recipient_email), '''');
  v_message_id := NULLIF(trim(p_message_id), '''');
  v_booking_ref := NULLIF(upper(trim(p_booking_ref)), '''');
  v_template_type := NULLIF(trim(p_template_type), '''');
  v_email_type := NULLIF(trim(p_email_type), '''');
  v_statuses := CASE
    WHEN p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR array_length(p_statuses, 1) = 0
      THEN NULL
    ELSE p_statuses
  END;

  RETURN QUERY
    WITH booking_filter AS (
      SELECT b.id
      FROM public.bookings b
      WHERE v_booking_ref IS NOT NULL
        AND b.restaurant_id = p_restaurant_id
        AND b.reference = v_booking_ref
    ),
    latest AS (
      SELECT DISTINCT ON (l.message_id, lower(l.recipient_email))
        l.message_id,
        l.recipient_email,
        l.booking_id,
        l.email_type,
        l.template_type,
        l.provider,
        l.status AS current_status,
        l.occurred_at AS current_occurred_at,
        l.id AS current_id
      FROM public.email_delivery_log l
      WHERE l.restaurant_id = p_restaurant_id
        AND l.occurred_at >= v_since_ts
        AND (v_message_id IS NULL OR l.message_id = v_message_id)
        AND (v_recipient_email IS NULL OR lower(l.recipient_email) = lower(v_recipient_email))
        AND (v_template_type IS NULL OR l.template_type = v_template_type)
        AND (v_email_type IS NULL OR l.email_type = v_email_type)
      ORDER BY l.message_id, lower(l.recipient_email), l.occurred_at DESC, l.id DESC
    ),
    filtered AS (
      SELECT l.*
      FROM latest l
      WHERE (v_statuses IS NULL OR l.current_status = ANY(v_statuses))
        AND (v_booking_ref IS NULL OR l.booking_id IN (SELECT id FROM booking_filter))
      ORDER BY l.current_occurred_at DESC, l.current_id DESC
      OFFSET v_offset
      LIMIT v_limit
    )
    SELECT
      f.message_id AS \"messageId\",
      f.recipient_email AS \"recipientEmail\",
      f.booking_id AS \"bookingId\",
      f.email_type AS \"emailType\",
      f.template_type AS \"templateType\",
      f.provider AS \"provider\",
      f.current_status AS \"currentStatus\",
      f.current_occurred_at AS \"currentOccurredAt\",
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              ''id'', e.id,
              ''bookingId'', e.booking_id,
              ''restaurantId'', e.restaurant_id,
              ''emailType'', e.email_type,
              ''templateType'', e.template_type,
              ''recipientEmail'', e.recipient_email,
              ''messageId'', e.message_id,
              ''status'', e.status,
              ''provider'', e.provider,
              ''occurredAt'', e.occurred_at,
              ''error'', e.error,
              ''metadata'', e.metadata
            )
            ORDER BY e.occurred_at ASC, e.id ASC
          ),
          ''[]''::jsonb
        )
        FROM public.email_delivery_log e
        WHERE e.restaurant_id = p_restaurant_id
          AND e.message_id = f.message_id
          AND lower(e.recipient_email) = lower(f.recipient_email)
      ) AS \"events\",
      (
        SELECT CASE
          WHEN f.booking_id IS NULL THEN NULL
          ELSE jsonb_build_object(
            ''id'', b.id,
            ''reference'', b.reference,
            ''bookingDate'', b.booking_date,
            ''startTime'', b.start_time,
            ''endTime'', b.end_time,
            ''customerName'', b.customer_name,
            ''partySize'', b.party_size
          )
        END
        FROM public.bookings b
        WHERE b.id = f.booking_id
        LIMIT 1
      ) AS \"booking\"
    FROM filtered f;
END;
$$","CREATE OR REPLACE FUNCTION public.ops_email_delivery_attempts_summary(
  p_restaurant_id uuid,
  p_range text,
  p_statuses text[] DEFAULT NULL,
  p_recipient_email text DEFAULT NULL,
  p_message_id text DEFAULT NULL,
  p_booking_ref text DEFAULT NULL,
  p_template_type text DEFAULT NULL,
  p_email_type text DEFAULT NULL
)
RETURNS TABLE (
  total integer,
  sent integer,
  delivered integer,
  \"deliveryDelayed\" integer,
  bounced integer,
  complained integer,
  failed integer,
  \"deliveredRate\" double precision,
  \"failureRate\" double precision,
  \"uniqueRecipients\" integer,
  \"uniqueBookings\" integer,
  \"p50DeliverySeconds\" double precision,
  \"p95DeliverySeconds\" double precision,
  \"topFailedTemplates\" jsonb,
  \"topFailedEmailTypes\" jsonb
)
LANGUAGE sql
STABLE
AS $$
  WITH normalized AS (
    SELECT
      p_restaurant_id AS restaurant_id,
      CASE p_range
        WHEN ''24h'' THEN now() - interval ''24 hours''
        WHEN ''30d'' THEN now() - interval ''30 days''
        ELSE now() - interval ''7 days''
      END AS since_ts,
      NULLIF(trim(p_recipient_email), '''') AS recipient_email,
      NULLIF(trim(p_message_id), '''') AS message_id,
      NULLIF(upper(trim(p_booking_ref)), '''') AS booking_ref,
      NULLIF(trim(p_template_type), '''') AS template_type,
      NULLIF(trim(p_email_type), '''') AS email_type,
      CASE
        WHEN p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR array_length(p_statuses, 1) = 0
          THEN NULL
        ELSE p_statuses
      END AS statuses
  ),
  booking_filter AS (
    SELECT b.id
    FROM public.bookings b
    JOIN normalized n ON true
    WHERE n.booking_ref IS NOT NULL
      AND b.restaurant_id = n.restaurant_id
      AND b.reference = n.booking_ref
  ),
  latest AS (
    SELECT DISTINCT ON (l.message_id, lower(l.recipient_email))
      l.message_id,
      l.recipient_email,
      l.booking_id,
      l.email_type,
      l.template_type,
      l.status AS current_status,
      l.occurred_at AS current_occurred_at,
      l.id AS current_id
    FROM public.email_delivery_log l
    JOIN normalized n ON true
    WHERE l.restaurant_id = n.restaurant_id
      AND l.occurred_at >= n.since_ts
      AND (n.message_id IS NULL OR l.message_id = n.message_id)
      AND (n.recipient_email IS NULL OR lower(l.recipient_email) = lower(n.recipient_email))
      AND (n.template_type IS NULL OR l.template_type = n.template_type)
      AND (n.email_type IS NULL OR l.email_type = n.email_type)
    ORDER BY l.message_id, lower(l.recipient_email), l.occurred_at DESC, l.id DESC
  ),
  filtered AS (
    SELECT l.*
    FROM latest l
    JOIN normalized n ON true
    WHERE (n.statuses IS NULL OR l.current_status = ANY(n.statuses))
      AND (n.booking_ref IS NULL OR l.booking_id IN (SELECT id FROM booking_filter))
  ),
  duration_pairs AS (
    SELECT
      f.message_id,
      lower(f.recipient_email) AS recipient_key,
      min(e.occurred_at) FILTER (WHERE e.status = ''sent'') AS sent_at,
      min(e.occurred_at) FILTER (WHERE e.status = ''delivered'') AS delivered_at
    FROM filtered f
    JOIN public.email_delivery_log e
      ON e.restaurant_id = p_restaurant_id
      AND e.message_id = f.message_id
      AND lower(e.recipient_email) = lower(f.recipient_email)
    GROUP BY f.message_id, lower(f.recipient_email)
  ),
  delivered_durations AS (
    SELECT extract(epoch from (delivered_at - sent_at)) AS delivery_seconds
    FROM duration_pairs
    WHERE delivered_at IS NOT NULL
      AND sent_at IS NOT NULL
      AND delivered_at >= sent_at
  ),
  failed_templates AS (
    SELECT
      coalesce(f.template_type, ''unknown'') AS template_type,
      count(*)::int AS cnt
    FROM filtered f
    WHERE f.current_status IN (''bounced'', ''complained'', ''failed'')
    GROUP BY coalesce(f.template_type, ''unknown'')
    ORDER BY cnt DESC, template_type ASC
    LIMIT 5
  ),
  failed_email_types AS (
    SELECT
      coalesce(f.email_type, ''unknown'') AS email_type,
      count(*)::int AS cnt
    FROM filtered f
    WHERE f.current_status IN (''bounced'', ''complained'', ''failed'')
    GROUP BY coalesce(f.email_type, ''unknown'')
    ORDER BY cnt DESC, email_type ASC
    LIMIT 5
  ),
  counts AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE current_status = ''sent'')::int AS sent,
      count(*) FILTER (WHERE current_status = ''delivered'')::int AS delivered,
      count(*) FILTER (WHERE current_status = ''delivery_delayed'')::int AS delivery_delayed,
      count(*) FILTER (WHERE current_status = ''bounced'')::int AS bounced,
      count(*) FILTER (WHERE current_status = ''complained'')::int AS complained,
      count(*) FILTER (WHERE current_status = ''failed'')::int AS failed,
      count(distinct lower(recipient_email))::int AS unique_recipients,
      count(distinct booking_id) FILTER (WHERE booking_id IS NOT NULL)::int AS unique_bookings
    FROM filtered
  )
  SELECT
    c.total,
    c.sent,
    c.delivered,
    c.delivery_delayed AS \"deliveryDelayed\",
    c.bounced,
    c.complained,
    c.failed,
    CASE WHEN c.total = 0 THEN 0 ELSE c.delivered::double precision / c.total END AS \"deliveredRate\",
    CASE WHEN c.total = 0 THEN 0 ELSE (c.bounced + c.complained + c.failed)::double precision / c.total END AS \"failureRate\",
    c.unique_recipients AS \"uniqueRecipients\",
    c.unique_bookings AS \"uniqueBookings\",
    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY delivery_seconds) FROM delivered_durations) AS \"p50DeliverySeconds\",
    (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY delivery_seconds) FROM delivered_durations) AS \"p95DeliverySeconds\",
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(''templateType'', template_type, ''count'', cnt)
          ORDER BY cnt DESC, template_type ASC
        ),
        ''[]''::jsonb
      )
      FROM failed_templates
    ) AS \"topFailedTemplates\",
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(''emailType'', email_type, ''count'', cnt)
          ORDER BY cnt DESC, email_type ASC
        ),
        ''[]''::jsonb
      )
      FROM failed_email_types
    ) AS \"topFailedEmailTypes\"
  FROM counts c;
$$","REVOKE ALL ON FUNCTION public.ops_email_delivery_attempts_feed(
  uuid, text, integer, integer, text[], text, text, text, text, text
) FROM PUBLIC","GRANT EXECUTE ON FUNCTION public.ops_email_delivery_attempts_feed(
  uuid, text, integer, integer, text[], text, text, text, text, text
) TO service_role","REVOKE ALL ON FUNCTION public.ops_email_delivery_attempts_summary(
  uuid, text, text[], text, text, text, text, text
) FROM PUBLIC","GRANT EXECUTE ON FUNCTION public.ops_email_delivery_attempts_summary(
  uuid, text, text[], text, text, text, text, text
) TO service_role"}', 'ops_email_delivery_attempts_dashboard'),
	('20260207144113', '{"-- Index hygiene: add missing FK indexes and remove redundant / duplicate indexes.
-- Staging-first. For production rollout, schedule in a change window.

SET statement_timeout = ''120s''","SET lock_timeout = ''5s''","-- ---------------------------------------------------------------------------
-- 1) Add missing FK indexes (btree)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_allocations_created_by
  ON public.allocations (created_by)","CREATE INDEX IF NOT EXISTS idx_booking_assignment_idempotency_merge_group_allocation_id
  ON public.booking_assignment_idempotency (merge_group_allocation_id)","CREATE INDEX IF NOT EXISTS idx_booking_confirmation_results_restaurant_id
  ON public.booking_confirmation_results (restaurant_id)","CREATE INDEX IF NOT EXISTS idx_booking_state_history_changed_by
  ON public.booking_state_history (changed_by)","CREATE INDEX IF NOT EXISTS idx_booking_table_assignments_allocation_id
  ON public.booking_table_assignments (allocation_id)","CREATE INDEX IF NOT EXISTS idx_booking_table_assignments_assigned_by
  ON public.booking_table_assignments (assigned_by)","CREATE INDEX IF NOT EXISTS idx_bookings_assigned_zone_id
  ON public.bookings (assigned_zone_id)","CREATE INDEX IF NOT EXISTS idx_bookings_booking_type
  ON public.bookings (booking_type)","CREATE INDEX IF NOT EXISTS idx_manual_assignment_sessions_created_by
  ON public.manual_assignment_sessions (created_by)","CREATE INDEX IF NOT EXISTS idx_manual_assignment_sessions_hold_id
  ON public.manual_assignment_sessions (hold_id)","CREATE INDEX IF NOT EXISTS idx_restaurant_capacity_rules_service_period_id
  ON public.restaurant_capacity_rules (service_period_id)","CREATE INDEX IF NOT EXISTS idx_restaurant_invites_invited_by
  ON public.restaurant_invites (invited_by)","CREATE INDEX IF NOT EXISTS idx_restaurant_service_periods_booking_option
  ON public.restaurant_service_periods (booking_option)","CREATE INDEX IF NOT EXISTS idx_restaurant_turn_bands_booking_option
  ON public.restaurant_turn_bands (booking_option)","CREATE INDEX IF NOT EXISTS idx_strategic_configs_updated_by
  ON public.strategic_configs (updated_by)","CREATE INDEX IF NOT EXISTS idx_table_holds_created_by
  ON public.table_holds (created_by)","CREATE INDEX IF NOT EXISTS idx_table_inventory_allowed_capacity
  ON public.table_inventory (restaurant_id, capacity)","-- ---------------------------------------------------------------------------
-- 2) Drop duplicate / redundant indexes
-- ---------------------------------------------------------------------------

-- allowed_capacities: redundant with PK (unique index)
DROP INDEX IF EXISTS public.allowed_capacities_restaurant_idx","-- audit_logs: exact duplicate definitions
DROP INDEX IF EXISTS public.idx_audit_logs_entity_id","-- booking_assignment_idempotency: duplicates covered by PK + redundant directional/covering indexes
DROP INDEX IF EXISTS public.bai_rest_bk_idx","DROP INDEX IF EXISTS public.booking_assignment_idempo_bkid_key_idx","DROP INDEX IF EXISTS public.idx_booking_assignment_idempotency_booking","-- PK prefix covers booking_id
DROP INDEX IF EXISTS public.idx_booking_assignment_idempotency_created","-- keep DESC index

-- booking_confirmation_results: redundant with unique index
DROP INDEX IF EXISTS public.booking_confirmation_results_hold_idx","-- booking_slots: redundant with unique index on same columns
DROP INDEX IF EXISTS public.idx_booking_slots_lookup","-- booking_table_assignments: redundant indexes on booking_id (unique (booking_id, table_id) covers)
DROP INDEX IF EXISTS public.bta_booking_id_idx","DROP INDEX IF EXISTS public.idx_booking_table_assignments_booking","DROP INDEX IF EXISTS public.idx_booking_table_assignments_booking_id","-- bookings: redundant with unique index, and duplicate date-start index
DROP INDEX IF EXISTS public.idx_bookings_reference","DROP INDEX IF EXISTS public.bookings_restaurant_date_idx","-- keep idx_bookings_restaurant_date_start

-- customers: redundant with unique constraints
DROP INDEX IF EXISTS public.idx_customers_email_normalized","DROP INDEX IF EXISTS public.idx_customers_phone_normalized","-- restaurant_turn_bands: redundant with unique index
DROP INDEX IF EXISTS public.restaurant_turn_bands_lookup_idx","-- restaurants: redundant with unique constraint
DROP INDEX IF EXISTS public.idx_restaurants_slug","-- strategic_configs: redundant with unique constraint
DROP INDEX IF EXISTS public.idx_strategic_configs_restaurant","-- table_hold_members: redundant duplicate unique and duplicate table_id indexes
DROP INDEX IF EXISTS public.thm_unique","DROP INDEX IF EXISTS public.idx_table_hold_members_hold","-- unique (hold_id, table_id) covers hold_id
DROP INDEX IF EXISTS public.table_hold_members_table_active_idx","DROP INDEX IF EXISTS public.table_hold_members_table_idx","-- table_scarcity_metrics: redundant with unique index
DROP INDEX IF EXISTS public.idx_table_scarcity_metrics_restaurant_type"}', 'index_hygiene_fk_and_dedupe'),
	('20260207170000', '{"-- Staging-first: add remaining FK-supporting indexes that were still missing after
-- the 20260207144113 hardening migration.
--
-- Why:
-- - FK checks without supporting indexes can force sequential scans, increasing
--   lock time and latency during deletes/updates and joins.
-- - These are additive changes (low risk), but use CONCURRENTLY to avoid blocking.
--
-- Production rollout:
-- - Safe to apply during business hours due to CONCURRENTLY, but expect longer
--   runtime on large datasets.
-- - Ensure this migration is not wrapped in a transaction.

SET statement_timeout = ''15min''","SET lock_timeout = ''5s''","CREATE INDEX IF NOT EXISTS idx_analytics_events_customer_id
  ON public.analytics_events (customer_id)","CREATE INDEX IF NOT EXISTS idx_restaurant_capacity_rules_restaurant_id
  ON public.restaurant_capacity_rules (restaurant_id)","CREATE INDEX IF NOT EXISTS idx_restaurant_operating_hours_restaurant_id
  ON public.restaurant_operating_hours (restaurant_id)","CREATE INDEX IF NOT EXISTS idx_restaurant_service_periods_restaurant_id
  ON public.restaurant_service_periods (restaurant_id)","CREATE INDEX IF NOT EXISTS idx_zones_restaurant_id
  ON public.zones (restaurant_id)"}', 'add_remaining_fk_indexes'),
	('20260208013000', '{"-- Migration: Ensure soft-hold primitives exist (baseline-safe)
-- Description:
--   Some environments may have had migration history \"repaired\"/baselined without
--   executing older migrations. This migration re-asserts the soft-hold table,
--   RPCs, grants, and RLS policies in an idempotent way so application code and
--   generated Supabase types remain consistent.
--
-- Safety:
--   - Uses CREATE IF NOT EXISTS / CREATE OR REPLACE where possible.
--   - Wraps CREATE POLICY / ADD CONSTRAINT in DO blocks to avoid duplicate errors.

CREATE EXTENSION IF NOT EXISTS pgcrypto","CREATE EXTENSION IF NOT EXISTS btree_gist","-- =============================================================================
-- TABLE: table_soft_holds
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.table_soft_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.table_inventory(id) ON DELETE CASCADE,
  hold_window tstzrange NOT NULL,
  session_token uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())
)","-- Ensure the exclusion constraint exists (no overlapping windows per table).
-- Note: this cannot be partial on \"expires_at > now()\" because predicates must be IMMUTABLE.
ALTER TABLE public.table_soft_holds
  DROP CONSTRAINT IF EXISTS table_soft_holds_no_overlap","ALTER TABLE public.table_soft_holds
  ADD CONSTRAINT table_soft_holds_no_overlap
    EXCLUDE USING gist (table_id WITH =, hold_window WITH &&)","CREATE INDEX IF NOT EXISTS table_soft_holds_expires_idx
  ON public.table_soft_holds (expires_at)","CREATE INDEX IF NOT EXISTS table_soft_holds_session_idx
  ON public.table_soft_holds (session_token)","CREATE INDEX IF NOT EXISTS table_soft_holds_restaurant_idx
  ON public.table_soft_holds (restaurant_id, expires_at)","CREATE INDEX IF NOT EXISTS table_soft_holds_booking_idx
  ON public.table_soft_holds (booking_id)
  WHERE booking_id IS NOT NULL","-- =============================================================================
-- FUNCTIONS
-- =============================================================================
-- Functions and grants are applied in follow-up migrations to keep each file
-- free of multi-statement parsing edge-cases in remote migration execution.

-- =============================================================================
-- GRANTS + RLS
-- =============================================================================

-- Lock down direct table access; RPCs remain SECURITY DEFINER.
REVOKE ALL ON TABLE public.table_soft_holds FROM authenticated","REVOKE ALL ON TABLE public.table_soft_holds FROM anon","GRANT ALL ON TABLE public.table_soft_holds TO service_role","ALTER TABLE public.table_soft_holds ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Service role has full access to soft_holds\" ON public.table_soft_holds","CREATE POLICY \"Service role has full access to soft_holds\"
  ON public.table_soft_holds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true)","DROP POLICY IF EXISTS \"Users can delete their own soft holds\" ON public.table_soft_holds","DROP POLICY IF EXISTS \"Users can view soft holds\" ON public.table_soft_holds","DROP POLICY IF EXISTS \"Users can insert soft holds\" ON public.table_soft_holds"}', 'ensure_soft_holds_primitives'),
	('20260208013110', '{"CREATE OR REPLACE FUNCTION public.release_soft_holds(
  p_session_token uuid,
  p_table_ids uuid[] DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''public''
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
$$"}', 'create_release_soft_holds'),
	('20260208013120', '{"CREATE OR REPLACE FUNCTION public.cleanup_expired_soft_holds(
  p_batch_size integer DEFAULT 1000
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''public''
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.table_soft_holds
  WHERE id IN (
    SELECT id
    FROM public.table_soft_holds
    WHERE expires_at <= timezone(''utc'', now())
    LIMIT p_batch_size
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$"}', 'create_cleanup_expired_soft_holds'),
	('20260208013130', '{"CREATE OR REPLACE FUNCTION public.check_soft_hold_ownership(
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
SET search_path TO ''public''
AS $$
DECLARE
  v_now timestamptz := timezone(''utc'', now());
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
$$"}', 'create_check_soft_hold_ownership'),
	('20260208013140', '{"GRANT EXECUTE ON FUNCTION public.acquire_soft_holds_atomic(uuid[], tstzrange, uuid, uuid, uuid, integer) TO authenticated, service_role;"}', 'grant_acquire_soft_holds_atomic'),
	('20260208013150', '{"GRANT EXECUTE ON FUNCTION public.release_soft_holds(uuid, uuid[]) TO authenticated, service_role"}', 'grant_release_soft_holds'),
	('20260208013160', '{"GRANT EXECUTE ON FUNCTION public.cleanup_expired_soft_holds(integer) TO service_role"}', 'grant_cleanup_expired_soft_holds'),
	('20260208013170', '{"GRANT EXECUTE ON FUNCTION public.check_soft_hold_ownership(uuid, uuid[], tstzrange) TO authenticated, service_role"}', 'grant_check_soft_hold_ownership');


--
-- PostgreSQL database dump complete
--

-- \unrestrict G0mXHOKzDnLKBNMpDFLWNyZL3fruTJO830Sdc3B8D3575u2n512R3VVRFrHTKZi

RESET ALL;
