--
-- PostgreSQL database dump
--

\restrict CRPYErcjnwWznPC38W8bHc7sHof5tgvRtLMB9ZGehdSMrndzoObJdjLAy8VoXfE

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

-- Started on 2026-02-07 14:15:10 GMT

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
-- TOC entry 11 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- TOC entry 4797 (class 0 OID 0)
-- Dependencies: 11
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 1247 (class 1247 OID 17492)
-- Name: analytics_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.analytics_event_type AS ENUM (
    'booking.created',
    'booking.cancelled',
    'booking.allocated',
    'booking.waitlisted'
);


--
-- TOC entry 1250 (class 1247 OID 17502)
-- Name: booking_change_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_change_type AS ENUM (
    'created',
    'updated',
    'cancelled',
    'deleted'
);


--
-- TOC entry 1253 (class 1247 OID 17512)
-- Name: booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_status AS ENUM (
    'confirmed',
    'pending',
    'cancelled',
    'completed',
    'PRIORITY_WAITLIST',
    'no_show',
    'pending_allocation',
    'checked_in'
);


--
-- TOC entry 4798 (class 0 OID 0)
-- Dependencies: 1253
-- Name: TYPE booking_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.booking_status IS 'Lifecycle status of a booking (pending, confirmed, checked_in, completed, cancelled, no_show, etc).';


--
-- TOC entry 1256 (class 1247 OID 17530)
-- Name: capacity_override_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.capacity_override_type AS ENUM (
    'holiday',
    'event',
    'manual',
    'emergency'
);


--
-- TOC entry 1259 (class 1247 OID 17540)
-- Name: loyalty_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.loyalty_tier AS ENUM (
    'bronze',
    'silver',
    'gold',
    'platinum'
);


--
-- TOC entry 1262 (class 1247 OID 17550)
-- Name: manual_assignment_session_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.manual_assignment_session_state AS ENUM (
    'none',
    'proposed',
    'held',
    'confirmed',
    'expired',
    'conflicted',
    'cancelled'
);


--
-- TOC entry 1265 (class 1247 OID 17566)
-- Name: seating_preference_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.seating_preference_type AS ENUM (
    'any',
    'indoor',
    'outdoor',
    'bar',
    'window',
    'quiet',
    'booth'
);


--
-- TOC entry 1268 (class 1247 OID 17582)
-- Name: table_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_category AS ENUM (
    'bar',
    'dining',
    'lounge',
    'patio',
    'private'
);


--
-- TOC entry 1271 (class 1247 OID 17594)
-- Name: table_hold_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_hold_status AS ENUM (
    'active',
    'expired',
    'confirmed',
    'cancelled'
);


--
-- TOC entry 1274 (class 1247 OID 17604)
-- Name: table_mobility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_mobility AS ENUM (
    'movable',
    'fixed'
);


--
-- TOC entry 1277 (class 1247 OID 17610)
-- Name: table_seating_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_seating_type AS ENUM (
    'standard',
    'sofa',
    'booth',
    'high_top'
);


--
-- TOC entry 1280 (class 1247 OID 17620)
-- Name: table_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_status AS ENUM (
    'available',
    'reserved',
    'occupied',
    'out_of_service'
);


--
-- TOC entry 4799 (class 0 OID 0)
-- Dependencies: 1280
-- Name: TYPE table_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.table_status IS 'Status of a restaurant table: available, reserved (booked), occupied (guests seated), out_of_service (maintenance)';


--
-- TOC entry 480 (class 1255 OID 17629)
-- Name: allocations_overlap(tstzrange, tstzrange); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.allocations_overlap(a tstzrange, b tstzrange) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT COALESCE(a && b, false);
$$;


--
-- TOC entry 4800 (class 0 OID 0)
-- Dependencies: 480
-- Name: FUNCTION allocations_overlap(a tstzrange, b tstzrange); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.allocations_overlap(a tstzrange, b tstzrange) IS 'Returns true when two timestamptz ranges overlap (half-open [start,end) semantics).';


--
-- TOC entry 481 (class 1255 OID 17630)
-- Name: allowed_capacities_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.allowed_capacities_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;


