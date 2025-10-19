

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."analytics_event_type" AS ENUM (
    'booking.created',
    'booking.cancelled',
    'booking.allocated',
    'booking.waitlisted'
);


ALTER TYPE "public"."analytics_event_type" OWNER TO "postgres";


CREATE TYPE "public"."booking_change_type" AS ENUM (
    'created',
    'updated',
    'cancelled',
    'deleted'
);


ALTER TYPE "public"."booking_change_type" OWNER TO "postgres";


CREATE TYPE "public"."booking_status" AS ENUM (
    'confirmed',
    'pending',
    'cancelled',
    'completed',
    'no_show',
    'pending_allocation',
    'checked_in'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."booking_status" IS 'Lifecycle status of a booking (pending, confirmed, checked_in, completed, cancelled, no_show, etc).';



CREATE TYPE "public"."booking_type" AS ENUM (
    'breakfast',
    'lunch',
    'dinner',
    'drinks'
);


ALTER TYPE "public"."booking_type" OWNER TO "postgres";


CREATE TYPE "public"."capacity_override_type" AS ENUM (
    'holiday',
    'event',
    'manual',
    'emergency'
);


ALTER TYPE "public"."capacity_override_type" OWNER TO "postgres";


CREATE TYPE "public"."loyalty_tier" AS ENUM (
    'bronze',
    'silver',
    'gold',
    'platinum'
);


ALTER TYPE "public"."loyalty_tier" OWNER TO "postgres";


CREATE TYPE "public"."seating_preference_type" AS ENUM (
    'any',
    'indoor',
    'outdoor',
    'bar',
    'window',
    'quiet',
    'booth'
);


ALTER TYPE "public"."seating_preference_type" OWNER TO "postgres";


CREATE TYPE "public"."table_category" AS ENUM (
    'bar',
    'dining',
    'lounge',
    'patio',
    'private'
);


ALTER TYPE "public"."table_category" OWNER TO "postgres";


CREATE TYPE "public"."table_mobility" AS ENUM (
    'movable',
    'fixed'
);


ALTER TYPE "public"."table_mobility" OWNER TO "postgres";


CREATE TYPE "public"."table_seating_type" AS ENUM (
    'standard',
    'sofa',
    'booth',
    'high_top'
);


ALTER TYPE "public"."table_seating_type" OWNER TO "postgres";


CREATE TYPE "public"."table_status" AS ENUM (
    'available',
    'reserved',
    'occupied',
    'out_of_service'
);


ALTER TYPE "public"."table_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."table_status" IS 'Status of a restaurant table: available, reserved (booked), occupied (guests seated), out_of_service (maintenance)';



CREATE OR REPLACE FUNCTION "public"."allocations_overlap"("a" "tstzrange", "b" "tstzrange") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT COALESCE(a && b, false);
$$;


ALTER FUNCTION "public"."allocations_overlap"("a" "tstzrange", "b" "tstzrange") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."allocations_overlap"("a" "tstzrange", "b" "tstzrange") IS 'Returns true when two timestamptz ranges overlap (half-open [start,end) semantics).';



CREATE OR REPLACE FUNCTION "public"."allowed_capacities_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."allowed_capacities_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_booking_state_transition"("p_booking_id" "uuid", "p_status" "public"."booking_status", "p_checked_in_at" timestamp with time zone, "p_checked_out_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_history_from" "public"."booking_status", "p_history_to" "public"."booking_status", "p_history_changed_by" "uuid", "p_history_changed_at" timestamp with time zone, "p_history_reason" "text", "p_history_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("status" "public"."booking_status", "checked_in_at" timestamp with time zone, "checked_out_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_updated public.bookings%ROWTYPE;
BEGIN
    UPDATE public.bookings
    SET
        status = p_status,
        checked_in_at = p_checked_in_at,
        checked_out_at = p_checked_out_at,
        updated_at = p_updated_at
    WHERE id = p_booking_id
    RETURNING * INTO v_updated;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id;
    END IF;

    INSERT INTO public.booking_state_history (
        booking_id,
        from_status,
        to_status,
        changed_by,
        changed_at,
        reason,
        metadata
    )
    VALUES (
        p_booking_id,
        p_history_from,
        p_history_to,
        p_history_changed_by,
        p_history_changed_at,
        p_history_reason,
        COALESCE(p_history_metadata, '{}'::jsonb)
    );

    RETURN QUERY
    SELECT
        v_updated.status,
        v_updated.checked_in_at,
        v_updated.checked_out_at,
        v_updated.updated_at;
END;
$$;


ALTER FUNCTION "public"."apply_booking_state_transition"("p_booking_id" "uuid", "p_status" "public"."booking_status", "p_checked_in_at" timestamp with time zone, "p_checked_out_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_history_from" "public"."booking_status", "p_history_to" "public"."booking_status", "p_history_changed_by" "uuid", "p_history_changed_at" timestamp with time zone, "p_history_reason" "text", "p_history_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."are_tables_connected"("table_ids" "uuid"[]) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  unique_tables uuid[];
  start_table uuid;
  total_count integer;
  connected_count integer;
BEGIN
  SELECT array_agg(DISTINCT id)
  INTO unique_tables
  FROM unnest(table_ids) AS id
  WHERE id IS NOT NULL;

  total_count := array_length(unique_tables, 1);

  IF total_count IS NULL OR total_count = 0 THEN
    RETURN false;
  END IF;

  IF total_count = 1 THEN
    RETURN true;
  END IF;

  start_table := unique_tables[1];

  WITH RECURSIVE connected AS (
    SELECT start_table AS table_id
    UNION
    SELECT adj.table_b
    FROM connected
    JOIN public.table_adjacencies adj
      ON adj.table_a = connected.table_id
    WHERE adj.table_b = ANY(unique_tables)
  )
  SELECT COUNT(DISTINCT table_id)
  INTO connected_count
  FROM connected;

  RETURN connected_count = total_count;
END;
$$;


ALTER FUNCTION "public"."are_tables_connected"("table_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_table_to_booking"("p_booking_id" "uuid", "p_table_id" "uuid", "p_assigned_by" "uuid" DEFAULT NULL::"uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_assignment_id uuid;
    v_restaurant_id uuid;
    v_booking_date date;
    v_start_time time;
    v_slot_id uuid;
BEGIN
    -- Verify booking exists and get details
    SELECT restaurant_id, booking_date, start_time 
    INTO v_restaurant_id, v_booking_date, v_start_time
    FROM bookings
    WHERE id = p_booking_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found: %', p_booking_id;
    END IF;
    
    -- Verify table exists and belongs to same restaurant
    IF NOT EXISTS (
        SELECT 1 FROM table_inventory
        WHERE id = p_table_id AND restaurant_id = v_restaurant_id
    ) THEN
        RAISE EXCEPTION 'Table not found or belongs to different restaurant: %', p_table_id;
    END IF;
    
    -- Get or create booking slot
    SELECT id INTO v_slot_id
    FROM booking_slots
    WHERE restaurant_id = v_restaurant_id
        AND slot_date = v_booking_date
        AND slot_time = v_start_time;
    
    -- Create assignment
    INSERT INTO booking_table_assignments (
        booking_id,
        table_id,
        slot_id,
        assigned_by,
        notes
    ) VALUES (
        p_booking_id,
        p_table_id,
        v_slot_id,
        p_assigned_by,
        p_notes
    )
    ON CONFLICT (booking_id, table_id) DO UPDATE
    SET assigned_by = EXCLUDED.assigned_by,
        notes = EXCLUDED.notes,
        assigned_at = now()
    RETURNING id INTO v_assignment_id;
    
    -- Update table status to reserved
    UPDATE table_inventory
    SET status = 'reserved'::table_status
    WHERE id = p_table_id;
    
    RETURN v_assignment_id;
END;
$$;


ALTER FUNCTION "public"."assign_table_to_booking"("p_booking_id" "uuid", "p_table_id" "uuid", "p_assigned_by" "uuid", "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_table_to_booking"("p_booking_id" "uuid", "p_table_id" "uuid", "p_assigned_by" "uuid", "p_notes" "text") IS 'Assign a table to a booking. Updates table status to reserved. Returns assignment ID.';



CREATE OR REPLACE FUNCTION "public"."assign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange", "p_assigned_by" "uuid" DEFAULT NULL::"uuid", "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS TABLE("table_id" "uuid", "assignment_id" "uuid", "merge_group_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
      v_booking RECORD;
      v_restaurant_id uuid;
      v_target_tables uuid[];
      v_requested_tables uuid[];
      v_existing_tables uuid[];
      v_table RECORD;
      v_total_capacity integer := 0;
      v_first_zone uuid := NULL;
      v_merge_group_id uuid := NULL;
      v_slot_id uuid := NULL;
      v_now timestamptz := now();
      v_window tstzrange := p_window;
      v_assignment_id uuid;
      v_loaded_count integer := 0;
      v_table_id uuid;
      v_lock_restaurant int4;
      v_lock_date int4;
    BEGIN
      IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
        RAISE EXCEPTION 'assign_tables_atomic requires at least one table id'
          USING ERRCODE = '23514';
      END IF;

      SELECT array_agg(DISTINCT table_id)
      INTO v_target_tables
      FROM unnest(p_table_ids) AS t(table_id);

      IF v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0 THEN
        RAISE EXCEPTION 'assign_tables_atomic requires at least one valid table id'
          USING ERRCODE = '23514';
      END IF;

      SELECT *
      INTO v_booking
      FROM public.bookings
      WHERE id = p_booking_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id
          USING ERRCODE = 'P0002';
      END IF;

      v_restaurant_id := v_booking.restaurant_id;

      v_lock_restaurant := hashtext(v_restaurant_id::text);
      v_lock_date := COALESCE((v_booking.booking_date - DATE '2000-01-01')::int, 0);
      PERFORM pg_advisory_xact_lock(v_lock_restaurant, v_lock_date);

      IF v_window IS NULL THEN
        v_window := tstzrange(v_booking.start_at, v_booking.end_at, '[)');
      END IF;

      IF v_window IS NULL OR lower(v_window) IS NULL OR upper(v_window) IS NULL OR lower(v_window) >= upper(v_window) THEN
        RAISE EXCEPTION 'Invalid assignment window for booking %', p_booking_id
          USING ERRCODE = '22000';
      END IF;

      IF p_idempotency_key IS NOT NULL THEN
        SELECT array_agg(bta.table_id ORDER BY bta.table_id)
        INTO v_existing_tables
        FROM public.booking_table_assignments bta
        WHERE bta.booking_id = p_booking_id
          AND bta.idempotency_key = p_idempotency_key;

        IF v_existing_tables IS NOT NULL THEN
          SELECT array_agg(table_id ORDER BY table_id)
          INTO v_requested_tables
          FROM unnest(v_target_tables) AS t(table_id);

          IF v_requested_tables IS NULL OR v_requested_tables <> v_existing_tables THEN
            RAISE EXCEPTION 'assign_tables_atomic idempotency key mismatch'
              USING ERRCODE = 'P0003',
                    DETAIL = 'Idempotency key reuse detected with a different table set';
          END IF;

          RETURN QUERY
            SELECT
              bta.table_id,
              bta.id AS assignment_id,
              bta.merge_group_id
            FROM public.booking_table_assignments bta
            WHERE bta.booking_id = p_booking_id
              AND bta.idempotency_key = p_idempotency_key;

          RETURN;
        END IF;
      END IF;

      FOR v_table IN
        SELECT id, restaurant_id, zone_id, capacity
        FROM public.table_inventory
        WHERE id = ANY (v_target_tables)
        ORDER BY id
        FOR UPDATE
      LOOP
        IF v_table.restaurant_id <> v_restaurant_id THEN
          RAISE EXCEPTION 'Table % belongs to a different restaurant', v_table.id;
        END IF;

        IF v_table.zone_id IS NULL THEN
          RAISE EXCEPTION 'Table % is not assigned to a zone', v_table.id;
        END IF;

        IF v_first_zone IS NULL THEN
          v_first_zone := v_table.zone_id;
        ELSIF v_first_zone <> v_table.zone_id THEN
          RAISE EXCEPTION 'All tables must belong to the same zone';
        END IF;

        v_total_capacity := v_total_capacity + COALESCE(v_table.capacity, 0);
        v_loaded_count := v_loaded_count + 1;
      END LOOP;

      IF v_loaded_count <> array_length(v_target_tables, 1) THEN
        RAISE EXCEPTION 'Unable to load all requested tables';
      END IF;

      IF array_length(v_target_tables, 1) > 1 THEN
        INSERT INTO public.merge_groups (capacity, created_at)
        VALUES (NULLIF(v_total_capacity, 0), v_now)
        RETURNING id INTO v_merge_group_id;

        INSERT INTO public.merge_group_members (merge_group_id, table_id)
        SELECT v_merge_group_id, unnest(v_target_tables)
        ON CONFLICT DO NOTHING;
      END IF;

      IF v_booking.booking_date IS NOT NULL AND v_booking.start_time IS NOT NULL THEN
        SELECT id
        INTO v_slot_id
        FROM public.booking_slots
        WHERE restaurant_id = v_restaurant_id
          AND slot_date = v_booking.booking_date
          AND slot_time = v_booking.start_time
        LIMIT 1;

        IF v_slot_id IS NULL THEN
          SELECT public.get_or_create_booking_slot(v_restaurant_id, v_booking.booking_date, v_booking.start_time, 999)
          INTO v_slot_id;
        END IF;
      END IF;

      FOREACH v_table_id IN ARRAY v_target_tables LOOP
        INSERT INTO public.booking_table_assignments (
          booking_id,
          table_id,
          slot_id,
          assigned_by,
          idempotency_key,
          merge_group_id
        ) VALUES (
          p_booking_id,
          v_table_id,
          v_slot_id,
          p_assigned_by,
          p_idempotency_key,
          v_merge_group_id
        )
        ON CONFLICT (booking_id, table_id) DO UPDATE
        SET assigned_by = EXCLUDED.assigned_by,
            assigned_at = v_now,
            idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key),
            merge_group_id = COALESCE(EXCLUDED.merge_group_id, public.booking_table_assignments.merge_group_id)
        RETURNING id INTO v_assignment_id;

        BEGIN
          INSERT INTO public.allocations (
            booking_id,
            restaurant_id,
            resource_type,
            resource_id,
            "window",
            created_by,
            shadow,
            created_at,
            updated_at
          ) VALUES (
            p_booking_id,
            v_restaurant_id,
            'table',
            v_table_id,
            v_window,
            p_assigned_by,
            false,
            v_now,
            v_now
          )
          ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
          SET "window" = EXCLUDED."window",
              created_by = EXCLUDED.created_by,
              updated_at = v_now;
        EXCEPTION
          WHEN unique_violation OR exclusion_violation THEN
            RAISE EXCEPTION 'allocations_no_overlap'
              USING ERRCODE = 'P0001',
                    DETAIL = format('Resource %s overlaps requested window for booking %s', v_table_id, p_booking_id);
        END;

        UPDATE public.table_inventory
        SET status = 'reserved'::public.table_status
        WHERE id = v_table_id;

        table_id := v_table_id;
        assignment_id := v_assignment_id;
        merge_group_id := v_merge_group_id;
        RETURN NEXT;
      END LOOP;

      IF v_merge_group_id IS NOT NULL THEN
        BEGIN
          INSERT INTO public.allocations (
            booking_id,
            restaurant_id,
            resource_type,
            resource_id,
            "window",
            created_by,
            shadow,
            created_at,
            updated_at
          ) VALUES (
            p_booking_id,
            v_restaurant_id,
            'merge_group',
            v_merge_group_id,
            v_window,
            p_assigned_by,
            false,
            v_now,
            v_now
          )
          ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
          SET "window" = EXCLUDED."window",
              created_by = EXCLUDED.created_by,
              updated_at = v_now;
        EXCEPTION
          WHEN unique_violation OR exclusion_violation THEN
            RAISE EXCEPTION 'allocations_no_overlap'
              USING ERRCODE = 'P0001',
                    DETAIL = format('Merge group %s overlaps requested window for booking %s', v_merge_group_id, p_booking_id);
        END;
      END IF;

      RETURN;
    END;
    $$;


ALTER FUNCTION "public"."assign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange", "p_assigned_by" "uuid", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."booking_status_summary"("p_restaurant_id" "uuid", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_status_filter" "public"."booking_status"[] DEFAULT NULL::"public"."booking_status"[]) RETURNS TABLE("status" "public"."booking_status", "total" bigint)
    LANGUAGE "sql"
    AS $$
    SELECT
        b.status,
        COUNT(*)::bigint AS total
    FROM public.bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND (p_start_date IS NULL OR b.booking_date >= p_start_date)
      AND (p_end_date IS NULL OR b.booking_date <= p_end_date)
      AND (p_status_filter IS NULL OR b.status = ANY(p_status_filter))
    GROUP BY b.status
    ORDER BY b.status;
$$;


ALTER FUNCTION "public"."booking_status_summary"("p_restaurant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_status_filter" "public"."booking_status"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."booking_status_summary"("p_restaurant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_status_filter" "public"."booking_status"[]) IS 'Returns aggregated booking counts by status for a restaurant across an optional date range and status filter.';



CREATE OR REPLACE FUNCTION "public"."capacity_metrics_hourly_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."capacity_metrics_hourly_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_with_capacity_check"("p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text" DEFAULT NULL::"text", "p_marketing_opt_in" boolean DEFAULT false, "p_idempotency_key" "text" DEFAULT NULL::"text", "p_source" "text" DEFAULT 'api'::"text", "p_auth_user_id" "uuid" DEFAULT NULL::"uuid", "p_client_request_id" "text" DEFAULT NULL::"text", "p_details" "jsonb" DEFAULT '{}'::"jsonb", "p_loyalty_points_awarded" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
        -- STEP 3: Get Capacity Rules with Row-Level Lock
        -- =====================================================
        SELECT 
            COALESCE(cr.max_covers, 999999) as max_covers,
            COALESCE(cr.max_parties, 999999) as max_parties
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
        
        -- =====================================================
        -- STEP 4: Count Existing Bookings in Same Period
        -- =====================================================
        SELECT 
            COALESCE(SUM(b.party_size), 0) as total_covers,
            COUNT(*) as total_parties
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
        -- STEP 5: Capacity Validation
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
            p_booking_type::booking_type,
            p_seating_preference::seating_preference_type,
            'confirmed'::booking_status,
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


ALTER FUNCTION "public"."create_booking_with_capacity_check"("p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_idempotency_key" "text", "p_source" "text", "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_booking_with_capacity_check"("p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_idempotency_key" "text", "p_source" "text", "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer) IS 'Race-safe booking creation with capacity enforcement. Uses SERIALIZABLE isolation and row-level locking to prevent overbooking. Returns JSONB with success/error/booking/capacity data.';



CREATE OR REPLACE FUNCTION "public"."generate_booking_reference"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- excludes 0/O/1/I
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..10 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_booking_reference"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_booking_slot"("p_restaurant_id" "uuid", "p_slot_date" "date", "p_slot_time" time without time zone, "p_default_capacity" integer DEFAULT 999) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_slot_id uuid;
    v_service_period_id uuid;
    v_capacity integer;
BEGIN
    -- Try to find existing slot
    SELECT id INTO v_slot_id
    FROM booking_slots
    WHERE restaurant_id = p_restaurant_id
        AND slot_date = p_slot_date
        AND slot_time = p_slot_time;
    
    IF FOUND THEN
        RETURN v_slot_id;
    END IF;
    
    -- Find applicable service period
    SELECT id INTO v_service_period_id
    FROM restaurant_service_periods
    WHERE restaurant_id = p_restaurant_id
        AND (day_of_week IS NULL OR day_of_week = EXTRACT(DOW FROM p_slot_date)::smallint)
        AND p_slot_time >= start_time
        AND p_slot_time < end_time
    ORDER BY day_of_week DESC NULLS LAST
    LIMIT 1;
    
    -- Get capacity from rules (if exists)
    SELECT COALESCE(max_covers, p_default_capacity) INTO v_capacity
    FROM restaurant_capacity_rules
    WHERE restaurant_id = p_restaurant_id
        AND (service_period_id IS NULL OR service_period_id = v_service_period_id)
        AND (day_of_week IS NULL OR day_of_week = EXTRACT(DOW FROM p_slot_date)::smallint)
        AND (effective_date IS NULL OR effective_date <= p_slot_date)
    ORDER BY 
        effective_date DESC NULLS LAST,
        day_of_week DESC NULLS LAST,
        service_period_id DESC NULLS LAST
    LIMIT 1;
    
    -- Default capacity if no rule found
    v_capacity := COALESCE(v_capacity, p_default_capacity);
    
    -- Create new slot
    INSERT INTO booking_slots (
        restaurant_id,
        slot_date,
        slot_time,
        service_period_id,
        available_capacity,
        reserved_count
    ) VALUES (
        p_restaurant_id,
        p_slot_date,
        p_slot_time,
        v_service_period_id,
        v_capacity,
        0
    )
    RETURNING id INTO v_slot_id;
    
    RETURN v_slot_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_booking_slot"("p_restaurant_id" "uuid", "p_slot_date" "date", "p_slot_time" time without time zone, "p_default_capacity" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_or_create_booking_slot"("p_restaurant_id" "uuid", "p_slot_date" "date", "p_slot_time" time without time zone, "p_default_capacity" integer) IS 'Get existing slot or create new one with capacity derived from rules. Used for lazy slot creation.';



CREATE OR REPLACE FUNCTION "public"."increment_booking_slot_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Only increment version if reserved_count changed
    IF OLD.reserved_count IS DISTINCT FROM NEW.reserved_count THEN
        NEW.version := OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_booking_slot_version"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_booking_slot_version"() IS 'Automatically increment version column when reserved_count changes (optimistic concurrency control)';



CREATE OR REPLACE FUNCTION "public"."increment_capacity_metrics"("p_restaurant_id" "uuid", "p_window_start" timestamp with time zone, "p_success_delta" integer DEFAULT 0, "p_conflict_delta" integer DEFAULT 0, "p_capacity_exceeded_delta" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.capacity_metrics_hourly (
    restaurant_id,
    window_start,
    success_count,
    conflict_count,
    capacity_exceeded_count
  )
  VALUES (
    p_restaurant_id,
    date_trunc('hour', p_window_start),
    GREATEST(p_success_delta, 0),
    GREATEST(p_conflict_delta, 0),
    GREATEST(p_capacity_exceeded_delta, 0)
  )
  ON CONFLICT (restaurant_id, window_start)
  DO UPDATE SET
    success_count = public.capacity_metrics_hourly.success_count + GREATEST(p_success_delta, 0),
    conflict_count = public.capacity_metrics_hourly.conflict_count + GREATEST(p_conflict_delta, 0),
    capacity_exceeded_count = public.capacity_metrics_hourly.capacity_exceeded_count + GREATEST(p_capacity_exceeded_delta, 0),
    updated_at = timezone('utc', now());
END;
$$;


ALTER FUNCTION "public"."increment_capacity_metrics"("p_restaurant_id" "uuid", "p_window_start" timestamp with time zone, "p_success_delta" integer, "p_conflict_delta" integer, "p_capacity_exceeded_delta" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_capacity_metrics"("p_restaurant_id" "uuid", "p_window_start" timestamp with time zone, "p_success_delta" integer, "p_conflict_delta" integer, "p_capacity_exceeded_delta" integer) IS 'Increment hourly capacity metrics counters with atomic upsert.';



CREATE OR REPLACE FUNCTION "public"."log_table_assignment_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Log to audit_logs table if it exists
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (entity, entity_id, action, actor, metadata)
        VALUES (
            'booking_table_assignment',
            NEW.id::text,
            'assigned',
            NEW.assigned_by::text,
            jsonb_build_object(
                'booking_id', NEW.booking_id,
                'table_id', NEW.table_id,
                'slot_id', NEW.slot_id
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (entity, entity_id, action, actor, metadata)
        VALUES (
            'booking_table_assignment',
            OLD.id::text,
            'unassigned',
            OLD.assigned_by::text,
            jsonb_build_object(
                'booking_id', OLD.booking_id,
                'table_id', OLD.table_id,
                'slot_id', OLD.slot_id
            )
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_table_assignment_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_table_assignment_change"() IS 'Audit trail for table assignment changes (who assigned what table to which booking)';



CREATE OR REPLACE FUNCTION "public"."on_allocations_refresh"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
      v_table uuid;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF OLD.resource_type = 'table' THEN
          PERFORM public.refresh_table_status(OLD.resource_id);
        END IF;
      ELSE
        IF NEW.resource_type = 'table' THEN
          PERFORM public.refresh_table_status(NEW.resource_id);
        END IF;
      END IF;
      RETURN NULL;
    END;
    $$;


ALTER FUNCTION "public"."on_allocations_refresh"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_booking_status_refresh"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
      v_table_id uuid;
    BEGIN
      IF TG_OP <> 'UPDATE' OR NEW.status = OLD.status THEN
        RETURN NEW;
      END IF;

      FOR v_table_id IN
        SELECT table_id
        FROM public.booking_table_assignments
        WHERE booking_id = NEW.id
      LOOP
        PERFORM public.refresh_table_status(v_table_id);
      END LOOP;

      RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."on_booking_status_refresh"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_table_status"("p_table_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
      v_has_checked_in boolean;
      v_has_future_or_current boolean;
    BEGIN
      IF p_table_id IS NULL THEN
        RETURN;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.allocations a
        WHERE a.resource_type = 'table'
          AND a.resource_id = p_table_id
          AND a.is_maintenance
          AND a."window" @> now()
      ) THEN
        UPDATE public.table_inventory
        SET status = 'out_of_service'
        WHERE id = p_table_id;
        RETURN;
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM public.allocations a
        JOIN public.bookings b ON b.id = a.booking_id
        WHERE a.resource_type = 'table'
          AND a.resource_id = p_table_id
          AND b.status = 'checked_in'
          AND a."window" @> now()
      ) INTO v_has_checked_in;

      IF v_has_checked_in THEN
        UPDATE public.table_inventory
        SET status = 'occupied'
        WHERE id = p_table_id
          AND status <> 'out_of_service';
        RETURN;
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM public.allocations a
        WHERE a.resource_type = 'table'
          AND a.resource_id = p_table_id
          AND upper(a."window") > now()
      ) INTO v_has_future_or_current;

      IF v_has_future_or_current THEN
        UPDATE public.table_inventory
        SET status = 'reserved'
        WHERE id = p_table_id
          AND status NOT IN ('occupied', 'out_of_service');
      ELSE
        UPDATE public.table_inventory
        SET status = 'available'
        WHERE id = p_table_id
          AND status <> 'out_of_service';
      END IF;
    END;
    $$;


ALTER FUNCTION "public"."refresh_table_status"("p_table_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_booking_instants"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  tz text;
  sh int; sm int; ss double precision;
  eh int; em int; es double precision;
BEGIN
  SELECT timezone INTO tz FROM public.restaurants WHERE id = NEW.restaurant_id;

  sh := EXTRACT(HOUR   FROM NEW.start_time)::int;
  sm := EXTRACT(MINUTE FROM NEW.start_time)::int;
  ss := EXTRACT(SECOND FROM NEW.start_time);
  eh := EXTRACT(HOUR   FROM NEW.end_time)::int;
  em := EXTRACT(MINUTE FROM NEW.end_time)::int;
  es := EXTRACT(SECOND FROM NEW.end_time);

  NEW.start_at := make_timestamptz(
                    EXTRACT(YEAR  FROM NEW.booking_date)::int,
                    EXTRACT(MONTH FROM NEW.booking_date)::int,
                    EXTRACT(DAY   FROM NEW.booking_date)::int,
                    sh, sm, ss, tz
                  );

  NEW.end_at := make_timestamptz(
                    EXTRACT(YEAR  FROM NEW.booking_date)::int,
                    EXTRACT(MONTH FROM NEW.booking_date)::int,
                    EXTRACT(DAY   FROM NEW.booking_date)::int,
                    eh, em, es, tz
               );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_booking_instants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_booking_reference"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE ref text;
BEGIN
  IF COALESCE(NEW.reference,'') = '' THEN
    LOOP
      ref := public.generate_booking_reference();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE reference = ref);
    END LOOP;
    NEW.reference := ref;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_booking_reference"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_table_adjacency_symmetry"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.table_adjacencies
      WHERE table_a = NEW.table_b AND table_b = NEW.table_a
    ) THEN
      IF NEW.table_a::text < NEW.table_b::text THEN
        INSERT INTO public.table_adjacencies(table_a, table_b)
        VALUES (NEW.table_b, NEW.table_a)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.table_adjacencies
    WHERE table_a = OLD.table_b AND table_b = OLD.table_a;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_table_adjacency_symmetry"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unassign_table_from_booking"("p_booking_id" "uuid", "p_table_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_deleted boolean;
BEGIN
    -- Delete assignment
    DELETE FROM booking_table_assignments
    WHERE booking_id = p_booking_id
        AND table_id = p_table_id;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    IF v_deleted THEN
        -- Update table status to available
        UPDATE table_inventory
        SET status = 'available'::table_status
        WHERE id = p_table_id
            AND NOT EXISTS (
                -- Keep as reserved if other active bookings exist
                SELECT 1 FROM booking_table_assignments bta
                JOIN bookings b ON b.id = bta.booking_id
                WHERE bta.table_id = p_table_id
                    AND b.status NOT IN ('cancelled', 'no_show', 'completed')
            );
        
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;


ALTER FUNCTION "public"."unassign_table_from_booking"("p_booking_id" "uuid", "p_table_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."unassign_table_from_booking"("p_booking_id" "uuid", "p_table_id" "uuid") IS 'Remove table assignment from booking. Updates table status to available if no other active bookings.';



CREATE OR REPLACE FUNCTION "public"."unassign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_merge_group_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("table_id" "uuid", "merge_group_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
      v_target_tables uuid[] := p_table_ids;
      v_removed RECORD;
      v_tables_from_group uuid[];
      v_merge_group_id uuid := p_merge_group_id;
    BEGIN
      IF v_target_tables IS NOT NULL THEN
        SELECT array_agg(DISTINCT table_id)
        INTO v_target_tables
        FROM unnest(v_target_tables) AS t(table_id);
      END IF;

      IF (v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0) THEN
        IF v_merge_group_id IS NULL THEN
          RAISE EXCEPTION 'Provide table_ids or merge_group_id to unassign'
            USING ERRCODE = '23514';
        END IF;

        SELECT array_agg(table_id)
        INTO v_tables_from_group
        FROM public.merge_group_members
        WHERE merge_group_id = v_merge_group_id;

        v_target_tables := v_tables_from_group;
      END IF;

      IF v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0 THEN
        RETURN;
      END IF;

      FOR v_removed IN
        DELETE FROM public.booking_table_assignments
        WHERE booking_id = p_booking_id
          AND table_id = ANY (v_target_tables)
        RETURNING table_id, merge_group_id
      LOOP
        table_id := v_removed.table_id;
        merge_group_id := v_removed.merge_group_id;
        IF v_merge_group_id IS NULL THEN
          v_merge_group_id := v_removed.merge_group_id;
        END IF;

        DELETE FROM public.allocations
        WHERE booking_id = p_booking_id
          AND resource_type = 'table'
          AND resource_id = v_removed.table_id;

        UPDATE public.table_inventory ti
        SET status = 'available'::public.table_status
        WHERE ti.id = v_removed.table_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.booking_table_assignments bta
            WHERE bta.table_id = v_removed.table_id
          );

        RETURN NEXT;
      END LOOP;

      IF v_merge_group_id IS NULL THEN
        SELECT merge_group_id
        INTO v_merge_group_id
        FROM public.booking_table_assignments
        WHERE booking_id = p_booking_id
          AND merge_group_id IS NOT NULL
        LIMIT 1;
      END IF;

      IF v_merge_group_id IS NOT NULL THEN
        DELETE FROM public.allocations
        WHERE booking_id = p_booking_id
          AND resource_type = 'merge_group'
          AND resource_id = v_merge_group_id;

        UPDATE public.merge_groups
        SET dissolved_at = now()
        WHERE id = v_merge_group_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.booking_table_assignments bta
            WHERE bta.merge_group_id = v_merge_group_id
          );

        DELETE FROM public.merge_group_members
        WHERE merge_group_id = v_merge_group_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.booking_table_assignments bta
            WHERE bta.merge_group_id = v_merge_group_id
          );
      END IF;

      RETURN;
    END;
    $$;


ALTER FUNCTION "public"."unassign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_merge_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_restaurants"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT restaurant_id
  FROM public.restaurant_memberships
  WHERE user_id = auth.uid()
$$;


ALTER FUNCTION "public"."user_restaurants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_restaurants_admin"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT restaurant_id
  FROM public.restaurant_memberships
  WHERE user_id = auth.uid()
    AND role = ANY (ARRAY['owner'::text, 'manager'::text]);
$$;


ALTER FUNCTION "public"."user_restaurants_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_merge_group_members"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  table_ids uuid[];
  distinct_zones integer;
BEGIN
  SELECT array_agg(mgm.table_id)
  INTO table_ids
  FROM public.merge_group_members mgm
  WHERE mgm.merge_group_id = NEW.merge_group_id;

  table_ids := array_append(COALESCE(table_ids, '{}'::uuid[]), NEW.table_id);

  SELECT COUNT(DISTINCT ti.zone_id)
  INTO distinct_zones
  FROM public.table_inventory ti
  WHERE ti.id = ANY(table_ids);

  IF distinct_zones IS NULL OR distinct_zones = 0 THEN
    RAISE EXCEPTION 'Merge group % references tables that do not exist', NEW.merge_group_id;
  END IF;

  IF distinct_zones > 1 THEN
    RAISE EXCEPTION 'Merge group % cannot span multiple zones', NEW.merge_group_id;
  END IF;

  IF array_length(table_ids, 1) > 1 AND NOT public.are_tables_connected(table_ids) THEN
    RAISE EXCEPTION 'Merge group % includes tables without adjacency connectivity', NEW.merge_group_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_merge_group_members"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_table_adjacency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  zone_a uuid;
  zone_b uuid;
BEGIN
  SELECT zone_id INTO zone_a FROM public.table_inventory WHERE id = NEW.table_a;
  SELECT zone_id INTO zone_b FROM public.table_inventory WHERE id = NEW.table_b;

  IF zone_a IS NULL OR zone_b IS NULL THEN
    RAISE EXCEPTION 'Tables must belong to zones before adjacency can be created';
  END IF;

  IF zone_a <> zone_b THEN
    RAISE EXCEPTION 'Adjacency requires tables to be in the same zone';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_table_adjacency"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."_migrations" (
    "id" bigint NOT NULL,
    "name" character varying(255) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "status" character varying(50) DEFAULT 'applied'::character varying
);


ALTER TABLE "public"."_migrations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."_migrations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."_migrations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."_migrations_id_seq" OWNED BY "public"."_migrations"."id";



CREATE TABLE IF NOT EXISTS "public"."allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shadow" boolean DEFAULT false NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "window" "tstzrange" NOT NULL,
    "created_by" "uuid",
    "is_maintenance" boolean DEFAULT false NOT NULL,
    CONSTRAINT "allocations_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['table'::"text", 'merge_group'::"text"])))
);


ALTER TABLE "public"."allocations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."allocations"."is_maintenance" IS 'True when allocation reserves a table for maintenance/out-of-service windows rather than a booking.';



CREATE TABLE IF NOT EXISTS "public"."allowed_capacities" (
    "restaurant_id" "uuid" NOT NULL,
    "capacity" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "allowed_capacities_capacity_check" CHECK (("capacity" > 0))
);


ALTER TABLE "public"."allowed_capacities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_type" "public"."analytics_event_type" NOT NULL,
    "schema_version" "text" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "emitted_by" "text" DEFAULT 'server'::"text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entity" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "actor" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_slots" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "slot_date" "date" NOT NULL,
    "slot_time" time without time zone NOT NULL,
    "service_period_id" "uuid",
    "available_capacity" integer DEFAULT 0 NOT NULL,
    "reserved_count" integer DEFAULT 0 NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_slots_available_capacity_positive" CHECK (("available_capacity" >= 0)),
    CONSTRAINT "booking_slots_capacity_valid" CHECK ((("reserved_count" >= 0) AND ("reserved_count" <= "available_capacity")))
);


ALTER TABLE "public"."booking_slots" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_slots" IS 'Pre-materialized time slots with capacity counters for fast availability checks. Created on-demand or pre-generated.';



COMMENT ON COLUMN "public"."booking_slots"."slot_date" IS 'Date of the slot (e.g., 2025-10-20)';



COMMENT ON COLUMN "public"."booking_slots"."slot_time" IS 'Time of the slot (e.g., 19:00). Typically 15/30/60 minute intervals.';



COMMENT ON COLUMN "public"."booking_slots"."service_period_id" IS 'Optional link to service period (lunch/dinner). Null if not applicable.';



COMMENT ON COLUMN "public"."booking_slots"."available_capacity" IS 'Maximum capacity for this slot (in covers/guests). Derived from capacity rules.';



COMMENT ON COLUMN "public"."booking_slots"."reserved_count" IS 'Number of covers/guests currently reserved for this slot.';



COMMENT ON COLUMN "public"."booking_slots"."version" IS 'Optimistic locking version. Incremented on each update to prevent race conditions.';



CREATE TABLE IF NOT EXISTS "public"."booking_state_history" (
    "id" bigint NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "from_status" "public"."booking_status",
    "to_status" "public"."booking_status" NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."booking_state_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_state_history" IS 'Audit history of booking lifecycle transitions.';



COMMENT ON COLUMN "public"."booking_state_history"."booking_id" IS 'Booking whose status transitioned.';



COMMENT ON COLUMN "public"."booking_state_history"."from_status" IS 'Previous lifecycle status.';



COMMENT ON COLUMN "public"."booking_state_history"."to_status" IS 'New lifecycle status.';



COMMENT ON COLUMN "public"."booking_state_history"."changed_by" IS 'User who triggered the change (null for system operations).';



COMMENT ON COLUMN "public"."booking_state_history"."changed_at" IS 'UTC timestamp when the transition was recorded.';



COMMENT ON COLUMN "public"."booking_state_history"."reason" IS 'Optional human-readable reason for the transition.';



COMMENT ON COLUMN "public"."booking_state_history"."metadata" IS 'Additional structured data describing the transition.';



CREATE SEQUENCE IF NOT EXISTS "public"."booking_state_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."booking_state_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."booking_state_history_id_seq" OWNED BY "public"."booking_state_history"."id";



CREATE TABLE IF NOT EXISTS "public"."booking_table_assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "slot_id" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "idempotency_key" "text",
    "merge_group_id" "uuid"
);


ALTER TABLE "public"."booking_table_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_table_assignments" IS 'Links bookings to physical tables. A booking can have multiple tables (e.g., party of 10 = 2x 6-tops).';



COMMENT ON COLUMN "public"."booking_table_assignments"."booking_id" IS 'The booking being assigned a table';



COMMENT ON COLUMN "public"."booking_table_assignments"."table_id" IS 'The physical table being assigned';



COMMENT ON COLUMN "public"."booking_table_assignments"."slot_id" IS 'Optional link to the booking slot (for slot-level tracking)';



COMMENT ON COLUMN "public"."booking_table_assignments"."assigned_at" IS 'When the assignment was made';



COMMENT ON COLUMN "public"."booking_table_assignments"."assigned_by" IS 'User who made the assignment (null for auto-assignment)';



COMMENT ON COLUMN "public"."booking_table_assignments"."notes" IS 'Optional notes about the assignment (e.g., "VIP preferred seating")';



CREATE TABLE IF NOT EXISTS "public"."booking_versions" (
    "version_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "change_type" "public"."booking_change_type" NOT NULL,
    "changed_by" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."booking_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "booking_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "party_size" integer NOT NULL,
    "seating_preference" "public"."seating_preference_type" DEFAULT 'any'::"public"."seating_preference_type" NOT NULL,
    "status" "public"."booking_status" DEFAULT 'confirmed'::"public"."booking_status" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_email" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "notes" "text",
    "reference" "text" NOT NULL,
    "source" "text" DEFAULT 'web'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "booking_type" "public"."booking_type" DEFAULT 'dinner'::"public"."booking_type" NOT NULL,
    "idempotency_key" "text",
    "client_request_id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "pending_ref" "text",
    "details" "jsonb",
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    "confirmation_token" character varying(64),
    "confirmation_token_expires_at" timestamp with time zone,
    "confirmation_token_used_at" timestamp with time zone,
    "auth_user_id" "uuid",
    "checked_in_at" timestamp with time zone,
    "checked_out_at" timestamp with time zone,
    "loyalty_points_awarded" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "bookings_checked_out_after_checked_in" CHECK ((("checked_out_at" IS NULL) OR ("checked_in_at" IS NULL) OR ("checked_out_at" >= "checked_in_at"))),
    CONSTRAINT "bookings_party_size_check" CHECK (("party_size" > 0)),
    CONSTRAINT "chk_time_order" CHECK (("start_at" < "end_at"))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bookings"."confirmation_token" IS 'One-time cryptographic token (base64url, 64 chars) for guest confirmation page access. Expires in 1 hour.';



COMMENT ON COLUMN "public"."bookings"."confirmation_token_expires_at" IS 'Expiry timestamp for confirmation_token. After this time, token is invalid.';



COMMENT ON COLUMN "public"."bookings"."confirmation_token_used_at" IS 'Timestamp when confirmation_token was first used. Prevents token replay attacks.';



COMMENT ON COLUMN "public"."bookings"."auth_user_id" IS 'Optional link to the authenticated Supabase user that created or owns the booking.';



COMMENT ON COLUMN "public"."bookings"."checked_in_at" IS 'Timestamp when the guest was checked in by ops';



COMMENT ON COLUMN "public"."bookings"."checked_out_at" IS 'Timestamp when the guest was checked out by ops';



COMMENT ON CONSTRAINT "bookings_checked_out_after_checked_in" ON "public"."bookings" IS 'Ensures recorded check-out timestamps are chronologically after check-in.';



CREATE TABLE IF NOT EXISTS "public"."capacity_metrics_hourly" (
    "restaurant_id" "uuid" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "success_count" integer DEFAULT 0 NOT NULL,
    "conflict_count" integer DEFAULT 0 NOT NULL,
    "capacity_exceeded_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."capacity_metrics_hourly" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_profiles" (
    "customer_id" "uuid" NOT NULL,
    "first_booking_at" timestamp with time zone,
    "last_booking_at" timestamp with time zone,
    "total_bookings" integer DEFAULT 0 NOT NULL,
    "total_covers" integer DEFAULT 0 NOT NULL,
    "total_cancellations" integer DEFAULT 0 NOT NULL,
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    "last_marketing_opt_in_at" timestamp with time zone,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_profiles_total_bookings_check" CHECK (("total_bookings" >= 0)),
    CONSTRAINT "customer_profiles_total_cancellations_check" CHECK (("total_cancellations" >= 0)),
    CONSTRAINT "customer_profiles_total_covers_check" CHECK (("total_covers" >= 0))
);


ALTER TABLE "public"."customer_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email_normalized" "text" GENERATED ALWAYS AS ("lower"(TRIM(BOTH FROM "email"))) STORED,
    "phone_normalized" "text" GENERATED ALWAYS AS ("regexp_replace"("phone", '[^0-9]+'::"text", ''::"text", 'g'::"text")) STORED,
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    "auth_user_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customers_email_check" CHECK (("email" = "lower"("email"))),
    CONSTRAINT "customers_phone_check" CHECK ((("length"("phone") >= 7) AND ("length"("phone") <= 20)))
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_point_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "points_change" integer NOT NULL,
    "event_type" "text" NOT NULL,
    "schema_version" integer DEFAULT 1 NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."loyalty_point_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_points" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "total_points" integer DEFAULT 0 NOT NULL,
    "tier" "public"."loyalty_tier" DEFAULT 'bronze'::"public"."loyalty_tier" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."loyalty_points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_programs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "accrual_rule" "jsonb" DEFAULT '{"type": "per_guest", "base_points": 10, "points_per_guest": 5, "minimum_party_size": 1}'::"jsonb" NOT NULL,
    "tier_definitions" "jsonb" DEFAULT '[{"tier": "bronze", "min_points": 0}]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pilot_only" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."loyalty_programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."merge_group_members" (
    "merge_group_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."merge_group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."merge_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "capacity" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dissolved_at" timestamp with time zone
);


ALTER TABLE "public"."merge_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."merge_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_a" smallint NOT NULL,
    "from_b" smallint NOT NULL,
    "to_capacity" smallint NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "require_same_zone" boolean DEFAULT true NOT NULL,
    "require_adjacency" boolean DEFAULT true NOT NULL,
    "cross_category_merge" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "merge_rules_positive" CHECK ((("from_a" > 0) AND ("from_b" > 0) AND ("to_capacity" > 0)))
);


ALTER TABLE "public"."merge_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_update_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "payload_hash" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."profile_update_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "name" "text",
    "phone" "text",
    "image" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "has_access" boolean DEFAULT true NOT NULL,
    CONSTRAINT "profiles_email_check" CHECK (("email" = "lower"("email")))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."has_access" IS 'Indicates whether the profile retains active access to Ops surfaces.';



CREATE TABLE IF NOT EXISTS "public"."restaurant_capacity_rules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "service_period_id" "uuid",
    "day_of_week" smallint,
    "effective_date" "date",
    "max_covers" integer,
    "max_parties" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "label" "text",
    "override_type" "public"."capacity_override_type",
    CONSTRAINT "restaurant_capacity_rules_non_negative" CHECK (((("max_covers" IS NULL) OR ("max_covers" >= 0)) AND (("max_parties" IS NULL) OR ("max_parties" >= 0)))),
    CONSTRAINT "restaurant_capacity_rules_scope" CHECK ((("service_period_id" IS NOT NULL) OR ("day_of_week" IS NOT NULL) OR ("effective_date" IS NOT NULL)))
);


ALTER TABLE "public"."restaurant_capacity_rules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."restaurant_capacity_rules"."label" IS 'Human-friendly name for this capacity rule or override (e.g., “Christmas Eve Dinner”).';



COMMENT ON COLUMN "public"."restaurant_capacity_rules"."override_type" IS 'Categorizes overrides (holiday, event, manual adjustments, emergencies).';



CREATE TABLE IF NOT EXISTS "public"."restaurant_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "email_normalized" "text" GENERATED ALWAYS AS ("lower"(TRIM(BOTH FROM "email"))) STORED,
    "role" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "invited_by" "uuid",
    "accepted_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "restaurant_invites_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'host'::"text", 'server'::"text"]))),
    CONSTRAINT "restaurant_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'revoked'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."restaurant_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_memberships" (
    "user_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "restaurant_memberships_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'host'::"text", 'server'::"text"])))
);