--
-- TOC entry 482 (class 1255 OID 17631)
-- Name: apply_booking_state_transition(uuid, public.booking_status, timestamp with time zone, timestamp with time zone, timestamp with time zone, public.booking_status, public.booking_status, uuid, timestamp with time zone, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_booking_state_transition(p_booking_id uuid, p_status public.booking_status, p_checked_in_at timestamp with time zone, p_checked_out_at timestamp with time zone, p_updated_at timestamp with time zone, p_history_from public.booking_status, p_history_to public.booking_status, p_history_changed_by uuid, p_history_changed_at timestamp with time zone, p_history_reason text, p_history_metadata jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(status public.booking_status, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  DECLARE
    v_updated public.bookings%ROWTYPE;
    v_current public.booking_status;
    v_rows integer;
  BEGIN
    UPDATE public.bookings
    SET status = p_status,
        checked_in_at = p_checked_in_at,
        checked_out_at = p_checked_out_at,
        updated_at = p_updated_at
    WHERE id = p_booking_id
      AND public.bookings.status = p_history_from
    RETURNING * INTO v_updated;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      SELECT status INTO v_current FROM public.bookings WHERE id = p_booking_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
      END IF;
      RAISE EXCEPTION 'booking_state_conflict'
        USING ERRCODE = 'P0004',
              DETAIL = format('Current status %s does not match expected %s', v_current, p_history_from);
    END IF;

    INSERT INTO public.booking_state_history (
      booking_id, from_status, to_status, changed_by, changed_at, reason, metadata
    ) VALUES (
      p_booking_id, p_history_from, p_history_to, p_history_changed_by, p_history_changed_at, p_history_reason, COALESCE(p_history_metadata, '{}'::jsonb)
    );

    RETURN QUERY SELECT v_updated.status, v_updated.checked_in_at, v_updated.checked_out_at, v_updated.updated_at;
  END;
$$;


--
-- TOC entry 483 (class 1255 OID 17632)
-- Name: are_tables_connected(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.are_tables_connected(table_ids uuid[]) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
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


--
-- TOC entry 484 (class 1255 OID 17633)
-- Name: assign_merged_tables(uuid, uuid[], boolean, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_merged_tables(p_booking_id uuid, p_table_ids uuid[], p_require_adjacency boolean DEFAULT true, p_assigned_by uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_table_count integer;
BEGIN
  v_table_count := COALESCE(array_length(p_table_ids, 1), 0);

  IF v_table_count < 2 THEN
    RAISE EXCEPTION 'assign_merged_tables requires at least two table ids.';
  END IF;

  PERFORM public.assign_tables_atomic_v2(
    p_booking_id := p_booking_id,
    p_table_ids := p_table_ids,
    p_idempotency_key := p_idempotency_key,
    p_require_adjacency := p_require_adjacency,
    p_assigned_by := p_assigned_by
  );
END;
$$;


--
-- TOC entry 4801 (class 0 OID 0)
-- Dependencies: 484
-- Name: FUNCTION assign_merged_tables(p_booking_id uuid, p_table_ids uuid[], p_require_adjacency boolean, p_assigned_by uuid, p_idempotency_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_merged_tables(p_booking_id uuid, p_table_ids uuid[], p_require_adjacency boolean, p_assigned_by uuid, p_idempotency_key text) IS 'Atomically assigns multiple tables to a booking with optional adjacency enforcement.';


--
-- TOC entry 485 (class 1255 OID 17634)
-- Name: assign_single_table(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_single_table(p_booking_id uuid, p_table_id uuid, p_assigned_by uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_table_id IS NULL THEN
    RAISE EXCEPTION 'assign_single_table requires a table id.';
  END IF;

  PERFORM public.assign_tables_atomic_v2(
    p_booking_id := p_booking_id,
    p_table_ids := ARRAY[p_table_id],
    p_idempotency_key := p_idempotency_key,
    p_require_adjacency := false,
    p_assigned_by := p_assigned_by
  );
END;
$$;


--
-- TOC entry 4802 (class 0 OID 0)
-- Dependencies: 485
-- Name: FUNCTION assign_single_table(p_booking_id uuid, p_table_id uuid, p_assigned_by uuid, p_idempotency_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_single_table(p_booking_id uuid, p_table_id uuid, p_assigned_by uuid, p_idempotency_key text) IS 'Atomically assigns a single table to a booking; preferred entrypoint for standard seating.';


--
-- TOC entry 486 (class 1255 OID 17635)
-- Name: assign_tables_atomic(uuid, uuid[], tstzrange, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_tables_atomic(p_booking_id uuid, p_table_ids uuid[], p_window tstzrange, p_assigned_by uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text) RETURNS TABLE(table_id uuid, assignment_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
    DECLARE
      v_booking RECORD;
      v_restaurant_id uuid;
      v_target_tables uuid[];
      v_target_table uuid;
      v_existing_tables uuid[];
      v_table RECORD;
      v_slot_id uuid := NULL;
      v_now timestamptz := now();
      v_window tstzrange := p_window;
      v_assignment_id uuid;
      v_lock_restaurant int4;
      v_lock_date int4;
    BEGIN
      IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
        RAISE EXCEPTION 'assign_tables_atomic requires at least one table id'
          USING ERRCODE = '23514';
      END IF;

      SELECT array_agg(DISTINCT table_id ORDER BY table_id)
      INTO v_target_tables
      FROM unnest(p_table_ids) AS t(table_id);

      IF v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0 THEN
        RAISE EXCEPTION 'assign_tables_atomic requires at least one valid table id'
          USING ERRCODE = '23514';
      END IF;

      IF array_length(v_target_tables, 1) > 1 THEN
        RAISE EXCEPTION 'assign_tables_atomic only supports a single table after merge removal'
          USING ERRCODE = '23514';
      END IF;

      v_target_table := v_target_tables[1];

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
          IF v_existing_tables <> v_target_tables THEN
            RAISE EXCEPTION 'assign_tables_atomic idempotency key mismatch'
              USING ERRCODE = 'P0003',
                    DETAIL = 'Idempotency key reuse detected with a different table id';
          END IF;

          RETURN QUERY
            SELECT
              bta.table_id,
              bta.id AS assignment_id
            FROM public.booking_table_assignments bta
            WHERE bta.booking_id = p_booking_id
              AND bta.idempotency_key = p_idempotency_key;

          RETURN;
        END IF;
      END IF;

      SELECT id, restaurant_id
      INTO v_table
      FROM public.table_inventory
      WHERE id = v_target_table
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Table % not found', v_target_table
          USING ERRCODE = 'P0002';
      END IF;

      IF v_table.restaurant_id <> v_restaurant_id THEN
        RAISE EXCEPTION 'Table % belongs to a different restaurant', v_target_table
          USING ERRCODE = '23503';
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

      INSERT INTO public.booking_table_assignments (
        booking_id,
        table_id,
        slot_id,
        assigned_by,
        idempotency_key
      ) VALUES (
        p_booking_id,
        v_target_table,
        v_slot_id,
        p_assigned_by,
        p_idempotency_key
      )
      ON CONFLICT (booking_id, table_id) DO UPDATE
      SET assigned_by = EXCLUDED.assigned_by,
          assigned_at = v_now,
          idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key)
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
          v_target_table,
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
                  DETAIL = format('Resource %s overlaps requested window for booking %s', v_target_table, p_booking_id);
      END;

      UPDATE public.table_inventory
      SET status = 'reserved'::public.table_status
      WHERE id = v_target_table;

      table_id := v_target_table;
      assignment_id := v_assignment_id;
      RETURN NEXT;
    END;
    $$;


--
-- TOC entry 4803 (class 0 OID 0)
-- Dependencies: 486
-- Name: FUNCTION assign_tables_atomic(p_booking_id uuid, p_table_ids uuid[], p_window tstzrange, p_assigned_by uuid, p_idempotency_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_tables_atomic(p_booking_id uuid, p_table_ids uuid[], p_window tstzrange, p_assigned_by uuid, p_idempotency_key text) IS 'DEPRECATED: prefer assign_single_table() or assign_merged_tables().';


--
-- TOC entry 487 (class 1255 OID 17637)
-- Name: assign_tables_atomic_v2(uuid, uuid[], text, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text DEFAULT NULL::text, p_require_adjacency boolean DEFAULT false, p_assigned_by uuid DEFAULT NULL::uuid) RETURNS TABLE(table_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, merge_group_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DECLARE
    v_booking RECORD;
    v_zone_id uuid;
    v_restaurant_id uuid;
    v_service_date date;
    v_lock_zone int4;
    v_lock_date int4;
    v_now timestamptz := timezone('utc', now());
    v_table_ids uuid[];
    v_table_count integer;
    v_table RECORD;
    v_loaded_count integer := 0;
    v_slot_id uuid := NULL;
    v_start_at timestamptz;
    v_end_at timestamptz;
    v_window tstzrange;
    v_timezone text := NULL;
    v_hold_conflict uuid;
    v_merge_allocation_id uuid := NULL;
    v_table_assignment_id uuid;
    v_existing RECORD;
    v_adjacency_count integer;
    v_table_id uuid;
    v_merge_group_supported boolean := false;
  BEGIN
    IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
      RAISE EXCEPTION 'assign_tables_atomic_v2 requires at least one table id'
        USING ERRCODE = '23514';
    END IF;

    SELECT array_agg(DISTINCT t.table_id ORDER BY t.table_id)
    INTO v_table_ids
    FROM unnest(p_table_ids) AS t(table_id);

    IF v_table_ids IS NULL OR array_length(v_table_ids, 1) = 0 THEN
      RAISE EXCEPTION 'assign_tables_atomic_v2 requires at least one valid table id'
        USING ERRCODE = '23514';
    END IF;

    v_table_count := array_length(v_table_ids, 1);

    SELECT
      b.*,
      r.timezone AS restaurant_timezone
    INTO v_booking
    FROM public.bookings b
    LEFT JOIN public.restaurants r ON r.id = b.restaurant_id
    WHERE b.id = p_booking_id
    FOR UPDATE OF b;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking % not found', p_booking_id
        USING ERRCODE = 'P0002';
    END IF;

    v_restaurant_id := v_booking.restaurant_id;
    v_timezone := COALESCE(NULLIF(v_booking.restaurant_timezone, ''), 'UTC');

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'booking_table_assignments'
        AND column_name = 'merge_group_id'
    )
    INTO v_merge_group_supported;

    IF v_booking.start_at IS NOT NULL AND v_booking.end_at IS NOT NULL THEN
      v_start_at := v_booking.start_at;
      v_end_at := v_booking.end_at;
    ELSIF v_booking.booking_date IS NOT NULL AND v_booking.start_time IS NOT NULL AND v_booking.end_time IS NOT NULL THEN
      v_start_at := make_timestamptz(
        EXTRACT(YEAR FROM v_booking.booking_date)::int,
        EXTRACT(MONTH FROM v_booking.booking_date)::int,
        EXTRACT(DAY FROM v_booking.booking_date)::int,
        EXTRACT(HOUR FROM v_booking.start_time)::int,
        EXTRACT(MINUTE FROM v_booking.start_time)::int,
        EXTRACT(SECOND FROM v_booking.start_time),
        v_timezone
      );
      v_end_at := make_timestamptz(
        EXTRACT(YEAR FROM v_booking.booking_date)::int,
        EXTRACT(MONTH FROM v_booking.booking_date)::int,
        EXTRACT(DAY FROM v_booking.booking_date)::int,
        EXTRACT(HOUR FROM v_booking.end_time)::int,
        EXTRACT(MINUTE FROM v_booking.end_time)::int,
        EXTRACT(SECOND FROM v_booking.end_time),
        v_timezone
      );
    ELSE
      RAISE EXCEPTION 'Booking % missing start/end window', p_booking_id
        USING ERRCODE = '22000';
    END IF;

    IF v_start_at >= v_end_at THEN
      RAISE EXCEPTION 'Booking % has invalid time window', p_booking_id
        USING ERRCODE = '22000';
    END IF;

    v_window := tstzrange(v_start_at, v_end_at, '[)');

    FOR v_table IN
      SELECT id, restaurant_id, zone_id, active, status, mobility
      FROM public.table_inventory
      WHERE id = ANY (v_table_ids)
      ORDER BY id
      FOR UPDATE
    LOOP
      IF v_table.restaurant_id <> v_restaurant_id THEN
        RAISE EXCEPTION 'Table % belongs to a different restaurant', v_table.id
          USING ERRCODE = '23503';
      END IF;

      IF v_table.zone_id IS NULL THEN
        RAISE EXCEPTION 'Table % is not assigned to a zone', v_table.id
          USING ERRCODE = '23514';
      END IF;

      IF v_table.active IS NOT TRUE THEN
        RAISE EXCEPTION 'Table % is inactive', v_table.id
          USING ERRCODE = '23514';
      END IF;

      IF v_zone_id IS NULL THEN
        v_zone_id := v_table.zone_id;
      ELSIF v_zone_id <> v_table.zone_id THEN
        RAISE EXCEPTION 'All tables must belong to the same zone (found %, expected %)', v_table.zone_id, v_zone_id
          USING ERRCODE = '23514';
      END IF;

      IF v_table_count > 1 AND v_table.mobility <> 'movable'::public.table_mobility THEN
        RAISE EXCEPTION 'Merged assignments require movable tables (% is %)', v_table.id, v_table.mobility
          USING ERRCODE = '23514';
      END IF;

      v_loaded_count := v_loaded_count + 1;
    END LOOP;

    IF v_loaded_count <> v_table_count THEN
      RAISE EXCEPTION 'Unable to load all requested tables for booking %', p_booking_id
        USING ERRCODE = 'P0002';
    END IF;

    IF p_require_adjacency AND v_table_count > 1 THEN
      FOR v_table IN
        SELECT id FROM unnest(v_table_ids) AS t(id)
      LOOP
        SELECT COUNT(*)
        INTO v_adjacency_count
        FROM public.table_adjacencies
        WHERE table_a = v_table.id
          AND table_b = ANY (v_table_ids)
          AND table_b <> v_table.id;

        IF COALESCE(v_adjacency_count, 0) = 0 THEN
          RAISE EXCEPTION 'Table % is not adjacent to the selected set', v_table.id
            USING ERRCODE = '23514';
        END IF;
      END LOOP;
    END IF;

    v_service_date := v_booking.booking_date;
    IF v_service_date IS NULL THEN
      v_service_date := (v_start_at AT TIME ZONE v_timezone)::date;
    END IF;

    v_lock_zone := hashtext(COALESCE(v_zone_id::text, ''));
    v_lock_date := COALESCE((v_service_date - DATE '2000-01-01')::int, 0);
    PERFORM pg_advisory_xact_lock(v_lock_zone, v_lock_date);

    IF p_idempotency_key IS NOT NULL THEN
      SELECT *
      INTO v_existing
      FROM public.booking_assignment_idempotency
      WHERE booking_id = p_booking_id
        AND idempotency_key = p_idempotency_key;

      IF FOUND THEN
        IF v_existing.table_ids IS NULL OR array_length(v_existing.table_ids, 1) <> v_table_count
           OR (SELECT array_agg(elem ORDER BY elem) FROM unnest(v_existing.table_ids) AS e(elem))
              <> (SELECT array_agg(elem ORDER BY elem) FROM unnest(v_table_ids) AS e(elem)) THEN
          RAISE EXCEPTION 'assign_tables_atomic_v2 idempotency mismatch for booking %', p_booking_id
            USING ERRCODE = 'P0003',
                  DETAIL = 'Idempotency key reuse detected with a different table set';
        END IF;

        RETURN QUERY
          SELECT
            bta.table_id,
            lower(v_existing.assignment_window) AS start_at,
            upper(v_existing.assignment_window) AS end_at,
            v_existing.merge_group_allocation_id
          FROM public.booking_table_assignments bta
          WHERE bta.booking_id = p_booking_id
            AND bta.idempotency_key = p_idempotency_key
            AND bta.table_id = ANY (v_table_ids)
          ORDER BY bta.table_id;

        RETURN;
      END IF;
    END IF;

    SELECT th.id
    INTO v_hold_conflict
    FROM public.table_holds th
    JOIN public.table_hold_members thm ON thm.hold_id = th.id
    WHERE thm.table_id = ANY (v_table_ids)
      AND th.expires_at > v_now
      AND (th.booking_id IS NULL OR th.booking_id <> p_booking_id)
      AND tstzrange(th.start_at, th.end_at, '[)') && v_window
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'Hold conflict prevents assignment for booking %', p_booking_id
        USING ERRCODE = 'P0001',
              DETAIL = format('Hold % overlaps requested window', v_hold_conflict),
              HINT = 'Retry after hold expiration or confirm existing hold.';
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

    IF v_merge_group_supported AND v_table_count > 1 THEN
      v_merge_allocation_id := gen_random_uuid();

      BEGIN
        INSERT INTO public.allocations (
          id,
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
          v_merge_allocation_id,
          p_booking_id,
          v_restaurant_id,
          'merge_group',
          v_merge_allocation_id,
          v_window,
          p_assigned_by,
          false,
          v_now,
          v_now
        )
        ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
        SET "window" = EXCLUDED."window",
            created_by = COALESCE(EXCLUDED.created_by, public.allocations.created_by),
            updated_at = v_now;
      EXCEPTION
        WHEN unique_violation OR exclusion_violation THEN
          RAISE EXCEPTION 'allocations_no_overlap'
            USING ERRCODE = 'P0001',
                  DETAIL = format('Merge group overlaps requested window for booking %s', p_booking_id);
      END;
    END IF;

    FOREACH v_table_id IN ARRAY v_table_ids LOOP
      IF v_merge_group_supported THEN
        BEGIN
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
            v_merge_allocation_id
          )
          ON CONFLICT ON CONSTRAINT booking_table_assignments_booking_table_key DO UPDATE
          SET assigned_at = v_now,
              assigned_by = COALESCE(EXCLUDED.assigned_by, public.booking_table_assignments.assigned_by),
              idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key),
              merge_group_id = COALESCE(EXCLUDED.merge_group_id, public.booking_table_assignments.merge_group_id),
              slot_id = COALESCE(EXCLUDED.slot_id, public.booking_table_assignments.slot_id)
          RETURNING id INTO v_table_assignment_id;
        EXCEPTION
          WHEN unique_violation THEN
            RAISE EXCEPTION 'assign_tables_atomic_v2 assignment duplicate for table %', v_table_id
              USING ERRCODE = 'P0001';
        END;
      ELSE
        BEGIN
          INSERT INTO public.booking_table_assignments (
            booking_id,
            table_id,
            slot_id,
            assigned_by,
            idempotency_key
          ) VALUES (
            p_booking_id,
            v_table_id,
            v_slot_id,
            p_assigned_by,
            p_idempotency_key
          )
          ON CONFLICT ON CONSTRAINT booking_table_assignments_booking_table_key DO UPDATE
          SET assigned_at = v_now,
              assigned_by = COALESCE(EXCLUDED.assigned_by, public.booking_table_assignments.assigned_by),
              idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key),
              slot_id = COALESCE(EXCLUDED.slot_id, public.booking_table_assignments.slot_id)
          RETURNING id INTO v_table_assignment_id;
        EXCEPTION
          WHEN unique_violation THEN
            RAISE EXCEPTION 'assign_tables_atomic_v2 assignment duplicate for table %', v_table_id
              USING ERRCODE = 'P0001';
        END;
      END IF;

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
            created_by = COALESCE(EXCLUDED.created_by, public.allocations.created_by),
            updated_at = v_now;
      EXCEPTION
        WHEN unique_violation OR exclusion_violation THEN
          RAISE EXCEPTION 'allocations_no_overlap'
            USING ERRCODE = 'P0001',
                  DETAIL = format('Resource %s overlaps requested window for booking %s', v_table_id, p_booking_id);
      END;

      PERFORM public.refresh_table_status(v_table_id);

      table_id := v_table_id;
      start_at := v_start_at;
      end_at := v_end_at;
      merge_group_id := CASE WHEN v_merge_group_supported THEN v_merge_allocation_id ELSE NULL END;
      RETURN NEXT;
    END LOOP;

    IF p_idempotency_key IS NOT NULL THEN
      INSERT INTO public.booking_assignment_idempotency (
        booking_id,
        idempotency_key,
        table_ids,
        assignment_window,
        merge_group_allocation_id,
        created_at
      ) VALUES (
        p_booking_id,
        p_idempotency_key,
        v_table_ids,
        v_window,
        v_merge_allocation_id,
        v_now
      )
      ON CONFLICT (booking_id, idempotency_key) DO NOTHING;
    END IF;
  END;
  $$;


--
-- TOC entry 4804 (class 0 OID 0)
-- Dependencies: 487
-- Name: FUNCTION assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid) IS 'DEPRECATED: prefer assign_single_table() or assign_merged_tables().';


--
-- TOC entry 488 (class 1255 OID 17639)
-- Name: assign_tables_atomic_v2(uuid, uuid[], text, boolean, uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text DEFAULT NULL::text, p_require_adjacency boolean DEFAULT false, p_assigned_by uuid DEFAULT NULL::uuid, p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(table_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, merge_group_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_booking RECORD;
  v_zone_id uuid;
  v_restaurant_id uuid;
  v_service_date date;
  v_lock_zone int4;
  v_lock_bucket int4;
  v_now timestamptz := timezone('utc', now());
  v_table_ids uuid[];
  v_table_count integer;
  v_table RECORD;
  v_loaded_count integer := 0;
  v_slot_id uuid := NULL;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_window tstzrange;
  v_timezone text := NULL;
  v_merge_allocation_id uuid := NULL;
  v_table_assignment_id uuid;
  v_existing RECORD;
  v_adjacency_count integer;
  v_table_id uuid;
  v_merge_group_supported boolean := false;
  v_conflict RECORD;
  v_existing_zones uuid[] := ARRAY[]::uuid[];
  v_table_set_hash text;
  v_hold_conflict uuid;
  v_allocation_id uuid;
  v_capacity_check_enabled boolean := true;
  v_bucket_minutes integer := 60;
BEGIN
  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 requires at least one table id'
      USING ERRCODE = '23514';
  END IF;

  SELECT array_agg(DISTINCT t.table_id ORDER BY t.table_id)
  INTO v_table_ids
  FROM unnest(p_table_ids) AS t(table_id);

  IF v_table_ids IS NULL OR array_length(v_table_ids, 1) = 0 THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 requires at least one valid table id'
      USING ERRCODE = '23514';
  END IF;

  v_table_count := array_length(v_table_ids, 1);
  v_table_set_hash := md5(array_to_string(v_table_ids, ','));

  SELECT b.*, r.timezone AS restaurant_timezone
  INTO v_booking
  FROM public.bookings b
  LEFT JOIN public.restaurants r ON r.id = b.restaurant_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id
      USING ERRCODE = 'P0002';
  END IF;

  v_restaurant_id := v_booking.restaurant_id;
  v_timezone := COALESCE(NULLIF(v_booking.restaurant_timezone, ''), 'UTC');

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_table_assignments'
      AND column_name = 'merge_group_id'
  ) INTO v_merge_group_supported;

  IF (p_start_at IS NULL) <> (p_end_at IS NULL) THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 requires both start and end when providing custom window'
      USING ERRCODE = '22023';
  END IF;

  IF p_start_at IS NOT NULL AND p_end_at IS NOT NULL THEN
    v_start_at := p_start_at;
    v_end_at := p_end_at;
  ELSIF v_booking.start_at IS NOT NULL AND v_booking.end_at IS NOT NULL THEN
    v_start_at := v_booking.start_at;
    v_end_at := v_booking.end_at;
  ELSIF v_booking.booking_date IS NOT NULL AND v_booking.start_time IS NOT NULL AND v_booking.end_time IS NOT NULL THEN
    v_start_at := make_timestamptz(
      EXTRACT(YEAR FROM v_booking.booking_date)::int,
      EXTRACT(MONTH FROM v_booking.booking_date)::int,
      EXTRACT(DAY FROM v_booking.booking_date)::int,
      EXTRACT(HOUR FROM v_booking.start_time)::int,
      EXTRACT(MINUTE FROM v_booking.start_time)::int,
      EXTRACT(SECOND FROM v_booking.start_time),
      v_timezone
    );
    v_end_at := make_timestamptz(
      EXTRACT(YEAR FROM v_booking.booking_date)::int,
      EXTRACT(MONTH FROM v_booking.booking_date)::int,
      EXTRACT(DAY FROM v_booking.booking_date)::int,
      EXTRACT(HOUR FROM v_booking.end_time)::int,
      EXTRACT(MINUTE FROM v_booking.end_time)::int,
      EXTRACT(SECOND FROM v_booking.end_time),
      v_timezone
    );
  ELSE
    RAISE EXCEPTION 'Booking % missing start/end window', p_booking_id
      USING ERRCODE = '22000';
  END IF;

  IF v_start_at >= v_end_at THEN
    RAISE EXCEPTION 'Booking % has invalid time window', p_booking_id
      USING ERRCODE = '22000';
  END IF;

  v_window := tstzrange(v_start_at, v_end_at, '[)');
  v_service_date := (v_start_at AT TIME ZONE v_timezone)::date;

  FOR v_table IN
    SELECT id, restaurant_id, zone_id, active, status, mobility
    FROM public.table_inventory
    WHERE id = ANY (v_table_ids)
    ORDER BY id
    FOR UPDATE
  LOOP
    IF v_table.restaurant_id <> v_restaurant_id THEN
      RAISE EXCEPTION 'Table % belongs to a different restaurant', v_table.id
        USING ERRCODE = '23503';
    END IF;

    IF v_table.zone_id IS NULL THEN
      RAISE EXCEPTION 'Table % is not assigned to a zone', v_table.id
        USING ERRCODE = '23514';
    END IF;

    IF v_table.active IS NOT TRUE THEN
      RAISE EXCEPTION 'Table % is inactive', v_table.id
        USING ERRCODE = '23514';
    END IF;

    IF v_zone_id IS NULL THEN
      v_zone_id := v_table.zone_id;
    ELSIF v_zone_id <> v_table.zone_id THEN
      RAISE EXCEPTION 'All tables must belong to the same zone (found %, expected %)', v_table.zone_id, v_zone_id
        USING ERRCODE = '23514';
    END IF;

    IF v_table_count > 1 AND v_table.mobility <> 'movable'::public.table_mobility THEN
      RAISE EXCEPTION 'Merged assignments require movable tables (% is %)', v_table.id, v_table.mobility
        USING ERRCODE = '23514';
    END IF;

    v_loaded_count := v_loaded_count + 1;
  END LOOP;

  IF v_loaded_count <> v_table_count THEN
    RAISE EXCEPTION 'Unable to load all requested tables for booking %', p_booking_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT array_agg(DISTINCT ti.zone_id)
  INTO v_existing_zones
  FROM public.booking_table_assignments existing
  JOIN public.table_inventory ti ON ti.id = existing.table_id
  WHERE existing.booking_id = p_booking_id;

  IF array_length(v_existing_zones, 1) IS NOT NULL AND array_length(v_existing_zones, 1) > 0 THEN
    IF v_zone_id IS NULL OR EXISTS (
      SELECT 1 FROM unnest(v_existing_zones) AS z WHERE z IS DISTINCT FROM v_zone_id
    ) THEN
      RAISE EXCEPTION 'Booking % already has assignments in a different zone', p_booking_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_booking.assigned_zone_id IS NULL THEN
    UPDATE public.bookings
    SET assigned_zone_id = v_zone_id,
        updated_at = v_now
    WHERE id = p_booking_id;
  ELSIF v_booking.assigned_zone_id IS DISTINCT FROM v_zone_id THEN
    RAISE EXCEPTION 'Booking % locked to zone %, cannot assign zone %', p_booking_id, v_booking.assigned_zone_id, v_zone_id
      USING ERRCODE = '23514';
  END IF;

  IF p_require_adjacency AND v_table_count > 1 THEN
    FOR v_table IN
      SELECT id FROM unnest(v_table_ids) AS t(id)
    LOOP
      SELECT COUNT(*)
      INTO v_adjacency_count
      FROM public.table_adjacencies
      WHERE (
        table_a = v_table.id AND table_b = ANY (v_table_ids) AND table_b <> v_table.id
      ) OR (
        table_b = v_table.id AND table_a = ANY (v_table_ids) AND table_a <> v_table.id
      );

      IF COALESCE(v_adjacency_count, 0) = 0 THEN
        RAISE EXCEPTION 'Table % is not adjacent to the selected set', v_table.id
          USING ERRCODE = '23514';
      END IF;
    END LOOP;
  END IF;

  v_lock_zone := hashtext(COALESCE(v_zone_id::text, ''));
  v_lock_bucket := COALESCE((EXTRACT(EPOCH FROM date_trunc('hour', v_start_at))::bigint / 60)::int, 0);
  PERFORM pg_advisory_xact_lock(v_lock_zone, v_lock_bucket);

  IF p_idempotency_key IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.booking_assignment_idempotency
    WHERE booking_id = p_booking_id
      AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      IF v_existing.table_set_hash IS DISTINCT FROM v_table_set_hash THEN
        RAISE EXCEPTION 'assign_tables_atomic_v2 idempotency mismatch for booking %', p_booking_id
          USING ERRCODE = 'P0003',
                DETAIL = 'Idempotency key reuse detected with a different table set';
      END IF;

      RETURN QUERY
        SELECT
          bta.table_id,
          COALESCE(bta.start_at, lower(v_existing.assignment_window)) AS start_at,
          COALESCE(bta.end_at, upper(v_existing.assignment_window)) AS end_at,
          v_existing.merge_group_allocation_id
        FROM public.booking_table_assignments bta
        WHERE bta.booking_id = p_booking_id
          AND bta.idempotency_key = p_idempotency_key
          AND bta.table_id = ANY (v_table_ids)
        ORDER BY bta.table_id;

      RETURN;
    END IF;
  END IF;

  SELECT th.id
  INTO v_hold_conflict
  FROM public.table_hold_windows thw
  JOIN public.table_holds th ON th.id = thw.hold_id
  WHERE thw.table_id = ANY (v_table_ids)
    AND thw.expires_at > v_now
    AND (th.booking_id IS NULL OR th.booking_id <> p_booking_id)
    AND thw.hold_window && v_window
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Hold conflict prevents assignment for booking %', p_booking_id
      USING ERRCODE = 'P0001',
            DETAIL = format('Hold % overlaps requested window', v_hold_conflict),
            HINT = 'Retry after hold expiration or confirm existing hold.';
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

  IF v_merge_group_supported AND v_table_count > 1 THEN
    v_merge_allocation_id := gen_random_uuid();

    BEGIN
      INSERT INTO public.allocations (
        id,
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
        v_merge_allocation_id,
        p_booking_id,
        v_restaurant_id,
        'merge_group',
        v_merge_allocation_id,
        v_window,
        p_assigned_by,
        false,
        v_now,
        v_now
      )
      ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
      SET "window" = EXCLUDED."window",
          created_by = COALESCE(EXCLUDED.created_by, public.allocations.created_by),
          updated_at = v_now;
    EXCEPTION
      WHEN unique_violation OR exclusion_violation THEN
        RAISE EXCEPTION 'allocations_no_overlap'
          USING ERRCODE = 'P0001',
                DETAIL = format('Merge group overlaps requested window for booking %s', p_booking_id);
    END;
  END IF;

  FOREACH v_table_id IN ARRAY v_table_ids LOOP
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
          created_by = COALESCE(EXCLUDED.created_by, public.allocations.created_by),
          shadow = false,
          updated_at = v_now
      RETURNING id INTO v_allocation_id;
    EXCEPTION
      WHEN unique_violation OR exclusion_violation THEN
        RAISE EXCEPTION 'allocations_no_overlap'
          USING ERRCODE = 'P0001',
                DETAIL = format('Resource %s overlaps requested window for booking %s', v_table_id, p_booking_id);
    END;

    BEGIN
      INSERT INTO public.booking_table_assignments (
        booking_id,
        table_id,
        slot_id,
        assigned_by,
        idempotency_key,
        merge_group_id,
        start_at,
        end_at,
        allocation_id
      ) VALUES (
        p_booking_id,
        v_table_id,
        v_slot_id,
        p_assigned_by,
        p_idempotency_key,
        v_merge_allocation_id,
        v_start_at,
        v_end_at,
        v_allocation_id
      )
      ON CONFLICT ON CONSTRAINT booking_table_assignments_booking_table_key DO UPDATE
      SET assigned_at = v_now,
          assigned_by = COALESCE(EXCLUDED.assigned_by, public.booking_table_assignments.assigned_by),
          idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key),
          merge_group_id = COALESCE(EXCLUDED.merge_group_id, public.booking_table_assignments.merge_group_id),
          slot_id = COALESCE(EXCLUDED.slot_id, public.booking_table_assignments.slot_id),
          start_at = EXCLUDED.start_at,
          end_at = EXCLUDED.end_at,
          allocation_id = EXCLUDED.allocation_id,
          updated_at = v_now
      RETURNING id INTO v_table_assignment_id;
    EXCEPTION
      WHEN unique_violation THEN
        UPDATE public.booking_table_assignments AS bta
        SET assigned_at = v_now,
            assigned_by = COALESCE(p_assigned_by, bta.assigned_by),
            idempotency_key = COALESCE(p_idempotency_key, bta.idempotency_key),
            merge_group_id = COALESCE(v_merge_allocation_id, bta.merge_group_id),
            slot_id = COALESCE(v_slot_id, bta.slot_id),
            start_at = v_start_at,
            end_at = v_end_at,
            allocation_id = COALESCE(v_allocation_id, bta.allocation_id),
            updated_at = v_now
        WHERE bta.booking_id = p_booking_id
          AND bta.table_id = v_table_id
        RETURNING bta.id INTO v_table_assignment_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'assign_tables_atomic_v2 assignment duplicate for table %', v_table_id
            USING ERRCODE = 'P0001';
        END IF;
    END;

    PERFORM public.refresh_table_status(v_table_id);

    table_id := v_table_id;
    start_at := v_start_at;
    end_at := v_end_at;
    merge_group_id := CASE WHEN v_merge_group_supported THEN v_merge_allocation_id ELSE NULL END;
    RETURN NEXT;
  END LOOP;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.booking_assignment_idempotency (
      booking_id,
      idempotency_key,
      table_ids,
      assignment_window,
      merge_group_allocation_id,
      table_set_hash,
      created_at
    ) VALUES (
      p_booking_id,
      p_idempotency_key,
      v_table_ids,
      v_window,
      v_merge_allocation_id,
      v_table_set_hash,
      v_now
    )
    ON CONFLICT (booking_id, idempotency_key) DO UPDATE
      SET table_ids = EXCLUDED.table_ids,
          assignment_window = EXCLUDED.assignment_window,
          merge_group_allocation_id = EXCLUDED.merge_group_allocation_id,
          table_set_hash = EXCLUDED.table_set_hash;
  END IF;

  IF current_setting('app.capacity.post_assignment.enabled', true) = 'off' THEN
    v_capacity_check_enabled := false;
  END IF;

  IF v_capacity_check_enabled THEN
    PERFORM public.validate_booking_capacity_after_assignment(p_booking_id);
  END IF;
END;
$$;


--
-- TOC entry 4805 (class 0 OID 0)
-- Dependencies: 488
-- Name: FUNCTION assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone) IS 'DEPRECATED: prefer assign_single_table() or assign_merged_tables().';


--
-- TOC entry 489 (class 1255 OID 17641)
-- Name: booking_status_summary(uuid, date, date, public.booking_status[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.booking_status_summary(p_restaurant_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_status_filter public.booking_status[] DEFAULT NULL::public.booking_status[]) RETURNS TABLE(status public.booking_status, total bigint)
    LANGUAGE sql
    SET search_path TO 'public', 'extensions'
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


--
-- TOC entry 4806 (class 0 OID 0)
-- Dependencies: 489
-- Name: FUNCTION booking_status_summary(p_restaurant_id uuid, p_start_date date, p_end_date date, p_status_filter public.booking_status[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.booking_status_summary(p_restaurant_id uuid, p_start_date date, p_end_date date, p_status_filter public.booking_status[]) IS 'Returns aggregated booking counts by status for a restaurant across an optional date range and status filter.';


--
-- TOC entry 490 (class 1255 OID 17642)
-- Name: confirm_hold_assignment_tx(uuid, uuid, text, boolean, uuid, timestamp with time zone, timestamp with time zone, text, text, public.booking_status, text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_hold_assignment_tx(p_hold_id uuid, p_booking_id uuid, p_idempotency_key text, p_require_adjacency boolean DEFAULT false, p_assigned_by uuid DEFAULT NULL::uuid, p_window_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_window_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_expected_policy_version text DEFAULT NULL::text, p_expected_adjacency_hash text DEFAULT NULL::text, p_target_status public.booking_status DEFAULT NULL::public.booking_status, p_history_reason text DEFAULT 'auto_assign_confirm'::text, p_history_metadata jsonb DEFAULT '{}'::jsonb, p_history_changed_by uuid DEFAULT NULL::uuid) RETURNS TABLE(assignment_id uuid, table_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, merge_group_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_hold public.table_holds%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_table_ids uuid[];
  v_zone_id uuid;
  v_policy_version text;
  v_snapshot_hash text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_window tstzrange;
  v_rows integer;
  v_booking_status public.booking_status;
  v_payload_checksum text;
  v_dedupe_key text;
  v_table_list text;
  v_hold_payload jsonb;
BEGIN
  IF p_window_start IS NULL AND p_window_end IS NOT NULL THEN
    RAISE EXCEPTION 'confirm_hold_assignment_tx requires both start and end when providing custom window'
      USING ERRCODE = '22023';
  END IF;
  IF p_window_start IS NOT NULL AND p_window_end IS NULL THEN
    RAISE EXCEPTION 'confirm_hold_assignment_tx requires both start and end when providing custom window'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_hold
  FROM public.table_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hold % not found', p_hold_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_hold.booking_id IS NOT NULL AND v_hold.booking_id <> p_booking_id THEN
    RAISE EXCEPTION 'Hold % belongs to booking % (expected %)', p_hold_id, v_hold.booking_id, p_booking_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_hold.expires_at <= v_now THEN
    RAISE EXCEPTION 'Hold % expired at %', p_hold_id, v_hold.expires_at
      USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(thm.table_id ORDER BY thm.table_id)
  INTO v_table_ids
  FROM public.table_hold_members thm
  WHERE thm.hold_id = p_hold_id;

  IF v_table_ids IS NULL OR array_length(v_table_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Hold % has no table members', p_hold_id
      USING ERRCODE = 'P0001';
  END IF;

  v_zone_id := v_hold.zone_id;
  v_policy_version := COALESCE((v_hold.metadata ->> 'policyVersion'), NULL);
  v_snapshot_hash := v_hold.metadata -> 'selection' -> 'snapshot' -> 'adjacency' ->> 'hash';

  IF p_expected_policy_version IS NOT NULL AND v_policy_version IS NOT NULL AND v_policy_version <> p_expected_policy_version THEN
    RAISE EXCEPTION 'Policy version changed (hold %, expected %, actual %)', p_hold_id, p_expected_policy_version, v_policy_version
      USING ERRCODE = 'P0003';
  END IF;

  IF p_expected_adjacency_hash IS NOT NULL AND v_snapshot_hash IS NOT NULL AND v_snapshot_hash <> p_expected_adjacency_hash THEN
    RAISE EXCEPTION 'Adjacency snapshot changed for hold %', p_hold_id
      USING ERRCODE = 'P0003';
  END IF;

  v_start_at := COALESCE(p_window_start, v_hold.start_at);
  v_end_at := COALESCE(p_window_end, v_hold.end_at);

  IF v_start_at IS NULL OR v_end_at IS NULL THEN
    RAISE EXCEPTION 'Hold % missing scheduling window', p_hold_id
      USING ERRCODE = '22000';
  END IF;

  IF v_start_at >= v_end_at THEN
    RAISE EXCEPTION 'Hold % has invalid window', p_hold_id
      USING ERRCODE = '22000';
  END IF;

  v_window := tstzrange(v_start_at, v_end_at, '[)');

  DROP TABLE IF EXISTS tmp_confirm_assignments_tx;
  CREATE TEMP TABLE tmp_confirm_assignments_tx ON COMMIT DROP AS
    SELECT *
    FROM public.assign_tables_atomic_v2(
      p_booking_id,
      v_table_ids,
      p_idempotency_key,
      p_require_adjacency,
      p_assigned_by,
      v_start_at,
      v_end_at
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 returned no assignments for booking %', p_booking_id
      USING ERRCODE = 'P0003';
  END IF;

  IF p_target_status IS NOT NULL THEN
    SELECT status INTO v_booking_status
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking % not found during transition', p_booking_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_booking_status <> p_target_status THEN
      PERFORM public.apply_booking_state_transition(
        p_booking_id,
        p_target_status,
        NULL,
        NULL,
        v_now,
        v_booking_status,
        p_target_status,
        p_history_changed_by,
        v_now,
        COALESCE(p_history_reason, 'auto_assign_confirm'),
        COALESCE(p_history_metadata, '{}'::jsonb)
      );
    END IF;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    v_payload_checksum := encode(
      digest(
        jsonb_build_object(
          'bookingId', p_booking_id,
          'tableIds', v_table_ids,
          'startAt', v_start_at,
          'endAt', v_end_at,
          'actorId', p_assigned_by,
          'holdId', p_hold_id
        )::text,
        'sha256'
      ),
      'hex'
    );

    UPDATE public.booking_assignment_idempotency
      SET payload_checksum = v_payload_checksum
    WHERE booking_id = p_booking_id
      AND idempotency_key = p_idempotency_key;
  END IF;

  v_table_list := array_to_string(v_table_ids, ',');
  v_dedupe_key := format('%s:%s:%s:%s', p_booking_id, to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), v_table_list);

  BEGIN
    INSERT INTO public.capacity_outbox (
      event_type,
      dedupe_key,
      restaurant_id,
      booking_id,
      idempotency_key,
      payload
    ) VALUES (
      'capacity.assignment.sync',
      v_dedupe_key,
      v_hold.restaurant_id,
      p_booking_id,
      p_idempotency_key,
      jsonb_build_object(
        'bookingId', p_booking_id,
        'restaurantId', v_hold.restaurant_id,
        'tableIds', v_table_ids,
        'startAt', to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'endAt', to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'mergeGroupId', (SELECT tmp.merge_group_id FROM tmp_confirm_assignments_tx tmp LIMIT 1),
        'idempotencyKey', p_idempotency_key
      )
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  BEGIN
    v_hold_payload := jsonb_build_object(
      'holdId', p_hold_id,
      'bookingId', p_booking_id,
      'restaurantId', v_hold.restaurant_id,
      'zoneId', v_zone_id,
      'tableIds', v_table_ids,
      'startAt', to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'endAt', to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'expiresAt', to_char(v_hold.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'actorId', p_assigned_by,
      'metadata', v_hold.metadata
    );

    INSERT INTO public.capacity_outbox (
      event_type,
      dedupe_key,
      restaurant_id,
      booking_id,
      idempotency_key,
      payload
    ) VALUES (
      'capacity.hold.confirmed',
      format('%s:%s:hold.confirmed', p_booking_id, p_hold_id),
      v_hold.restaurant_id,
      p_booking_id,
      p_idempotency_key,
      v_hold_payload
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    BEGIN
      INSERT INTO public.booking_confirmation_results (
        booking_id,
        hold_id,
        restaurant_id,
        idempotency_key,
        table_ids,
        assignment_window,
        actor_id,
        metadata
      ) VALUES (
        p_booking_id,
        p_hold_id,
        v_hold.restaurant_id,
        p_idempotency_key,
        v_table_ids,
        v_window,
        p_assigned_by,
        v_hold.metadata
      )
      ON CONFLICT (booking_id, idempotency_key) DO UPDATE
        SET table_ids = EXCLUDED.table_ids,
            assignment_window = EXCLUDED.assignment_window,
            restaurant_id = EXCLUDED.restaurant_id,
            hold_id = EXCLUDED.hold_id,
            actor_id = EXCLUDED.actor_id,
            metadata = EXCLUDED.metadata,
            created_at = EXCLUDED.created_at;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_column THEN NULL;
    END;
  END IF;

  DELETE FROM public.table_holds WHERE id = p_hold_id;

  RETURN QUERY
    SELECT bta.id,
           tmp.table_id,
           tmp.start_at,
           tmp.end_at,
           tmp.merge_group_id
    FROM tmp_confirm_assignments_tx tmp
    JOIN public.booking_table_assignments bta
      ON bta.booking_id = p_booking_id
     AND bta.table_id = tmp.table_id;
END;
$$;


--
-- TOC entry 491 (class 1255 OID 17644)
-- Name: confirm_hold_assignment_with_transition(uuid, uuid[], text, boolean, uuid, timestamp with time zone, timestamp with time zone, public.booking_status, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_hold_assignment_with_transition(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean DEFAULT false, p_assigned_by uuid DEFAULT NULL::uuid, p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_target_status public.booking_status DEFAULT 'confirmed'::public.booking_status, p_history_changed_by uuid DEFAULT NULL::uuid, p_history_reason text DEFAULT 'auto_assign_atomic_confirm'::text, p_history_metadata jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(table_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, merge_group_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_history_from public.booking_status;
  v_now timestamptz := timezone('utc', now());
  v_transition_needed boolean := true;
BEGIN
  SELECT status INTO v_history_from
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id
      USING ERRCODE = 'P0002';
  END IF;

  DROP TABLE IF EXISTS tmp_confirm_assignments;
  CREATE TEMP TABLE tmp_confirm_assignments ON COMMIT DROP AS
    SELECT ata.table_id, ata.start_at, ata.end_at, ata.merge_group_id
    FROM public.assign_tables_atomic_v2(
      p_booking_id,
      p_table_ids,
      p_idempotency_key,
      p_require_adjacency,
      p_assigned_by,
      p_start_at,
      p_end_at
    ) AS ata;

  IF NOT EXISTS (SELECT 1 FROM tmp_confirm_assignments) THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 returned no assignments for booking %', p_booking_id
      USING ERRCODE = 'P0003';
  END IF;

  IF v_history_from = p_target_status THEN
    v_transition_needed := false;
  END IF;

  IF v_transition_needed THEN
    PERFORM public.apply_booking_state_transition(
      p_booking_id,
      p_target_status,
      NULL,
      NULL,
      v_now,
      v_history_from,
      p_target_status,
      p_history_changed_by,
      v_now,
      COALESCE(p_history_reason, 'auto_assign_atomic_confirm'),
      COALESCE(p_history_metadata, '{}'::jsonb)
    );
  END IF;

  RETURN QUERY
    SELECT t.table_id, t.start_at, t.end_at, t.merge_group_id
    FROM tmp_confirm_assignments AS t;
END;
$$;


--
-- TOC entry 492 (class 1255 OID 17645)
-- Name: create_booking_with_capacity_check(uuid, uuid, date, time without time zone, time without time zone, integer, text, text, text, text, text, text, boolean, text, text, uuid, text, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_booking_with_capacity_check(p_restaurant_id uuid, p_customer_id uuid, p_booking_date date, p_start_time time without time zone, p_end_time time without time zone, p_party_size integer, p_booking_type text, p_customer_name text, p_customer_email text, p_customer_phone text, p_seating_preference text, p_notes text DEFAULT NULL::text, p_marketing_opt_in boolean DEFAULT false, p_idempotency_key text DEFAULT NULL::text, p_source text DEFAULT 'api'::text, p_auth_user_id uuid DEFAULT NULL::uuid, p_client_request_id text DEFAULT NULL::text, p_details jsonb DEFAULT '{}'::jsonb, p_loyalty_points_awarded integer DEFAULT 0) RETURNS jsonb
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


--
-- TOC entry 4807 (class 0 OID 0)
-- Dependencies: 492
-- Name: FUNCTION create_booking_with_capacity_check(p_restaurant_id uuid, p_customer_id uuid, p_booking_date date, p_start_time time without time zone, p_end_time time without time zone, p_party_size integer, p_booking_type text, p_customer_name text, p_customer_email text, p_customer_phone text, p_seating_preference text, p_notes text, p_marketing_opt_in boolean, p_idempotency_key text, p_source text, p_auth_user_id uuid, p_client_request_id text, p_details jsonb, p_loyalty_points_awarded integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_booking_with_capacity_check(p_restaurant_id uuid, p_customer_id uuid, p_booking_date date, p_start_time time without time zone, p_end_time time without time zone, p_party_size integer, p_booking_type text, p_customer_name text, p_customer_email text, p_customer_phone text, p_seating_preference text, p_notes text, p_marketing_opt_in boolean, p_idempotency_key text, p_source text, p_auth_user_id uuid, p_client_request_id text, p_details jsonb, p_loyalty_points_awarded integer) IS 'Race-safe booking creation enforcing capacity and operating hours. Returns JSON response with success/error detail. Fixed to use TEXT columns instead of non-existent enum types.';


--
-- TOC entry 493 (class 1255 OID 17647)
-- Name: current_restaurant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_restaurant_id() RETURNS uuid
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_raw text;
BEGIN
  v_raw := nullif(current_setting('app.restaurant_id', true), '');
  IF v_raw IS NULL THEN
    v_raw := nullif(current_setting('request.header.x-restaurant-id', true), '');
  END IF;

  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_raw::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid restaurant context value'
      USING ERRCODE = '22023',
            DETAIL = format('app.restaurant_id=%L', v_raw);
END;
$$;


--
-- TOC entry 4808 (class 0 OID 0)
-- Dependencies: 493
-- Name: FUNCTION current_restaurant_id(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.current_restaurant_id() IS 'Returns the tenant/restaurant scope extracted from app.restaurant_id GUC or the X-Restaurant-Id header.';


--
-- TOC entry 494 (class 1255 OID 17648)
-- Name: enforce_bar_drinks_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_bar_drinks_only() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
  -- =========================================================================
  -- Bar table restriction REMOVED (2025-12-25)
  -- =========================================================================
  -- Previously, this function blocked non-drinks bookings on:
  --   - Tables with category = 'bar'
  --   - Tables in zones with names starting with 'bar%'
  -- 
  -- This restriction has been removed per business requirements.
  -- Bar tables and bar zones can now be used for any booking type:
  --   - lunch
  --   - dinner  
  --   - drinks
  --
  -- See: docs/ANTIGRAVITY_SESSION_HISTORY_20251225.md
  -- See: docs/BUSINESS_LOGIC.md (line 637-638)
  -- =========================================================================
  
  RETURN NEW;
END;
$$;


--
-- TOC entry 495 (class 1255 OID 17649)
-- Name: generate_booking_reference(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_booking_reference() RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
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


--
-- TOC entry 496 (class 1255 OID 17650)
-- Name: get_or_create_booking_slot(uuid, date, time without time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_booking_slot(p_restaurant_id uuid, p_slot_date date, p_slot_time time without time zone, p_default_capacity integer DEFAULT 999) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_slot_id uuid;
  v_service_period_id uuid;
  v_capacity integer;
  v_rules_exist boolean := to_regclass('public.restaurant_capacity_rules') IS NOT NULL;
BEGIN
  SELECT id
  INTO v_slot_id
  FROM public.booking_slots
  WHERE restaurant_id = p_restaurant_id
    AND slot_date = p_slot_date
    AND slot_time = p_slot_time;

  IF FOUND THEN
    RETURN v_slot_id;
  END IF;

  SELECT id
  INTO v_service_period_id
  FROM public.restaurant_service_periods
  WHERE restaurant_id = p_restaurant_id
    AND (day_of_week IS NULL OR day_of_week = EXTRACT(DOW FROM p_slot_date)::smallint)
    AND p_slot_time >= start_time
    AND p_slot_time < end_time
  ORDER BY day_of_week DESC NULLS LAST, start_time ASC
  LIMIT 1;

  IF v_rules_exist THEN
    SELECT COALESCE(max_covers, p_default_capacity)
    INTO v_capacity
    FROM public.restaurant_capacity_rules
    WHERE restaurant_id = p_restaurant_id
      AND (service_period_id IS NULL OR service_period_id = v_service_period_id)
      AND (day_of_week IS NULL OR day_of_week = EXTRACT(DOW FROM p_slot_date)::smallint)
      AND (effective_date IS NULL OR effective_date <= p_slot_date)
    ORDER BY effective_date DESC NULLS LAST,
             day_of_week DESC NULLS LAST,
             service_period_id DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_capacity := COALESCE(v_capacity, p_default_capacity);

  INSERT INTO public.booking_slots (
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
  ON CONFLICT ON CONSTRAINT booking_slots_restaurant_slot_key DO UPDATE
    SET service_period_id = EXCLUDED.service_period_id,
        available_capacity = greatest(public.booking_slots.available_capacity, EXCLUDED.available_capacity),
        updated_at = timezone('utc', now())
  RETURNING id INTO v_slot_id;

  RETURN v_slot_id;
END;
$$;


--
-- TOC entry 4809 (class 0 OID 0)
-- Dependencies: 496
-- Name: FUNCTION get_or_create_booking_slot(p_restaurant_id uuid, p_slot_date date, p_slot_time time without time zone, p_default_capacity integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_or_create_booking_slot(p_restaurant_id uuid, p_slot_date date, p_slot_time time without time zone, p_default_capacity integer) IS 'Get existing slot or create new one with capacity override fallback (works even if restaurant_capacity_rules is absent).';


--
-- TOC entry 497 (class 1255 OID 17651)
-- Name: increment_booking_slot_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_booking_slot_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
    -- Only increment version if reserved_count changed
    IF OLD.reserved_count IS DISTINCT FROM NEW.reserved_count THEN
        NEW.version := OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$;


--
-- TOC entry 4810 (class 0 OID 0)
-- Dependencies: 497
-- Name: FUNCTION increment_booking_slot_version(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.increment_booking_slot_version() IS 'Automatically increment version column when reserved_count changes (optimistic concurrency control)';


--
-- TOC entry 498 (class 1255 OID 17652)
-- Name: is_holds_strict_conflicts_enabled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_holds_strict_conflicts_enabled() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Return true since we use DB-level exclusion constraints for conflict detection
  -- The actual conflict enforcement is done via the table_hold_windows_no_overlap constraint
  RETURN true;
END;
$$;


--
-- TOC entry 499 (class 1255 OID 17653)
-- Name: is_table_available_v2(uuid, timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_table_available_v2(p_table_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_exclude_booking_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'extensions'
    AS $$
SELECT NOT EXISTS (
  SELECT 1
  FROM public.booking_table_assignments bta
  JOIN public.bookings b ON b.id = bta.booking_id
  WHERE bta.table_id = p_table_id
    AND tstzrange(bta.start_at, bta.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
    AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
    AND b.status IN ('pending', 'confirmed', 'checked_in')
);
$$;


--
-- TOC entry 500 (class 1255 OID 17654)
-- Name: log_table_assignment_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_table_assignment_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
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


--
-- TOC entry 4811 (class 0 OID 0)
-- Dependencies: 500
-- Name: FUNCTION log_table_assignment_change(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.log_table_assignment_change() IS 'Audit trail for table assignment changes (who assigned what table to which booking)';


--
-- TOC entry 501 (class 1255 OID 17655)
-- Name: on_allocations_refresh(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_allocations_refresh() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
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


--
-- TOC entry 502 (class 1255 OID 17656)
-- Name: on_booking_status_refresh(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_booking_status_refresh() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
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


--
-- TOC entry 526 (class 1255 OID 19409)
-- Name: ops_email_delivery_attempts_feed(uuid, text, integer, integer, text[], text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ops_email_delivery_attempts_feed(p_restaurant_id uuid, p_range text, p_page integer, p_page_size integer, p_statuses text[] DEFAULT NULL::text[], p_recipient_email text DEFAULT NULL::text, p_message_id text DEFAULT NULL::text, p_booking_ref text DEFAULT NULL::text, p_template_type text DEFAULT NULL::text, p_email_type text DEFAULT NULL::text) RETURNS TABLE("messageId" text, "recipientEmail" text, "bookingId" uuid, "emailType" text, "templateType" text, provider text, "currentStatus" text, "currentOccurredAt" timestamp with time zone, events jsonb, booking jsonb)
    LANGUAGE plpgsql STABLE
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
    RAISE EXCEPTION 'p_restaurant_id is required' USING ERRCODE = '22004';
  END IF;

  v_since_ts := CASE p_range
    WHEN '24h' THEN now() - interval '24 hours'
    WHEN '30d' THEN now() - interval '30 days'
    ELSE now() - interval '7 days'
  END;

  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
  v_offset := (v_page - 1) * v_page_size;
  v_limit := v_page_size + 1;

  v_recipient_email := NULLIF(trim(p_recipient_email), '');
  v_message_id := NULLIF(trim(p_message_id), '');
  v_booking_ref := NULLIF(upper(trim(p_booking_ref)), '');
  v_template_type := NULLIF(trim(p_template_type), '');
  v_email_type := NULLIF(trim(p_email_type), '');
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
      f.message_id AS "messageId",
      f.recipient_email AS "recipientEmail",
      f.booking_id AS "bookingId",
      f.email_type AS "emailType",
      f.template_type AS "templateType",
      f.provider AS "provider",
      f.current_status AS "currentStatus",
      f.current_occurred_at AS "currentOccurredAt",
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', e.id,
              'bookingId', e.booking_id,
              'restaurantId', e.restaurant_id,
              'emailType', e.email_type,
              'templateType', e.template_type,
              'recipientEmail', e.recipient_email,
              'messageId', e.message_id,
              'status', e.status,
              'provider', e.provider,
              'occurredAt', e.occurred_at,
              'error', e.error,
              'metadata', e.metadata
            )
            ORDER BY e.occurred_at ASC, e.id ASC
          ),
          '[]'::jsonb
        )
        FROM public.email_delivery_log e
        WHERE e.restaurant_id = p_restaurant_id
          AND e.message_id = f.message_id
          AND lower(e.recipient_email) = lower(f.recipient_email)
      ) AS "events",
      (
        SELECT CASE
          WHEN f.booking_id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', b.id,
            'reference', b.reference,
            'bookingDate', b.booking_date,
            'startTime', b.start_time,
            'endTime', b.end_time,
            'customerName', b.customer_name,
            'partySize', b.party_size
          )
        END
        FROM public.bookings b
        WHERE b.id = f.booking_id
        LIMIT 1
      ) AS "booking"
    FROM filtered f;
END;
$$;


--
-- TOC entry 527 (class 1255 OID 19411)
-- Name: ops_email_delivery_attempts_summary(uuid, text, text[], text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ops_email_delivery_attempts_summary(p_restaurant_id uuid, p_range text, p_statuses text[] DEFAULT NULL::text[], p_recipient_email text DEFAULT NULL::text, p_message_id text DEFAULT NULL::text, p_booking_ref text DEFAULT NULL::text, p_template_type text DEFAULT NULL::text, p_email_type text DEFAULT NULL::text) RETURNS TABLE(total integer, sent integer, delivered integer, "deliveryDelayed" integer, bounced integer, complained integer, failed integer, "deliveredRate" double precision, "failureRate" double precision, "uniqueRecipients" integer, "uniqueBookings" integer, "p50DeliverySeconds" double precision, "p95DeliverySeconds" double precision, "topFailedTemplates" jsonb, "topFailedEmailTypes" jsonb)
    LANGUAGE sql STABLE
    AS $$
  WITH normalized AS (
    SELECT
      p_restaurant_id AS restaurant_id,
      CASE p_range
        WHEN '24h' THEN now() - interval '24 hours'
        WHEN '30d' THEN now() - interval '30 days'
        ELSE now() - interval '7 days'
      END AS since_ts,
      NULLIF(trim(p_recipient_email), '') AS recipient_email,
      NULLIF(trim(p_message_id), '') AS message_id,
      NULLIF(upper(trim(p_booking_ref)), '') AS booking_ref,
      NULLIF(trim(p_template_type), '') AS template_type,
      NULLIF(trim(p_email_type), '') AS email_type,
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
      min(e.occurred_at) FILTER (WHERE e.status = 'sent') AS sent_at,
      min(e.occurred_at) FILTER (WHERE e.status = 'delivered') AS delivered_at
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
      coalesce(f.template_type, 'unknown') AS template_type,
      count(*)::int AS cnt
    FROM filtered f
    WHERE f.current_status IN ('bounced', 'complained', 'failed')
    GROUP BY coalesce(f.template_type, 'unknown')
    ORDER BY cnt DESC, template_type ASC
    LIMIT 5
  ),
  failed_email_types AS (
    SELECT
      coalesce(f.email_type, 'unknown') AS email_type,
      count(*)::int AS cnt
    FROM filtered f
    WHERE f.current_status IN ('bounced', 'complained', 'failed')
    GROUP BY coalesce(f.email_type, 'unknown')
    ORDER BY cnt DESC, email_type ASC
    LIMIT 5
  ),
  counts AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE current_status = 'sent')::int AS sent,
      count(*) FILTER (WHERE current_status = 'delivered')::int AS delivered,
      count(*) FILTER (WHERE current_status = 'delivery_delayed')::int AS delivery_delayed,
      count(*) FILTER (WHERE current_status = 'bounced')::int AS bounced,
      count(*) FILTER (WHERE current_status = 'complained')::int AS complained,
      count(*) FILTER (WHERE current_status = 'failed')::int AS failed,
      count(distinct lower(recipient_email))::int AS unique_recipients,
      count(distinct booking_id) FILTER (WHERE booking_id IS NOT NULL)::int AS unique_bookings
    FROM filtered
  )
  SELECT
    c.total,
    c.sent,
    c.delivered,
    c.delivery_delayed AS "deliveryDelayed",
    c.bounced,
    c.complained,
    c.failed,
    CASE WHEN c.total = 0 THEN 0 ELSE c.delivered::double precision / c.total END AS "deliveredRate",
    CASE WHEN c.total = 0 THEN 0 ELSE (c.bounced + c.complained + c.failed)::double precision / c.total END AS "failureRate",
    c.unique_recipients AS "uniqueRecipients",
    c.unique_bookings AS "uniqueBookings",
    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY delivery_seconds) FROM delivered_durations) AS "p50DeliverySeconds",
    (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY delivery_seconds) FROM delivered_durations) AS "p95DeliverySeconds",
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object('templateType', template_type, 'count', cnt)
          ORDER BY cnt DESC, template_type ASC
        ),
        '[]'::jsonb
      )
      FROM failed_templates
    ) AS "topFailedTemplates",
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object('emailType', email_type, 'count', cnt)
          ORDER BY cnt DESC, email_type ASC
        ),
        '[]'::jsonb
      )
      FROM failed_email_types
    ) AS "topFailedEmailTypes"
  FROM counts c;
$$;


--
-- TOC entry 503 (class 1255 OID 17657)
-- Name: process_late_arrivals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_late_arrivals() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  late_booking_ids uuid[];
BEGIN
  -- Select all booking IDs that are confirmed and where the start time is more than 15 minutes in the past
  SELECT array_agg(id)
  INTO late_booking_ids
  FROM public.bookings
  WHERE
    status = 'confirmed'
    AND start_at < (timezone('utc', now()) - INTERVAL '15 minutes');

  IF array_length(late_booking_ids, 1) > 0 THEN
    -- Remove all table assignments for the identified late bookings to free up the tables
    DELETE FROM public.booking_table_assignments
    WHERE booking_id = ANY(late_booking_ids);

    -- Remove associated allocations to free up the resources for conflict checks
    DELETE FROM public.allocations
    WHERE booking_id = ANY(late_booking_ids);

    -- Update the status of the late bookings to PRIORITY_WAITLIST
    UPDATE public.bookings
    SET status = 'PRIORITY_WAITLIST'
    WHERE id = ANY(late_booking_ids);
  END IF;
END;
$$;


--
-- TOC entry 504 (class 1255 OID 17658)
-- Name: prune_allocations_history(timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prune_allocations_history(p_cutoff timestamp with time zone, p_limit integer DEFAULT 500) RETURNS TABLE(archived_count integer, deleted_count integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
  WITH candidates AS (
    SELECT
      id,
      booking_id,
      resource_type,
      resource_id,
      created_at,
      updated_at,
      shadow,
      restaurant_id,
      "window",
      created_by,
      is_maintenance
    FROM public.allocations
    WHERE upper("window") < p_cutoff
    ORDER BY updated_at
    LIMIT p_limit
  ), inserted AS (
    INSERT INTO public.allocations_archive (
      id,
      booking_id,
      resource_type,
      resource_id,
      created_at,
      updated_at,
      shadow,
      restaurant_id,
      "window",
      created_by,
      is_maintenance,
      archived_at
    )
    SELECT
      c.id,
      c.booking_id,
      c.resource_type,
      c.resource_id,
      c.created_at,
      c.updated_at,
      c.shadow,
      c.restaurant_id,
      c."window",
      c.created_by,
      c.is_maintenance,
      timezone('utc'::text, now())
    FROM candidates c
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  ), deleted AS (
    DELETE FROM public.allocations a
    USING inserted i
    WHERE a.id = i.id
    RETURNING a.id
  )
  SELECT * INTO archived_count, deleted_count FROM (
    SELECT
      COALESCE((SELECT count(*) FROM inserted), 0)::integer AS archived_count,
      COALESCE((SELECT count(*) FROM deleted), 0)::integer AS deleted_count
  ) subq;
  
  RETURN QUERY SELECT archived_count, deleted_count;
END;
$$;


--
-- TOC entry 505 (class 1255 OID 17659)
-- Name: refresh_table_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_table_status(p_table_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  DECLARE
    v_has_checked_in boolean;
    v_has_current_allocation boolean;
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
        AND a."window" @> now()
    ) INTO v_has_current_allocation;

    IF v_has_current_allocation THEN
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


--
-- TOC entry 506 (class 1255 OID 17660)
-- Name: release_hold_and_emit(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_hold_and_emit(p_hold_id uuid, p_actor_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_hold public.table_holds%ROWTYPE;
  v_member_table_ids uuid[];
BEGIN
  SELECT * INTO v_hold
    FROM public.table_holds
    WHERE id = p_hold_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Collect member table IDs BEFORE deleting
  SELECT array_agg(thm.table_id)
    INTO v_member_table_ids
    FROM public.table_hold_members thm
    WHERE thm.hold_id = p_hold_id;

  DELETE FROM public.table_hold_members WHERE hold_id = p_hold_id;
  DELETE FROM public.table_holds WHERE id = p_hold_id;

  BEGIN
    PERFORM public.record_observability_event(
      'capacity.holds',
      'hold.released',
      'info',
      v_hold.restaurant_id,
      v_hold.booking_id,
      jsonb_build_object(
        'holdId', p_hold_id,
        'actorId', p_actor_id,
        'tableIds', COALESCE(to_jsonb(v_member_table_ids), '[]'::jsonb),
        'startAt', v_hold.start_at,
        'endAt', v_hold.end_at,
        'expiresAt', v_hold.expires_at
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN true;
END;
$$;


--
-- TOC entry 507 (class 1255 OID 17661)
-- Name: require_restaurant_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_restaurant_context() RETURNS uuid
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  v_restaurant_id := public.current_restaurant_id();
  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant context is required' USING ERRCODE = '42501';
  END IF;
  RETURN v_restaurant_id;
END;
$$;


--
-- TOC entry 4812 (class 0 OID 0)
-- Dependencies: 507
-- Name: FUNCTION require_restaurant_context(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.require_restaurant_context() IS 'Raises if no tenant context is present (used by RLS policies).';


--
-- TOC entry 508 (class 1255 OID 17662)
-- Name: set_booking_instants(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_booking_instants() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
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


--
-- TOC entry 509 (class 1255 OID 17663)
-- Name: set_booking_reference(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_booking_reference() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
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


--
-- TOC entry 510 (class 1255 OID 17664)
-- Name: set_hold_conflict_enforcement(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_hold_conflict_enforcement(enabled boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Store in a session-local temporary table or use SET LOCAL
  -- For simplicity, we just return true - the application already has fallback logic
  RETURN enabled;
END;
$$;


--
-- TOC entry 511 (class 1255 OID 17665)
-- Name: set_restaurant_context(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_restaurant_context(p_restaurant_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_restaurant_id IS NULL THEN
    PERFORM set_config('app.restaurant_id', '', false);
    RETURN NULL;
  END IF;
  PERFORM set_config('app.restaurant_id', p_restaurant_id::text, false);
  RETURN p_restaurant_id;
END;
$$;


--
-- TOC entry 4813 (class 0 OID 0)
-- Dependencies: 511
-- Name: FUNCTION set_restaurant_context(p_restaurant_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_restaurant_context(p_restaurant_id uuid) IS 'Allows edge functions / trusted callers to set the tenant context for the current session.';


--
-- TOC entry 512 (class 1255 OID 17666)
-- Name: set_timestamp_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_timestamp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 298 (class 1259 OID 17667)
-- Name: booking_table_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_table_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    table_id uuid NOT NULL,
    slot_id uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    idempotency_key text,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    allocation_id uuid,
    merge_group_id uuid,
    assignment_window tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)'::text)) STORED
);


--
-- TOC entry 4814 (class 0 OID 0)
-- Dependencies: 298
-- Name: TABLE booking_table_assignments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_table_assignments IS 'Links bookings to physical tables. A booking can have multiple tables (e.g., party of 10 = 2x 6-tops).';


--
-- TOC entry 4815 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN booking_table_assignments.booking_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.booking_id IS 'The booking being assigned a table';


--
-- TOC entry 4816 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN booking_table_assignments.table_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.table_id IS 'The physical table being assigned';


--
-- TOC entry 4817 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN booking_table_assignments.slot_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.slot_id IS 'Optional link to the booking slot (for slot-level tracking)';


--
-- TOC entry 4818 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN booking_table_assignments.assigned_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.assigned_at IS 'When the assignment was made';


--
-- TOC entry 4819 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN booking_table_assignments.assigned_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.assigned_by IS 'User who made the assignment.';


--
-- TOC entry 4820 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN booking_table_assignments.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.notes IS 'Optional notes about the assignment (e.g., "VIP preferred seating")';


--
-- TOC entry 4821 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN booking_table_assignments.allocation_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.allocation_id IS 'Allocation row backing the assignment; used for overlap enforcement.';


--
-- TOC entry 513 (class 1255 OID 17677)
-- Name: sync_confirmed_assignment_windows(uuid, uuid[], timestamp with time zone, timestamp with time zone, uuid, uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_confirmed_assignment_windows(p_booking_id uuid, p_table_ids uuid[], p_window_start timestamp with time zone, p_window_end timestamp with time zone, p_actor_id uuid DEFAULT NULL::uuid, p_hold_id uuid DEFAULT NULL::uuid, p_merge_group_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text, p_payload_checksum text DEFAULT NULL::text) RETURNS SETOF public.booking_table_assignments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_window tstzrange := tstzrange(p_window_start, p_window_end, '[)');
BEGIN
  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'sync_confirmed_assignment_windows requires booking id';
  END IF;

  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) IS NULL THEN
    RETURN QUERY
      SELECT *
      FROM public.booking_table_assignments
      WHERE booking_id = p_booking_id;
    RETURN;
  END IF;

  UPDATE public.booking_table_assignments
     SET start_at = p_window_start,
         end_at = p_window_end
   WHERE booking_id = p_booking_id
     AND table_id = ANY(p_table_ids);

  UPDATE public.allocations
     SET "window" = v_window,
         merge_group_id = COALESCE(p_merge_group_id, merge_group_id)
   WHERE booking_id = p_booking_id
     AND resource_type = 'table'
     AND resource_id = ANY(p_table_ids);

  IF p_idempotency_key IS NOT NULL THEN
    UPDATE public.booking_assignment_idempotency
       SET assignment_window = v_window,
           merge_group_allocation_id = p_merge_group_id,
           payload_checksum = p_payload_checksum
     WHERE booking_id = p_booking_id
       AND idempotency_key = p_idempotency_key;
  END IF;

  INSERT INTO public.capacity_outbox (
    event_type,
    dedupe_key,
    restaurant_id,
    booking_id,
    idempotency_key,
    payload
  )
  SELECT
    'capacity.assignment.window_synced',
    format('%s:%s:window_synced', p_booking_id, coalesce(p_hold_id, 'none')),
    b.restaurant_id,
    p_booking_id,
    p_idempotency_key,
    jsonb_build_object(
      'bookingId', p_booking_id,
      'tableIds', p_table_ids,
      'startAt', to_char(p_window_start AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'endAt', to_char(p_window_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'actorId', p_actor_id,
      'holdId', p_hold_id,
      'mergeGroupId', p_merge_group_id
    )
  FROM public.bookings b
  WHERE b.id = p_booking_id
  ON CONFLICT ON CONSTRAINT capacity_outbox_dedupe_unique DO NOTHING;

  RETURN QUERY
    SELECT *
      FROM public.booking_table_assignments
     WHERE booking_id = p_booking_id
       AND table_id = ANY(p_table_ids);
END;
$$;


--
-- TOC entry 514 (class 1255 OID 17678)
-- Name: sync_table_hold_windows(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_table_hold_windows() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  hold_row RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.table_hold_windows
    WHERE hold_id = OLD.hold_id AND table_id = OLD.table_id;
    RETURN OLD;
  END IF;

  -- For INSERT, get the parent hold details
  SELECT id, restaurant_id, booking_id, start_at, end_at, expires_at
  INTO hold_row
  FROM public.table_holds
  WHERE id = NEW.hold_id;

  IF hold_row IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.table_hold_windows (hold_id, table_id, restaurant_id, booking_id, start_at, end_at, expires_at)
  VALUES (
    NEW.hold_id,
    NEW.table_id,
    hold_row.restaurant_id,
    hold_row.booking_id,
    hold_row.start_at,
    hold_row.end_at,
    hold_row.expires_at
  )
  ON CONFLICT (hold_id, table_id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    booking_id = EXCLUDED.booking_id,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    expires_at = EXCLUDED.expires_at;

  RETURN NEW;
END;
$$;


--
-- TOC entry 515 (class 1255 OID 17679)
-- Name: unassign_table_from_booking(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unassign_table_from_booking(p_booking_id uuid, p_table_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
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


--
-- TOC entry 4822 (class 0 OID 0)
-- Dependencies: 515
-- Name: FUNCTION unassign_table_from_booking(p_booking_id uuid, p_table_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.unassign_table_from_booking(p_booking_id uuid, p_table_id uuid) IS 'Remove table assignment from booking. Updates table status to available if no other active bookings.';


--
-- TOC entry 516 (class 1255 OID 17680)
-- Name: unassign_tables_atomic(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unassign_tables_atomic(p_booking_id uuid, p_table_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(table_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
    DECLARE
      v_target_tables uuid[] := p_table_ids;
      v_removed RECORD;
    BEGIN
      IF v_target_tables IS NOT NULL THEN
        SELECT array_agg(DISTINCT t.table_id)
        INTO v_target_tables
        FROM unnest(v_target_tables) AS t(table_id);
      ELSE
        SELECT array_agg(bta.table_id)
        INTO v_target_tables
        FROM public.booking_table_assignments bta
        WHERE bta.booking_id = p_booking_id;
      END IF;

      IF v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0 THEN
        RETURN;
      END IF;

      FOR v_removed IN
        DELETE FROM public.booking_table_assignments bta
        WHERE bta.booking_id = p_booking_id
          AND bta.table_id = ANY (v_target_tables)
        RETURNING bta.table_id
      LOOP
        unassign_tables_atomic.table_id := v_removed.table_id;

        DELETE FROM public.allocations alloc
        WHERE alloc.booking_id = p_booking_id
          AND alloc.resource_type = 'table'
          AND alloc.resource_id = v_removed.table_id;

        UPDATE public.table_inventory ti
        SET status = 'available'::public.table_status
        WHERE ti.id = v_removed.table_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.booking_table_assignments bta2
            WHERE bta2.table_id = v_removed.table_id
          );

        RETURN NEXT;
      END LOOP;

      RETURN;
    END;
    $$;


--
-- TOC entry 517 (class 1255 OID 17681)
-- Name: update_booking_with_capacity_check(uuid, uuid, uuid, date, time without time zone, time without time zone, integer, text, text, text, text, text, text, boolean, uuid, text, jsonb, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_booking_with_capacity_check(p_booking_id uuid, p_restaurant_id uuid, p_customer_id uuid, p_booking_date date, p_start_time time without time zone, p_end_time time without time zone, p_party_size integer, p_booking_type text, p_customer_name text, p_customer_email text, p_customer_phone text, p_seating_preference text, p_notes text DEFAULT NULL::text, p_marketing_opt_in boolean DEFAULT false, p_auth_user_id uuid DEFAULT NULL::uuid, p_client_request_id text DEFAULT NULL::text, p_details jsonb DEFAULT '{}'::jsonb, p_loyalty_points_awarded integer DEFAULT 0, p_source text DEFAULT 'api'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
    v_capacity_rules_exist boolean := to_regclass('public.restaurant_capacity_rules') IS NOT NULL;
BEGIN
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
        ELSE
            RAISE LOG 'Skipping capacity override lookup for booking % at restaurant % because public.restaurant_capacity_rules is absent.',
              p_booking_id,
              p_restaurant_id;
        END IF;

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
END;
$$;


--
-- TOC entry 518 (class 1255 OID 17683)
-- Name: update_table_hold_windows(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_table_hold_windows() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
  UPDATE public.table_hold_windows
  SET
    restaurant_id = NEW.restaurant_id,
    booking_id = NEW.booking_id,
    start_at = NEW.start_at,
    end_at = NEW.end_at,
    expires_at = NEW.expires_at
  WHERE hold_id = NEW.id;
  RETURN NEW;
END;
$$;


--
-- TOC entry 519 (class 1255 OID 17684)
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- TOC entry 520 (class 1255 OID 17685)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- TOC entry 521 (class 1255 OID 17686)
-- Name: user_restaurants(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_restaurants() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT restaurant_id
  FROM public.restaurant_memberships
  WHERE user_id = auth.uid()
$$;


--
-- TOC entry 522 (class 1255 OID 17687)
-- Name: user_restaurants_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_restaurants_admin() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT restaurant_id
  FROM public.restaurant_memberships
  WHERE user_id = auth.uid()
    AND role = ANY (ARRAY['owner'::text, 'manager'::text]);
$$;


--
-- TOC entry 523 (class 1255 OID 17688)
-- Name: validate_booking_capacity_after_assignment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_booking_capacity_after_assignment(p_booking_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
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


--
-- TOC entry 4823 (class 0 OID 0)
-- Dependencies: 523
-- Name: FUNCTION validate_booking_capacity_after_assignment(p_booking_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_booking_capacity_after_assignment(p_booking_id uuid) IS 'Checks post-assignment capacity; tolerates missing restaurant_capacity_rules via to_regclass guard.';


--
-- TOC entry 524 (class 1255 OID 17689)
-- Name: validate_booking_has_assignments(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_booking_has_assignments() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
  -- Only validate when status is being changed to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Check if this booking has any table assignments
    IF NOT EXISTS (
      SELECT 1 
      FROM booking_table_assignments 
      WHERE booking_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot confirm booking %: No table assignments exist. Booking must have at least one table assigned before confirmation.', NEW.id
        USING HINT = 'Use the assign_tables RPC function to assign tables before confirming';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- TOC entry 4824 (class 0 OID 0)
-- Dependencies: 524
-- Name: FUNCTION validate_booking_has_assignments(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_booking_has_assignments() IS 'Validates that confirmed bookings have at least one table assignment. Prevents orphaned confirmations.';


--
-- TOC entry 525 (class 1255 OID 17690)
-- Name: validate_table_adjacency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_table_adjacency() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
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


--
-- TOC entry 299 (class 1259 OID 17691)
-- Name: _migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migrations (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    status character varying(50) DEFAULT 'applied'::character varying
);


--
-- TOC entry 300 (class 1259 OID 17696)
-- Name: _migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public._migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4825 (class 0 OID 0)
-- Dependencies: 300
-- Name: _migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public._migrations_id_seq OWNED BY public._migrations.id;


--
-- TOC entry 301 (class 1259 OID 17697)
-- Name: allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid,
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    shadow boolean DEFAULT false NOT NULL,
    restaurant_id uuid NOT NULL,
    "window" tstzrange NOT NULL,
    created_by uuid,
    is_maintenance boolean DEFAULT false NOT NULL,
    CONSTRAINT allocations_resource_type_check CHECK ((resource_type = ANY (ARRAY['table'::text, 'merge_group'::text])))
);


--
-- TOC entry 4826 (class 0 OID 0)
-- Dependencies: 301
-- Name: COLUMN allocations.shadow; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.allocations.shadow IS 'True when allocation is tentative (shadow). Shadow allocations are visible to staff but do not block standard bookings.';


--
-- TOC entry 4827 (class 0 OID 0)
-- Dependencies: 301
-- Name: COLUMN allocations.is_maintenance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.allocations.is_maintenance IS 'True when allocation reserves a table for maintenance/out-of-service windows rather than a booking.';


--
-- TOC entry 302 (class 1259 OID 17708)
-- Name: allocations_archive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allocations_archive (
    id uuid NOT NULL,
    booking_id uuid,
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    shadow boolean DEFAULT false NOT NULL,
    restaurant_id uuid NOT NULL,
    "window" tstzrange NOT NULL,
    created_by uuid,
    is_maintenance boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT allocations_archive_resource_type_check CHECK ((resource_type = ANY (ARRAY['table'::text, 'hold'::text, 'merge_group'::text])))
);


--
-- TOC entry 303 (class 1259 OID 17717)
-- Name: allowed_capacities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allowed_capacities (
    restaurant_id uuid NOT NULL,
    capacity smallint NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT allowed_capacities_capacity_check CHECK ((capacity > 0))
);


--
-- TOC entry 304 (class 1259 OID 17723)
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type public.analytics_event_type NOT NULL,
    schema_version text NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    customer_id uuid,
    emitted_by text DEFAULT 'server'::text NOT NULL,
    payload jsonb NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 4828 (class 0 OID 0)
-- Dependencies: 304
-- Name: TABLE analytics_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.analytics_events IS 'Tracks booking-related analytics events for reporting and metrics.';


--
-- TOC entry 305 (class 1259 OID 17731)
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    actor text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 306 (class 1259 OID 17738)
-- Name: booking_assignment_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_assignment_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    attempt_no integer NOT NULL,
    strategy text NOT NULL,
    result text NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- TOC entry 307 (class 1259 OID 17746)
-- Name: booking_assignment_idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_assignment_idempotency (
    booking_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    table_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    assignment_window tstzrange NOT NULL,
    merge_group_allocation_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    table_set_hash text,
    payload_checksum text DEFAULT ''::text NOT NULL,
    expires_at timestamp with time zone
);


--
-- TOC entry 4829 (class 0 OID 0)
-- Dependencies: 307
-- Name: TABLE booking_assignment_idempotency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_assignment_idempotency IS 'Tracks idempotent table assignments to prevent duplicate allocations.';


--
-- TOC entry 4830 (class 0 OID 0)
-- Dependencies: 307
-- Name: COLUMN booking_assignment_idempotency.table_set_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_assignment_idempotency.table_set_hash IS 'MD5 hash of sorted table ids used to dedupe idempotency payloads.';


--
-- TOC entry 308 (class 1259 OID 17754)
-- Name: booking_confirmation_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_confirmation_results (
    booking_id uuid NOT NULL,
    hold_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    table_ids uuid[] NOT NULL,
    assignment_window tstzrange NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    actor_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- TOC entry 309 (class 1259 OID 17761)
-- Name: booking_occasions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_occasions (
    key text NOT NULL,
    label text NOT NULL,
    short_label text NOT NULL,
    description text,
    availability jsonb DEFAULT '[]'::jsonb NOT NULL,
    default_duration_minutes smallint DEFAULT 90 NOT NULL,
    display_order smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_builtin boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT booking_occasions_builtin_not_deleted CHECK ((NOT (is_builtin AND (deleted_at IS NOT NULL))))
);


--
-- TOC entry 310 (class 1259 OID 17774)
-- Name: booking_occasions_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_occasions_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    occasion_key text NOT NULL,
    action text NOT NULL,
    before_change jsonb,
    after_change jsonb,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 311 (class 1259 OID 17781)
-- Name: booking_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    slot_date date NOT NULL,
    slot_time time without time zone NOT NULL,
    service_period_id uuid,
    available_capacity integer DEFAULT 0 NOT NULL,
    reserved_count integer DEFAULT 0 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_slots_available_capacity_positive CHECK ((available_capacity >= 0)),
    CONSTRAINT booking_slots_capacity_valid CHECK (((reserved_count >= 0) AND (reserved_count <= available_capacity)))
);


--
-- TOC entry 4831 (class 0 OID 0)
-- Dependencies: 311
-- Name: TABLE booking_slots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_slots IS 'Pre-materialized time slots with capacity counters for fast availability checks. Created on-demand or pre-generated.';


--
-- TOC entry 4832 (class 0 OID 0)
-- Dependencies: 311
-- Name: COLUMN booking_slots.slot_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.slot_date IS 'Date of the slot (e.g., 2025-10-20)';


--
-- TOC entry 4833 (class 0 OID 0)
-- Dependencies: 311
-- Name: COLUMN booking_slots.slot_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.slot_time IS 'Time of the slot (e.g., 19:00). Typically 15/30/60 minute intervals.';


--
-- TOC entry 4834 (class 0 OID 0)
-- Dependencies: 311
-- Name: COLUMN booking_slots.service_period_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.service_period_id IS 'Optional link to service period (lunch/dinner). Null if not applicable.';


--
-- TOC entry 4835 (class 0 OID 0)
-- Dependencies: 311
-- Name: COLUMN booking_slots.available_capacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.available_capacity IS 'Maximum capacity for this slot (in covers/guests). Derived from capacity rules.';


--
-- TOC entry 4836 (class 0 OID 0)
-- Dependencies: 311
-- Name: COLUMN booking_slots.reserved_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.reserved_count IS 'Number of covers/guests currently reserved for this slot.';


--
-- TOC entry 4837 (class 0 OID 0)
-- Dependencies: 311
-- Name: COLUMN booking_slots.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.version IS 'Optimistic locking version. Incremented on each update to prevent race conditions.';


--
-- TOC entry 312 (class 1259 OID 17792)
-- Name: booking_state_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_state_history (
    id bigint NOT NULL,
    booking_id uuid NOT NULL,
    from_status public.booking_status,
    to_status public.booking_status NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- TOC entry 4838 (class 0 OID 0)
-- Dependencies: 312
-- Name: TABLE booking_state_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_state_history IS 'Audit history of booking lifecycle transitions.';


--
-- TOC entry 4839 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN booking_state_history.booking_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.booking_id IS 'Booking whose status transitioned.';


--
-- TOC entry 4840 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN booking_state_history.from_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.from_status IS 'Previous lifecycle status.';


--
-- TOC entry 4841 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN booking_state_history.to_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.to_status IS 'New lifecycle status.';


--
-- TOC entry 4842 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN booking_state_history.changed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.changed_by IS 'User who triggered the change (null for system operations).';


--
-- TOC entry 4843 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN booking_state_history.changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.changed_at IS 'UTC timestamp when the transition was recorded.';


--
-- TOC entry 4844 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN booking_state_history.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.reason IS 'Optional human-readable reason for the transition.';


--
-- TOC entry 4845 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN booking_state_history.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.metadata IS 'Additional structured data describing the transition.';


--
-- TOC entry 313 (class 1259 OID 17799)
-- Name: booking_state_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.booking_state_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4846 (class 0 OID 0)
-- Dependencies: 313
-- Name: booking_state_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.booking_state_history_id_seq OWNED BY public.booking_state_history.id;


--
-- TOC entry 314 (class 1259 OID 17800)
-- Name: booking_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_versions (
    version_id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    change_type public.booking_change_type NOT NULL,
    changed_by text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 4847 (class 0 OID 0)
-- Dependencies: 314
-- Name: TABLE booking_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_versions IS 'Audit trail for booking changes with before/after snapshots.';


--
-- TOC entry 315 (class 1259 OID 17808)
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    booking_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    party_size integer NOT NULL,
    seating_preference public.seating_preference_type DEFAULT 'any'::public.seating_preference_type NOT NULL,
    status public.booking_status DEFAULT 'confirmed'::public.booking_status NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text NOT NULL,
    notes text,
    reference text NOT NULL,
    source text DEFAULT 'web'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    booking_type text DEFAULT 'dinner'::text NOT NULL,
    idempotency_key text,
    client_request_id text DEFAULT (gen_random_uuid())::text NOT NULL,
    pending_ref text,
    details jsonb,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    confirmation_token character varying(64),
    confirmation_token_expires_at timestamp with time zone,
    confirmation_token_used_at timestamp with time zone,
    auth_user_id uuid,
    checked_in_at timestamp with time zone,
    checked_out_at timestamp with time zone,
    loyalty_points_awarded integer DEFAULT 0 NOT NULL,
    assigned_zone_id uuid,
    auto_assign_idempotency_key text,
    auto_assign_last_result jsonb,
    assignment_state_version integer DEFAULT 1 NOT NULL,
    assignment_strategy text,
    CONSTRAINT bookings_checked_out_after_checked_in CHECK (((checked_out_at IS NULL) OR (checked_in_at IS NULL) OR (checked_out_at >= checked_in_at))),
    CONSTRAINT bookings_lifecycle_timestamp_consistency CHECK ((((status = ANY (ARRAY['pending'::public.booking_status, 'pending_allocation'::public.booking_status, 'confirmed'::public.booking_status])) AND (checked_in_at IS NULL) AND (checked_out_at IS NULL)) OR ((status = 'checked_in'::public.booking_status) AND (checked_in_at IS NOT NULL) AND (checked_out_at IS NULL)) OR ((status = 'completed'::public.booking_status) AND (checked_in_at IS NOT NULL) AND (checked_out_at IS NOT NULL) AND (checked_out_at >= checked_in_at)) OR (status = 'cancelled'::public.booking_status) OR ((status = 'no_show'::public.booking_status) AND (checked_in_at IS NULL) AND (checked_out_at IS NULL)))),
    CONSTRAINT bookings_party_size_check CHECK ((party_size > 0)),
    CONSTRAINT chk_time_order CHECK ((start_at < end_at))
);


--
-- TOC entry 4848 (class 0 OID 0)
-- Dependencies: 315
-- Name: TABLE bookings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bookings IS 'Customer reservations with party size, time, and status';


--
-- TOC entry 4849 (class 0 OID 0)
-- Dependencies: 315
-- Name: COLUMN bookings.pending_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.pending_ref IS 'Temporary reference used while an asynchronous booking is pending confirmation. Should be NULL for finalized bookings.';


--
-- TOC entry 4850 (class 0 OID 0)
-- Dependencies: 315
-- Name: COLUMN bookings.confirmation_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.confirmation_token IS 'One-time cryptographic token (base64url, 64 chars) for guest confirmation page access. Expires in 1 hour.';


--
-- TOC entry 4851 (class 0 OID 0)
-- Dependencies: 315
-- Name: COLUMN bookings.confirmation_token_expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.confirmation_token_expires_at IS 'Expiry timestamp for confirmation_token. After this time, token is invalid.';


--
-- TOC entry 4852 (class 0 OID 0)
-- Dependencies: 315
-- Name: COLUMN bookings.confirmation_token_used_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.confirmation_token_used_at IS 'Timestamp when confirmation_token was first used. Prevents token replay attacks.';


--
-- TOC entry 4853 (class 0 OID 0)
-- Dependencies: 315
-- Name: COLUMN bookings.auth_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.auth_user_id IS 'Optional link to the authenticated Supabase user that created or owns the booking.';


--
-- TOC entry 4854 (class 0 OID 0)
-- Dependencies: 315
-- Name: COLUMN bookings.checked_in_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.checked_in_at IS 'Timestamp when the guest was checked in by ops';


--
-- TOC entry 4855 (class 0 OID 0)
-- Dependencies: 315
-- Name: COLUMN bookings.checked_out_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.checked_out_at IS 'Timestamp when the guest was checked out by ops';


--
-- TOC entry 4856 (class 0 OID 0)
-- Dependencies: 315
-- Name: COLUMN bookings.assigned_zone_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.assigned_zone_id IS 'Zone enforced for all table assignments tied to the booking.';


--
-- TOC entry 4857 (class 0 OID 0)
-- Dependencies: 315
-- Name: CONSTRAINT bookings_checked_out_after_checked_in ON bookings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT bookings_checked_out_after_checked_in ON public.bookings IS 'Ensures recorded check-out timestamps are chronologically after check-in.';


--
-- TOC entry 4858 (class 0 OID 0)
-- Dependencies: 315
-- Name: CONSTRAINT bookings_lifecycle_timestamp_consistency ON bookings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT bookings_lifecycle_timestamp_consistency ON public.bookings IS 'Ensures booking lifecycle timestamps align with the status (checked-in bookings must have check-in timestamps, completed bookings need both timestamps, etc).';


--
-- TOC entry 316 (class 1259 OID 17828)
-- Name: capacity_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capacity_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    event_type text NOT NULL,
    dedupe_key text,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone,
    restaurant_id uuid,
    booking_id uuid,
    idempotency_key text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT capacity_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'done'::text, 'dead'::text])))
);


--
-- TOC entry 4859 (class 0 OID 0)
-- Dependencies: 316
-- Name: TABLE capacity_outbox; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.capacity_outbox IS 'Outbox for reliable post-commit processing (sync, telemetry).';


--
-- TOC entry 317 (class 1259 OID 17840)
-- Name: customer_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_profiles (
    customer_id uuid NOT NULL,
    first_booking_at timestamp with time zone,
    last_booking_at timestamp with time zone,
    total_bookings integer DEFAULT 0 NOT NULL,
    total_covers integer DEFAULT 0 NOT NULL,
    total_cancellations integer DEFAULT 0 NOT NULL,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    last_marketing_opt_in_at timestamp with time zone,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_profiles_total_bookings_check CHECK ((total_bookings >= 0)),
    CONSTRAINT customer_profiles_total_cancellations_check CHECK ((total_cancellations >= 0)),
    CONSTRAINT customer_profiles_total_covers_check CHECK ((total_covers >= 0))
);


--
-- TOC entry 318 (class 1259 OID 17854)
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    email_normalized text GENERATED ALWAYS AS (lower(TRIM(BOTH FROM email))) STORED,
    phone_normalized text GENERATED ALWAYS AS (regexp_replace(phone, '[^0-9]+'::text, ''::text, 'g'::text)) STORED,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    auth_user_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_profile_id uuid,
    CONSTRAINT customers_email_check CHECK ((email = lower(email))),
    CONSTRAINT customers_phone_check CHECK (((length(phone) >= 7) AND (length(phone) <= 20)))
);


--
-- TOC entry 4860 (class 0 OID 0)
-- Dependencies: 318
-- Name: TABLE customers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customers IS 'Guest profiles with contact details';


--
-- TOC entry 4861 (class 0 OID 0)
-- Dependencies: 318
-- Name: COLUMN customers.user_profile_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.user_profile_id IS 'Optional foreign key to global user_profiles identity.';


--
-- TOC entry 319 (class 1259 OID 17867)
-- Name: demand_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demand_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    day_of_week smallint NOT NULL,
    service_window text NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    start_minute integer,
    end_minute integer,
    priority integer DEFAULT 1,
    CONSTRAINT demand_profiles_check CHECK (((end_minute > start_minute) AND (end_minute <= 1440))),
    CONSTRAINT demand_profiles_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT demand_profiles_multiplier_check CHECK (((multiplier >= 0.1) AND (multiplier <= 10.0))),
    CONSTRAINT demand_profiles_priority_check CHECK ((priority >= 1)),
    CONSTRAINT demand_profiles_service_window_check CHECK ((service_window = ANY (ARRAY['lunch'::text, 'drinks'::text, 'dinner'::text, 'christmas_party'::text, 'curry_and_carols'::text]))),
    CONSTRAINT demand_profiles_start_minute_check CHECK (((start_minute >= 0) AND (start_minute < 1440)))
);


--
-- TOC entry 4862 (class 0 OID 0)
-- Dependencies: 319
-- Name: TABLE demand_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.demand_profiles IS 'Configures dynamic pricing multipliers by day of week and service window.';


--
-- TOC entry 320 (class 1259 OID 17883)
-- Name: email_delivery_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_delivery_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid,
    restaurant_id uuid,
    email_type text,
    template_type text,
    recipient_email text NOT NULL,
    message_id text NOT NULL,
    status text NOT NULL,
    provider text,
    provider_event_id text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    error text,
    metadata jsonb,
    CONSTRAINT email_delivery_log_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'delivered'::text, 'delivery_delayed'::text, 'bounced'::text, 'complained'::text, 'failed'::text])))
);


--
-- TOC entry 4863 (class 0 OID 0)
-- Dependencies: 320
-- Name: TABLE email_delivery_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_delivery_log IS 'Tracks outbound email delivery events and webhook updates.';


--
-- TOC entry 321 (class 1259 OID 17892)
-- Name: feature_flag_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flag_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flag text NOT NULL,
    environment text NOT NULL,
    value boolean NOT NULL,
    notes jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by uuid
);


--
-- TOC entry 4864 (class 0 OID 0)
-- Dependencies: 321
-- Name: TABLE feature_flag_overrides; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.feature_flag_overrides IS 'Runtime feature flag overrides per environment.';


--
-- TOC entry 322 (class 1259 OID 17899)
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- TOC entry 4865 (class 0 OID 0)
-- Dependencies: 322
-- Name: TABLE leads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.leads IS 'Marketing email leads for newsletter signups.';


--
-- TOC entry 323 (class 1259 OID 17906)
-- Name: loyalty_point_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_point_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    booking_id uuid,
    points_change integer NOT NULL,
    event_type text NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 324 (class 1259 OID 17914)
-- Name: loyalty_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    total_points integer DEFAULT 0 NOT NULL,
    tier public.loyalty_tier DEFAULT 'bronze'::public.loyalty_tier NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 325 (class 1259 OID 17922)
-- Name: loyalty_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    accrual_rule jsonb DEFAULT '{"type": "per_guest", "base_points": 10, "points_per_guest": 5, "minimum_party_size": 1}'::jsonb NOT NULL,
    tier_definitions jsonb DEFAULT '[{"tier": "bronze", "min_points": 0}]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pilot_only boolean DEFAULT false NOT NULL
);


--
-- TOC entry 326 (class 1259 OID 17934)
-- Name: manual_assignment_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manual_assignment_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    state public.manual_assignment_session_state DEFAULT 'none'::public.manual_assignment_session_state NOT NULL,
    selection jsonb,
    selection_version integer DEFAULT 0 NOT NULL,
    context_version text,
    policy_version text,
    snapshot_hash text,
    hold_id uuid,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    table_version text,
    adjacency_version text,
    flags_version text,
    window_version text,
    holds_version text,
    assignments_version text
);


--
-- TOC entry 327 (class 1259 OID 17944)
-- Name: merge_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.merge_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_a smallint NOT NULL,
    from_b smallint NOT NULL,
    to_capacity smallint NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    require_same_zone boolean DEFAULT true NOT NULL,
    require_adjacency boolean DEFAULT true NOT NULL,
    cross_category_merge boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT merge_rules_positive CHECK (((from_a > 0) AND (from_b > 0) AND (to_capacity > 0)))
);


--
-- TOC entry 328 (class 1259 OID 17955)
-- Name: observability_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.observability_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    source text NOT NULL,
    event_type text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    context jsonb,
    restaurant_id uuid,
    booking_id uuid,
    CONSTRAINT observability_events_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'critical'::text])))
);


--
-- TOC entry 329 (class 1259 OID 17964)
-- Name: profile_update_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_update_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    payload_hash text NOT NULL,
    applied_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- TOC entry 330 (class 1259 OID 17971)
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    name text,
    phone text,
    image text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    has_access boolean DEFAULT true NOT NULL,
    CONSTRAINT profiles_email_check CHECK ((email = lower(email)))
);


--
-- TOC entry 4866 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN profiles.has_access; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.has_access IS 'Indicates whether the profile retains active access to Ops surfaces.';


--
-- TOC entry 331 (class 1259 OID 17980)
-- Name: restaurant_capacity_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_capacity_rules (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    restaurant_id uuid NOT NULL,
    service_period_id uuid,
    day_of_week smallint,
    effective_date date,
    max_covers integer,
    max_parties integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    label text,
    override_type public.capacity_override_type,
    CONSTRAINT restaurant_capacity_rules_non_negative CHECK ((((max_covers IS NULL) OR (max_covers >= 0)) AND ((max_parties IS NULL) OR (max_parties >= 0)))),
    CONSTRAINT restaurant_capacity_rules_scope CHECK (((service_period_id IS NOT NULL) OR (day_of_week IS NOT NULL) OR (effective_date IS NOT NULL)))
);


--
-- TOC entry 4867 (class 0 OID 0)
-- Dependencies: 331
-- Name: COLUMN restaurant_capacity_rules.label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurant_capacity_rules.label IS 'Human-friendly name for this capacity rule or override (e.g., “Christmas Eve Dinner”).';


--
-- TOC entry 4868 (class 0 OID 0)
-- Dependencies: 331
-- Name: COLUMN restaurant_capacity_rules.override_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurant_capacity_rules.override_type IS 'Categorizes overrides (holiday, event, manual adjustments, emergencies).';


--
-- TOC entry 332 (class 1259 OID 17990)
-- Name: restaurant_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    email text NOT NULL,
    email_normalized text GENERATED ALWAYS AS (lower(TRIM(BOTH FROM email))) STORED,
    role text NOT NULL,
    token_hash text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    invited_by uuid,
    accepted_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT restaurant_invites_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'host'::text, 'server'::text]))),
    CONSTRAINT restaurant_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'revoked'::text, 'expired'::text])))
);


--
-- TOC entry 333 (class 1259 OID 18002)
-- Name: restaurant_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_memberships (
    user_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT restaurant_memberships_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'host'::text, 'server'::text])))
);


--
-- TOC entry 334 (class 1259 OID 18009)
-- Name: restaurant_operating_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_operating_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    day_of_week smallint,
    effective_date date,
    opens_at time without time zone,
    closes_at time without time zone,
    is_closed boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reservation_interval_minutes integer,
    reservation_slot_times text[],
    CONSTRAINT restaurant_operating_hours_scope CHECK (((day_of_week IS NOT NULL) OR (effective_date IS NOT NULL))),
    CONSTRAINT restaurant_operating_hours_time_order CHECK ((is_closed OR ((opens_at IS NOT NULL) AND (closes_at IS NOT NULL) AND (opens_at < closes_at))))
);


--
-- TOC entry 4869 (class 0 OID 0)
-- Dependencies: 334
-- Name: COLUMN restaurant_operating_hours.reservation_interval_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurant_operating_hours.reservation_interval_minutes IS 'Optional per-day reservation interval override (minutes).';


--
-- TOC entry 4870 (class 0 OID 0)
-- Dependencies: 334
-- Name: COLUMN restaurant_operating_hours.reservation_slot_times; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurant_operating_hours.reservation_slot_times IS 'Optional fixed reservation slot times (HH:MM) for the day; overrides interval when set.';


--
-- TOC entry 335 (class 1259 OID 18020)
-- Name: restaurant_service_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_service_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    day_of_week smallint,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    booking_option text DEFAULT 'drinks'::text NOT NULL,
    CONSTRAINT restaurant_service_periods_time_order CHECK ((start_time < end_time))
);


--
-- TOC entry 336 (class 1259 OID 18030)
-- Name: restaurant_turn_bands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_turn_bands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_option text NOT NULL,
    max_party_size integer NOT NULL,
    duration_minutes integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT restaurant_turn_bands_duration_minutes_check CHECK (((duration_minutes > 0) AND (duration_minutes <= 1440))),
    CONSTRAINT restaurant_turn_bands_max_party_size_check CHECK ((max_party_size > 0))
);


--
-- TOC entry 4871 (class 0 OID 0)
-- Dependencies: 336
-- Name: TABLE restaurant_turn_bands; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.restaurant_turn_bands IS 'Party-size-based reservation durations per restaurant and booking option.';


--
-- TOC entry 4872 (class 0 OID 0)
-- Dependencies: 336
-- Name: COLUMN restaurant_turn_bands.restaurant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurant_turn_bands.restaurant_id IS 'Restaurant the turn bands apply to.';


--
-- TOC entry 4873 (class 0 OID 0)
-- Dependencies: 336
-- Name: COLUMN restaurant_turn_bands.booking_option; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurant_turn_bands.booking_option IS 'Booking option key (e.g., lunch, dinner, tasting).';


--
-- TOC entry 4874 (class 0 OID 0)
-- Dependencies: 336
-- Name: COLUMN restaurant_turn_bands.max_party_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurant_turn_bands.max_party_size IS 'Upper bound of the party size for this duration band.';


--
-- TOC entry 4875 (class 0 OID 0)
-- Dependencies: 336
-- Name: COLUMN restaurant_turn_bands.duration_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurant_turn_bands.duration_minutes IS 'Duration in minutes for the party size band.';


--
-- TOC entry 337 (class 1259 OID 18040)
-- Name: restaurants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    timezone text DEFAULT 'Europe/London'::text NOT NULL,
    capacity integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_email text,
    contact_phone text,
    address text,
    booking_policy text,
    reservation_interval_minutes integer DEFAULT 15 NOT NULL,
    reservation_default_duration_minutes integer DEFAULT 90 NOT NULL,
    reservation_last_seating_buffer_minutes integer DEFAULT 120 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    logo_url text,
    email_send_reminder_24h boolean DEFAULT true NOT NULL,
    email_send_reminder_short boolean DEFAULT true NOT NULL,
    email_send_review_request boolean DEFAULT true NOT NULL,
    google_map_url text,
    reservation_lifecycle_grace_minutes integer DEFAULT 15,
    google_review_url text,
    email_templates jsonb,
    CONSTRAINT restaurants_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0))),
    CONSTRAINT restaurants_reservation_default_duration_minutes_check CHECK (((reservation_default_duration_minutes >= 15) AND (reservation_default_duration_minutes <= 300))),
    CONSTRAINT restaurants_reservation_interval_minutes_check CHECK (((reservation_interval_minutes > 0) AND (reservation_interval_minutes <= 180))),
    CONSTRAINT restaurants_reservation_last_seating_buffer_minutes_check CHECK (((reservation_last_seating_buffer_minutes >= 15) AND (reservation_last_seating_buffer_minutes <= 300))),
    CONSTRAINT restaurants_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))
);


--
-- TOC entry 4876 (class 0 OID 0)
-- Dependencies: 337
-- Name: TABLE restaurants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.restaurants IS 'Restaurant entities with timezone and capacity configuration';


--
-- TOC entry 4877 (class 0 OID 0)
-- Dependencies: 337
-- Name: COLUMN restaurants.timezone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.timezone IS 'Timezone of the restaurant (e.g., ''America/New_York''). Non-nullable, defaults to ''Europe/London''.';


--
-- TOC entry 4878 (class 0 OID 0)
-- Dependencies: 337
-- Name: COLUMN restaurants.reservation_last_seating_buffer_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.reservation_last_seating_buffer_minutes IS 'Minimum minutes before closing when the final reservation may start.';


--
-- TOC entry 4879 (class 0 OID 0)
-- Dependencies: 337
-- Name: COLUMN restaurants.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.is_active IS 'Indicates whether the restaurant is active and should surface in public experiences.';


--
-- TOC entry 4880 (class 0 OID 0)
-- Dependencies: 337
-- Name: COLUMN restaurants.logo_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.logo_url IS 'Publicly accessible logo URL used in outbound communications.';


--
-- TOC entry 4881 (class 0 OID 0)
-- Dependencies: 337
-- Name: COLUMN restaurants.reservation_lifecycle_grace_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.reservation_lifecycle_grace_minutes IS 'Grace period in minutes for reservation lifecycle state transitions (check-in, no-show, etc.)';


--
-- TOC entry 4882 (class 0 OID 0)
-- Dependencies: 337
-- Name: COLUMN restaurants.google_review_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.google_review_url IS 'Google Review URL for post-dining review request emails';


--
-- TOC entry 4883 (class 0 OID 0)
-- Dependencies: 337
-- Name: COLUMN restaurants.email_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.email_templates IS 'Custom email templates overriding system defaults. Keyed by email type (e.g., "created", "reminder").';


--
-- TOC entry 338 (class 1259 OID 18062)
-- Name: service_policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_policy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lunch_start time without time zone DEFAULT '12:00:00'::time without time zone NOT NULL,
    lunch_end time without time zone DEFAULT '15:00:00'::time without time zone NOT NULL,
    dinner_start time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    dinner_end time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
    clean_buffer_minutes smallint DEFAULT 5 NOT NULL,
    allow_after_hours boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 4884 (class 0 OID 0)
-- Dependencies: 338
-- Name: COLUMN service_policy.allow_after_hours; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_policy.allow_after_hours IS 'If true, privileged staff may override standard operating hours when creating bookings.';


--
-- TOC entry 339 (class 1259 OID 18074)
-- Name: strategic_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.strategic_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    scarcity_weight numeric(8,2) DEFAULT 22 NOT NULL,
    demand_multiplier_override numeric(8,3),
    future_conflict_penalty numeric(10,2)
);


--
-- TOC entry 4885 (class 0 OID 0)
-- Dependencies: 339
-- Name: TABLE strategic_configs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.strategic_configs IS 'Restaurant-specific strategic planner configuration.';


--
-- TOC entry 340 (class 1259 OID 18081)
-- Name: table_adjacencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_adjacencies (
    table_a uuid NOT NULL,
    table_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT table_adjacencies_not_equal CHECK ((table_a <> table_b))
);


--
-- TOC entry 341 (class 1259 OID 18086)
-- Name: table_hold_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_hold_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hold_id uuid NOT NULL,
    table_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- TOC entry 4886 (class 0 OID 0)
-- Dependencies: 341
-- Name: TABLE table_hold_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_hold_members IS 'Junction table linking table holds to specific tables.';


--
-- TOC entry 342 (class 1259 OID 18091)
-- Name: table_hold_windows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_hold_windows (
    hold_id uuid NOT NULL,
    table_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_id uuid,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    hold_window tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)'::text)) STORED
);


--
-- TOC entry 4887 (class 0 OID 0)
-- Dependencies: 342
-- Name: TABLE table_hold_windows; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_hold_windows IS 'Denormalized view for fast conflict detection on table holds.';


--
-- TOC entry 343 (class 1259 OID 18097)
-- Name: table_holds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_holds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_id uuid,
    zone_id uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata jsonb,
    session_id uuid,
    status public.table_hold_status DEFAULT 'active'::public.table_hold_status NOT NULL,
    last_touched_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT table_holds_window_check CHECK ((start_at < end_at)),
    CONSTRAINT th_times_consistent CHECK ((expires_at >= end_at))
);


--
-- TOC entry 4888 (class 0 OID 0)
-- Dependencies: 343
-- Name: TABLE table_holds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_holds IS 'Ephemeral table reservations to guard allocations during quoting/confirmation flows.';


--
-- TOC entry 344 (class 1259 OID 18109)
-- Name: table_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    table_number text NOT NULL,
    capacity integer NOT NULL,
    section text,
    status public.table_status DEFAULT 'available'::public.table_status NOT NULL,
    "position" jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    zone_id uuid NOT NULL,
    category public.table_category NOT NULL,
    seating_type public.table_seating_type DEFAULT 'standard'::public.table_seating_type NOT NULL,
    mobility public.table_mobility DEFAULT 'movable'::public.table_mobility NOT NULL,
    active boolean DEFAULT true NOT NULL,
    min_party_size integer DEFAULT 1 NOT NULL,
    max_party_size integer,
    CONSTRAINT table_inventory_min_party_positive CHECK ((min_party_size > 0)),
    CONSTRAINT table_inventory_valid_party_range CHECK (((max_party_size IS NULL) OR (max_party_size >= min_party_size)))
);


--
-- TOC entry 4889 (class 0 OID 0)
-- Dependencies: 344
-- Name: TABLE table_inventory; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_inventory IS 'Physical table inventory. Party size rules are derived from mobility and capacity in application code.';


--
-- TOC entry 4890 (class 0 OID 0)
-- Dependencies: 344
-- Name: COLUMN table_inventory.table_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.table_number IS 'Display name for the table (e.g., "T1", "Main-5", "Patio-2")';


--
-- TOC entry 4891 (class 0 OID 0)
-- Dependencies: 344
-- Name: COLUMN table_inventory.capacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.capacity IS 'Physical property: number of seats. For fixed tables, this is also the max party size.';


--
-- TOC entry 4892 (class 0 OID 0)
-- Dependencies: 344
-- Name: COLUMN table_inventory.section; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.section IS 'Section name (e.g., "Main Floor", "Patio", "Bar Area", "Private Room")';


--
-- TOC entry 4893 (class 0 OID 0)
-- Dependencies: 344
-- Name: COLUMN table_inventory.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.status IS 'Current status: available, reserved, occupied, out_of_service';


--
-- TOC entry 4894 (class 0 OID 0)
-- Dependencies: 344
-- Name: COLUMN table_inventory."position"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory."position" IS 'Floor plan position as JSON: {x: number, y: number, rotation?: number} for drag-and-drop UI';


--
-- TOC entry 4895 (class 0 OID 0)
-- Dependencies: 344
-- Name: COLUMN table_inventory.mobility; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.mobility IS 'Physical property: whether table can be moved. Business rules are derived from this:
  - movable: can be merged with other tables (unlimited party size when combined)
  - fixed: cannot be merged (strict party size = capacity)';


--
-- TOC entry 4896 (class 0 OID 0)
-- Dependencies: 344
-- Name: COLUMN table_inventory.min_party_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.min_party_size IS 'Minimum party size for this table (e.g., 2-top only for parties of 2+)';


--
-- TOC entry 4897 (class 0 OID 0)
-- Dependencies: 344
-- Name: COLUMN table_inventory.max_party_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.max_party_size IS 'Optional maximum party size for this table; NULL means derive from capacity/mobility.';


--
-- TOC entry 345 (class 1259 OID 18124)
-- Name: table_merge_graph; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_merge_graph (
    restaurant_id uuid NOT NULL,
    table_a uuid NOT NULL,
    table_b uuid NOT NULL,
    merge_score integer DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now(),
    status text DEFAULT 'pending'::text NOT NULL
);


--
-- TOC entry 346 (class 1259 OID 18133)
-- Name: table_scarcity_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_scarcity_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    table_type text NOT NULL,
    scarcity_score numeric(5,4) NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT table_scarcity_metrics_scarcity_score_check CHECK (((scarcity_score >= (0)::numeric) AND (scarcity_score <= (1)::numeric)))
);


--
-- TOC entry 4898 (class 0 OID 0)
-- Dependencies: 346
-- Name: TABLE table_scarcity_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_scarcity_metrics IS 'Pre-computed scarcity scores for table types to optimize assignment.';


--
-- TOC entry 347 (class 1259 OID 18141)
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    name text,
    phone text,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_email_suppressed boolean DEFAULT false NOT NULL,
    CONSTRAINT user_profiles_phone_e164_check CHECK (((phone IS NULL) OR (phone ~ '^\\+[1-9]\\d{1,14}$'::text)))
);