ALTER TABLE "public"."restaurant_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_operating_hours" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "day_of_week" smallint,
    "effective_date" "date",
    "opens_at" time without time zone,
    "closes_at" time without time zone,
    "is_closed" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "restaurant_operating_hours_scope" CHECK ((("day_of_week" IS NOT NULL) OR ("effective_date" IS NOT NULL))),
    CONSTRAINT "restaurant_operating_hours_time_order" CHECK (("is_closed" OR (("opens_at" IS NOT NULL) AND ("closes_at" IS NOT NULL) AND ("opens_at" < "closes_at"))))
);


ALTER TABLE "public"."restaurant_operating_hours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_service_periods" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "day_of_week" smallint,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "booking_option" "text" DEFAULT 'drinks'::"text" NOT NULL,
    CONSTRAINT "restaurant_service_periods_booking_option_check" CHECK (("booking_option" = ANY (ARRAY['lunch'::"text", 'dinner'::"text", 'drinks'::"text"]))),
    CONSTRAINT "restaurant_service_periods_time_order" CHECK (("start_time" < "end_time"))
);


ALTER TABLE "public"."restaurant_service_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "timezone" "text" DEFAULT 'Europe/London'::"text" NOT NULL,
    "capacity" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_email" "text",
    "contact_phone" "text",
    "address" "text",
    "booking_policy" "text",
    "reservation_interval_minutes" integer DEFAULT 15 NOT NULL,
    "reservation_default_duration_minutes" integer DEFAULT 90 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "restaurants_capacity_check" CHECK ((("capacity" IS NULL) OR ("capacity" > 0))),
    CONSTRAINT "restaurants_reservation_default_duration_minutes_check" CHECK ((("reservation_default_duration_minutes" >= 15) AND ("reservation_default_duration_minutes" <= 300))),
    CONSTRAINT "restaurants_reservation_interval_minutes_check" CHECK ((("reservation_interval_minutes" > 0) AND ("reservation_interval_minutes" <= 180))),
    CONSTRAINT "restaurants_slug_check" CHECK (("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::"text"))
);


ALTER TABLE "public"."restaurants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."restaurants"."is_active" IS 'Indicates whether the restaurant is active and should surface in public experiences.';



CREATE TABLE IF NOT EXISTS "public"."service_policy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lunch_start" time without time zone DEFAULT '12:00:00'::time without time zone NOT NULL,
    "lunch_end" time without time zone DEFAULT '15:00:00'::time without time zone NOT NULL,
    "dinner_start" time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    "dinner_end" time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
    "clean_buffer_minutes" smallint DEFAULT 5 NOT NULL,
    "allow_after_hours" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_policy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stripe_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table_adjacencies" (
    "table_a" "uuid" NOT NULL,
    "table_b" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "table_adjacencies_not_equal" CHECK (("table_a" <> "table_b"))
);