--
-- TOC entry 4899 (class 0 OID 0)
-- Dependencies: 347
-- Name: TABLE user_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_profiles IS 'Global customer identity (1:1 with auth.users).';


--
-- TOC entry 4900 (class 0 OID 0)
-- Dependencies: 347
-- Name: COLUMN user_profiles.phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.phone IS 'User phone number stored in E.164 format (leading + and digits only).';


--
-- TOC entry 4901 (class 0 OID 0)
-- Dependencies: 347
-- Name: COLUMN user_profiles.is_email_suppressed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.is_email_suppressed IS 'If true, no emails (transactional or marketing) should be sent to this user. Set by webhook on bounce, spam complaint, or unsubscribe.';


--
-- TOC entry 348 (class 1259 OID 18151)
-- Name: waiting_list; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waiting_list (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_date date NOT NULL,
    desired_time time without time zone NOT NULL,
    party_size integer NOT NULL,
    seating_preference public.seating_preference_type DEFAULT 'any'::public.seating_preference_type NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT waiting_list_party_size_check CHECK ((party_size > 0))
);


--
-- TOC entry 4902 (class 0 OID 0)
-- Dependencies: 348
-- Name: TABLE waiting_list; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.waiting_list IS 'Customers waiting for availability on fully booked dates/times.';


--
-- TOC entry 349 (class 1259 OID 18161)
-- Name: zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT zones_name_not_blank CHECK ((char_length(TRIM(BOTH FROM name)) > 0))
);


--
-- TOC entry 4903 (class 0 OID 0)
-- Dependencies: 349
-- Name: TABLE zones; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.zones IS 'Dining zones within restaurants (e.g., Dining 1, Dining 2)';


--
-- TOC entry 4904 (class 0 OID 0)
-- Dependencies: 349
-- Name: COLUMN zones.active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.zones.active IS 'Indicates whether the zone is currently in service';


--
-- TOC entry 3840 (class 2604 OID 18172)
-- Name: _migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations ALTER COLUMN id SET DEFAULT nextval('public._migrations_id_seq'::regclass);


--
-- TOC entry 3881 (class 2604 OID 18173)
-- Name: booking_state_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_state_history ALTER COLUMN id SET DEFAULT nextval('public.booking_state_history_id_seq'::regclass);


--
-- TOC entry 4111 (class 2606 OID 18175)
-- Name: _migrations _migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_name_key UNIQUE (name);


--
-- TOC entry 4113 (class 2606 OID 18177)
-- Name: _migrations _migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 4122 (class 2606 OID 18179)
-- Name: allocations_archive allocations_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations_archive
    ADD CONSTRAINT allocations_archive_pkey PRIMARY KEY (id);