ALTER TABLE "public"."table_adjacencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table_inventory" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "table_number" "text" NOT NULL,
    "capacity" integer NOT NULL,
    "min_party_size" integer DEFAULT 1 NOT NULL,
    "max_party_size" integer,
    "section" "text",
    "status" "public"."table_status" DEFAULT 'available'::"public"."table_status" NOT NULL,
    "position" "jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "category" "public"."table_category" NOT NULL,
    "seating_type" "public"."table_seating_type" DEFAULT 'standard'::"public"."table_seating_type" NOT NULL,
    "mobility" "public"."table_mobility" DEFAULT 'movable'::"public"."table_mobility" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "table_inventory_min_party_positive" CHECK (("min_party_size" > 0)),
    CONSTRAINT "table_inventory_valid_party_range" CHECK ((("max_party_size" IS NULL) OR ("max_party_size" >= "min_party_size")))
);


ALTER TABLE "public"."table_inventory" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_inventory" IS 'Physical restaurant tables with capacity and seating type. Used for table assignment and floor plan visualization.';



COMMENT ON COLUMN "public"."table_inventory"."table_number" IS 'Display name for the table (e.g., "T1", "Main-5", "Patio-2")';



COMMENT ON COLUMN "public"."table_inventory"."capacity" IS 'Number of seats at the table';