--
-- TOC entry 4115 (class 2606 OID 18181)
-- Name: allocations allocations_booking_resource_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_booking_resource_key UNIQUE (booking_id, resource_type, resource_id);


--
-- TOC entry 4117 (class 2606 OID 18183)
-- Name: allocations allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_pkey PRIMARY KEY (id);


--
-- TOC entry 4125 (class 2606 OID 18185)
-- Name: allowed_capacities allowed_capacities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allowed_capacities
    ADD CONSTRAINT allowed_capacities_pkey PRIMARY KEY (restaurant_id, capacity);


--
-- TOC entry 4128 (class 2606 OID 18187)
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- TOC entry 4136 (class 2606 OID 18189)
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4144 (class 2606 OID 18191)
-- Name: booking_assignment_attempts booking_assignment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_attempts
    ADD CONSTRAINT booking_assignment_attempts_pkey PRIMARY KEY (id);


--
-- TOC entry 4150 (class 2606 OID 18193)
-- Name: booking_assignment_idempotency booking_assignment_idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_idempotency
    ADD CONSTRAINT booking_assignment_idempotency_pkey PRIMARY KEY (booking_id, idempotency_key);


--
-- TOC entry 4155 (class 2606 OID 18195)
-- Name: booking_confirmation_results booking_confirmation_results_hold_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_confirmation_results
    ADD CONSTRAINT booking_confirmation_results_hold_id_key UNIQUE (hold_id);


--
-- TOC entry 4158 (class 2606 OID 18197)
-- Name: booking_confirmation_results booking_confirmation_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_confirmation_results
    ADD CONSTRAINT booking_confirmation_results_pkey PRIMARY KEY (booking_id, idempotency_key);


--
-- TOC entry 4165 (class 2606 OID 18199)
-- Name: booking_occasions_audit booking_occasions_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_occasions_audit
    ADD CONSTRAINT booking_occasions_audit_pkey PRIMARY KEY (id);


--
-- TOC entry 4162 (class 2606 OID 18201)
-- Name: booking_occasions booking_occasions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_occasions
    ADD CONSTRAINT booking_occasions_pkey PRIMARY KEY (key);


--
-- TOC entry 4167 (class 2606 OID 18203)
-- Name: booking_slots booking_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_pkey PRIMARY KEY (id);


--
-- TOC entry 4169 (class 2606 OID 18205)
-- Name: booking_slots booking_slots_restaurant_slot_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_restaurant_slot_key UNIQUE (restaurant_id, slot_date, slot_time);


--
-- TOC entry 4174 (class 2606 OID 18207)
-- Name: booking_state_history booking_state_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_state_history
    ADD CONSTRAINT booking_state_history_pkey PRIMARY KEY (id);


--
-- TOC entry 4095 (class 2606 OID 18209)
-- Name: booking_table_assignments booking_table_assignments_booking_table_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_booking_table_key UNIQUE (booking_id, table_id);


--
-- TOC entry 4098 (class 2606 OID 18211)
-- Name: booking_table_assignments booking_table_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 4100 (class 2606 OID 18213)
-- Name: booking_table_assignments booking_table_assignments_table_id_slot_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_table_id_slot_id_key UNIQUE (table_id, slot_id);


--
-- TOC entry 4178 (class 2606 OID 18215)
-- Name: booking_versions booking_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_versions
    ADD CONSTRAINT booking_versions_pkey PRIMARY KEY (version_id);


--
-- TOC entry 4183 (class 2606 OID 18217)
-- Name: bookings bookings_confirmation_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_confirmation_token_unique UNIQUE (confirmation_token);


--
-- TOC entry 4185 (class 2606 OID 18219)
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- TOC entry 4187 (class 2606 OID 18221)
-- Name: bookings bookings_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_reference_key UNIQUE (reference);


--
-- TOC entry 4209 (class 2606 OID 18223)
-- Name: capacity_outbox capacity_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capacity_outbox
    ADD CONSTRAINT capacity_outbox_pkey PRIMARY KEY (id);


--
-- TOC entry 4212 (class 2606 OID 18225)
-- Name: customer_profiles customer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_pkey PRIMARY KEY (customer_id);


--
-- TOC entry 4215 (class 2606 OID 18227)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- TOC entry 4217 (class 2606 OID 18229)
-- Name: customers customers_restaurant_email_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_restaurant_email_phone_key UNIQUE (restaurant_id, email_normalized, phone_normalized);


--
-- TOC entry 4219 (class 2606 OID 18231)
-- Name: customers customers_restaurant_id_email_normalized_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_restaurant_id_email_normalized_key UNIQUE (restaurant_id, email_normalized);


--
-- TOC entry 4221 (class 2606 OID 18233)
-- Name: customers customers_restaurant_id_phone_normalized_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_restaurant_id_phone_normalized_key UNIQUE (restaurant_id, phone_normalized);


--
-- TOC entry 4229 (class 2606 OID 18235)
-- Name: demand_profiles demand_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demand_profiles
    ADD CONSTRAINT demand_profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 4235 (class 2606 OID 18237)
-- Name: email_delivery_log email_delivery_log_message_recipient_status_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_delivery_log
    ADD CONSTRAINT email_delivery_log_message_recipient_status_key UNIQUE (message_id, recipient_email, status);


--
-- TOC entry 4238 (class 2606 OID 18239)
-- Name: email_delivery_log email_delivery_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_delivery_log
    ADD CONSTRAINT email_delivery_log_pkey PRIMARY KEY (id);


--
-- TOC entry 4242 (class 2606 OID 18241)
-- Name: feature_flag_overrides feature_flag_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flag_overrides
    ADD CONSTRAINT feature_flag_overrides_pkey PRIMARY KEY (id);


--
-- TOC entry 4244 (class 2606 OID 18243)
-- Name: feature_flag_overrides feature_flag_overrides_unique_flag_env; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flag_overrides
    ADD CONSTRAINT feature_flag_overrides_unique_flag_env UNIQUE (flag, environment);


--
-- TOC entry 4246 (class 2606 OID 18245)
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- TOC entry 4250 (class 2606 OID 18247)
-- Name: loyalty_point_events loyalty_point_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_point_events
    ADD CONSTRAINT loyalty_point_events_pkey PRIMARY KEY (id);


--
-- TOC entry 4253 (class 2606 OID 18249)
-- Name: loyalty_points loyalty_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_pkey PRIMARY KEY (id);


--
-- TOC entry 4255 (class 2606 OID 18251)
-- Name: loyalty_points loyalty_points_restaurant_id_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_restaurant_id_customer_id_key UNIQUE (restaurant_id, customer_id);


--
-- TOC entry 4258 (class 2606 OID 18253)
-- Name: loyalty_programs loyalty_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_pkey PRIMARY KEY (id);


--
-- TOC entry 4260 (class 2606 OID 18255)
-- Name: loyalty_programs loyalty_programs_restaurant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_restaurant_id_key UNIQUE (restaurant_id);


--
-- TOC entry 4262 (class 2606 OID 18257)
-- Name: manual_assignment_sessions manual_assignment_sessions_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_assignment_sessions
    ADD CONSTRAINT manual_assignment_sessions_booking_id_key UNIQUE (booking_id);


--
-- TOC entry 4264 (class 2606 OID 18259)
-- Name: manual_assignment_sessions manual_assignment_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_assignment_sessions
    ADD CONSTRAINT manual_assignment_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4270 (class 2606 OID 18261)
-- Name: merge_rules merge_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.merge_rules
    ADD CONSTRAINT merge_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 4273 (class 2606 OID 18263)
-- Name: observability_events observability_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observability_events
    ADD CONSTRAINT observability_events_pkey PRIMARY KEY (id);


--
-- TOC entry 4275 (class 2606 OID 18265)
-- Name: profile_update_requests profile_update_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_update_requests
    ADD CONSTRAINT profile_update_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 4280 (class 2606 OID 18267)
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 4283 (class 2606 OID 18269)
-- Name: restaurant_capacity_rules restaurant_capacity_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_capacity_rules
    ADD CONSTRAINT restaurant_capacity_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 4286 (class 2606 OID 18271)
-- Name: restaurant_invites restaurant_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_invites
    ADD CONSTRAINT restaurant_invites_pkey PRIMARY KEY (id);


--
-- TOC entry 4292 (class 2606 OID 18273)
-- Name: restaurant_memberships restaurant_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_memberships
    ADD CONSTRAINT restaurant_memberships_pkey PRIMARY KEY (user_id, restaurant_id);


--
-- TOC entry 4295 (class 2606 OID 18275)
-- Name: restaurant_operating_hours restaurant_operating_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_operating_hours
    ADD CONSTRAINT restaurant_operating_hours_pkey PRIMARY KEY (id);


--
-- TOC entry 4298 (class 2606 OID 18277)
-- Name: restaurant_service_periods restaurant_service_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_service_periods
    ADD CONSTRAINT restaurant_service_periods_pkey PRIMARY KEY (id);


--
-- TOC entry 4301 (class 2606 OID 18279)
-- Name: restaurant_turn_bands restaurant_turn_bands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_turn_bands
    ADD CONSTRAINT restaurant_turn_bands_pkey PRIMARY KEY (id);


--
-- TOC entry 4306 (class 2606 OID 18281)
-- Name: restaurants restaurants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_pkey PRIMARY KEY (id);


--
-- TOC entry 4308 (class 2606 OID 18283)
-- Name: restaurants restaurants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_slug_key UNIQUE (slug);


--
-- TOC entry 4310 (class 2606 OID 18285)
-- Name: service_policy service_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_policy
    ADD CONSTRAINT service_policy_pkey PRIMARY KEY (id);


--
-- TOC entry 4313 (class 2606 OID 18290)
-- Name: strategic_configs strategic_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_configs
    ADD CONSTRAINT strategic_configs_pkey PRIMARY KEY (id);


--
-- TOC entry 4315 (class 2606 OID 18292)
-- Name: strategic_configs strategic_configs_restaurant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_configs
    ADD CONSTRAINT strategic_configs_restaurant_id_key UNIQUE (restaurant_id);


--
-- TOC entry 4317 (class 2606 OID 18294)
-- Name: table_adjacencies table_adjacencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_adjacencies
    ADD CONSTRAINT table_adjacencies_pkey PRIMARY KEY (table_a, table_b);


--
-- TOC entry 4322 (class 2606 OID 18296)
-- Name: table_hold_members table_hold_members_hold_id_table_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_members
    ADD CONSTRAINT table_hold_members_hold_id_table_id_key UNIQUE (hold_id, table_id);


--
-- TOC entry 4324 (class 2606 OID 18298)
-- Name: table_hold_members table_hold_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_members
    ADD CONSTRAINT table_hold_members_pkey PRIMARY KEY (id);


--
-- TOC entry 4329 (class 2606 OID 18300)
-- Name: table_hold_windows table_hold_windows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_windows
    ADD CONSTRAINT table_hold_windows_pkey PRIMARY KEY (hold_id, table_id);


--
-- TOC entry 4341 (class 2606 OID 18302)
-- Name: table_holds table_holds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_pkey PRIMARY KEY (id);


--
-- TOC entry 4349 (class 2606 OID 18304)
-- Name: table_inventory table_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 4351 (class 2606 OID 18306)
-- Name: table_inventory table_inventory_restaurant_id_table_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_restaurant_id_table_number_key UNIQUE (restaurant_id, table_number);


--
-- TOC entry 4359 (class 2606 OID 18308)
-- Name: table_scarcity_metrics table_scarcity_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_scarcity_metrics
    ADD CONSTRAINT table_scarcity_metrics_pkey PRIMARY KEY (id);


--
-- TOC entry 4361 (class 2606 OID 18310)
-- Name: table_scarcity_metrics unique_restaurant_table_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_scarcity_metrics
    ADD CONSTRAINT unique_restaurant_table_type UNIQUE (restaurant_id, table_type);


--
-- TOC entry 4364 (class 2606 OID 18312)
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 4368 (class 2606 OID 18314)
-- Name: waiting_list waiting_list_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiting_list
    ADD CONSTRAINT waiting_list_pkey PRIMARY KEY (id);


--
-- TOC entry 4371 (class 2606 OID 18316)
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- TOC entry 4120 (class 1259 OID 18317)
-- Name: allocations_archive_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX allocations_archive_booking_idx ON public.allocations_archive USING btree (booking_id);


--
-- TOC entry 4123 (class 1259 OID 18318)
-- Name: allocations_archive_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX allocations_archive_restaurant_idx ON public.allocations_archive USING btree (restaurant_id);


--
-- TOC entry 4126 (class 1259 OID 18319)
-- Name: allowed_capacities_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX allowed_capacities_restaurant_idx ON public.allowed_capacities USING btree (restaurant_id, capacity);


--
-- TOC entry 4145 (class 1259 OID 18320)
-- Name: bai_rest_bk_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bai_rest_bk_idx ON public.booking_assignment_idempotency USING btree (booking_id, idempotency_key);


--
-- TOC entry 4141 (class 1259 OID 18321)
-- Name: booking_assignment_attempts_booking_attempt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX booking_assignment_attempts_booking_attempt_idx ON public.booking_assignment_attempts USING btree (booking_id, attempt_no);


--
-- TOC entry 4142 (class 1259 OID 18322)
-- Name: booking_assignment_attempts_booking_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_assignment_attempts_booking_created_idx ON public.booking_assignment_attempts USING btree (booking_id, created_at DESC);


--
-- TOC entry 4146 (class 1259 OID 18323)
-- Name: booking_assignment_idempo_bkid_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_assignment_idempo_bkid_key_idx ON public.booking_assignment_idempotency USING btree (booking_id, idempotency_key);


--
-- TOC entry 4147 (class 1259 OID 18324)
-- Name: booking_assignment_idempotency_booking_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX booking_assignment_idempotency_booking_hash_key ON public.booking_assignment_idempotency USING btree (booking_id, table_set_hash) WHERE (table_set_hash IS NOT NULL);


--
-- TOC entry 4148 (class 1259 OID 18325)
-- Name: booking_assignment_idempotency_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_assignment_idempotency_created_idx ON public.booking_assignment_idempotency USING btree (created_at DESC);


--
-- TOC entry 4153 (class 1259 OID 18326)
-- Name: booking_confirmation_results_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_confirmation_results_created_idx ON public.booking_confirmation_results USING btree (created_at DESC);


--
-- TOC entry 4156 (class 1259 OID 18327)
-- Name: booking_confirmation_results_hold_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_confirmation_results_hold_idx ON public.booking_confirmation_results USING btree (hold_id);


--
-- TOC entry 4159 (class 1259 OID 18328)
-- Name: booking_occasions_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_occasions_active_idx ON public.booking_occasions USING btree (is_active, deleted_at) WHERE (deleted_at IS NULL);


--
-- TOC entry 4163 (class 1259 OID 18329)
-- Name: booking_occasions_audit_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_occasions_audit_key_idx ON public.booking_occasions_audit USING btree (occasion_key);


--
-- TOC entry 4160 (class 1259 OID 18330)
-- Name: booking_occasions_display_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_occasions_display_order_idx ON public.booking_occasions USING btree (display_order);


--
-- TOC entry 4096 (class 1259 OID 18331)
-- Name: booking_table_assignments_merge_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_table_assignments_merge_group_idx ON public.booking_table_assignments USING btree (merge_group_id);


--
-- TOC entry 4188 (class 1259 OID 18332)
-- Name: bookings_restaurant_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_restaurant_date_idx ON public.bookings USING btree (restaurant_id, booking_date, start_at);


--
-- TOC entry 4189 (class 1259 OID 18333)
-- Name: bookings_restaurant_date_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_restaurant_date_status_idx ON public.bookings USING btree (restaurant_id, booking_date, status);


--
-- TOC entry 4101 (class 1259 OID 18334)
-- Name: bta_booking_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bta_booking_id_idx ON public.booking_table_assignments USING btree (booking_id);


--
-- TOC entry 4102 (class 1259 OID 18335)
-- Name: bta_table_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bta_table_id_idx ON public.booking_table_assignments USING btree (table_id);


--
-- TOC entry 4103 (class 1259 OID 18336)
-- Name: bta_window_gist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bta_window_gist ON public.booking_table_assignments USING gist (assignment_window);


--
-- TOC entry 4205 (class 1259 OID 18337)
-- Name: capacity_outbox_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX capacity_outbox_booking_idx ON public.capacity_outbox USING btree (booking_id);


--
-- TOC entry 4206 (class 1259 OID 18338)
-- Name: capacity_outbox_dedupe; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX capacity_outbox_dedupe ON public.capacity_outbox USING btree (event_type, COALESCE(dedupe_key, ''::text), COALESCE(idempotency_key, ''::text)) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));


--
-- TOC entry 4207 (class 1259 OID 18339)
-- Name: capacity_outbox_dispatch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX capacity_outbox_dispatch_idx ON public.capacity_outbox USING btree (status, next_attempt_at);


--
-- TOC entry 4210 (class 1259 OID 18340)
-- Name: capacity_outbox_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX capacity_outbox_restaurant_idx ON public.capacity_outbox USING btree (restaurant_id);


--
-- TOC entry 4222 (class 1259 OID 18341)
-- Name: customers_restaurant_id_user_profile_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_restaurant_id_user_profile_id_unique ON public.customers USING btree (restaurant_id, user_profile_id) WHERE (user_profile_id IS NOT NULL);


--
-- TOC entry 4232 (class 1259 OID 18342)
-- Name: email_delivery_log_booking_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_delivery_log_booking_id_idx ON public.email_delivery_log USING btree (booking_id);


--
-- TOC entry 4233 (class 1259 OID 18343)
-- Name: email_delivery_log_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_delivery_log_message_id_idx ON public.email_delivery_log USING btree (message_id);


--
-- TOC entry 4236 (class 1259 OID 18344)
-- Name: email_delivery_log_occurred_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_delivery_log_occurred_at_idx ON public.email_delivery_log USING btree (occurred_at DESC);


--
-- TOC entry 4239 (class 1259 OID 18345)
-- Name: email_delivery_log_restaurant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_delivery_log_restaurant_id_idx ON public.email_delivery_log USING btree (restaurant_id);


--
-- TOC entry 4240 (class 1259 OID 19408)
-- Name: email_delivery_log_restaurant_occurred_at_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_delivery_log_restaurant_occurred_at_id_idx ON public.email_delivery_log USING btree (restaurant_id, occurred_at DESC, id DESC);


--
-- TOC entry 4118 (class 1259 OID 18346)
-- Name: idx_allocations_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_restaurant ON public.allocations USING btree (restaurant_id);


--
-- TOC entry 4119 (class 1259 OID 18347)
-- Name: idx_allocations_window_gist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_window_gist ON public.allocations USING gist ("window");


--
-- TOC entry 4129 (class 1259 OID 18348)
-- Name: idx_analytics_events_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_booking_id ON public.analytics_events USING btree (booking_id);


--
-- TOC entry 4130 (class 1259 OID 18349)
-- Name: idx_analytics_events_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_customer_id ON public.analytics_events USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- TOC entry 4131 (class 1259 OID 18350)
-- Name: idx_analytics_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_event_type ON public.analytics_events USING btree (event_type);


--
-- TOC entry 4132 (class 1259 OID 18351)
-- Name: idx_analytics_events_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_occurred_at ON public.analytics_events USING btree (occurred_at DESC);


--
-- TOC entry 4133 (class 1259 OID 18352)
-- Name: idx_analytics_events_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_restaurant_id ON public.analytics_events USING btree (restaurant_id);


--
-- TOC entry 4134 (class 1259 OID 18353)
-- Name: idx_analytics_events_restaurant_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_restaurant_occurred ON public.analytics_events USING btree (restaurant_id, occurred_at DESC);


--
-- TOC entry 4137 (class 1259 OID 18354)
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- TOC entry 4138 (class 1259 OID 18355)
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- TOC entry 4139 (class 1259 OID 18356)
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity, entity_id);


--
-- TOC entry 4140 (class 1259 OID 18357)
-- Name: idx_audit_logs_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity_id ON public.audit_logs USING btree (entity, entity_id);


--
-- TOC entry 4151 (class 1259 OID 18358)
-- Name: idx_booking_assignment_idempotency_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_assignment_idempotency_booking ON public.booking_assignment_idempotency USING btree (booking_id);


--
-- TOC entry 4152 (class 1259 OID 18359)
-- Name: idx_booking_assignment_idempotency_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_assignment_idempotency_created ON public.booking_assignment_idempotency USING btree (created_at);


--
-- TOC entry 4170 (class 1259 OID 18360)
-- Name: idx_booking_slots_date_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_slots_date_range ON public.booking_slots USING btree (restaurant_id, slot_date);


--
-- TOC entry 4905 (class 0 OID 0)
-- Dependencies: 4170
-- Name: INDEX idx_booking_slots_date_range; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_slots_date_range IS 'Fast queries for all slots on a given date';


--
-- TOC entry 4171 (class 1259 OID 18361)
-- Name: idx_booking_slots_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_slots_lookup ON public.booking_slots USING btree (restaurant_id, slot_date, slot_time);


--
-- TOC entry 4906 (class 0 OID 0)
-- Dependencies: 4171
-- Name: INDEX idx_booking_slots_lookup; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_slots_lookup IS 'Fast lookup for specific slot (primary use case)';


--
-- TOC entry 4172 (class 1259 OID 18362)
-- Name: idx_booking_slots_service_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_slots_service_period ON public.booking_slots USING btree (service_period_id, slot_date);


--
-- TOC entry 4907 (class 0 OID 0)
-- Dependencies: 4172
-- Name: INDEX idx_booking_slots_service_period; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_slots_service_period IS 'Fast queries by service period (e.g., all lunch slots)';


--
-- TOC entry 4175 (class 1259 OID 18363)
-- Name: idx_booking_state_history_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_state_history_booking ON public.booking_state_history USING btree (booking_id, changed_at DESC);


--
-- TOC entry 4908 (class 0 OID 0)
-- Dependencies: 4175
-- Name: INDEX idx_booking_state_history_booking; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_state_history_booking IS 'Lookup transitions for a booking ordered by recency.';


--
-- TOC entry 4176 (class 1259 OID 18364)
-- Name: idx_booking_state_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_state_history_changed_at ON public.booking_state_history USING btree (changed_at);


--
-- TOC entry 4909 (class 0 OID 0)
-- Dependencies: 4176
-- Name: INDEX idx_booking_state_history_changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_state_history_changed_at IS 'Support chronological reporting of booking transitions.';


--
-- TOC entry 4104 (class 1259 OID 18365)
-- Name: idx_booking_table_assignments_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_table_assignments_booking ON public.booking_table_assignments USING btree (booking_id);


--
-- TOC entry 4910 (class 0 OID 0)
-- Dependencies: 4104
-- Name: INDEX idx_booking_table_assignments_booking; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_table_assignments_booking IS 'Fast lookup of tables assigned to a booking';


--
-- TOC entry 4105 (class 1259 OID 18366)
-- Name: idx_booking_table_assignments_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_table_assignments_booking_id ON public.booking_table_assignments USING btree (booking_id);


--
-- TOC entry 4911 (class 0 OID 0)
-- Dependencies: 4105
-- Name: INDEX idx_booking_table_assignments_booking_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_table_assignments_booking_id IS 'Improves performance of booking assignment validation trigger';


--
-- TOC entry 4106 (class 1259 OID 18367)
-- Name: idx_booking_table_assignments_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_table_assignments_slot ON public.booking_table_assignments USING btree (slot_id);


--
-- TOC entry 4912 (class 0 OID 0)
-- Dependencies: 4106
-- Name: INDEX idx_booking_table_assignments_slot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_table_assignments_slot IS 'Fast lookup of assignments per slot';


--
-- TOC entry 4107 (class 1259 OID 18368)
-- Name: idx_booking_table_assignments_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_table_assignments_table ON public.booking_table_assignments USING btree (table_id, assigned_at);


--
-- TOC entry 4913 (class 0 OID 0)
-- Dependencies: 4107
-- Name: INDEX idx_booking_table_assignments_table; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_table_assignments_table IS 'Fast lookup of bookings using a table (for reservation timeline)';


--
-- TOC entry 4179 (class 1259 OID 18369)
-- Name: idx_booking_versions_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_versions_booking_id ON public.booking_versions USING btree (booking_id);


--
-- TOC entry 4180 (class 1259 OID 18370)
-- Name: idx_booking_versions_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_versions_changed_at ON public.booking_versions USING btree (changed_at DESC);


--
-- TOC entry 4181 (class 1259 OID 18371)
-- Name: idx_booking_versions_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_versions_restaurant_id ON public.booking_versions USING btree (restaurant_id);


--
-- TOC entry 4190 (class 1259 OID 18372)
-- Name: idx_bookings_auth_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_auth_user ON public.bookings USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);


--
-- TOC entry 4191 (class 1259 OID 18373)
-- Name: idx_bookings_auto_assign_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_auto_assign_idempotency_key ON public.bookings USING btree (auto_assign_idempotency_key) WHERE (auto_assign_idempotency_key IS NOT NULL);


--
-- TOC entry 4192 (class 1259 OID 18374)
-- Name: idx_bookings_client_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_client_request_id ON public.bookings USING btree (client_request_id);


--
-- TOC entry 4193 (class 1259 OID 18375)
-- Name: idx_bookings_confirmation_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_confirmation_token ON public.bookings USING btree (confirmation_token) WHERE (confirmation_token IS NOT NULL);


--
-- TOC entry 4194 (class 1259 OID 18376)
-- Name: idx_bookings_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_created ON public.bookings USING btree (restaurant_id, created_at DESC);


--
-- TOC entry 4195 (class 1259 OID 18377)
-- Name: idx_bookings_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_customer ON public.bookings USING btree (customer_id);


--
-- TOC entry 4196 (class 1259 OID 18378)
-- Name: idx_bookings_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_date ON public.bookings USING btree (restaurant_id, booking_date);


--
-- TOC entry 4197 (class 1259 OID 18379)
-- Name: idx_bookings_datetime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_datetime ON public.bookings USING btree (restaurant_id, start_at, end_at);


--
-- TOC entry 4198 (class 1259 OID 18380)
-- Name: idx_bookings_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_idempotency_key ON public.bookings USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- TOC entry 4199 (class 1259 OID 18381)
-- Name: idx_bookings_pending_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_pending_ref ON public.bookings USING btree (pending_ref) WHERE (pending_ref IS NOT NULL);


--
-- TOC entry 4200 (class 1259 OID 18382)
-- Name: idx_bookings_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_reference ON public.bookings USING btree (reference);


--
-- TOC entry 4201 (class 1259 OID 18383)
-- Name: idx_bookings_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_restaurant ON public.bookings USING btree (restaurant_id);


--
-- TOC entry 4202 (class 1259 OID 18384)
-- Name: idx_bookings_restaurant_date_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_restaurant_date_end ON public.bookings USING btree (restaurant_id, booking_date, end_at);


--
-- TOC entry 4203 (class 1259 OID 18385)
-- Name: idx_bookings_restaurant_date_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_restaurant_date_start ON public.bookings USING btree (restaurant_id, booking_date, start_at);


--
-- TOC entry 4204 (class 1259 OID 18386)
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_status ON public.bookings USING btree (restaurant_id, status);


--
-- TOC entry 4108 (class 1259 OID 18387)
-- Name: idx_bta_booking_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bta_booking_end ON public.booking_table_assignments USING btree (booking_id, end_at);


--
-- TOC entry 4109 (class 1259 OID 18388)
-- Name: idx_bta_booking_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bta_booking_start ON public.booking_table_assignments USING btree (booking_id, start_at);


--
-- TOC entry 4213 (class 1259 OID 18389)
-- Name: idx_customer_profiles_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_profiles_updated_at ON public.customer_profiles USING btree (updated_at DESC);


--
-- TOC entry 4223 (class 1259 OID 18390)
-- Name: idx_customers_auth_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_auth_user ON public.customers USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);


--
-- TOC entry 4224 (class 1259 OID 18391)
-- Name: idx_customers_email_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_email_normalized ON public.customers USING btree (restaurant_id, email_normalized);


--
-- TOC entry 4225 (class 1259 OID 18392)
-- Name: idx_customers_phone_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_phone_normalized ON public.customers USING btree (restaurant_id, phone_normalized);


--
-- TOC entry 4226 (class 1259 OID 18393)
-- Name: idx_customers_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_restaurant ON public.customers USING btree (restaurant_id);


--
-- TOC entry 4227 (class 1259 OID 18394)
-- Name: idx_customers_user_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_user_profile_id ON public.customers USING btree (user_profile_id);


--
-- TOC entry 4230 (class 1259 OID 18395)
-- Name: idx_demand_profiles_restaurant_day_window; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demand_profiles_restaurant_day_window ON public.demand_profiles USING btree (restaurant_id, day_of_week, service_window);


--
-- TOC entry 4231 (class 1259 OID 18396)
-- Name: idx_demand_profiles_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demand_profiles_updated_at ON public.demand_profiles USING btree (updated_at);


--
-- TOC entry 4247 (class 1259 OID 18397)
-- Name: idx_loyalty_point_events_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_point_events_booking ON public.loyalty_point_events USING btree (booking_id) WHERE (booking_id IS NOT NULL);


--
-- TOC entry 4248 (class 1259 OID 18398)
-- Name: idx_loyalty_point_events_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_point_events_customer ON public.loyalty_point_events USING btree (customer_id);


--
-- TOC entry 4251 (class 1259 OID 18399)
-- Name: idx_loyalty_points_restaurant_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_points_restaurant_customer ON public.loyalty_points USING btree (restaurant_id, customer_id);


--
-- TOC entry 4256 (class 1259 OID 18400)
-- Name: idx_loyalty_programs_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_programs_restaurant ON public.loyalty_programs USING btree (restaurant_id);


--
-- TOC entry 4289 (class 1259 OID 18401)
-- Name: idx_memberships_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_restaurant ON public.restaurant_memberships USING btree (restaurant_id);


--
-- TOC entry 4290 (class 1259 OID 18402)
-- Name: idx_memberships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_user ON public.restaurant_memberships USING btree (user_id);


--
-- TOC entry 4277 (class 1259 OID 18403)
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email) WHERE (email IS NOT NULL);


--
-- TOC entry 4278 (class 1259 OID 18404)
-- Name: idx_profiles_has_access; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_has_access ON public.profiles USING btree (has_access);


--
-- TOC entry 4281 (class 1259 OID 18405)
-- Name: idx_restaurant_capacity_rules_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_capacity_rules_scope ON public.restaurant_capacity_rules USING btree (restaurant_id, COALESCE((day_of_week)::integer, '-1'::integer), effective_date);


--
-- TOC entry 4293 (class 1259 OID 18406)
-- Name: idx_restaurant_operating_hours_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_operating_hours_scope ON public.restaurant_operating_hours USING btree (restaurant_id, COALESCE((day_of_week)::integer, '-1'::integer), effective_date);


--
-- TOC entry 4296 (class 1259 OID 18407)
-- Name: idx_restaurant_service_periods_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_service_periods_scope ON public.restaurant_service_periods USING btree (restaurant_id, COALESCE((day_of_week)::integer, '-1'::integer));


--
-- TOC entry 4303 (class 1259 OID 18408)
-- Name: idx_restaurants_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurants_active ON public.restaurants USING btree (is_active);


--
-- TOC entry 4304 (class 1259 OID 18409)
-- Name: idx_restaurants_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurants_slug ON public.restaurants USING btree (slug);


--
-- TOC entry 4311 (class 1259 OID 18410)
-- Name: idx_strategic_configs_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_strategic_configs_restaurant ON public.strategic_configs USING btree (restaurant_id);


--
-- TOC entry 4319 (class 1259 OID 18411)
-- Name: idx_table_hold_members_hold; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_hold_members_hold ON public.table_hold_members USING btree (hold_id);


--
-- TOC entry 4320 (class 1259 OID 18412)
-- Name: idx_table_hold_members_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_hold_members_table ON public.table_hold_members USING btree (table_id);


--
-- TOC entry 4333 (class 1259 OID 18413)
-- Name: idx_table_holds_restaurant_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_holds_restaurant_end ON public.table_holds USING btree (restaurant_id, end_at);