COMMENT ON COLUMN "public"."table_inventory"."min_party_size" IS 'Minimum party size for this table (e.g., 2-top only for parties of 2+)';



COMMENT ON COLUMN "public"."table_inventory"."max_party_size" IS 'Maximum party size for this table (optional, defaults to capacity)';



COMMENT ON COLUMN "public"."table_inventory"."section" IS 'Section name (e.g., "Main Floor", "Patio", "Bar Area", "Private Room")';



COMMENT ON COLUMN "public"."table_inventory"."status" IS 'Current status: available, reserved, occupied, out_of_service';



COMMENT ON COLUMN "public"."table_inventory"."position" IS 'Floor plan position as JSON: {x: number, y: number, rotation?: number} for drag-and-drop UI';



CREATE TABLE IF NOT EXISTS "public"."zones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "zones_name_not_blank" CHECK (("char_length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."zones" OWNER TO "postgres";


ALTER TABLE ONLY "public"."_migrations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."_migrations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."booking_state_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."booking_state_history_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."_migrations"
    ADD CONSTRAINT "_migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."_migrations"
    ADD CONSTRAINT "_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_booking_resource_key" UNIQUE ("booking_id", "resource_type", "resource_id");



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_resource_window_excl" EXCLUDE USING "gist" ("resource_type" WITH =, "resource_id" WITH =, "window" WITH &&) DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."allowed_capacities"
    ADD CONSTRAINT "allowed_capacities_pkey" PRIMARY KEY ("restaurant_id", "capacity");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_slots"
    ADD CONSTRAINT "booking_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_slots"
    ADD CONSTRAINT "booking_slots_restaurant_slot_key" UNIQUE ("restaurant_id", "slot_date", "slot_time");