--
-- TOC entry 4334 (class 1259 OID 18414)
-- Name: idx_table_holds_restaurant_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_holds_restaurant_expires ON public.table_holds USING btree (restaurant_id, expires_at);


--
-- TOC entry 4335 (class 1259 OID 18415)
-- Name: idx_table_holds_restaurant_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_holds_restaurant_start ON public.table_holds USING btree (restaurant_id, start_at);


--
-- TOC entry 4346 (class 1259 OID 18416)
-- Name: idx_table_inventory_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_inventory_lookup ON public.table_inventory USING btree (restaurant_id, status, capacity);


--
-- TOC entry 4914 (class 0 OID 0)
-- Dependencies: 4346
-- Name: INDEX idx_table_inventory_lookup; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_table_inventory_lookup IS 'Fast lookup for available tables by restaurant and capacity';


--
-- TOC entry 4347 (class 1259 OID 18417)
-- Name: idx_table_inventory_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_inventory_section ON public.table_inventory USING btree (restaurant_id, section);


--
-- TOC entry 4915 (class 0 OID 0)
-- Dependencies: 4347
-- Name: INDEX idx_table_inventory_section; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_table_inventory_section IS 'Fast filtering by section for floor plan views';


--
-- TOC entry 4353 (class 1259 OID 18418)
-- Name: idx_table_merge_graph_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_merge_graph_restaurant_id ON public.table_merge_graph USING btree (restaurant_id);


--
-- TOC entry 4354 (class 1259 OID 18419)
-- Name: idx_table_merge_graph_table_a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_merge_graph_table_a ON public.table_merge_graph USING btree (table_a);


--
-- TOC entry 4355 (class 1259 OID 18420)
-- Name: idx_table_merge_graph_table_b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_merge_graph_table_b ON public.table_merge_graph USING btree (table_b);


--
-- TOC entry 4356 (class 1259 OID 18421)
-- Name: idx_table_scarcity_metrics_computed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_scarcity_metrics_computed_at ON public.table_scarcity_metrics USING btree (computed_at);


--
-- TOC entry 4357 (class 1259 OID 18422)
-- Name: idx_table_scarcity_metrics_restaurant_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_scarcity_metrics_restaurant_type ON public.table_scarcity_metrics USING btree (restaurant_id, table_type);


--
-- TOC entry 4362 (class 1259 OID 18423)
-- Name: idx_user_profiles_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_phone ON public.user_profiles USING btree (phone);


--
-- TOC entry 4365 (class 1259 OID 18424)
-- Name: idx_waiting_list_restaurant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waiting_list_restaurant_date ON public.waiting_list USING btree (restaurant_id, booking_date);


--
-- TOC entry 4265 (class 1259 OID 18425)
-- Name: mas_active_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mas_active_state_idx ON public.manual_assignment_sessions USING btree (state) WHERE (state = ANY (ARRAY['none'::public.manual_assignment_session_state, 'proposed'::public.manual_assignment_session_state, 'held'::public.manual_assignment_session_state, 'conflicted'::public.manual_assignment_session_state]));


--
-- TOC entry 4266 (class 1259 OID 18426)
-- Name: mas_booking_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mas_booking_state_idx ON public.manual_assignment_sessions USING btree (booking_id, state);


--
-- TOC entry 4267 (class 1259 OID 18427)
-- Name: mas_restaurant_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mas_restaurant_state_idx ON public.manual_assignment_sessions USING btree (restaurant_id, state);


--
-- TOC entry 4268 (class 1259 OID 18428)
-- Name: merge_rules_from_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX merge_rules_from_to_idx ON public.merge_rules USING btree (from_a, from_b, to_capacity);


--
-- TOC entry 4271 (class 1259 OID 18429)
-- Name: observability_events_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observability_events_created_at_idx ON public.observability_events USING btree (created_at DESC);


--
-- TOC entry 4276 (class 1259 OID 18430)
-- Name: profile_update_requests_profile_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profile_update_requests_profile_key_idx ON public.profile_update_requests USING btree (profile_id, idempotency_key);


--
-- TOC entry 4284 (class 1259 OID 18431)
-- Name: restaurant_invites_pending_unique_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_invites_pending_unique_email ON public.restaurant_invites USING btree (restaurant_id, email_normalized) WHERE (status = 'pending'::text);


--
-- TOC entry 4287 (class 1259 OID 18432)
-- Name: restaurant_invites_restaurant_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restaurant_invites_restaurant_status_idx ON public.restaurant_invites USING btree (restaurant_id, status, expires_at DESC);


--
-- TOC entry 4288 (class 1259 OID 18433)
-- Name: restaurant_invites_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_invites_token_hash_key ON public.restaurant_invites USING btree (token_hash);


--
-- TOC entry 4299 (class 1259 OID 18434)
-- Name: restaurant_turn_bands_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restaurant_turn_bands_lookup_idx ON public.restaurant_turn_bands USING btree (restaurant_id, booking_option, max_party_size);


--
-- TOC entry 4302 (class 1259 OID 18435)
-- Name: restaurant_turn_bands_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_turn_bands_unique_idx ON public.restaurant_turn_bands USING btree (restaurant_id, booking_option, max_party_size);


--
-- TOC entry 4318 (class 1259 OID 18436)
-- Name: table_adjacencies_table_b_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_adjacencies_table_b_idx ON public.table_adjacencies USING btree (table_b);


--
-- TOC entry 4325 (class 1259 OID 18437)
-- Name: table_hold_members_table_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_hold_members_table_active_idx ON public.table_hold_members USING btree (table_id);


--
-- TOC entry 4326 (class 1259 OID 18438)
-- Name: table_hold_members_table_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_hold_members_table_idx ON public.table_hold_members USING btree (table_id);


--
-- TOC entry 4330 (class 1259 OID 18439)
-- Name: table_hold_windows_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_hold_windows_restaurant_idx ON public.table_hold_windows USING btree (restaurant_id);


--
-- TOC entry 4331 (class 1259 OID 18440)
-- Name: table_hold_windows_table_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_hold_windows_table_idx ON public.table_hold_windows USING btree (table_id);


--
-- TOC entry 4336 (class 1259 OID 18441)
-- Name: table_holds_active_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_active_booking_idx ON public.table_holds USING btree (booking_id) WHERE (status = 'active'::public.table_hold_status);


--
-- TOC entry 4337 (class 1259 OID 18442)
-- Name: table_holds_active_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_active_restaurant_idx ON public.table_holds USING btree (restaurant_id, start_at, end_at) WHERE (status = 'active'::public.table_hold_status);


--
-- TOC entry 4338 (class 1259 OID 18443)
-- Name: table_holds_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_booking_idx ON public.table_holds USING btree (booking_id);


--
-- TOC entry 4339 (class 1259 OID 18444)
-- Name: table_holds_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_expires_at_idx ON public.table_holds USING btree (expires_at);


--
-- TOC entry 4342 (class 1259 OID 18445)
-- Name: table_holds_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_restaurant_idx ON public.table_holds USING btree (restaurant_id, start_at, end_at, expires_at);


--
-- TOC entry 4343 (class 1259 OID 18446)
-- Name: table_holds_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_session_idx ON public.table_holds USING btree (session_id);


--
-- TOC entry 4344 (class 1259 OID 18447)
-- Name: table_holds_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_status_idx ON public.table_holds USING btree (status);


--
-- TOC entry 4345 (class 1259 OID 18448)
-- Name: table_holds_zone_start_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_zone_start_idx ON public.table_holds USING btree (zone_id, start_at);


--
-- TOC entry 4352 (class 1259 OID 18449)
-- Name: table_inventory_zone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_inventory_zone_idx ON public.table_inventory USING btree (zone_id);


--
-- TOC entry 4327 (class 1259 OID 18450)
-- Name: thm_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX thm_unique ON public.table_hold_members USING btree (hold_id, table_id);


--
-- TOC entry 4332 (class 1259 OID 18451)
-- Name: thw_window_gist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX thw_window_gist ON public.table_hold_windows USING gist (hold_window);


--
-- TOC entry 4366 (class 1259 OID 18452)
-- Name: waiting_list_customer_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX waiting_list_customer_unique_idx ON public.waiting_list USING btree (restaurant_id, booking_date, desired_time, customer_email, COALESCE(customer_phone, ''::text));


--
-- TOC entry 4369 (class 1259 OID 18453)
-- Name: waiting_list_restaurant_date_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waiting_list_restaurant_date_time_idx ON public.waiting_list USING btree (restaurant_id, booking_date, desired_time, created_at);


--
-- TOC entry 4372 (class 1259 OID 18454)
-- Name: zones_restaurant_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX zones_restaurant_name_idx ON public.zones USING btree (restaurant_id, lower(name));


--
-- TOC entry 4453 (class 2620 OID 18455)
-- Name: allocations allocations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER allocations_updated_at BEFORE UPDATE ON public.allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4455 (class 2620 OID 18456)
-- Name: allowed_capacities allowed_capacities_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER allowed_capacities_touch_updated_at BEFORE UPDATE ON public.allowed_capacities FOR EACH ROW EXECUTE FUNCTION public.allowed_capacities_set_updated_at();


--
-- TOC entry 4450 (class 2620 OID 18457)
-- Name: booking_table_assignments bar_tables_drinks_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bar_tables_drinks_only BEFORE INSERT OR UPDATE ON public.booking_table_assignments FOR EACH ROW EXECUTE FUNCTION public.enforce_bar_drinks_only();


--
-- TOC entry 4458 (class 2620 OID 18458)
-- Name: bookings booking_assignment_validation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_assignment_validation BEFORE UPDATE ON public.bookings FOR EACH ROW WHEN ((new.status = 'confirmed'::public.booking_status)) EXECUTE FUNCTION public.validate_booking_has_assignments();


--
-- TOC entry 4456 (class 2620 OID 18459)
-- Name: booking_slots booking_slots_increment_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_slots_increment_version BEFORE UPDATE ON public.booking_slots FOR EACH ROW EXECUTE FUNCTION public.increment_booking_slot_version();


--
-- TOC entry 4457 (class 2620 OID 18460)
-- Name: booking_slots booking_slots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_slots_updated_at BEFORE UPDATE ON public.booking_slots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4451 (class 2620 OID 18461)
-- Name: booking_table_assignments booking_table_assignments_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_table_assignments_audit AFTER INSERT OR DELETE ON public.booking_table_assignments FOR EACH ROW EXECUTE FUNCTION public.log_table_assignment_change();


--
-- TOC entry 4452 (class 2620 OID 18462)
-- Name: booking_table_assignments booking_table_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_table_assignments_updated_at BEFORE UPDATE ON public.booking_table_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4459 (class 2620 OID 18463)
-- Name: bookings bookings_set_instants; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_set_instants BEFORE INSERT OR UPDATE OF booking_date, start_time, end_time, restaurant_id ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_booking_instants();


--
-- TOC entry 4460 (class 2620 OID 18464)
-- Name: bookings bookings_set_reference; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_set_reference BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_booking_reference();


--
-- TOC entry 4461 (class 2620 OID 18465)
-- Name: bookings bookings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4464 (class 2620 OID 18466)
-- Name: customers customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4468 (class 2620 OID 18467)
-- Name: merge_rules merge_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER merge_rules_updated_at BEFORE UPDATE ON public.merge_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4470 (class 2620 OID 18468)
-- Name: restaurant_capacity_rules restaurant_capacity_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_capacity_rules_updated_at BEFORE UPDATE ON public.restaurant_capacity_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4472 (class 2620 OID 18469)
-- Name: restaurant_operating_hours restaurant_operating_hours_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_operating_hours_updated_at BEFORE UPDATE ON public.restaurant_operating_hours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4473 (class 2620 OID 18470)
-- Name: restaurant_service_periods restaurant_service_periods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_service_periods_updated_at BEFORE UPDATE ON public.restaurant_service_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4474 (class 2620 OID 18471)
-- Name: restaurant_turn_bands restaurant_turn_bands_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_turn_bands_updated_at BEFORE UPDATE ON public.restaurant_turn_bands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4475 (class 2620 OID 18472)
-- Name: restaurants restaurants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4476 (class 2620 OID 18473)
-- Name: service_policy service_policy_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_policy_updated_at BEFORE UPDATE ON public.service_policy FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4471 (class 2620 OID 18474)
-- Name: restaurant_invites set_restaurant_invites_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_restaurant_invites_updated_at BEFORE UPDATE ON public.restaurant_invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4484 (class 2620 OID 18475)
-- Name: user_profiles set_user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4478 (class 2620 OID 18476)
-- Name: table_adjacencies table_adjacencies_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_adjacencies_validate BEFORE INSERT ON public.table_adjacencies FOR EACH ROW EXECUTE FUNCTION public.validate_table_adjacency();


--
-- TOC entry 4479 (class 2620 OID 18477)
-- Name: table_hold_members table_hold_members_sync_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_hold_members_sync_delete AFTER DELETE ON public.table_hold_members FOR EACH ROW EXECUTE FUNCTION public.sync_table_hold_windows();


--
-- TOC entry 4480 (class 2620 OID 18478)
-- Name: table_hold_members table_hold_members_sync_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_hold_members_sync_insert AFTER INSERT ON public.table_hold_members FOR EACH ROW EXECUTE FUNCTION public.sync_table_hold_windows();


--
-- TOC entry 4481 (class 2620 OID 18479)
-- Name: table_holds table_holds_sync_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_holds_sync_update AFTER UPDATE OF start_at, end_at, expires_at, restaurant_id, booking_id ON public.table_holds FOR EACH ROW EXECUTE FUNCTION public.update_table_hold_windows();


--
-- TOC entry 4482 (class 2620 OID 18480)
-- Name: table_holds table_holds_sync_windows; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_holds_sync_windows AFTER UPDATE ON public.table_holds FOR EACH ROW EXECUTE FUNCTION public.update_table_hold_windows();


--
-- TOC entry 4483 (class 2620 OID 18481)
-- Name: table_inventory table_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_inventory_updated_at BEFORE UPDATE ON public.table_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4454 (class 2620 OID 18482)
-- Name: allocations trg_allocations_refresh; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_allocations_refresh AFTER INSERT OR DELETE OR UPDATE ON public.allocations FOR EACH ROW EXECUTE FUNCTION public.on_allocations_refresh();


--
-- TOC entry 4462 (class 2620 OID 18483)
-- Name: bookings trg_booking_status_refresh; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_booking_status_refresh AFTER UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.on_booking_status_refresh();


--
-- TOC entry 4463 (class 2620 OID 18484)
-- Name: capacity_outbox trg_capacity_outbox_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_capacity_outbox_updated_at BEFORE UPDATE ON public.capacity_outbox FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();


--
-- TOC entry 4465 (class 2620 OID 18485)
-- Name: demand_profiles update_demand_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_demand_profiles_updated_at BEFORE UPDATE ON public.demand_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4466 (class 2620 OID 18486)
-- Name: loyalty_points update_loyalty_points_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_loyalty_points_updated_at BEFORE UPDATE ON public.loyalty_points FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4467 (class 2620 OID 18487)
-- Name: loyalty_programs update_loyalty_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_loyalty_programs_updated_at BEFORE UPDATE ON public.loyalty_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4469 (class 2620 OID 18488)
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4477 (class 2620 OID 18489)
-- Name: strategic_configs update_strategic_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_strategic_configs_updated_at BEFORE UPDATE ON public.strategic_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4485 (class 2620 OID 18490)
-- Name: user_profiles update_user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4486 (class 2620 OID 18491)
-- Name: waiting_list update_waiting_list_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_waiting_list_updated_at BEFORE UPDATE ON public.waiting_list FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4487 (class 2620 OID 18492)
-- Name: waiting_list waiting_list_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER waiting_list_updated_at BEFORE UPDATE ON public.waiting_list FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4488 (class 2620 OID 18493)
-- Name: zones zones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER zones_updated_at BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- TOC entry 4379 (class 2606 OID 18494)
-- Name: allocations allocations_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 4380 (class 2606 OID 18499)
-- Name: allocations allocations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- TOC entry 4381 (class 2606 OID 18504)
-- Name: allocations allocations_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4382 (class 2606 OID 18509)
-- Name: allowed_capacities allowed_capacities_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allowed_capacities
    ADD CONSTRAINT allowed_capacities_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4383 (class 2606 OID 18514)
-- Name: analytics_events analytics_events_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 4384 (class 2606 OID 18519)
-- Name: analytics_events analytics_events_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- TOC entry 4385 (class 2606 OID 18524)
-- Name: analytics_events analytics_events_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4386 (class 2606 OID 18529)
-- Name: booking_assignment_attempts booking_assignment_attempts_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_attempts
    ADD CONSTRAINT booking_assignment_attempts_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 4387 (class 2606 OID 18534)
-- Name: booking_assignment_idempotency booking_assignment_idempotency_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_idempotency
    ADD CONSTRAINT booking_assignment_idempotency_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 4388 (class 2606 OID 18539)
-- Name: booking_assignment_idempotency booking_assignment_idempotency_merge_group_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_idempotency
    ADD CONSTRAINT booking_assignment_idempotency_merge_group_fkey FOREIGN KEY (merge_group_allocation_id) REFERENCES public.allocations(id) ON DELETE SET NULL;


--
-- TOC entry 4389 (class 2606 OID 18544)
-- Name: booking_confirmation_results booking_confirmation_results_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_confirmation_results
    ADD CONSTRAINT booking_confirmation_results_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 4390 (class 2606 OID 18549)
-- Name: booking_confirmation_results booking_confirmation_results_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_confirmation_results
    ADD CONSTRAINT booking_confirmation_results_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4391 (class 2606 OID 18554)
-- Name: booking_slots booking_slots_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4392 (class 2606 OID 18559)
-- Name: booking_slots booking_slots_service_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_service_period_id_fkey FOREIGN KEY (service_period_id) REFERENCES public.restaurant_service_periods(id) ON DELETE SET NULL;


--
-- TOC entry 4393 (class 2606 OID 18564)
-- Name: booking_state_history booking_state_history_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_state_history
    ADD CONSTRAINT booking_state_history_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 4394 (class 2606 OID 18569)
-- Name: booking_state_history booking_state_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_state_history
    ADD CONSTRAINT booking_state_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- TOC entry 4373 (class 2606 OID 18574)
-- Name: booking_table_assignments booking_table_assignments_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id) ON DELETE SET NULL;


--
-- TOC entry 4374 (class 2606 OID 18579)
-- Name: booking_table_assignments booking_table_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- TOC entry 4375 (class 2606 OID 18584)
-- Name: booking_table_assignments booking_table_assignments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 4376 (class 2606 OID 18589)
-- Name: booking_table_assignments booking_table_assignments_merge_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_merge_group_id_fkey FOREIGN KEY (merge_group_id) REFERENCES public.allocations(id) ON DELETE SET NULL;


--
-- TOC entry 4377 (class 2606 OID 18594)
-- Name: booking_table_assignments booking_table_assignments_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.booking_slots(id) ON DELETE SET NULL;


--
-- TOC entry 4378 (class 2606 OID 18599)
-- Name: booking_table_assignments booking_table_assignments_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE RESTRICT;


--
-- TOC entry 4395 (class 2606 OID 18604)
-- Name: booking_versions booking_versions_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_versions
    ADD CONSTRAINT booking_versions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 4396 (class 2606 OID 18609)
-- Name: booking_versions booking_versions_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_versions
    ADD CONSTRAINT booking_versions_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4397 (class 2606 OID 18614)