ALTER TABLE ONLY "public"."booking_state_history"
    ADD CONSTRAINT "booking_state_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_booking_table_key" UNIQUE ("booking_id", "table_id");



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_versions"
    ADD CONSTRAINT "booking_versions_pkey" PRIMARY KEY ("version_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_confirmation_token_unique" UNIQUE ("confirmation_token");



ALTER TABLE "public"."bookings"
    ADD CONSTRAINT "bookings_lifecycle_timestamp_consistency" CHECK (((("status" = ANY (ARRAY['pending'::"public"."booking_status", 'pending_allocation'::"public"."booking_status", 'confirmed'::"public"."booking_status"])) AND ("checked_in_at" IS NULL) AND ("checked_out_at" IS NULL)) OR (("status" = 'checked_in'::"public"."booking_status") AND ("checked_in_at" IS NOT NULL) AND ("checked_out_at" IS NULL)) OR (("status" = 'completed'::"public"."booking_status") AND ("checked_in_at" IS NOT NULL) AND ("checked_out_at" IS NOT NULL) AND ("checked_out_at" >= "checked_in_at")) OR ("status" = 'cancelled'::"public"."booking_status") OR (("status" = 'no_show'::"public"."booking_status") AND ("checked_in_at" IS NULL) AND ("checked_out_at" IS NULL)))) NOT VALID;



COMMENT ON CONSTRAINT "bookings_lifecycle_timestamp_consistency" ON "public"."bookings" IS 'Ensures booking lifecycle timestamps align with the status (checked-in bookings must have check-in timestamps, completed bookings need both timestamps, etc).';



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_reference_key" UNIQUE ("reference");



ALTER TABLE ONLY "public"."capacity_metrics_hourly"
    ADD CONSTRAINT "capacity_metrics_hourly_pkey" PRIMARY KEY ("restaurant_id", "window_start");



ALTER TABLE ONLY "public"."customer_profiles"
    ADD CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("customer_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_restaurant_email_phone_key" UNIQUE ("restaurant_id", "email_normalized", "phone_normalized");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_restaurant_id_email_normalized_key" UNIQUE ("restaurant_id", "email_normalized");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_restaurant_id_phone_normalized_key" UNIQUE ("restaurant_id", "phone_normalized");



ALTER TABLE ONLY "public"."loyalty_point_events"
    ADD CONSTRAINT "loyalty_point_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_points"
    ADD CONSTRAINT "loyalty_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_points"
    ADD CONSTRAINT "loyalty_points_restaurant_id_customer_id_key" UNIQUE ("restaurant_id", "customer_id");



ALTER TABLE ONLY "public"."loyalty_programs"
    ADD CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_programs"
    ADD CONSTRAINT "loyalty_programs_restaurant_id_key" UNIQUE ("restaurant_id");



ALTER TABLE ONLY "public"."merge_group_members"
    ADD CONSTRAINT "merge_group_members_pkey" PRIMARY KEY ("merge_group_id", "table_id");



ALTER TABLE ONLY "public"."merge_groups"
    ADD CONSTRAINT "merge_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merge_rules"
    ADD CONSTRAINT "merge_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_update_requests"
    ADD CONSTRAINT "profile_update_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_capacity_rules"
    ADD CONSTRAINT "restaurant_capacity_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_invites"
    ADD CONSTRAINT "restaurant_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_memberships"
    ADD CONSTRAINT "restaurant_memberships_pkey" PRIMARY KEY ("user_id", "restaurant_id");



ALTER TABLE ONLY "public"."restaurant_operating_hours"
    ADD CONSTRAINT "restaurant_operating_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_service_periods"
    ADD CONSTRAINT "restaurant_service_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."service_policy"
    ADD CONSTRAINT "service_policy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_adjacencies"
    ADD CONSTRAINT "table_adjacencies_pkey" PRIMARY KEY ("table_a", "table_b");



ALTER TABLE ONLY "public"."table_inventory"
    ADD CONSTRAINT "table_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_inventory"
    ADD CONSTRAINT "table_inventory_restaurant_id_table_number_key" UNIQUE ("restaurant_id", "table_number");



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_pkey" PRIMARY KEY ("id");



CREATE INDEX "allocations_resource_window_idx" ON "public"."allocations" USING "gist" ("resource_type", "resource_id", "window");



CREATE INDEX "allowed_capacities_restaurant_idx" ON "public"."allowed_capacities" USING "btree" ("restaurant_id", "capacity");



CREATE UNIQUE INDEX "booking_table_assignments_booking_id_idempotency_key_key" ON "public"."booking_table_assignments" USING "btree" ("booking_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "bookings_restaurant_date_status_idx" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_date", "status");



CREATE INDEX "idx_analytics_events_booking_id" ON "public"."analytics_events" USING "btree" ("booking_id");



CREATE INDEX "idx_analytics_events_customer_id" ON "public"."analytics_events" USING "btree" ("customer_id") WHERE ("customer_id" IS NOT NULL);



CREATE INDEX "idx_analytics_events_event_type" ON "public"."analytics_events" USING "btree" ("event_type");



CREATE INDEX "idx_analytics_events_occurred_at" ON "public"."analytics_events" USING "btree" ("occurred_at" DESC);



CREATE INDEX "idx_analytics_events_restaurant_id" ON "public"."analytics_events" USING "btree" ("restaurant_id");



CREATE INDEX "idx_analytics_events_restaurant_occurred" ON "public"."analytics_events" USING "btree" ("restaurant_id", "occurred_at" DESC);



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_entity_id" ON "public"."audit_logs" USING "btree" ("entity", "entity_id");



CREATE INDEX "idx_booking_slots_date_range" ON "public"."booking_slots" USING "btree" ("restaurant_id", "slot_date");



COMMENT ON INDEX "public"."idx_booking_slots_date_range" IS 'Fast queries for all slots on a given date';



CREATE INDEX "idx_booking_slots_lookup" ON "public"."booking_slots" USING "btree" ("restaurant_id", "slot_date", "slot_time");



COMMENT ON INDEX "public"."idx_booking_slots_lookup" IS 'Fast lookup for specific slot (primary use case)';



CREATE INDEX "idx_booking_slots_service_period" ON "public"."booking_slots" USING "btree" ("service_period_id", "slot_date");



COMMENT ON INDEX "public"."idx_booking_slots_service_period" IS 'Fast queries by service period (e.g., all lunch slots)';



CREATE INDEX "idx_booking_state_history_booking" ON "public"."booking_state_history" USING "btree" ("booking_id", "changed_at" DESC);



COMMENT ON INDEX "public"."idx_booking_state_history_booking" IS 'Lookup transitions for a booking ordered by recency.';



CREATE INDEX "idx_booking_state_history_changed_at" ON "public"."booking_state_history" USING "btree" ("changed_at");



COMMENT ON INDEX "public"."idx_booking_state_history_changed_at" IS 'Support chronological reporting of booking transitions.';



CREATE INDEX "idx_booking_table_assignments_booking" ON "public"."booking_table_assignments" USING "btree" ("booking_id");



COMMENT ON INDEX "public"."idx_booking_table_assignments_booking" IS 'Fast lookup of tables assigned to a booking';



CREATE INDEX "idx_booking_table_assignments_slot" ON "public"."booking_table_assignments" USING "btree" ("slot_id");



COMMENT ON INDEX "public"."idx_booking_table_assignments_slot" IS 'Fast lookup of assignments per slot';



CREATE INDEX "idx_booking_table_assignments_table" ON "public"."booking_table_assignments" USING "btree" ("table_id", "assigned_at");



COMMENT ON INDEX "public"."idx_booking_table_assignments_table" IS 'Fast lookup of bookings using a table (for reservation timeline)';



CREATE INDEX "idx_booking_versions_booking_id" ON "public"."booking_versions" USING "btree" ("booking_id");



CREATE INDEX "idx_booking_versions_changed_at" ON "public"."booking_versions" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_booking_versions_restaurant_id" ON "public"."booking_versions" USING "btree" ("restaurant_id");



CREATE INDEX "idx_bookings_auth_user" ON "public"."bookings" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE INDEX "idx_bookings_client_request_id" ON "public"."bookings" USING "btree" ("client_request_id");



CREATE INDEX "idx_bookings_confirmation_token" ON "public"."bookings" USING "btree" ("confirmation_token") WHERE ("confirmation_token" IS NOT NULL);



CREATE INDEX "idx_bookings_created" ON "public"."bookings" USING "btree" ("restaurant_id", "created_at" DESC);



CREATE INDEX "idx_bookings_customer" ON "public"."bookings" USING "btree" ("customer_id");



CREATE INDEX "idx_bookings_date" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_date");



CREATE INDEX "idx_bookings_datetime" ON "public"."bookings" USING "btree" ("restaurant_id", "start_at", "end_at");



CREATE INDEX "idx_bookings_idempotency_key" ON "public"."bookings" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_bookings_pending_ref" ON "public"."bookings" USING "btree" ("pending_ref") WHERE ("pending_ref" IS NOT NULL);



CREATE INDEX "idx_bookings_reference" ON "public"."bookings" USING "btree" ("reference");



CREATE INDEX "idx_bookings_restaurant" ON "public"."bookings" USING "btree" ("restaurant_id");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("restaurant_id", "status");



CREATE INDEX "idx_capacity_metrics_hourly_window" ON "public"."capacity_metrics_hourly" USING "btree" ("window_start" DESC);



CREATE INDEX "idx_customer_profiles_updated_at" ON "public"."customer_profiles" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_customers_auth_user" ON "public"."customers" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE INDEX "idx_customers_email_normalized" ON "public"."customers" USING "btree" ("restaurant_id", "email_normalized");



CREATE INDEX "idx_customers_phone_normalized" ON "public"."customers" USING "btree" ("restaurant_id", "phone_normalized");



CREATE INDEX "idx_customers_restaurant" ON "public"."customers" USING "btree" ("restaurant_id");



CREATE INDEX "idx_loyalty_point_events_booking" ON "public"."loyalty_point_events" USING "btree" ("booking_id") WHERE ("booking_id" IS NOT NULL);



CREATE INDEX "idx_loyalty_point_events_customer" ON "public"."loyalty_point_events" USING "btree" ("customer_id");



CREATE INDEX "idx_loyalty_points_restaurant_customer" ON "public"."loyalty_points" USING "btree" ("restaurant_id", "customer_id");



CREATE INDEX "idx_loyalty_programs_restaurant" ON "public"."loyalty_programs" USING "btree" ("restaurant_id");



CREATE INDEX "idx_memberships_restaurant" ON "public"."restaurant_memberships" USING "btree" ("restaurant_id");



CREATE INDEX "idx_memberships_user" ON "public"."restaurant_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_profiles_has_access" ON "public"."profiles" USING "btree" ("has_access");



CREATE INDEX "idx_restaurant_capacity_rules_scope" ON "public"."restaurant_capacity_rules" USING "btree" ("restaurant_id", COALESCE(("day_of_week")::integer, '-1'::integer), "effective_date");



CREATE INDEX "idx_restaurant_operating_hours_scope" ON "public"."restaurant_operating_hours" USING "btree" ("restaurant_id", COALESCE(("day_of_week")::integer, '-1'::integer), "effective_date");



CREATE INDEX "idx_restaurant_service_periods_scope" ON "public"."restaurant_service_periods" USING "btree" ("restaurant_id", COALESCE(("day_of_week")::integer, '-1'::integer));



CREATE INDEX "idx_restaurants_active" ON "public"."restaurants" USING "btree" ("is_active");



CREATE INDEX "idx_restaurants_slug" ON "public"."restaurants" USING "btree" ("slug");



CREATE INDEX "idx_stripe_events_created_at" ON "public"."stripe_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_stripe_events_event_id" ON "public"."stripe_events" USING "btree" ("event_id");



CREATE INDEX "idx_stripe_events_event_type" ON "public"."stripe_events" USING "btree" ("event_type");



CREATE INDEX "idx_stripe_events_processed" ON "public"."stripe_events" USING "btree" ("processed") WHERE ("processed" = false);



CREATE INDEX "idx_table_inventory_lookup" ON "public"."table_inventory" USING "btree" ("restaurant_id", "status", "capacity");



COMMENT ON INDEX "public"."idx_table_inventory_lookup" IS 'Fast lookup for available tables by restaurant and capacity';



CREATE INDEX "idx_table_inventory_section" ON "public"."table_inventory" USING "btree" ("restaurant_id", "section");



COMMENT ON INDEX "public"."idx_table_inventory_section" IS 'Fast filtering by section for floor plan views';



CREATE UNIQUE INDEX "merge_rules_from_to_idx" ON "public"."merge_rules" USING "btree" ("from_a", "from_b", "to_capacity");



CREATE UNIQUE INDEX "profile_update_requests_profile_key_idx" ON "public"."profile_update_requests" USING "btree" ("profile_id", "idempotency_key");



CREATE UNIQUE INDEX "restaurant_invites_pending_unique_email" ON "public"."restaurant_invites" USING "btree" ("restaurant_id", "email_normalized") WHERE ("status" = 'pending'::"text");



CREATE INDEX "restaurant_invites_restaurant_status_idx" ON "public"."restaurant_invites" USING "btree" ("restaurant_id", "status", "expires_at" DESC);



CREATE UNIQUE INDEX "restaurant_invites_token_hash_key" ON "public"."restaurant_invites" USING "btree" ("token_hash");



CREATE INDEX "table_adjacencies_table_b_idx" ON "public"."table_adjacencies" USING "btree" ("table_b");



CREATE INDEX "table_inventory_zone_idx" ON "public"."table_inventory" USING "btree" ("zone_id");



CREATE UNIQUE INDEX "zones_restaurant_name_idx" ON "public"."zones" USING "btree" ("restaurant_id", "lower"("name"));



CREATE OR REPLACE TRIGGER "allocations_updated_at" BEFORE UPDATE ON "public"."allocations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "allowed_capacities_touch_updated_at" BEFORE UPDATE ON "public"."allowed_capacities" FOR EACH ROW EXECUTE FUNCTION "public"."allowed_capacities_set_updated_at"();



CREATE OR REPLACE TRIGGER "booking_slots_increment_version" BEFORE UPDATE ON "public"."booking_slots" FOR EACH ROW EXECUTE FUNCTION "public"."increment_booking_slot_version"();



CREATE OR REPLACE TRIGGER "booking_slots_updated_at" BEFORE UPDATE ON "public"."booking_slots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "booking_table_assignments_audit" AFTER INSERT OR DELETE ON "public"."booking_table_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."log_table_assignment_change"();



CREATE OR REPLACE TRIGGER "booking_table_assignments_updated_at" BEFORE UPDATE ON "public"."booking_table_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "bookings_set_instants" BEFORE INSERT OR UPDATE OF "booking_date", "start_time", "end_time", "restaurant_id" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_booking_instants"();



CREATE OR REPLACE TRIGGER "bookings_set_reference" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_booking_reference"();



CREATE OR REPLACE TRIGGER "bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "capacity_metrics_hourly_set_updated_at" BEFORE UPDATE ON "public"."capacity_metrics_hourly" FOR EACH ROW EXECUTE FUNCTION "public"."capacity_metrics_hourly_updated_at"();



CREATE OR REPLACE TRIGGER "customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "merge_group_members_validate_connectivity" BEFORE INSERT ON "public"."merge_group_members" FOR EACH ROW EXECUTE FUNCTION "public"."validate_merge_group_members"();



CREATE OR REPLACE TRIGGER "merge_rules_updated_at" BEFORE UPDATE ON "public"."merge_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "restaurant_capacity_rules_updated_at" BEFORE UPDATE ON "public"."restaurant_capacity_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "restaurant_operating_hours_updated_at" BEFORE UPDATE ON "public"."restaurant_operating_hours" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "restaurant_service_periods_updated_at" BEFORE UPDATE ON "public"."restaurant_service_periods" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "restaurants_updated_at" BEFORE UPDATE ON "public"."restaurants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "service_policy_updated_at" BEFORE UPDATE ON "public"."service_policy" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_restaurant_invites_updated_at" BEFORE UPDATE ON "public"."restaurant_invites" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "table_adjacencies_sync" AFTER INSERT OR DELETE ON "public"."table_adjacencies" FOR EACH ROW EXECUTE FUNCTION "public"."sync_table_adjacency_symmetry"();



CREATE OR REPLACE TRIGGER "table_adjacencies_validate" BEFORE INSERT ON "public"."table_adjacencies" FOR EACH ROW EXECUTE FUNCTION "public"."validate_table_adjacency"();



CREATE OR REPLACE TRIGGER "table_inventory_updated_at" BEFORE UPDATE ON "public"."table_inventory" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_allocations_refresh" AFTER INSERT OR DELETE OR UPDATE ON "public"."allocations" FOR EACH ROW EXECUTE FUNCTION "public"."on_allocations_refresh"();



CREATE OR REPLACE TRIGGER "trg_booking_status_refresh" AFTER UPDATE OF "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."on_booking_status_refresh"();



CREATE OR REPLACE TRIGGER "update_loyalty_points_updated_at" BEFORE UPDATE ON "public"."loyalty_points" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_loyalty_programs_updated_at" BEFORE UPDATE ON "public"."loyalty_programs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "zones_updated_at" BEFORE UPDATE ON "public"."zones" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."allowed_capacities"
    ADD CONSTRAINT "allowed_capacities_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_slots"
    ADD CONSTRAINT "booking_slots_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_slots"
    ADD CONSTRAINT "booking_slots_service_period_id_fkey" FOREIGN KEY ("service_period_id") REFERENCES "public"."restaurant_service_periods"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_state_history"
    ADD CONSTRAINT "booking_state_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_state_history"
    ADD CONSTRAINT "booking_state_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_merge_group_id_fkey" FOREIGN KEY ("merge_group_id") REFERENCES "public"."merge_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "public"."booking_slots"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."table_inventory"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."booking_versions"
    ADD CONSTRAINT "booking_versions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_versions"
    ADD CONSTRAINT "booking_versions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."capacity_metrics_hourly"
    ADD CONSTRAINT "capacity_metrics_hourly_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_profiles"
    ADD CONSTRAINT "customer_profiles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_point_events"
    ADD CONSTRAINT "loyalty_point_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_point_events"
    ADD CONSTRAINT "loyalty_point_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_point_events"
    ADD CONSTRAINT "loyalty_point_events_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_points"
    ADD CONSTRAINT "loyalty_points_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_points"
    ADD CONSTRAINT "loyalty_points_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_programs"
    ADD CONSTRAINT "loyalty_programs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merge_group_members"
    ADD CONSTRAINT "merge_group_members_merge_group_id_fkey" FOREIGN KEY ("merge_group_id") REFERENCES "public"."merge_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merge_group_members"
    ADD CONSTRAINT "merge_group_members_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."table_inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_update_requests"
    ADD CONSTRAINT "profile_update_requests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_capacity_rules"
    ADD CONSTRAINT "restaurant_capacity_rules_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_capacity_rules"
    ADD CONSTRAINT "restaurant_capacity_rules_service_period_id_fkey" FOREIGN KEY ("service_period_id") REFERENCES "public"."restaurant_service_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_invites"
    ADD CONSTRAINT "restaurant_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."restaurant_invites"
    ADD CONSTRAINT "restaurant_invites_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_memberships"
    ADD CONSTRAINT "restaurant_memberships_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_operating_hours"
    ADD CONSTRAINT "restaurant_operating_hours_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_service_periods"
    ADD CONSTRAINT "restaurant_service_periods_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_adjacencies"
    ADD CONSTRAINT "table_adjacencies_table_a_fkey" FOREIGN KEY ("table_a") REFERENCES "public"."table_inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_adjacencies"
    ADD CONSTRAINT "table_adjacencies_table_b_fkey" FOREIGN KEY ("table_b") REFERENCES "public"."table_inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_inventory"
    ADD CONSTRAINT "table_inventory_allowed_capacity_fkey" FOREIGN KEY ("restaurant_id", "capacity") REFERENCES "public"."allowed_capacities"("restaurant_id", "capacity") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."table_inventory"
    ADD CONSTRAINT "table_inventory_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_inventory"
    ADD CONSTRAINT "table_inventory_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



CREATE POLICY "Admins and owners can delete bookings" ON "public"."bookings" FOR DELETE USING (("restaurant_id" IN ( SELECT "rm"."restaurant_id"
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."user_id" = "auth"."uid"()) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins and owners can delete customers" ON "public"."customers" FOR DELETE USING (("restaurant_id" IN ( SELECT "rm"."restaurant_id"
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."user_id" = "auth"."uid"()) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text"]))))));



CREATE POLICY "Customers can view their table assignments" ON "public"."booking_table_assignments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."id" = "booking_table_assignments"."booking_id") AND (("b"."auth_user_id" = "auth"."uid"()) OR ("b"."customer_id" IN ( SELECT "customers"."id"
           FROM "public"."customers"
          WHERE ("customers"."auth_user_id" = "auth"."uid"()))))))));



CREATE POLICY "Owners and admins can manage memberships" ON "public"."restaurant_memberships" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants_admin"() AS "user_restaurants_admin"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants_admin"() AS "user_restaurants_admin")));



CREATE POLICY "Owners and managers manage invites" ON "public"."restaurant_invites" USING (("restaurant_id" IN ( SELECT "rm"."restaurant_id"
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."user_id" = "auth"."uid"()) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text"])))))) WITH CHECK (("restaurant_id" IN ( SELECT "rm"."restaurant_id"
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."user_id" = "auth"."uid"()) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text"]))))));



CREATE POLICY "Public can view booking slots" ON "public"."booking_slots" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."restaurants" "r"
  WHERE (("r"."id" = "booking_slots"."restaurant_id") AND ("r"."is_active" = true)))));



CREATE POLICY "Public can view table inventory" ON "public"."table_inventory" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."restaurants" "r"
  WHERE (("r"."id" = "table_inventory"."restaurant_id") AND ("r"."is_active" = true)))));



CREATE POLICY "Restaurant staff can view analytics" ON "public"."analytics_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "analytics_events"."restaurant_id") AND ("rm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Restaurant staff can view booking versions" ON "public"."booking_versions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "booking_versions"."restaurant_id") AND ("rm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Service role can manage adjacencies" ON "public"."table_adjacencies" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage allocations" ON "public"."allocations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage allowed capacities" ON "public"."allowed_capacities" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage analytics events" ON "public"."analytics_events" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage audit logs" ON "public"."audit_logs" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage booking slots" ON "public"."booking_slots" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage booking versions" ON "public"."booking_versions" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage capacity rules" ON "public"."restaurant_capacity_rules" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage customer profiles" ON "public"."customer_profiles" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage loyalty events" ON "public"."loyalty_point_events" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage loyalty points" ON "public"."loyalty_points" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage loyalty programs" ON "public"."loyalty_programs" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage merge group members" ON "public"."merge_group_members" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage merge groups" ON "public"."merge_groups" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage merge rules" ON "public"."merge_rules" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage operating hours" ON "public"."restaurant_operating_hours" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage profiles" ON "public"."profiles" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage service periods" ON "public"."restaurant_service_periods" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage service policy" ON "public"."service_policy" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage stripe events" ON "public"."stripe_events" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage table assignments" ON "public"."booking_table_assignments" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage table inventory" ON "public"."table_inventory" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage zones" ON "public"."zones" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Staff can create bookings" ON "public"."bookings" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can create customers" ON "public"."customers" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage adjacencies" ON "public"."table_adjacencies" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."table_inventory" "ti"
  WHERE (("ti"."id" = "table_adjacencies"."table_a") AND ("ti"."restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."table_inventory" "ti"
  WHERE (("ti"."id" = "table_adjacencies"."table_a") AND ("ti"."restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))))));



CREATE POLICY "Staff can manage allowed capacities" ON "public"."allowed_capacities" TO "authenticated" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage booking slots" ON "public"."booking_slots" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage capacity rules" ON "public"."restaurant_capacity_rules" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage operating hours" ON "public"."restaurant_operating_hours" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage service periods" ON "public"."restaurant_service_periods" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage table assignments" ON "public"."booking_table_assignments" USING ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."id" = "booking_table_assignments"."booking_id") AND ("b"."restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."id" = "booking_table_assignments"."booking_id") AND ("b"."restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))))));



CREATE POLICY "Staff can manage table inventory" ON "public"."table_inventory" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage zones" ON "public"."zones" TO "authenticated" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can update bookings" ON "public"."bookings" FOR UPDATE USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can update customers" ON "public"."customers" FOR UPDATE USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can view allocations for their restaurants" ON "public"."allocations" FOR SELECT TO "authenticated" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can view bookings" ON "public"."bookings" FOR SELECT USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can view customer profiles" ON "public"."customer_profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."customers" "c"
  WHERE (("c"."id" = "customer_profiles"."customer_id") AND ("c"."restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))))));



CREATE POLICY "Staff can view customers" ON "public"."customers" FOR SELECT USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can view merge rules" ON "public"."merge_rules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Staff can view service policy" ON "public"."service_policy" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view memberships in their restaurants" ON "public"."restaurant_memberships" FOR SELECT USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."allocations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."allowed_capacities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon_read_all" ON "public"."restaurants" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_can_create" ON "public"."restaurants" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "authenticated_read_all" ON "public"."restaurants" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."booking_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_table_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_point_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_programs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merge_group_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merge_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merge_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owners_admins_can_update" ON "public"."restaurants" FOR UPDATE TO "authenticated" USING (("id" IN ( SELECT "rm"."restaurant_id"
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."user_id" = "auth"."uid"()) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text"])))))) WITH CHECK (("id" IN ( SELECT "rm"."restaurant_id"
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."user_id" = "auth"."uid"()) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text"]))))));



CREATE POLICY "owners_can_delete" ON "public"."restaurants" FOR DELETE TO "authenticated" USING (("id" IN ( SELECT "rm"."restaurant_id"
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."user_id" = "auth"."uid"()) AND ("rm"."role" = 'owner'::"text")))));



ALTER TABLE "public"."profile_update_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_update_requests_delete" ON "public"."profile_update_requests" FOR DELETE USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "profile_update_requests_insert" ON "public"."profile_update_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "profile_id"));



CREATE POLICY "profile_update_requests_select" ON "public"."profile_update_requests" FOR SELECT USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "profile_update_requests_update" ON "public"."profile_update_requests" FOR UPDATE USING (("auth"."uid"() = "profile_id")) WITH CHECK (("auth"."uid"() = "profile_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_capacity_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_operating_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_service_periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_policy" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_all_access" ON "public"."restaurants" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_read_all" ON "public"."restaurants" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "public"."stripe_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_adjacencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zones" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT CREATE ON SCHEMA "public" TO PUBLIC;
GRANT ALL ON SCHEMA "public" TO "anon";
GRANT ALL ON SCHEMA "public" TO "authenticated";
GRANT ALL ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."allocations_overlap"("a" "tstzrange", "b" "tstzrange") TO "service_role";



GRANT ALL ON FUNCTION "public"."allowed_capacities_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_booking_state_transition"("p_booking_id" "uuid", "p_status" "public"."booking_status", "p_checked_in_at" timestamp with time zone, "p_checked_out_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_history_from" "public"."booking_status", "p_history_to" "public"."booking_status", "p_history_changed_by" "uuid", "p_history_changed_at" timestamp with time zone, "p_history_reason" "text", "p_history_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."are_tables_connected"("table_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_table_to_booking"("p_booking_id" "uuid", "p_table_id" "uuid", "p_assigned_by" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange", "p_assigned_by" "uuid", "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."booking_status_summary"("p_restaurant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_status_filter" "public"."booking_status"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."capacity_metrics_hourly_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_with_capacity_check"("p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_idempotency_key" "text", "p_source" "text", "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."create_booking_with_capacity_check"("p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_idempotency_key" "text", "p_source" "text", "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_with_capacity_check"("p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_idempotency_key" "text", "p_source" "text", "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer) TO "anon";



GRANT ALL ON FUNCTION "public"."generate_booking_reference"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_booking_reference"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_booking_slot"("p_restaurant_id" "uuid", "p_slot_date" "date", "p_slot_time" time without time zone, "p_default_capacity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_booking_slot_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_capacity_metrics"("p_restaurant_id" "uuid", "p_window_start" timestamp with time zone, "p_success_delta" integer, "p_conflict_delta" integer, "p_capacity_exceeded_delta" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_table_assignment_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_allocations_refresh"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_booking_status_refresh"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_table_status"("p_table_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_booking_instants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_booking_reference"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_table_adjacency_symmetry"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unassign_table_from_booking"("p_booking_id" "uuid", "p_table_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."unassign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_merge_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_restaurants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_restaurants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_restaurants_admin"() TO "service_role";
GRANT ALL ON FUNCTION "public"."user_restaurants_admin"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."validate_merge_group_members"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_table_adjacency"() TO "service_role";


















GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."allocations" TO "service_role";
GRANT SELECT ON TABLE "public"."allocations" TO "authenticated";
GRANT SELECT ON TABLE "public"."allocations" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."allowed_capacities" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."allowed_capacities" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."analytics_events" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."booking_slots" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."booking_slots" TO "authenticated";
GRANT SELECT ON TABLE "public"."booking_slots" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."booking_state_history" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."booking_state_history_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."booking_table_assignments" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."booking_table_assignments" TO "authenticated";
GRANT SELECT ON TABLE "public"."booking_table_assignments" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."booking_versions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."bookings" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."bookings" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."capacity_metrics_hourly" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."customer_profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."customers" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."customers" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."loyalty_point_events" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."loyalty_points" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."loyalty_programs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."merge_group_members" TO "service_role";
GRANT SELECT ON TABLE "public"."merge_group_members" TO "authenticated";
GRANT SELECT ON TABLE "public"."merge_group_members" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."merge_groups" TO "service_role";
GRANT SELECT ON TABLE "public"."merge_groups" TO "authenticated";
GRANT SELECT ON TABLE "public"."merge_groups" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."merge_rules" TO "service_role";
GRANT SELECT ON TABLE "public"."merge_rules" TO "authenticated";
GRANT SELECT ON TABLE "public"."merge_rules" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profile_update_requests" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_capacity_rules" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_capacity_rules" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_invites" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_invites" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_memberships" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_memberships" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_operating_hours" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_operating_hours" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_service_periods" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_service_periods" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurants" TO "authenticated";
GRANT SELECT ON TABLE "public"."restaurants" TO "anon";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."service_policy" TO "service_role";
GRANT SELECT ON TABLE "public"."service_policy" TO "authenticated";
GRANT SELECT ON TABLE "public"."service_policy" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."stripe_events" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."table_adjacencies" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."table_adjacencies" TO "authenticated";
GRANT SELECT ON TABLE "public"."table_adjacencies" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."table_inventory" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."table_inventory" TO "authenticated";
GRANT SELECT ON TABLE "public"."table_inventory" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."zones" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."zones" TO "authenticated";
GRANT SELECT ON TABLE "public"."zones" TO "anon";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "service_role";



























RESET ALL;