-- Name: bookings bookings_assigned_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_assigned_zone_id_fkey FOREIGN KEY (assigned_zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- TOC entry 4398 (class 2606 OID 18619)
-- Name: bookings bookings_booking_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_booking_type_fkey FOREIGN KEY (booking_type) REFERENCES public.booking_occasions(key) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4399 (class 2606 OID 18624)
-- Name: bookings bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- TOC entry 4400 (class 2606 OID 18629)
-- Name: bookings bookings_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4401 (class 2606 OID 18634)
-- Name: customer_profiles customer_profiles_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 4402 (class 2606 OID 18639)
-- Name: customers customers_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4403 (class 2606 OID 18644)
-- Name: customers customers_user_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_profile_id_fkey FOREIGN KEY (user_profile_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- TOC entry 4404 (class 2606 OID 18649)
-- Name: demand_profiles demand_profiles_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demand_profiles
    ADD CONSTRAINT demand_profiles_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4405 (class 2606 OID 18654)
-- Name: email_delivery_log email_delivery_log_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_delivery_log
    ADD CONSTRAINT email_delivery_log_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- TOC entry 4406 (class 2606 OID 18659)
-- Name: email_delivery_log email_delivery_log_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_delivery_log
    ADD CONSTRAINT email_delivery_log_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE SET NULL;


--
-- TOC entry 4407 (class 2606 OID 18664)
-- Name: loyalty_point_events loyalty_point_events_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_point_events
    ADD CONSTRAINT loyalty_point_events_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- TOC entry 4408 (class 2606 OID 18669)
-- Name: loyalty_point_events loyalty_point_events_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_point_events
    ADD CONSTRAINT loyalty_point_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 4409 (class 2606 OID 18674)
-- Name: loyalty_point_events loyalty_point_events_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_point_events
    ADD CONSTRAINT loyalty_point_events_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4410 (class 2606 OID 18679)
-- Name: loyalty_points loyalty_points_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 4411 (class 2606 OID 18684)
-- Name: loyalty_points loyalty_points_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4412 (class 2606 OID 18689)
-- Name: loyalty_programs loyalty_programs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4413 (class 2606 OID 18694)
-- Name: manual_assignment_sessions manual_assignment_sessions_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_assignment_sessions
    ADD CONSTRAINT manual_assignment_sessions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 4414 (class 2606 OID 18699)
-- Name: manual_assignment_sessions manual_assignment_sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_assignment_sessions
    ADD CONSTRAINT manual_assignment_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- TOC entry 4415 (class 2606 OID 18704)
-- Name: manual_assignment_sessions manual_assignment_sessions_hold_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_assignment_sessions
    ADD CONSTRAINT manual_assignment_sessions_hold_fkey FOREIGN KEY (hold_id) REFERENCES public.table_holds(id) ON DELETE SET NULL;


--
-- TOC entry 4416 (class 2606 OID 18709)
-- Name: manual_assignment_sessions manual_assignment_sessions_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_assignment_sessions
    ADD CONSTRAINT manual_assignment_sessions_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4417 (class 2606 OID 18714)
-- Name: profile_update_requests profile_update_requests_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_update_requests
    ADD CONSTRAINT profile_update_requests_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- TOC entry 4418 (class 2606 OID 18719)
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4419 (class 2606 OID 18724)
-- Name: restaurant_capacity_rules restaurant_capacity_rules_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_capacity_rules
    ADD CONSTRAINT restaurant_capacity_rules_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4420 (class 2606 OID 18729)
-- Name: restaurant_capacity_rules restaurant_capacity_rules_service_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_capacity_rules
    ADD CONSTRAINT restaurant_capacity_rules_service_period_id_fkey FOREIGN KEY (service_period_id) REFERENCES public.restaurant_service_periods(id) ON DELETE CASCADE;


--
-- TOC entry 4421 (class 2606 OID 18734)
-- Name: restaurant_invites restaurant_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_invites
    ADD CONSTRAINT restaurant_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- TOC entry 4422 (class 2606 OID 18739)
-- Name: restaurant_invites restaurant_invites_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_invites
    ADD CONSTRAINT restaurant_invites_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4423 (class 2606 OID 18744)
-- Name: restaurant_memberships restaurant_memberships_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_memberships
    ADD CONSTRAINT restaurant_memberships_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4424 (class 2606 OID 18749)
-- Name: restaurant_operating_hours restaurant_operating_hours_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_operating_hours
    ADD CONSTRAINT restaurant_operating_hours_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4425 (class 2606 OID 18754)
-- Name: restaurant_service_periods restaurant_service_periods_booking_option_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_service_periods
    ADD CONSTRAINT restaurant_service_periods_booking_option_fkey FOREIGN KEY (booking_option) REFERENCES public.booking_occasions(key) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 4426 (class 2606 OID 18759)
-- Name: restaurant_service_periods restaurant_service_periods_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_service_periods
    ADD CONSTRAINT restaurant_service_periods_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4427 (class 2606 OID 18764)
-- Name: restaurant_turn_bands restaurant_turn_bands_booking_option_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_turn_bands
    ADD CONSTRAINT restaurant_turn_bands_booking_option_fkey FOREIGN KEY (booking_option) REFERENCES public.booking_occasions(key) ON DELETE CASCADE;


--
-- TOC entry 4428 (class 2606 OID 18769)
-- Name: restaurant_turn_bands restaurant_turn_bands_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_turn_bands
    ADD CONSTRAINT restaurant_turn_bands_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4429 (class 2606 OID 18774)
-- Name: strategic_configs strategic_configs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_configs
    ADD CONSTRAINT strategic_configs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4430 (class 2606 OID 18779)
-- Name: strategic_configs strategic_configs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_configs
    ADD CONSTRAINT strategic_configs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- TOC entry 4431 (class 2606 OID 18784)
-- Name: table_adjacencies table_adjacencies_table_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_adjacencies
    ADD CONSTRAINT table_adjacencies_table_a_fkey FOREIGN KEY (table_a) REFERENCES public.table_inventory(id) ON DELETE CASCADE;


--
-- TOC entry 4432 (class 2606 OID 18789)
-- Name: table_adjacencies table_adjacencies_table_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_adjacencies
    ADD CONSTRAINT table_adjacencies_table_b_fkey FOREIGN KEY (table_b) REFERENCES public.table_inventory(id) ON DELETE CASCADE;


--
-- TOC entry 4433 (class 2606 OID 18794)
-- Name: table_hold_members table_hold_members_hold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_members
    ADD CONSTRAINT table_hold_members_hold_id_fkey FOREIGN KEY (hold_id) REFERENCES public.table_holds(id) ON DELETE CASCADE;


--
-- TOC entry 4434 (class 2606 OID 18799)
-- Name: table_hold_members table_hold_members_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_members
    ADD CONSTRAINT table_hold_members_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE RESTRICT;


--
-- TOC entry 4435 (class 2606 OID 18804)
-- Name: table_hold_windows table_hold_windows_hold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_windows
    ADD CONSTRAINT table_hold_windows_hold_id_fkey FOREIGN KEY (hold_id) REFERENCES public.table_holds(id) ON DELETE CASCADE;


--
-- TOC entry 4436 (class 2606 OID 18809)
-- Name: table_hold_windows table_hold_windows_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_windows
    ADD CONSTRAINT table_hold_windows_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4437 (class 2606 OID 18814)
-- Name: table_hold_windows table_hold_windows_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_windows
    ADD CONSTRAINT table_hold_windows_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE CASCADE;


--
-- TOC entry 4438 (class 2606 OID 18819)
-- Name: table_holds table_holds_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- TOC entry 4439 (class 2606 OID 18824)
-- Name: table_holds table_holds_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- TOC entry 4440 (class 2606 OID 18829)
-- Name: table_holds table_holds_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4441 (class 2606 OID 18834)
-- Name: table_holds table_holds_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.manual_assignment_sessions(id) ON DELETE SET NULL;


--
-- TOC entry 4442 (class 2606 OID 18839)
-- Name: table_holds table_holds_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


--
-- TOC entry 4443 (class 2606 OID 18844)
-- Name: table_inventory table_inventory_allowed_capacity_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_allowed_capacity_fkey FOREIGN KEY (restaurant_id, capacity) REFERENCES public.allowed_capacities(restaurant_id, capacity) NOT VALID;


--
-- TOC entry 4444 (class 2606 OID 18849)
-- Name: table_inventory table_inventory_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4445 (class 2606 OID 18854)
-- Name: table_inventory table_inventory_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE RESTRICT;


--
-- TOC entry 4446 (class 2606 OID 18859)
-- Name: table_scarcity_metrics table_scarcity_metrics_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_scarcity_metrics
    ADD CONSTRAINT table_scarcity_metrics_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4447 (class 2606 OID 18864)
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4448 (class 2606 OID 18869)
-- Name: waiting_list waiting_list_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiting_list
    ADD CONSTRAINT waiting_list_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4449 (class 2606 OID 18874)
-- Name: zones zones_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4687 (class 3256 OID 18879)
-- Name: bookings Admins and owners can delete bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and owners can delete bookings" ON public.bookings FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = bookings.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- TOC entry 4688 (class 3256 OID 18880)
-- Name: customers Admins and owners can delete customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and owners can delete customers" ON public.customers FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = customers.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- TOC entry 4689 (class 3256 OID 18881)
-- Name: booking_occasions Allow public read access to booking_occasions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to booking_occasions" ON public.booking_occasions FOR SELECT USING (true);


--
-- TOC entry 4690 (class 3256 OID 18882)
-- Name: booking_table_assignments Customers can view their table assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their table assignments" ON public.booking_table_assignments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = booking_table_assignments.booking_id) AND (b.auth_user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4691 (class 3256 OID 18883)
-- Name: restaurant_memberships Owners and admins can manage memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins can manage memberships" ON public.restaurant_memberships USING ((restaurant_id IN ( SELECT public.user_restaurants_admin() AS user_restaurants_admin))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants_admin() AS user_restaurants_admin)));


--
-- TOC entry 4692 (class 3256 OID 18885)
-- Name: demand_profiles Owners and managers can manage demand profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and managers can manage demand profiles" ON public.demand_profiles USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = demand_profiles.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = demand_profiles.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'admin'::text]))))));


--
-- TOC entry 4693 (class 3256 OID 18887)
-- Name: table_scarcity_metrics Owners and managers can manage scarcity metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and managers can manage scarcity metrics" ON public.table_scarcity_metrics USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = table_scarcity_metrics.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = table_scarcity_metrics.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'admin'::text]))))));


--
-- TOC entry 4694 (class 3256 OID 18889)
-- Name: strategic_configs Owners and managers can manage strategic configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and managers can manage strategic configs" ON public.strategic_configs USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = strategic_configs.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'admin'::text, 'ops_manager'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = strategic_configs.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'admin'::text, 'ops_manager'::text]))))));


--
-- TOC entry 4695 (class 3256 OID 18891)
-- Name: restaurant_invites Owners and managers manage invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and managers manage invites" ON public.restaurant_invites USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = restaurant_invites.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = restaurant_invites.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'admin'::text]))))));


--
-- TOC entry 4696 (class 3256 OID 18893)
-- Name: leads Public can insert leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can insert leads" ON public.leads FOR INSERT WITH CHECK (true);


--
-- TOC entry 4697 (class 3256 OID 18894)
-- Name: waiting_list Restaurant members can manage waiting list; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Restaurant members can manage waiting list" ON public.waiting_list USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = waiting_list.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = waiting_list.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4701 (class 3256 OID 18896)
-- Name: booking_versions Restaurant members can view booking versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Restaurant members can view booking versions" ON public.booking_versions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = booking_versions.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4702 (class 3256 OID 18897)
-- Name: analytics_events Restaurant staff can view analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Restaurant staff can view analytics" ON public.analytics_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = analytics_events.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4703 (class 3256 OID 18898)
-- Name: table_adjacencies Service role can manage adjacencies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage adjacencies" ON public.table_adjacencies TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4704 (class 3256 OID 18899)
-- Name: allowed_capacities Service role can manage allowed capacities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage allowed capacities" ON public.allowed_capacities TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4705 (class 3256 OID 18900)
-- Name: audit_logs Service role can manage audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage audit logs" ON public.audit_logs USING (true) WITH CHECK (true);


--
-- TOC entry 4706 (class 3256 OID 18901)
-- Name: booking_slots Service role can manage booking slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage booking slots" ON public.booking_slots TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4707 (class 3256 OID 18902)
-- Name: restaurant_capacity_rules Service role can manage capacity rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage capacity rules" ON public.restaurant_capacity_rules TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4708 (class 3256 OID 18903)
-- Name: loyalty_point_events Service role can manage loyalty events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage loyalty events" ON public.loyalty_point_events USING (true) WITH CHECK (true);


--
-- TOC entry 4709 (class 3256 OID 18904)
-- Name: loyalty_points Service role can manage loyalty points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage loyalty points" ON public.loyalty_points USING (true) WITH CHECK (true);


--
-- TOC entry 4710 (class 3256 OID 18905)
-- Name: loyalty_programs Service role can manage loyalty programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage loyalty programs" ON public.loyalty_programs USING (true) WITH CHECK (true);


--
-- TOC entry 4711 (class 3256 OID 18906)
-- Name: restaurant_operating_hours Service role can manage operating hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage operating hours" ON public.restaurant_operating_hours TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4712 (class 3256 OID 18907)
-- Name: restaurant_service_periods Service role can manage service periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage service periods" ON public.restaurant_service_periods TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4713 (class 3256 OID 18908)
-- Name: service_policy Service role can manage service policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage service policy" ON public.service_policy TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4714 (class 3256 OID 18909)
-- Name: table_inventory Service role can manage table inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage table inventory" ON public.table_inventory TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4698 (class 3256 OID 18910)
-- Name: restaurant_turn_bands Service role can manage turn bands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage turn bands" ON public.restaurant_turn_bands TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4699 (class 3256 OID 18911)
-- Name: zones Service role can manage zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage zones" ON public.zones TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4700 (class 3256 OID 18912)
-- Name: booking_assignment_idempotency Service role full access to booking_assignment_idempotency; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to booking_assignment_idempotency" ON public.booking_assignment_idempotency USING (true) WITH CHECK (true);


--
-- TOC entry 4715 (class 3256 OID 18913)
-- Name: feature_flag_overrides Service role full access to feature_flag_overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to feature_flag_overrides" ON public.feature_flag_overrides USING (true) WITH CHECK (true);


--
-- TOC entry 4716 (class 3256 OID 18914)
-- Name: table_hold_members Service role full access to table_hold_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to table_hold_members" ON public.table_hold_members TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4717 (class 3256 OID 18915)
-- Name: table_hold_windows Service role full access to table_hold_windows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to table_hold_windows" ON public.table_hold_windows USING (true) WITH CHECK (true);


--
-- TOC entry 4718 (class 3256 OID 18916)
-- Name: table_holds Service role full access to table_holds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to table_holds" ON public.table_holds TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4719 (class 3256 OID 18917)
-- Name: bookings Staff can create bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create bookings" ON public.bookings FOR INSERT WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4720 (class 3256 OID 18918)
-- Name: customers Staff can create customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create customers" ON public.customers FOR INSERT WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4721 (class 3256 OID 18919)
-- Name: table_adjacencies Staff can manage adjacencies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage adjacencies" ON public.table_adjacencies TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.table_inventory ti
  WHERE ((ti.id = table_adjacencies.table_a) AND (ti.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.table_inventory ti
  WHERE ((ti.id = table_adjacencies.table_a) AND (ti.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))))));


--
-- TOC entry 4724 (class 3256 OID 18921)
-- Name: allowed_capacities Staff can manage allowed capacities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage allowed capacities" ON public.allowed_capacities TO authenticated USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4725 (class 3256 OID 18922)
-- Name: booking_slots Staff can manage booking slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage booking slots" ON public.booking_slots USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4726 (class 3256 OID 18923)
-- Name: restaurant_capacity_rules Staff can manage capacity rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage capacity rules" ON public.restaurant_capacity_rules USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4727 (class 3256 OID 18924)
-- Name: restaurant_operating_hours Staff can manage operating hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage operating hours" ON public.restaurant_operating_hours USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4728 (class 3256 OID 18925)
-- Name: restaurant_service_periods Staff can manage service periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage service periods" ON public.restaurant_service_periods USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4729 (class 3256 OID 18926)
-- Name: booking_table_assignments Staff can manage table assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage table assignments" ON public.booking_table_assignments USING ((EXISTS ( SELECT 1
   FROM (public.bookings b
     JOIN public.restaurant_memberships rm ON ((rm.restaurant_id = b.restaurant_id)))
  WHERE ((b.id = booking_table_assignments.booking_id) AND (rm.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.bookings b
     JOIN public.restaurant_memberships rm ON ((rm.restaurant_id = b.restaurant_id)))
  WHERE ((b.id = booking_table_assignments.booking_id) AND (rm.user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4730 (class 3256 OID 18929)
-- Name: table_inventory Staff can manage table inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage table inventory" ON public.table_inventory USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4731 (class 3256 OID 18930)
-- Name: restaurant_turn_bands Staff can manage turn bands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage turn bands" ON public.restaurant_turn_bands USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4733 (class 3256 OID 18931)
-- Name: zones Staff can manage zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage zones" ON public.zones TO authenticated USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4734 (class 3256 OID 18932)
-- Name: bookings Staff can update bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update bookings" ON public.bookings FOR UPDATE USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4735 (class 3256 OID 18933)
-- Name: customers Staff can update customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update customers" ON public.customers FOR UPDATE USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4736 (class 3256 OID 18934)
-- Name: allocations Staff can view allocations for their restaurants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view allocations for their restaurants" ON public.allocations FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4732 (class 3256 OID 18935)
-- Name: bookings Staff can view bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view bookings" ON public.bookings FOR SELECT USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4738 (class 3256 OID 18936)
-- Name: customer_profiles Staff can view customer profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view customer profiles" ON public.customer_profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.id = customer_profiles.customer_id) AND (c.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))))));


--
-- TOC entry 4739 (class 3256 OID 18937)
-- Name: customers Staff can view customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view customers" ON public.customers FOR SELECT USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4740 (class 3256 OID 18938)
-- Name: merge_rules Staff can view merge rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view merge rules" ON public.merge_rules FOR SELECT USING (true);


--
-- TOC entry 4741 (class 3256 OID 18939)
-- Name: service_policy Staff can view service policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view service policy" ON public.service_policy FOR SELECT TO authenticated USING (true);


--
-- TOC entry 4742 (class 3256 OID 18940)
-- Name: table_hold_members Staff can view table hold members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view table hold members" ON public.table_hold_members FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.table_holds h
  WHERE ((h.id = table_hold_members.hold_id) AND (h.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))))));


--
-- TOC entry 4743 (class 3256 OID 18941)
-- Name: table_holds Staff can view table holds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view table holds" ON public.table_holds FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- TOC entry 4744 (class 3256 OID 18942)
-- Name: allocations Tenant service role can manage allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant service role can manage allocations" ON public.allocations TO service_role USING ((restaurant_id = public.require_restaurant_context())) WITH CHECK ((restaurant_id = public.require_restaurant_context()));


--
-- TOC entry 4737 (class 3256 OID 18943)
-- Name: allocations_archive Tenant service role can manage allocations archive; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant service role can manage allocations archive" ON public.allocations_archive TO service_role USING ((restaurant_id = public.require_restaurant_context())) WITH CHECK ((restaurant_id = public.require_restaurant_context()));


--
-- TOC entry 4722 (class 3256 OID 18944)
-- Name: booking_confirmation_results Tenant service role can manage booking confirmation results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant service role can manage booking confirmation results" ON public.booking_confirmation_results TO service_role USING ((restaurant_id = public.require_restaurant_context())) WITH CHECK ((restaurant_id = public.require_restaurant_context()));


--
-- TOC entry 4745 (class 3256 OID 18945)
-- Name: bookings Tenant service role can manage bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant service role can manage bookings" ON public.bookings TO service_role USING ((restaurant_id = public.require_restaurant_context())) WITH CHECK ((restaurant_id = public.require_restaurant_context()));


--
-- TOC entry 4746 (class 3256 OID 18946)
-- Name: capacity_outbox Tenant service role can manage capacity outbox; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant service role can manage capacity outbox" ON public.capacity_outbox TO service_role USING ((restaurant_id = public.require_restaurant_context())) WITH CHECK ((restaurant_id = public.require_restaurant_context()));


--
-- TOC entry 4747 (class 3256 OID 18947)
-- Name: customers Tenant service role can manage customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant service role can manage customers" ON public.customers TO service_role USING ((restaurant_id = public.require_restaurant_context())) WITH CHECK ((restaurant_id = public.require_restaurant_context()));


--
-- TOC entry 4748 (class 3256 OID 18948)
-- Name: booking_table_assignments Tenant service role can manage table assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant service role can manage table assignments" ON public.booking_table_assignments TO service_role USING ((EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = booking_table_assignments.booking_id) AND (b.restaurant_id = public.require_restaurant_context()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = booking_table_assignments.booking_id) AND (b.restaurant_id = public.require_restaurant_context())))));


--
-- TOC entry 4749 (class 3256 OID 18950)
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 4750 (class 3256 OID 18951)
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 4751 (class 3256 OID 18952)
-- Name: user_profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 4752 (class 3256 OID 18953)
-- Name: demand_profiles Users can view demand profiles for their restaurants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view demand profiles for their restaurants" ON public.demand_profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = demand_profiles.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4753 (class 3256 OID 18954)
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 4754 (class 3256 OID 18955)
-- Name: user_profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING ((id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 4755 (class 3256 OID 18956)
-- Name: table_scarcity_metrics Users can view scarcity metrics for their restaurants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view scarcity metrics for their restaurants" ON public.table_scarcity_metrics FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = table_scarcity_metrics.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4756 (class 3256 OID 18957)
-- Name: strategic_configs Users can view strategic configs for their restaurants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view strategic configs for their restaurants" ON public.strategic_configs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = strategic_configs.restaurant_id) AND (rm.user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4638 (class 0 OID 17691)
-- Dependencies: 299
-- Name: _migrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._migrations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4639 (class 0 OID 17697)
-- Dependencies: 301
-- Name: allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4640 (class 0 OID 17708)
-- Dependencies: 302
-- Name: allocations_archive; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.allocations_archive ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4641 (class 0 OID 17717)
-- Dependencies: 303
-- Name: allowed_capacities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.allowed_capacities ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4642 (class 0 OID 17723)
-- Dependencies: 304
-- Name: analytics_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4757 (class 3256 OID 18958)
-- Name: restaurants anon_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_read_all ON public.restaurants FOR SELECT TO anon USING (true);


--
-- TOC entry 4643 (class 0 OID 17731)
-- Dependencies: 305
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4758 (class 3256 OID 18959)
-- Name: restaurants authenticated_can_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_can_create ON public.restaurants FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- TOC entry 4759 (class 3256 OID 18960)
-- Name: restaurants authenticated_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_all ON public.restaurants FOR SELECT TO authenticated USING (true);


--
-- TOC entry 4760 (class 3256 OID 18961)
-- Name: allocations authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select ON public.allocations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = allocations.restaurant_id) AND (rm.user_id = auth.uid())))));


--
-- TOC entry 4761 (class 3256 OID 18962)
-- Name: booking_assignment_attempts authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select ON public.booking_assignment_attempts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.bookings b
     JOIN public.restaurant_memberships rm ON ((rm.restaurant_id = b.restaurant_id)))
  WHERE ((b.id = booking_assignment_attempts.booking_id) AND (rm.user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4762 (class 3256 OID 18964)
-- Name: booking_state_history authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select ON public.booking_state_history FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.bookings b
     JOIN public.restaurant_memberships rm ON ((rm.restaurant_id = b.restaurant_id)))
  WHERE ((b.id = booking_state_history.booking_id) AND (rm.user_id = auth.uid())))));


--
-- TOC entry 4763 (class 3256 OID 18966)
-- Name: booking_table_assignments authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select ON public.booking_table_assignments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.bookings b
     JOIN public.restaurant_memberships rm ON ((rm.restaurant_id = b.restaurant_id)))
  WHERE ((b.id = booking_table_assignments.booking_id) AND (rm.user_id = auth.uid())))));


--
-- TOC entry 4764 (class 3256 OID 18968)
-- Name: table_merge_graph authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select ON public.table_merge_graph FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.restaurant_id = table_merge_graph.restaurant_id)))));


--
-- TOC entry 4644 (class 0 OID 17738)
-- Dependencies: 306
-- Name: booking_assignment_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_assignment_attempts ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4645 (class 0 OID 17746)
-- Dependencies: 307
-- Name: booking_assignment_idempotency; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_assignment_idempotency ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4646 (class 0 OID 17754)
-- Dependencies: 308
-- Name: booking_confirmation_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_confirmation_results ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4647 (class 0 OID 17761)
-- Dependencies: 309
-- Name: booking_occasions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_occasions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4648 (class 0 OID 17774)
-- Dependencies: 310
-- Name: booking_occasions_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_occasions_audit ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4649 (class 0 OID 17781)
-- Dependencies: 311
-- Name: booking_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_slots ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4650 (class 0 OID 17792)
-- Dependencies: 312
-- Name: booking_state_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_state_history ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4637 (class 0 OID 17667)
-- Dependencies: 298
-- Name: booking_table_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_table_assignments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4651 (class 0 OID 17800)
-- Dependencies: 314
-- Name: booking_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_versions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4652 (class 0 OID 17808)
-- Dependencies: 315
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4653 (class 0 OID 17828)
-- Dependencies: 316
-- Name: capacity_outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capacity_outbox ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4654 (class 0 OID 17840)
-- Dependencies: 317
-- Name: customer_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4655 (class 0 OID 17854)
-- Dependencies: 318
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4656 (class 0 OID 17867)
-- Dependencies: 319
-- Name: demand_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demand_profiles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4657 (class 0 OID 17883)
-- Dependencies: 320
-- Name: email_delivery_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4658 (class 0 OID 17892)
-- Dependencies: 321
-- Name: feature_flag_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4659 (class 0 OID 17899)
-- Dependencies: 322
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4660 (class 0 OID 17906)
-- Dependencies: 323
-- Name: loyalty_point_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_point_events ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4661 (class 0 OID 17914)
-- Dependencies: 324
-- Name: loyalty_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4662 (class 0 OID 17922)
-- Dependencies: 325
-- Name: loyalty_programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4663 (class 0 OID 17934)
-- Dependencies: 326
-- Name: manual_assignment_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.manual_assignment_sessions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4664 (class 0 OID 17944)
-- Dependencies: 327
-- Name: merge_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.merge_rules ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4665 (class 0 OID 17955)
-- Dependencies: 328
-- Name: observability_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.observability_events ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4768 (class 3256 OID 18969)
-- Name: restaurants owners_admins_can_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owners_admins_can_update ON public.restaurants FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = restaurants.id) AND (rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = restaurants.id) AND (rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- TOC entry 4769 (class 3256 OID 18971)
-- Name: restaurants owners_can_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owners_can_delete ON public.restaurants FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = restaurants.id) AND (rm.user_id = ( SELECT auth.uid() AS uid)) AND (rm.role = 'owner'::text)))));


--
-- TOC entry 4666 (class 0 OID 17964)
-- Dependencies: 329
-- Name: profile_update_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_update_requests ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4770 (class 3256 OID 18972)
-- Name: profile_update_requests profile_update_requests_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_update_requests_delete ON public.profile_update_requests FOR DELETE USING ((profile_id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 4771 (class 3256 OID 18973)
-- Name: profile_update_requests profile_update_requests_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_update_requests_insert ON public.profile_update_requests FOR INSERT WITH CHECK ((profile_id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 4772 (class 3256 OID 18974)
-- Name: profile_update_requests profile_update_requests_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_update_requests_select ON public.profile_update_requests FOR SELECT USING ((profile_id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 4774 (class 3256 OID 18975)
-- Name: profile_update_requests profile_update_requests_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_update_requests_update ON public.profile_update_requests FOR UPDATE USING ((profile_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((profile_id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 4667 (class 0 OID 17971)
-- Dependencies: 330
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4668 (class 0 OID 17980)
-- Dependencies: 331
-- Name: restaurant_capacity_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_capacity_rules ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4669 (class 0 OID 17990)
-- Dependencies: 332
-- Name: restaurant_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_invites ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4670 (class 0 OID 18002)
-- Dependencies: 333
-- Name: restaurant_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_memberships ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4671 (class 0 OID 18009)
-- Dependencies: 334
-- Name: restaurant_operating_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_operating_hours ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4672 (class 0 OID 18020)
-- Dependencies: 335
-- Name: restaurant_service_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_service_periods ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4673 (class 0 OID 18030)
-- Dependencies: 336
-- Name: restaurant_turn_bands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_turn_bands ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4674 (class 0 OID 18040)
-- Dependencies: 337
-- Name: restaurants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4675 (class 0 OID 18062)
-- Dependencies: 338
-- Name: service_policy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_policy ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4775 (class 3256 OID 18976)
-- Name: _migrations service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public._migrations TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4776 (class 3256 OID 18977)
-- Name: allocations service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.allocations TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4777 (class 3256 OID 18978)
-- Name: analytics_events service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.analytics_events TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4778 (class 3256 OID 18979)
-- Name: audit_logs service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.audit_logs TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4779 (class 3256 OID 18980)
-- Name: booking_assignment_attempts service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.booking_assignment_attempts TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4780 (class 3256 OID 18981)
-- Name: booking_assignment_idempotency service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.booking_assignment_idempotency TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4781 (class 3256 OID 18982)
-- Name: booking_occasions_audit service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.booking_occasions_audit TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4782 (class 3256 OID 18983)
-- Name: booking_state_history service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.booking_state_history TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4783 (class 3256 OID 18984)
-- Name: booking_table_assignments service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.booking_table_assignments TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4784 (class 3256 OID 18985)
-- Name: booking_versions service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.booking_versions TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4785 (class 3256 OID 18986)
-- Name: leads service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.leads TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4786 (class 3256 OID 18987)
-- Name: manual_assignment_sessions service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.manual_assignment_sessions TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4787 (class 3256 OID 18988)
-- Name: observability_events service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.observability_events TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4788 (class 3256 OID 18989)
-- Name: profiles service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.profiles TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4765 (class 3256 OID 18990)
-- Name: table_merge_graph service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.table_merge_graph TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4766 (class 3256 OID 18991)
-- Name: user_profiles service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.user_profiles TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4767 (class 3256 OID 18992)
-- Name: waiting_list service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.waiting_list TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4773 (class 3256 OID 18993)
-- Name: restaurants service_role_all_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_access ON public.restaurants TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 4723 (class 3256 OID 18994)
-- Name: restaurants service_role_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_read_all ON public.restaurants FOR SELECT TO service_role USING (true);


--
-- TOC entry 4676 (class 0 OID 18074)
-- Dependencies: 339
-- Name: strategic_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.strategic_configs ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4677 (class 0 OID 18081)
-- Dependencies: 340
-- Name: table_adjacencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_adjacencies ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4678 (class 0 OID 18086)
-- Dependencies: 341
-- Name: table_hold_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_hold_members ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4679 (class 0 OID 18091)
-- Dependencies: 342
-- Name: table_hold_windows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_hold_windows ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4680 (class 0 OID 18097)
-- Dependencies: 343
-- Name: table_holds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_holds ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4681 (class 0 OID 18109)
-- Dependencies: 344
-- Name: table_inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_inventory ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4682 (class 0 OID 18124)
-- Dependencies: 345
-- Name: table_merge_graph; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_merge_graph ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4683 (class 0 OID 18133)
-- Dependencies: 346
-- Name: table_scarcity_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_scarcity_metrics ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4684 (class 0 OID 18141)
-- Dependencies: 347
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4685 (class 0 OID 18151)
-- Dependencies: 348
-- Name: waiting_list; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4686 (class 0 OID 18161)
-- Dependencies: 349
-- Name: zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

-- Completed on 2026-02-07 14:15:19 GMT

--
-- PostgreSQL database dump complete
--

\unrestrict CRPYErcjnwWznPC38W8bHc7sHof5tgvRtLMB9ZGehdSMrndzoObJdjLAy8VoXfE

