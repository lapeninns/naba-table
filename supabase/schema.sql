--
-- PostgreSQL database dump
--

\restrict mXExBCr5fo0ca01PVodAj2Jdmb2m2WSHtj3MaaP13cn7iJ5jGBOvmc88lR68cjx

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.6 (Homebrew)

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: analytics_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.analytics_event_type AS ENUM (
    'booking.created',
    'booking.cancelled',
    'booking.allocated',
    'booking.waitlisted'
);


--
-- Name: area_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.area_type AS ENUM (
    'indoor',
    'outdoor',
    'covered'
);


--
-- Name: booking_change_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_change_type AS ENUM (
    'created',
    'updated',
    'cancelled',
    'deleted'
);


--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_status AS ENUM (
    'confirmed',
    'pending',
    'cancelled',
    'completed',
    'no_show',
    'pending_allocation',
    'checked_in'
);


--
-- Name: TYPE booking_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.booking_status IS 'Lifecycle status of a booking (pending, confirmed, checked_in, completed, cancelled, no_show, etc).';


--
-- Name: loyalty_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.loyalty_tier AS ENUM (
    'bronze',
    'silver',
    'gold',
    'platinum'
);


--
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
-- Name: table_mobility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_mobility AS ENUM (
    'movable',
    'fixed'
);


--
-- Name: table_seating_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_seating_type AS ENUM (
    'standard',
    'sofa',
    'booth',
    'high_top'
);


--
-- Name: table_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_status AS ENUM (
    'available',
    'reserved',
    'occupied',
    'out_of_service'
);


--
-- Name: TYPE table_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.table_status IS 'Status of a restaurant table: available, reserved (booked), occupied (guests seated), out_of_service (maintenance)';


--
-- Name: allocations_overlap(tstzrange, tstzrange); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.allocations_overlap(a tstzrange, b tstzrange) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT COALESCE(a && b, false);
$$;


--
-- Name: FUNCTION allocations_overlap(a tstzrange, b tstzrange); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.allocations_overlap(a tstzrange, b tstzrange) IS 'Returns true when two timestamptz ranges overlap (half-open [start,end) semantics).';


--
-- Name: allowed_capacities_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.allowed_capacities_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;


--
-- Name: apply_booking_state_transition(uuid, public.booking_status, timestamp with time zone, timestamp with time zone, timestamp with time zone, public.booking_status, public.booking_status, uuid, timestamp with time zone, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_booking_state_transition(p_booking_id uuid, p_status public.booking_status, p_checked_in_at timestamp with time zone, p_checked_out_at timestamp with time zone, p_updated_at timestamp with time zone, p_history_from public.booking_status, p_history_to public.booking_status, p_history_changed_by uuid, p_history_changed_at timestamp with time zone, p_history_reason text, p_history_metadata jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(status public.booking_status, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: are_tables_connected(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.are_tables_connected(table_ids uuid[]) RETURNS boolean
    LANGUAGE plpgsql
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
-- Name: FUNCTION assign_merged_tables(p_booking_id uuid, p_table_ids uuid[], p_require_adjacency boolean, p_assigned_by uuid, p_idempotency_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_merged_tables(p_booking_id uuid, p_table_ids uuid[], p_require_adjacency boolean, p_assigned_by uuid, p_idempotency_key text) IS 'Atomically assigns multiple tables to a booking with optional adjacency enforcement.';


--
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
-- Name: FUNCTION assign_single_table(p_booking_id uuid, p_table_id uuid, p_assigned_by uuid, p_idempotency_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_single_table(p_booking_id uuid, p_table_id uuid, p_assigned_by uuid, p_idempotency_key text) IS 'Atomically assigns a single table to a booking; preferred entrypoint for standard seating.';


--
-- Name: assign_tables_atomic(uuid, uuid[], tstzrange, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_tables_atomic(p_booking_id uuid, p_table_ids uuid[], p_window tstzrange, p_assigned_by uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text) RETURNS TABLE(table_id uuid, assignment_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
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
-- Name: FUNCTION assign_tables_atomic(p_booking_id uuid, p_table_ids uuid[], p_window tstzrange, p_assigned_by uuid, p_idempotency_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_tables_atomic(p_booking_id uuid, p_table_ids uuid[], p_window tstzrange, p_assigned_by uuid, p_idempotency_key text) IS 'DEPRECATED: prefer assign_single_table() or assign_merged_tables().';


--
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
-- Name: FUNCTION assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid) IS 'DEPRECATED: prefer assign_single_table() or assign_merged_tables().';

CREATE FUNCTION public.confirm_hold_assignment_with_transition(
    p_booking_id uuid,
    p_table_ids uuid[],
    p_idempotency_key text,
    p_require_adjacency boolean DEFAULT false,
    p_assigned_by uuid DEFAULT NULL::uuid,
    p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_target_status public.booking_status DEFAULT 'confirmed'::public.booking_status,
    p_history_changed_by uuid DEFAULT NULL::uuid,
    p_history_reason text DEFAULT 'auto_assign_atomic_confirm'::text,
    p_history_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(table_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, merge_group_id uuid)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
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
    SELECT table_id, start_at, end_at, merge_group_id
    FROM public.assign_tables_atomic_v2(
      p_booking_id,
      p_table_ids,
      p_idempotency_key,
      p_require_adjacency,
      p_assigned_by,
      p_start_at,
      p_end_at
    );

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
    SELECT table_id, start_at, end_at, merge_group_id
    FROM tmp_confirm_assignments;
END;
$$;

GRANT ALL ON FUNCTION public.confirm_hold_assignment_with_transition(
    p_booking_id uuid,
    p_table_ids uuid[],
    p_idempotency_key text,
    p_require_adjacency boolean,
    p_assigned_by uuid,
    p_start_at timestamp with time zone,
    p_end_at timestamp with time zone,
    p_target_status public.booking_status,
    p_history_changed_by uuid,
    p_history_reason text,
    p_history_metadata jsonb
) TO service_role;


CREATE FUNCTION public.confirm_hold_assignment_tx(
    p_hold_id uuid,
    p_booking_id uuid,
    p_idempotency_key text,
    p_require_adjacency boolean DEFAULT false,
    p_assigned_by uuid DEFAULT NULL::uuid,
    p_window_start timestamptz DEFAULT NULL::timestamptz,
    p_window_end timestamptz DEFAULT NULL::timestamptz,
    p_expected_policy_version text DEFAULT NULL::text,
    p_expected_adjacency_hash text DEFAULT NULL::text,
    p_target_status public.booking_status DEFAULT NULL::public.booking_status,
    p_history_reason text DEFAULT 'auto_assign_confirm'::text,
    p_history_metadata jsonb DEFAULT '{}'::jsonb,
    p_history_changed_by uuid DEFAULT NULL::uuid
) RETURNS TABLE(assignment_id uuid, table_id uuid, start_at timestamptz, end_at timestamptz, merge_group_id uuid)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
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
  v_dedupe_key := format('%s:%s:%s:%s', p_booking_id, to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), v_table_list);

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
        'startAt', to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
        'endAt', to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
        'mergeGroupId', (SELECT merge_group_id FROM tmp_confirm_assignments_tx LIMIT 1),
        'idempotencyKey', p_idempotency_key
      )
    )
    ON CONFLICT ON CONSTRAINT capacity_outbox_dedupe_unique DO NOTHING;
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
      'startAt', to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
      'endAt', to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
      'expiresAt', to_char(v_hold.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
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
    ON CONFLICT ON CONSTRAINT capacity_outbox_dedupe_unique DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

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


GRANT ALL ON FUNCTION public.confirm_hold_assignment_tx(
    p_hold_id uuid,
    p_booking_id uuid,
    p_idempotency_key text,
    p_require_adjacency boolean,
    p_assigned_by uuid,
    p_window_start timestamp with time zone,
    p_window_end timestamp with time zone,
    p_expected_policy_version text,
    p_expected_adjacency_hash text,
    p_target_status public.booking_status,
    p_history_reason text,
    p_history_metadata jsonb,
    p_history_changed_by uuid
) TO service_role;


--
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
-- Name: FUNCTION assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone) IS 'DEPRECATED: prefer assign_single_table() or assign_merged_tables().';


--
-- Name: booking_status_summary(uuid, date, date, public.booking_status[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.booking_status_summary(p_restaurant_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_status_filter public.booking_status[] DEFAULT NULL::public.booking_status[]) RETURNS TABLE(status public.booking_status, total bigint)
    LANGUAGE sql
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
-- Name: FUNCTION booking_status_summary(p_restaurant_id uuid, p_start_date date, p_end_date date, p_status_filter public.booking_status[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.booking_status_summary(p_restaurant_id uuid, p_start_date date, p_end_date date, p_status_filter public.booking_status[]) IS 'Returns aggregated booking counts by status for a restaurant across an optional date range and status filter.';


--
-- Name: create_booking_with_capacity_check(uuid, uuid, date, time without time zone, time without time zone, integer, text, text, text, text, text, text, boolean, text, text, uuid, text, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_booking_with_capacity_check(p_restaurant_id uuid, p_customer_id uuid, p_booking_date date, p_start_time time without time zone, p_end_time time without time zone, p_party_size integer, p_booking_type text, p_customer_name text, p_customer_email text, p_customer_phone text, p_seating_preference text, p_notes text DEFAULT NULL::text, p_marketing_opt_in boolean DEFAULT false, p_idempotency_key text DEFAULT NULL::text, p_source text DEFAULT 'api'::text, p_auth_user_id uuid DEFAULT NULL::uuid, p_client_request_id text DEFAULT NULL::text, p_details jsonb DEFAULT '{}'::jsonb, p_loyalty_points_awarded integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    -- =====================================================
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


--
-- Name: FUNCTION create_booking_with_capacity_check(p_restaurant_id uuid, p_customer_id uuid, p_booking_date date, p_start_time time without time zone, p_end_time time without time zone, p_party_size integer, p_booking_type text, p_customer_name text, p_customer_email text, p_customer_phone text, p_seating_preference text, p_notes text, p_marketing_opt_in boolean, p_idempotency_key text, p_source text, p_auth_user_id uuid, p_client_request_id text, p_details jsonb, p_loyalty_points_awarded integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_booking_with_capacity_check(p_restaurant_id uuid, p_customer_id uuid, p_booking_date date, p_start_time time without time zone, p_end_time time without time zone, p_party_size integer, p_booking_type text, p_customer_name text, p_customer_email text, p_customer_phone text, p_seating_preference text, p_notes text, p_marketing_opt_in boolean, p_idempotency_key text, p_source text, p_auth_user_id uuid, p_client_request_id text, p_details jsonb, p_loyalty_points_awarded integer) IS 'Race-safe booking creation enforcing capacity and operating hours. Returns JSON response with success/error detail.';


--
-- Name: generate_booking_reference(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_booking_reference() RETURNS text
    LANGUAGE plpgsql
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
-- Name: get_or_create_booking_slot(uuid, date, time without time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_booking_slot(p_restaurant_id uuid, p_slot_date date, p_slot_time time without time zone, p_default_capacity integer DEFAULT 999) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
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
-- Name: FUNCTION get_or_create_booking_slot(p_restaurant_id uuid, p_slot_date date, p_slot_time time without time zone, p_default_capacity integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_or_create_booking_slot(p_restaurant_id uuid, p_slot_date date, p_slot_time time without time zone, p_default_capacity integer) IS 'Get existing slot or create new one with capacity override fallback (works even if restaurant_capacity_rules is absent).';


--
-- Name: increment_booking_slot_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_booking_slot_version() RETURNS trigger
    LANGUAGE plpgsql
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
-- Name: FUNCTION increment_booking_slot_version(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.increment_booking_slot_version() IS 'Automatically increment version column when reserved_count changes (optimistic concurrency control)';


--
-- Name: is_holds_strict_conflicts_enabled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_holds_strict_conflicts_enabled() RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  setting text;
BEGIN
  BEGIN
    setting := current_setting('app.holds.strict_conflicts.enabled', true);
  EXCEPTION
    WHEN others THEN
      setting := NULL;
  END;

  IF setting IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN lower(setting) IN ('1', 't', 'true', 'on', 'enabled');
END;
$$;


--
-- Name: is_table_available_v2(uuid, timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_table_available_v2(p_table_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_exclude_booking_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE sql STABLE
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
-- Name: log_table_assignment_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_table_assignment_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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
-- Name: FUNCTION log_table_assignment_change(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.log_table_assignment_change() IS 'Audit trail for table assignment changes (who assigned what table to which booking)';


--
-- Name: on_allocations_refresh(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_allocations_refresh() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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
-- Name: on_booking_status_refresh(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_booking_status_refresh() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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
-- Name: refresh_table_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_table_status(p_table_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
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
-- Name: set_booking_instants(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_booking_instants() RETURNS trigger
    LANGUAGE plpgsql
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
-- Name: set_booking_reference(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_booking_reference() RETURNS trigger
    LANGUAGE plpgsql
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
-- Name: set_hold_conflict_enforcement(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_hold_conflict_enforcement(enabled boolean) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM set_config(
    'app.holds.strict_conflicts.enabled',
    CASE WHEN enabled THEN 'on' ELSE 'off' END,
    true
  );
  RETURN enabled;
END;
$$;


--
-- Name: sync_table_hold_windows(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_table_hold_windows() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_hold RECORD;
  v_window tstzrange;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.table_hold_windows
    WHERE hold_id = OLD.hold_id AND table_id = OLD.table_id;

    DELETE FROM public.allocations
    WHERE resource_type = 'table'
      AND resource_id = OLD.table_id
      AND shadow = true
      AND booking_id IS NOT DISTINCT FROM (
        SELECT booking_id FROM public.table_holds WHERE id = OLD.hold_id
      );

    RETURN OLD;
  END IF;

  SELECT *
  INTO v_hold
  FROM public.table_holds
  WHERE id = COALESCE(NEW.hold_id, OLD.hold_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_window := tstzrange(v_hold.start_at, v_hold.end_at, '[)');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.table_hold_windows (hold_id, table_id, restaurant_id, booking_id, start_at, end_at, expires_at)
    VALUES (NEW.hold_id, NEW.table_id, v_hold.restaurant_id, v_hold.booking_id, v_hold.start_at, v_hold.end_at, v_hold.expires_at)
    ON CONFLICT (hold_id, table_id) DO UPDATE
      SET start_at = EXCLUDED.start_at,
          end_at = EXCLUDED.end_at,
          expires_at = EXCLUDED.expires_at,
          restaurant_id = EXCLUDED.restaurant_id,
          booking_id = EXCLUDED.booking_id;
  END IF;

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
    v_hold.booking_id,
    v_hold.restaurant_id,
    'table',
    COALESCE(NEW.table_id, OLD.table_id),
    v_window,
    v_hold.created_by,
    true,
    timezone('utc', now()),
    timezone('utc', now())
  )
  ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
    SET "window" = EXCLUDED."window",
        restaurant_id = EXCLUDED.restaurant_id,
        shadow = true,
        updated_at = timezone('utc', now());

  RETURN NEW;
END;
$$;


--
-- Name: unassign_table_from_booking(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unassign_table_from_booking(p_booking_id uuid, p_table_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
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
-- Name: FUNCTION unassign_table_from_booking(p_booking_id uuid, p_table_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.unassign_table_from_booking(p_booking_id uuid, p_table_id uuid) IS 'Remove table assignment from booking. Updates table status to available if no other active bookings.';


--
-- Name: unassign_tables_atomic(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unassign_tables_atomic(p_booking_id uuid, p_table_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(table_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      v_target_tables uuid[] := p_table_ids;
      v_removed RECORD;
    BEGIN
      IF v_target_tables IS NOT NULL THEN
        SELECT array_agg(DISTINCT table_id)
        INTO v_target_tables
        FROM unnest(v_target_tables) AS t(table_id);
      ELSE
        SELECT array_agg(table_id)
        INTO v_target_tables
        FROM public.booking_table_assignments
        WHERE booking_id = p_booking_id;
      END IF;

      IF v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0 THEN
        RETURN;
      END IF;

      FOR v_removed IN
        DELETE FROM public.booking_table_assignments
        WHERE booking_id = p_booking_id
          AND table_id = ANY (v_target_tables)
        RETURNING table_id
      LOOP
        table_id := v_removed.table_id;

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

      RETURN;
    END;
    $$;


--
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
    $$;


--
-- Name: update_table_hold_windows(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_table_hold_windows() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_window tstzrange := tstzrange(NEW.start_at, NEW.end_at, '[)');
BEGIN
  UPDATE public.table_hold_windows
  SET start_at = NEW.start_at,
      end_at = NEW.end_at,
      expires_at = NEW.expires_at,
      restaurant_id = NEW.restaurant_id,
      booking_id = NEW.booking_id
  WHERE hold_id = NEW.id;

  UPDATE public.allocations
  SET "window" = v_window,
      restaurant_id = NEW.restaurant_id,
      booking_id = NEW.booking_id,
      shadow = CASE WHEN shadow THEN shadow ELSE false END,
      updated_at = timezone('utc', now())
  WHERE resource_type = 'table'
    AND resource_id IN (
      SELECT table_id FROM public.table_hold_members WHERE hold_id = NEW.id
    )
    AND booking_id IS NOT DISTINCT FROM NEW.booking_id
    AND shadow = true;

  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: user_restaurants(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_restaurants() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT restaurant_id
  FROM public.restaurant_memberships
  WHERE user_id = auth.uid()
$$;


--
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
-- Name: validate_booking_capacity_after_assignment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_booking_capacity_after_assignment(p_booking_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_booking RECORD;
  v_service_period RECORD;
  v_capacity_rule RECORD;
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

  SELECT
    COALESCE(cr.max_covers, v_max_covers) AS max_covers,
    COALESCE(cr.max_parties, v_max_parties) AS max_parties
  INTO v_capacity_rule
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

  v_max_covers := COALESCE(v_capacity_rule.max_covers, v_max_covers);
  v_max_parties := COALESCE(v_capacity_rule.max_parties, v_max_parties);

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
-- Name: validate_table_adjacency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_table_adjacency() RETURNS trigger
    LANGUAGE plpgsql
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migrations (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    status character varying(50) DEFAULT 'applied'::character varying
);


--
-- Name: _migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public._migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: _migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public._migrations_id_seq OWNED BY public._migrations.id;


--
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
    CONSTRAINT allocations_resource_type_check CHECK ((resource_type = ANY (ARRAY['table'::text, 'hold'::text, 'merge_group'::text])))
);


--
-- Name: COLUMN allocations.shadow; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.allocations.shadow IS 'True when allocation is tentative (shadow). Shadow allocations are visible to staff but do not block standard bookings.';


--
-- Name: COLUMN allocations.is_maintenance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.allocations.is_maintenance IS 'True when allocation reserves a table for maintenance/out-of-service windows rather than a booking.';


--
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
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    entity text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    actor text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_assignment_idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_assignment_idempotency (
    booking_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    table_ids uuid[] NOT NULL,
    assignment_window tstzrange NOT NULL,
    merge_group_allocation_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    table_set_hash text,
    payload_checksum text
);


--
-- Name: COLUMN booking_assignment_idempotency.table_set_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_assignment_idempotency.table_set_hash IS 'MD5 hash of sorted table ids used to dedupe idempotency payloads.';


--
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_slots (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
-- Name: TABLE booking_slots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_slots IS 'Pre-materialized time slots with capacity counters for fast availability checks. Created on-demand or pre-generated.';


--
-- Name: COLUMN booking_slots.slot_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.slot_date IS 'Date of the slot (e.g., 2025-10-20)';


--
-- Name: COLUMN booking_slots.slot_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.slot_time IS 'Time of the slot (e.g., 19:00). Typically 15/30/60 minute intervals.';


--
-- Name: COLUMN booking_slots.service_period_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.service_period_id IS 'Optional link to service period (lunch/dinner). Null if not applicable.';


--
-- Name: COLUMN booking_slots.available_capacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.available_capacity IS 'Maximum capacity for this slot (in covers/guests). Derived from capacity rules.';


--
-- Name: COLUMN booking_slots.reserved_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.reserved_count IS 'Number of covers/guests currently reserved for this slot.';


--
-- Name: COLUMN booking_slots.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.version IS 'Optimistic locking version. Incremented on each update to prevent race conditions.';


--
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
-- Name: TABLE booking_state_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_state_history IS 'Audit history of booking lifecycle transitions.';


--
-- Name: COLUMN booking_state_history.booking_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.booking_id IS 'Booking whose status transitioned.';


--
-- Name: COLUMN booking_state_history.from_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.from_status IS 'Previous lifecycle status.';


--
-- Name: COLUMN booking_state_history.to_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.to_status IS 'New lifecycle status.';


--
-- Name: COLUMN booking_state_history.changed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.changed_by IS 'User who triggered the change (null for system operations).';


--
-- Name: COLUMN booking_state_history.changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.changed_at IS 'UTC timestamp when the transition was recorded.';


--
-- Name: COLUMN booking_state_history.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.reason IS 'Optional human-readable reason for the transition.';


--
-- Name: COLUMN booking_state_history.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.metadata IS 'Additional structured data describing the transition.';


--
-- Name: booking_state_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.booking_state_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: booking_state_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.booking_state_history_id_seq OWNED BY public.booking_state_history.id;


--
-- Name: booking_table_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_table_assignments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
-- Name: TABLE booking_table_assignments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_table_assignments IS 'Links bookings to physical tables. A booking can have multiple tables (e.g., party of 10 = 2x 6-tops).';


--
-- Name: COLUMN booking_table_assignments.booking_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.booking_id IS 'The booking being assigned a table';


--
-- Name: COLUMN booking_table_assignments.table_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.table_id IS 'The physical table being assigned';


--
-- Name: COLUMN booking_table_assignments.slot_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.slot_id IS 'Optional link to the booking slot (for slot-level tracking)';


--
-- Name: COLUMN booking_table_assignments.assigned_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.assigned_at IS 'When the assignment was made';


--
-- Name: COLUMN booking_table_assignments.assigned_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.assigned_by IS 'User who made the assignment (null for auto-assignment)';


--
-- Name: COLUMN booking_table_assignments.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.notes IS 'Optional notes about the assignment (e.g., "VIP preferred seating")';


--
-- Name: COLUMN booking_table_assignments.allocation_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.allocation_id IS 'Allocation row backing the assignment; used for overlap enforcement.';


--
-- Name: booking_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_versions (
    version_id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    auto_assign_idempotency_key text,
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
    table_id uuid,
    assigned_zone_id uuid,
    CONSTRAINT bookings_checked_out_after_checked_in CHECK (((checked_out_at IS NULL) OR (checked_in_at IS NULL) OR (checked_out_at >= checked_in_at))),
    CONSTRAINT bookings_lifecycle_timestamp_consistency CHECK ((((status = ANY (ARRAY['pending'::public.booking_status, 'pending_allocation'::public.booking_status, 'confirmed'::public.booking_status])) AND (checked_in_at IS NULL) AND (checked_out_at IS NULL)) OR ((status = 'checked_in'::public.booking_status) AND (checked_in_at IS NOT NULL) AND (checked_out_at IS NULL)) OR ((status = 'completed'::public.booking_status) AND (checked_in_at IS NOT NULL) AND (checked_out_at IS NOT NULL) AND (checked_out_at >= checked_in_at)) OR (status = 'cancelled'::public.booking_status) OR ((status = 'no_show'::public.booking_status) AND (checked_in_at IS NULL) AND (checked_out_at IS NULL)))),
    CONSTRAINT bookings_party_size_check CHECK ((party_size > 0)),
    CONSTRAINT chk_time_order CHECK ((start_at < end_at))
);


--
-- Name: COLUMN bookings.pending_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.pending_ref IS 'Temporary reference used while an asynchronous booking is pending confirmation. Should be NULL for finalized bookings.';


--
-- Name: COLUMN bookings.confirmation_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.confirmation_token IS 'One-time cryptographic token (base64url, 64 chars) for guest confirmation page access. Expires in 1 hour.';


--
-- Name: COLUMN bookings.confirmation_token_expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.confirmation_token_expires_at IS 'Expiry timestamp for confirmation_token. After this time, token is invalid.';


--
-- Name: COLUMN bookings.confirmation_token_used_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.confirmation_token_used_at IS 'Timestamp when confirmation_token was first used. Prevents token replay attacks.';


--
-- Name: COLUMN bookings.auth_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.auth_user_id IS 'Optional link to the authenticated Supabase user that created or owns the booking.';


--
-- Name: COLUMN bookings.checked_in_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.checked_in_at IS 'Timestamp when the guest was checked in by ops';


--
-- Name: COLUMN bookings.checked_out_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.checked_out_at IS 'Timestamp when the guest was checked out by ops';


--
-- Name: COLUMN bookings.assigned_zone_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.assigned_zone_id IS 'Zone enforced for all table assignments tied to the booking.';


--
-- Name: CONSTRAINT bookings_checked_out_after_checked_in ON bookings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT bookings_checked_out_after_checked_in ON public.bookings IS 'Ensures recorded check-out timestamps are chronologically after check-in.';


--
-- Name: CONSTRAINT bookings_lifecycle_timestamp_consistency ON bookings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT bookings_lifecycle_timestamp_consistency ON public.bookings IS 'Ensures booking lifecycle timestamps align with the status (checked-in bookings must have check-in timestamps, completed bookings need both timestamps, etc).';


--
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
-- Name: capacity_selector_rejections_v1; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.capacity_selector_rejections_v1 AS
 SELECT id,
    created_at,
    restaurant_id,
    booking_id,
    (context ->> 'skip_reason'::text) AS skip_reason,
        CASE
            WHEN ((context ->> 'skip_reason'::text) ~~ '%No suitable tables%'::text) THEN 'strategic'::text
            WHEN ((context ->> 'skip_reason'::text) ~~ '%service_overrun%'::text) THEN 'hard'::text
            WHEN ((context ->> 'skip_reason'::text) ~~ '%capacity%'::text) THEN 'strategic'::text
            ELSE 'hard'::text
        END AS classification,
    (context -> 'scoreBreakdown'::text) AS score_breakdown,
    (context -> 'plannerConfig'::text) AS planner_config,
    (context -> 'dominantPenalty'::text) AS dominant_penalty
   FROM public.observability_events oe
  WHERE ((source = 'capacity.selector'::text) AND (event_type = 'capacity.selector.skipped'::text))
  WITH NO DATA;


--
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
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
-- Name: COLUMN customers.user_profile_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.user_profile_id IS 'Optional foreign key to global user_profiles identity.';


--
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
-- Name: loyalty_point_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_point_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
-- Name: loyalty_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_points (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    restaurant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    total_points integer DEFAULT 0 NOT NULL,
    tier public.loyalty_tier DEFAULT 'bronze'::public.loyalty_tier NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: loyalty_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_programs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
-- Name: COLUMN profiles.has_access; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.has_access IS 'Indicates whether the profile retains active access to Ops surfaces.';


--
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
-- Name: restaurant_operating_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_operating_hours (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    restaurant_id uuid NOT NULL,
    day_of_week smallint,
    effective_date date,
    opens_at time without time zone,
    closes_at time without time zone,
    is_closed boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT restaurant_operating_hours_scope CHECK (((day_of_week IS NOT NULL) OR (effective_date IS NOT NULL))),
    CONSTRAINT restaurant_operating_hours_time_order CHECK ((is_closed OR ((opens_at IS NOT NULL) AND (closes_at IS NOT NULL) AND (opens_at < closes_at))))
);


--
-- Name: restaurant_service_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_service_periods (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
-- Name: restaurants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurants (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    logo_url text,
    reservation_interval_minutes integer DEFAULT 15 NOT NULL,
    reservation_default_duration_minutes integer DEFAULT 90 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    reservation_last_seating_buffer_minutes integer DEFAULT 120 NOT NULL,
    CONSTRAINT restaurants_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0))),
    CONSTRAINT restaurants_reservation_default_duration_minutes_check CHECK (((reservation_default_duration_minutes >= 15) AND (reservation_default_duration_minutes <= 300))),
    CONSTRAINT restaurants_reservation_interval_minutes_check CHECK (((reservation_interval_minutes > 0) AND (reservation_interval_minutes <= 180))),
    CONSTRAINT restaurants_reservation_last_seating_buffer_minutes_check CHECK (((reservation_last_seating_buffer_minutes >= 15) AND (reservation_last_seating_buffer_minutes <= 300))),
    CONSTRAINT restaurants_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))
);


--
-- Name: COLUMN restaurants.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.is_active IS 'Indicates whether the restaurant is active and should surface in public experiences.';


--
-- Name: COLUMN restaurants.reservation_last_seating_buffer_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.reservation_last_seating_buffer_minutes IS 'Minimum minutes before closing when the final reservation may start.';


--
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
-- Name: COLUMN service_policy.allow_after_hours; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_policy.allow_after_hours IS 'If true, privileged staff may override standard operating hours when creating bookings.';


--
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
-- Name: strategic_simulation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.strategic_simulation_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    strategy_a jsonb NOT NULL,
    strategy_b jsonb NOT NULL,
    snapshot_range tstzrange NOT NULL,
    kpis jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text,
    CONSTRAINT strategic_simulation_runs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: stripe_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: table_adjacencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_adjacencies (
    table_a uuid NOT NULL,
    table_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT table_adjacencies_not_equal CHECK ((table_a <> table_b))
);


--
-- Name: table_hold_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_hold_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hold_id uuid NOT NULL,
    table_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
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
    CONSTRAINT table_holds_window_check CHECK ((start_at < end_at)),
    CONSTRAINT th_times_consistent CHECK ((expires_at >= end_at))
);


--
-- Name: TABLE table_holds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_holds IS 'Ephemeral table reservations to guard allocations during quoting/confirmation flows.';


--
-- Name: table_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_inventory (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    restaurant_id uuid NOT NULL,
    table_number text NOT NULL,
    capacity integer NOT NULL,
    min_party_size integer DEFAULT 1 NOT NULL,
    max_party_size integer,
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
    CONSTRAINT table_inventory_min_party_positive CHECK ((min_party_size > 0)),
    CONSTRAINT table_inventory_valid_party_range CHECK (((max_party_size IS NULL) OR (max_party_size >= min_party_size)))
);


--
-- Name: TABLE table_inventory; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_inventory IS 'Physical restaurant tables with capacity and seating type. Used for table assignment and floor plan visualization.';


--
-- Name: COLUMN table_inventory.table_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.table_number IS 'Display name for the table (e.g., "T1", "Main-5", "Patio-2")';


--
-- Name: COLUMN table_inventory.capacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.capacity IS 'Number of seats at the table';


--
-- Name: COLUMN table_inventory.min_party_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.min_party_size IS 'Minimum party size for this table (e.g., 2-top only for parties of 2+)';


--
-- Name: COLUMN table_inventory.max_party_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.max_party_size IS 'Maximum party size for this table (optional, defaults to capacity)';


--
-- Name: COLUMN table_inventory.section; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.section IS 'Section name (e.g., "Main Floor", "Patio", "Bar Area", "Private Room")';


--
-- Name: COLUMN table_inventory.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.status IS 'Current status: available, reserved, occupied, out_of_service';


--
-- Name: COLUMN table_inventory."position"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory."position" IS 'Floor plan position as JSON: {x: number, y: number, rotation?: number} for drag-and-drop UI';


--
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
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    name text,
    email public.citext,
    phone text,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_profiles_phone_e164_check CHECK (((phone IS NULL) OR (phone ~ '^\\+[1-9]\\d{1,14}$'::text)))
);


--
-- Name: TABLE user_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_profiles IS 'Global customer identity (1:1 with auth.users).';


--
-- Name: COLUMN user_profiles.phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.phone IS 'User phone number stored in E.164 format (leading + and digits only).';


--
-- Name: zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    area_type public.area_type DEFAULT 'indoor'::public.area_type NOT NULL,
    CONSTRAINT zones_name_not_blank CHECK ((char_length(TRIM(BOTH FROM name)) > 0))
);


--
-- Name: _migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations ALTER COLUMN id SET DEFAULT nextval('public._migrations_id_seq'::regclass);


--
-- Name: booking_state_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_state_history ALTER COLUMN id SET DEFAULT nextval('public.booking_state_history_id_seq'::regclass);


--
-- Name: _migrations _migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_name_key UNIQUE (name);


--
-- Name: _migrations _migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_pkey PRIMARY KEY (id);


--
-- Name: allocations allocations_booking_resource_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_booking_resource_key UNIQUE (booking_id, resource_type, resource_id);


--
-- Name: allocations allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_pkey PRIMARY KEY (id);


--
-- Name: allocations allocations_resource_window_excl; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_resource_window_excl EXCLUDE USING gist (resource_type WITH =, resource_id WITH =, "window" WITH &&) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: allowed_capacities allowed_capacities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allowed_capacities
    ADD CONSTRAINT allowed_capacities_pkey PRIMARY KEY (restaurant_id, capacity);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: booking_assignment_idempotency booking_assignment_idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_idempotency
    ADD CONSTRAINT booking_assignment_idempotency_pkey PRIMARY KEY (booking_id, idempotency_key);


--
-- Name: booking_occasions booking_occasions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_occasions
    ADD CONSTRAINT booking_occasions_pkey PRIMARY KEY (key);


--
-- Name: booking_slots booking_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_pkey PRIMARY KEY (id);


--
-- Name: booking_slots booking_slots_restaurant_slot_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_restaurant_slot_key UNIQUE (restaurant_id, slot_date, slot_time);


--
-- Name: booking_state_history booking_state_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_state_history
    ADD CONSTRAINT booking_state_history_pkey PRIMARY KEY (id);


--
-- Name: booking_table_assignments booking_table_assignments_booking_table_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_booking_table_key UNIQUE (booking_id, table_id);


--
-- Name: booking_table_assignments booking_table_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_pkey PRIMARY KEY (id);


--
-- Name: booking_table_assignments booking_table_assignments_table_id_slot_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_table_id_slot_id_key UNIQUE (table_id, slot_id);

--
-- Name: booking_table_assignments bta_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT bta_no_overlap EXCLUDE USING gist (table_id WITH =, assignment_window WITH &&) WHERE (table_id IS NOT NULL);


--
-- Name: booking_versions booking_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_versions
    ADD CONSTRAINT booking_versions_pkey PRIMARY KEY (version_id);


--
-- Name: bookings bookings_confirmation_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_confirmation_token_unique UNIQUE (confirmation_token);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_reference_key UNIQUE (reference);


--
-- Name: customer_profiles customer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_pkey PRIMARY KEY (customer_id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_restaurant_email_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_restaurant_email_phone_key UNIQUE (restaurant_id, email_normalized, phone_normalized);


--
-- Name: customers customers_restaurant_id_email_normalized_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_restaurant_id_email_normalized_key UNIQUE (restaurant_id, email_normalized);


--
-- Name: customers customers_restaurant_id_phone_normalized_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_restaurant_id_phone_normalized_key UNIQUE (restaurant_id, phone_normalized);


--
-- Name: demand_profiles demand_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demand_profiles
    ADD CONSTRAINT demand_profiles_pkey PRIMARY KEY (id);


--
-- Name: feature_flag_overrides feature_flag_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flag_overrides
    ADD CONSTRAINT feature_flag_overrides_pkey PRIMARY KEY (id);


--
-- Name: feature_flag_overrides feature_flag_overrides_unique_flag_env; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flag_overrides
    ADD CONSTRAINT feature_flag_overrides_unique_flag_env UNIQUE (flag, environment);


--
-- Name: loyalty_point_events loyalty_point_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_point_events
    ADD CONSTRAINT loyalty_point_events_pkey PRIMARY KEY (id);


--
-- Name: loyalty_points loyalty_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_pkey PRIMARY KEY (id);


--
-- Name: loyalty_points loyalty_points_restaurant_id_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_restaurant_id_customer_id_key UNIQUE (restaurant_id, customer_id);


--
-- Name: loyalty_programs loyalty_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_pkey PRIMARY KEY (id);


--
-- Name: loyalty_programs loyalty_programs_restaurant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_restaurant_id_key UNIQUE (restaurant_id);


--
-- Name: booking_table_assignments no_overlapping_table_assignments; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT no_overlapping_table_assignments EXCLUDE USING gist (table_id WITH =, tstzrange(start_at, end_at, '[)'::text) WITH &&) WHERE (((start_at IS NOT NULL) AND (end_at IS NOT NULL)));


--
-- Name: observability_events observability_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observability_events
    ADD CONSTRAINT observability_events_pkey PRIMARY KEY (id);


--
-- Name: profile_update_requests profile_update_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_update_requests
    ADD CONSTRAINT profile_update_requests_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: restaurant_invites restaurant_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_invites
    ADD CONSTRAINT restaurant_invites_pkey PRIMARY KEY (id);


--
-- Name: restaurant_memberships restaurant_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_memberships
    ADD CONSTRAINT restaurant_memberships_pkey PRIMARY KEY (user_id, restaurant_id);


--
-- Name: restaurant_operating_hours restaurant_operating_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_operating_hours
    ADD CONSTRAINT restaurant_operating_hours_pkey PRIMARY KEY (id);


--
-- Name: restaurant_service_periods restaurant_service_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_service_periods
    ADD CONSTRAINT restaurant_service_periods_pkey PRIMARY KEY (id);


--
-- Name: restaurants restaurants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_pkey PRIMARY KEY (id);


--
-- Name: restaurants restaurants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_slug_key UNIQUE (slug);


--
-- Name: service_policy service_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_policy
    ADD CONSTRAINT service_policy_pkey PRIMARY KEY (id);


--
-- Name: strategic_configs strategic_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_configs
    ADD CONSTRAINT strategic_configs_pkey PRIMARY KEY (id);


--
-- Name: strategic_configs strategic_configs_restaurant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_configs
    ADD CONSTRAINT strategic_configs_restaurant_id_key UNIQUE (restaurant_id);


--
-- Name: strategic_simulation_runs strategic_simulation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_simulation_runs
    ADD CONSTRAINT strategic_simulation_runs_pkey PRIMARY KEY (id);


--
-- Name: stripe_events stripe_events_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_events
    ADD CONSTRAINT stripe_events_event_id_key UNIQUE (event_id);


--
-- Name: stripe_events stripe_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_events
    ADD CONSTRAINT stripe_events_pkey PRIMARY KEY (id);


--
-- Name: table_adjacencies table_adjacencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_adjacencies
    ADD CONSTRAINT table_adjacencies_pkey PRIMARY KEY (table_a, table_b);


--
-- Name: table_hold_members table_hold_members_hold_id_table_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_members
    ADD CONSTRAINT table_hold_members_hold_id_table_id_key UNIQUE (hold_id, table_id);


--
-- Name: table_hold_members table_hold_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_members
    ADD CONSTRAINT table_hold_members_pkey PRIMARY KEY (id);


--
-- Name: table_hold_windows thw_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_windows
    ADD CONSTRAINT thw_no_overlap EXCLUDE USING gist (table_id WITH =, hold_window WITH &&);


--
-- Name: table_hold_windows table_hold_windows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_windows
    ADD CONSTRAINT table_hold_windows_pkey PRIMARY KEY (hold_id, table_id);


--
-- Name: table_holds table_holds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_pkey PRIMARY KEY (id);


--
-- Name: table_inventory table_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_pkey PRIMARY KEY (id);


--
-- Name: table_inventory table_inventory_restaurant_id_table_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_restaurant_id_table_number_key UNIQUE (restaurant_id, table_number);


--
-- Name: table_scarcity_metrics table_scarcity_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_scarcity_metrics
    ADD CONSTRAINT table_scarcity_metrics_pkey PRIMARY KEY (id);


--
-- Name: table_scarcity_metrics unique_restaurant_table_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_scarcity_metrics
    ADD CONSTRAINT unique_restaurant_table_type UNIQUE (restaurant_id, table_type);


--
-- Name: user_profiles user_profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_email_key UNIQUE (email);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: allocations_resource_window_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX allocations_resource_window_idx ON public.allocations USING gist (resource_type, resource_id, "window");


--
-- Name: allowed_capacities_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX allowed_capacities_restaurant_idx ON public.allowed_capacities USING btree (restaurant_id, capacity);


--
-- Name: booking_assignment_idempotency_booking_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX booking_assignment_idempotency_booking_hash_key ON public.booking_assignment_idempotency USING btree (booking_id, table_set_hash) WHERE (table_set_hash IS NOT NULL);


--
-- Name: booking_assignment_idempotency_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_assignment_idempotency_created_idx ON public.booking_assignment_idempotency USING btree (created_at DESC);

--
-- Name: bai_rest_bk_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bai_rest_bk_idx ON public.booking_assignment_idempotency USING btree (booking_id, idempotency_key);


--
-- Name: booking_table_assignments_merge_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_table_assignments_merge_group_idx ON public.booking_table_assignments USING btree (merge_group_id);

--
-- Name: bta_window_gist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bta_window_gist ON public.booking_table_assignments USING gist (assignment_window);

--
-- Name: bta_table_window_gist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bta_table_window_gist ON public.booking_table_assignments USING gist (table_id, assignment_window);


--
-- Name: bookings_restaurant_date_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_restaurant_date_status_idx ON public.bookings USING btree (restaurant_id, booking_date, status);


--
-- Name: customers_restaurant_id_user_profile_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_restaurant_id_user_profile_id_unique ON public.customers USING btree (restaurant_id, user_profile_id) WHERE (user_profile_id IS NOT NULL);


--
-- Name: idx_analytics_events_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_booking_id ON public.analytics_events USING btree (booking_id);


--
-- Name: idx_analytics_events_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_customer_id ON public.analytics_events USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_analytics_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_event_type ON public.analytics_events USING btree (event_type);


--
-- Name: idx_analytics_events_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_occurred_at ON public.analytics_events USING btree (occurred_at DESC);


--
-- Name: idx_analytics_events_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_restaurant_id ON public.analytics_events USING btree (restaurant_id);


--
-- Name: idx_analytics_events_restaurant_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_restaurant_occurred ON public.analytics_events USING btree (restaurant_id, occurred_at DESC);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity_id ON public.audit_logs USING btree (entity, entity_id);


--
-- Name: idx_booking_slots_date_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_slots_date_range ON public.booking_slots USING btree (restaurant_id, slot_date);


--
-- Name: INDEX idx_booking_slots_date_range; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_slots_date_range IS 'Fast queries for all slots on a given date';


--
-- Name: idx_booking_slots_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_slots_lookup ON public.booking_slots USING btree (restaurant_id, slot_date, slot_time);


--
-- Name: INDEX idx_booking_slots_lookup; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_slots_lookup IS 'Fast lookup for specific slot (primary use case)';


--
-- Name: idx_booking_slots_service_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_slots_service_period ON public.booking_slots USING btree (service_period_id, slot_date);


--
-- Name: INDEX idx_booking_slots_service_period; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_slots_service_period IS 'Fast queries by service period (e.g., all lunch slots)';


--
-- Name: idx_booking_state_history_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_state_history_booking ON public.booking_state_history USING btree (booking_id, changed_at DESC);


--
-- Name: INDEX idx_booking_state_history_booking; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_state_history_booking IS 'Lookup transitions for a booking ordered by recency.';


--
-- Name: idx_booking_state_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_state_history_changed_at ON public.booking_state_history USING btree (changed_at);


--
-- Name: INDEX idx_booking_state_history_changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_state_history_changed_at IS 'Support chronological reporting of booking transitions.';


--
-- Name: idx_booking_table_assignments_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_table_assignments_booking ON public.booking_table_assignments USING btree (booking_id);

--
-- Name: bta_booking_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bta_booking_id_idx ON public.booking_table_assignments USING btree (booking_id);


--
-- Name: INDEX idx_booking_table_assignments_booking; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_table_assignments_booking IS 'Fast lookup of tables assigned to a booking';


--
-- Name: idx_booking_table_assignments_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_table_assignments_slot ON public.booking_table_assignments USING btree (slot_id);


--
-- Name: INDEX idx_booking_table_assignments_slot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_table_assignments_slot IS 'Fast lookup of assignments per slot';


--
-- Name: idx_booking_table_assignments_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_table_assignments_table ON public.booking_table_assignments USING btree (table_id, assigned_at);

--
-- Name: bta_table_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bta_table_id_idx ON public.booking_table_assignments USING btree (table_id);


--
-- Name: INDEX idx_booking_table_assignments_table; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_table_assignments_table IS 'Fast lookup of bookings using a table (for reservation timeline)';


--
-- Name: idx_booking_versions_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_versions_booking_id ON public.booking_versions USING btree (booking_id);


--
-- Name: idx_booking_versions_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_versions_changed_at ON public.booking_versions USING btree (changed_at DESC);


--
-- Name: idx_booking_versions_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_versions_restaurant_id ON public.booking_versions USING btree (restaurant_id);


--
-- Name: idx_bookings_auth_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_auth_user ON public.bookings USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);


--
-- Name: idx_bookings_client_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_client_request_id ON public.bookings USING btree (client_request_id);


--
-- Name: idx_bookings_confirmation_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_confirmation_token ON public.bookings USING btree (confirmation_token) WHERE (confirmation_token IS NOT NULL);


--
-- Name: idx_bookings_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_created ON public.bookings USING btree (restaurant_id, created_at DESC);


--
-- Name: idx_bookings_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_customer ON public.bookings USING btree (customer_id);


--
-- Name: idx_bookings_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_date ON public.bookings USING btree (restaurant_id, booking_date);


--
-- Name: idx_bookings_datetime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_datetime ON public.bookings USING btree (restaurant_id, start_at, end_at);


--
-- Name: idx_bookings_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_idempotency_key ON public.bookings USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX idx_bookings_auto_assign_idempotency_key ON public.bookings USING btree (auto_assign_idempotency_key) WHERE (auto_assign_idempotency_key IS NOT NULL);


--
-- Name: idx_bookings_pending_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_pending_ref ON public.bookings USING btree (pending_ref) WHERE (pending_ref IS NOT NULL);


--
-- Name: idx_bookings_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_reference ON public.bookings USING btree (reference);


--
-- Name: idx_bookings_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_restaurant ON public.bookings USING btree (restaurant_id);


--
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_status ON public.bookings USING btree (restaurant_id, status);


--
-- Name: bookings_restaurant_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_restaurant_date_idx ON public.bookings USING btree (restaurant_id, booking_date, start_at);


--
-- Name: idx_capacity_selector_rejections_v1_restaurant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capacity_selector_rejections_v1_restaurant_date ON public.capacity_selector_rejections_v1 USING btree (restaurant_id, created_at);


--
-- Name: idx_customer_profiles_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_profiles_updated_at ON public.customer_profiles USING btree (updated_at DESC);


--
-- Name: idx_customers_auth_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_auth_user ON public.customers USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);


--
-- Name: idx_customers_email_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_email_normalized ON public.customers USING btree (restaurant_id, email_normalized);


--
-- Name: idx_customers_phone_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_phone_normalized ON public.customers USING btree (restaurant_id, phone_normalized);


--
-- Name: idx_customers_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_restaurant ON public.customers USING btree (restaurant_id);


--
-- Name: idx_customers_user_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_user_profile_id ON public.customers USING btree (user_profile_id);


--
-- Name: idx_demand_profiles_restaurant_day_window; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demand_profiles_restaurant_day_window ON public.demand_profiles USING btree (restaurant_id, day_of_week, service_window);


--
-- Name: idx_demand_profiles_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demand_profiles_updated_at ON public.demand_profiles USING btree (updated_at);


--
-- Name: idx_loyalty_point_events_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_point_events_booking ON public.loyalty_point_events USING btree (booking_id) WHERE (booking_id IS NOT NULL);


--
-- Name: idx_loyalty_point_events_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_point_events_customer ON public.loyalty_point_events USING btree (customer_id);


--
-- Name: idx_loyalty_points_restaurant_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_points_restaurant_customer ON public.loyalty_points USING btree (restaurant_id, customer_id);


--
-- Name: idx_loyalty_programs_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_programs_restaurant ON public.loyalty_programs USING btree (restaurant_id);


--
-- Name: idx_memberships_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_restaurant ON public.restaurant_memberships USING btree (restaurant_id);


--
-- Name: idx_memberships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_user ON public.restaurant_memberships USING btree (user_id);


--
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: idx_profiles_has_access; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_has_access ON public.profiles USING btree (has_access);


--
-- Name: idx_restaurant_operating_hours_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_operating_hours_scope ON public.restaurant_operating_hours USING btree (restaurant_id, COALESCE((day_of_week)::integer, '-1'::integer), effective_date);


--
-- Name: idx_restaurant_service_periods_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_service_periods_scope ON public.restaurant_service_periods USING btree (restaurant_id, COALESCE((day_of_week)::integer, '-1'::integer));


--
-- Name: idx_restaurants_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurants_active ON public.restaurants USING btree (is_active);


--
-- Name: idx_restaurants_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurants_slug ON public.restaurants USING btree (slug);


--
-- Name: idx_stripe_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_events_created_at ON public.stripe_events USING btree (created_at DESC);


--
-- Name: idx_stripe_events_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_events_event_id ON public.stripe_events USING btree (event_id);


--
-- Name: idx_stripe_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_events_event_type ON public.stripe_events USING btree (event_type);


--
-- Name: idx_stripe_events_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_events_processed ON public.stripe_events USING btree (processed) WHERE (processed = false);


--
-- Name: idx_table_inventory_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_inventory_lookup ON public.table_inventory USING btree (restaurant_id, status, capacity);


--
-- Name: INDEX idx_table_inventory_lookup; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_table_inventory_lookup IS 'Fast lookup for available tables by restaurant and capacity';


--
-- Name: idx_table_inventory_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_inventory_section ON public.table_inventory USING btree (restaurant_id, section);


--
-- Name: INDEX idx_table_inventory_section; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_table_inventory_section IS 'Fast filtering by section for floor plan views';


--
-- Name: idx_table_scarcity_metrics_computed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_scarcity_metrics_computed_at ON public.table_scarcity_metrics USING btree (computed_at);


--
-- Name: idx_table_scarcity_metrics_restaurant_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_scarcity_metrics_restaurant_type ON public.table_scarcity_metrics USING btree (restaurant_id, table_type);


--
-- Name: idx_user_profiles_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_phone ON public.user_profiles USING btree (phone);


--
-- Name: observability_events_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observability_events_created_at_idx ON public.observability_events USING btree (created_at DESC);


--
-- Name: profile_update_requests_profile_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profile_update_requests_profile_key_idx ON public.profile_update_requests USING btree (profile_id, idempotency_key);


--
-- Name: restaurant_invites_pending_unique_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_invites_pending_unique_email ON public.restaurant_invites USING btree (restaurant_id, email_normalized) WHERE (status = 'pending'::text);


--
-- Name: restaurant_invites_restaurant_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restaurant_invites_restaurant_status_idx ON public.restaurant_invites USING btree (restaurant_id, status, expires_at DESC);


--
-- Name: restaurant_invites_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_invites_token_hash_key ON public.restaurant_invites USING btree (token_hash);


--
-- Name: table_adjacencies_table_b_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_adjacencies_table_b_idx ON public.table_adjacencies USING btree (table_b);


--
-- Name: table_hold_members_table_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_hold_members_table_idx ON public.table_hold_members USING btree (table_id);

--
-- Name: thm_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX thm_unique ON public.table_hold_members USING btree (hold_id, table_id);


--
-- Name: table_hold_windows_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_hold_windows_restaurant_idx ON public.table_hold_windows USING btree (restaurant_id);

--
-- Name: thw_window_gist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX thw_window_gist ON public.table_hold_windows USING gist (hold_window);

--
-- Name: thw_table_window_gist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX thw_table_window_gist ON public.table_hold_windows USING gist (table_id, hold_window);


--
-- Name: table_hold_windows_table_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_hold_windows_table_idx ON public.table_hold_windows USING btree (table_id);


--
-- Name: table_holds_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_booking_idx ON public.table_holds USING btree (booking_id);


--
-- Name: table_holds_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_expires_at_idx ON public.table_holds USING btree (expires_at);


--
-- Name: table_holds_zone_start_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_zone_start_idx ON public.table_holds USING btree (zone_id, start_at);

--
-- Name: table_holds_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_restaurant_idx ON public.table_holds USING btree (restaurant_id, start_at, end_at, expires_at);


--
-- Name: table_inventory_zone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_inventory_zone_idx ON public.table_inventory USING btree (zone_id);


--
-- Name: uniq_zones_restaurant_lower_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_zones_restaurant_lower_name ON public.zones USING btree (restaurant_id, lower(name));


--
-- Name: zones_restaurant_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX zones_restaurant_name_idx ON public.zones USING btree (restaurant_id, lower(name));


--
-- Name: allocations allocations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER allocations_updated_at BEFORE UPDATE ON public.allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: allowed_capacities allowed_capacities_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER allowed_capacities_touch_updated_at BEFORE UPDATE ON public.allowed_capacities FOR EACH ROW EXECUTE FUNCTION public.allowed_capacities_set_updated_at();


--
-- Name: booking_slots booking_slots_increment_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_slots_increment_version BEFORE UPDATE ON public.booking_slots FOR EACH ROW EXECUTE FUNCTION public.increment_booking_slot_version();


--
-- Name: booking_slots booking_slots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_slots_updated_at BEFORE UPDATE ON public.booking_slots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: booking_table_assignments booking_table_assignments_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_table_assignments_audit AFTER INSERT OR DELETE ON public.booking_table_assignments FOR EACH ROW EXECUTE FUNCTION public.log_table_assignment_change();


--
-- Name: booking_table_assignments booking_table_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_table_assignments_updated_at BEFORE UPDATE ON public.booking_table_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: bookings bookings_set_instants; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_set_instants BEFORE INSERT OR UPDATE OF booking_date, start_time, end_time, restaurant_id ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_booking_instants();


--
-- Name: bookings bookings_set_reference; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_set_reference BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_booking_reference();


--
-- Name: bookings bookings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: customers customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: restaurant_operating_hours restaurant_operating_hours_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_operating_hours_updated_at BEFORE UPDATE ON public.restaurant_operating_hours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: restaurant_service_periods restaurant_service_periods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_service_periods_updated_at BEFORE UPDATE ON public.restaurant_service_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: restaurants restaurants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: service_policy service_policy_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_policy_updated_at BEFORE UPDATE ON public.service_policy FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: restaurant_invites set_restaurant_invites_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_restaurant_invites_updated_at BEFORE UPDATE ON public.restaurant_invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: user_profiles set_user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: table_adjacencies table_adjacencies_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_adjacencies_validate BEFORE INSERT ON public.table_adjacencies FOR EACH ROW EXECUTE FUNCTION public.validate_table_adjacency();


--
-- Name: table_hold_members table_hold_members_sync_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_hold_members_sync_delete AFTER DELETE ON public.table_hold_members FOR EACH ROW EXECUTE FUNCTION public.sync_table_hold_windows();


--
-- Name: table_hold_members table_hold_members_sync_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_hold_members_sync_insert AFTER INSERT ON public.table_hold_members FOR EACH ROW EXECUTE FUNCTION public.sync_table_hold_windows();


--
-- Name: table_holds table_holds_sync_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_holds_sync_update AFTER UPDATE OF start_at, end_at, expires_at, restaurant_id, booking_id ON public.table_holds FOR EACH ROW EXECUTE FUNCTION public.update_table_hold_windows();


--
-- Name: table_inventory table_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_inventory_updated_at BEFORE UPDATE ON public.table_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: allocations trg_allocations_refresh; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_allocations_refresh AFTER INSERT OR DELETE OR UPDATE ON public.allocations FOR EACH ROW EXECUTE FUNCTION public.on_allocations_refresh();


--
-- Name: bookings trg_booking_status_refresh; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_booking_status_refresh AFTER UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.on_booking_status_refresh();


--
-- Name: demand_profiles update_demand_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_demand_profiles_updated_at BEFORE UPDATE ON public.demand_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: loyalty_points update_loyalty_points_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_loyalty_points_updated_at BEFORE UPDATE ON public.loyalty_points FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: loyalty_programs update_loyalty_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_loyalty_programs_updated_at BEFORE UPDATE ON public.loyalty_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: zones zones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER zones_updated_at BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: allocations allocations_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: allocations allocations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: allocations allocations_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: allowed_capacities allowed_capacities_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allowed_capacities
    ADD CONSTRAINT allowed_capacities_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: analytics_events analytics_events_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: analytics_events analytics_events_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: analytics_events analytics_events_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: booking_assignment_idempotency booking_assignment_idempotency_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_idempotency
    ADD CONSTRAINT booking_assignment_idempotency_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_assignment_idempotency booking_assignment_idempotency_merge_group_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_idempotency
    ADD CONSTRAINT booking_assignment_idempotency_merge_group_fkey FOREIGN KEY (merge_group_allocation_id) REFERENCES public.allocations(id) ON DELETE SET NULL;


--
-- Name: booking_slots booking_slots_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: booking_slots booking_slots_service_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_service_period_id_fkey FOREIGN KEY (service_period_id) REFERENCES public.restaurant_service_periods(id) ON DELETE SET NULL;


--
-- Name: booking_state_history booking_state_history_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_state_history
    ADD CONSTRAINT booking_state_history_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_state_history booking_state_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_state_history
    ADD CONSTRAINT booking_state_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: booking_table_assignments booking_table_assignments_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id) ON DELETE SET NULL;


--
-- Name: booking_table_assignments booking_table_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: booking_table_assignments booking_table_assignments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_table_assignments booking_table_assignments_merge_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_merge_group_id_fkey FOREIGN KEY (merge_group_id) REFERENCES public.allocations(id) ON DELETE SET NULL;


--
-- Name: booking_table_assignments booking_table_assignments_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.booking_slots(id) ON DELETE SET NULL;


--
-- Name: booking_table_assignments booking_table_assignments_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE RESTRICT;


--
-- Name: booking_versions booking_versions_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_versions
    ADD CONSTRAINT booking_versions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_versions booking_versions_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_versions
    ADD CONSTRAINT booking_versions_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_assigned_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_assigned_zone_id_fkey FOREIGN KEY (assigned_zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_booking_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_booking_type_fkey FOREIGN KEY (booking_type) REFERENCES public.booking_occasions(key) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bookings bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: bookings bookings_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE SET NULL;


--
-- Name: customer_profiles customer_profiles_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customers customers_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: customers customers_user_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_profile_id_fkey FOREIGN KEY (user_profile_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: demand_profiles demand_profiles_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demand_profiles
    ADD CONSTRAINT demand_profiles_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: loyalty_point_events loyalty_point_events_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_point_events
    ADD CONSTRAINT loyalty_point_events_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: loyalty_point_events loyalty_point_events_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_point_events
    ADD CONSTRAINT loyalty_point_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: loyalty_point_events loyalty_point_events_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_point_events
    ADD CONSTRAINT loyalty_point_events_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: loyalty_points loyalty_points_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: loyalty_points loyalty_points_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: loyalty_programs loyalty_programs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: profile_update_requests profile_update_requests_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_update_requests
    ADD CONSTRAINT profile_update_requests_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: restaurant_invites restaurant_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_invites
    ADD CONSTRAINT restaurant_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: restaurant_invites restaurant_invites_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_invites
    ADD CONSTRAINT restaurant_invites_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_memberships restaurant_memberships_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_memberships
    ADD CONSTRAINT restaurant_memberships_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_operating_hours restaurant_operating_hours_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_operating_hours
    ADD CONSTRAINT restaurant_operating_hours_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_service_periods restaurant_service_periods_booking_option_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_service_periods
    ADD CONSTRAINT restaurant_service_periods_booking_option_fkey FOREIGN KEY (booking_option) REFERENCES public.booking_occasions(key) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: restaurant_service_periods restaurant_service_periods_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_service_periods
    ADD CONSTRAINT restaurant_service_periods_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: strategic_configs strategic_configs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_configs
    ADD CONSTRAINT strategic_configs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: strategic_configs strategic_configs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_configs
    ADD CONSTRAINT strategic_configs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: strategic_simulation_runs strategic_simulation_runs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_simulation_runs
    ADD CONSTRAINT strategic_simulation_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: strategic_simulation_runs strategic_simulation_runs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_simulation_runs
    ADD CONSTRAINT strategic_simulation_runs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_adjacencies table_adjacencies_table_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_adjacencies
    ADD CONSTRAINT table_adjacencies_table_a_fkey FOREIGN KEY (table_a) REFERENCES public.table_inventory(id) ON DELETE CASCADE;


--
-- Name: table_adjacencies table_adjacencies_table_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_adjacencies
    ADD CONSTRAINT table_adjacencies_table_b_fkey FOREIGN KEY (table_b) REFERENCES public.table_inventory(id) ON DELETE CASCADE;


--
-- Name: table_hold_members table_hold_members_hold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_members
    ADD CONSTRAINT table_hold_members_hold_id_fkey FOREIGN KEY (hold_id) REFERENCES public.table_holds(id) ON DELETE CASCADE;


--
-- Name: table_hold_members table_hold_members_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_members
    ADD CONSTRAINT table_hold_members_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE RESTRICT;


--
-- Name: table_hold_windows table_hold_windows_hold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_windows
    ADD CONSTRAINT table_hold_windows_hold_id_fkey FOREIGN KEY (hold_id) REFERENCES public.table_holds(id) ON DELETE CASCADE;


--
-- Name: table_hold_windows table_hold_windows_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_windows
    ADD CONSTRAINT table_hold_windows_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE CASCADE;


--
-- Name: table_holds table_holds_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: table_holds table_holds_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: table_holds table_holds_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_holds table_holds_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


--
-- Name: table_inventory table_inventory_allowed_capacity_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_allowed_capacity_fkey FOREIGN KEY (restaurant_id, capacity) REFERENCES public.allowed_capacities(restaurant_id, capacity) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: table_inventory table_inventory_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_inventory table_inventory_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE RESTRICT;


--
-- Name: table_scarcity_metrics table_scarcity_metrics_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_scarcity_metrics
    ADD CONSTRAINT table_scarcity_metrics_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: zones zones_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: bookings Admins and owners can delete bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and owners can delete bookings" ON public.bookings FOR DELETE USING ((restaurant_id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));


--
-- Name: customers Admins and owners can delete customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and owners can delete customers" ON public.customers FOR DELETE USING ((restaurant_id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));


--
-- Name: booking_table_assignments Customers can view their table assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their table assignments" ON public.booking_table_assignments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = booking_table_assignments.booking_id) AND ((b.auth_user_id = auth.uid()) OR (b.customer_id IN ( SELECT customers.id
           FROM public.customers
          WHERE (customers.auth_user_id = auth.uid()))))))));


--
-- Name: strategic_simulation_runs Ops can manage simulation runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ops can manage simulation runs" ON public.strategic_simulation_runs USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = strategic_simulation_runs.restaurant_id) AND (rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'ops'::text]))))));


--
-- Name: strategic_configs Ops managers can manage strategic configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ops managers can manage strategic configs" ON public.strategic_configs USING (((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = strategic_configs.restaurant_id) AND (rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'ops'::text]))))) OR (restaurant_id IS NULL)));


--
-- Name: restaurant_memberships Owners and admins can manage memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins can manage memberships" ON public.restaurant_memberships USING ((restaurant_id IN ( SELECT public.user_restaurants_admin() AS user_restaurants_admin))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants_admin() AS user_restaurants_admin)));


--
-- Name: demand_profiles Owners and managers can manage demand profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and managers can manage demand profiles" ON public.demand_profiles USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = demand_profiles.restaurant_id) AND (rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));


--
-- Name: table_scarcity_metrics Owners and managers can manage scarcity metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and managers can manage scarcity metrics" ON public.table_scarcity_metrics USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = table_scarcity_metrics.restaurant_id) AND (rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));


--
-- Name: restaurant_invites Owners and managers manage invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and managers manage invites" ON public.restaurant_invites USING ((restaurant_id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text])))))) WITH CHECK ((restaurant_id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));


--
-- Name: booking_slots Public can view booking slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view booking slots" ON public.booking_slots FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurants r
  WHERE ((r.id = booking_slots.restaurant_id) AND (r.is_active = true)))));


--
-- Name: table_inventory Public can view table inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view table inventory" ON public.table_inventory FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurants r
  WHERE ((r.id = table_inventory.restaurant_id) AND (r.is_active = true)))));


--
-- Name: analytics_events Restaurant staff can view analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Restaurant staff can view analytics" ON public.analytics_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = analytics_events.restaurant_id) AND (rm.user_id = auth.uid())))));


--
-- Name: booking_versions Restaurant staff can view booking versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Restaurant staff can view booking versions" ON public.booking_versions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = booking_versions.restaurant_id) AND (rm.user_id = auth.uid())))));


--
-- Name: table_adjacencies Service role can manage adjacencies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage adjacencies" ON public.table_adjacencies TO service_role USING (true) WITH CHECK (true);


--
-- Name: allocations Service role can manage allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage allocations" ON public.allocations TO service_role USING (true) WITH CHECK (true);


--
-- Name: allowed_capacities Service role can manage allowed capacities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage allowed capacities" ON public.allowed_capacities TO service_role USING (true) WITH CHECK (true);


--
-- Name: analytics_events Service role can manage analytics events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage analytics events" ON public.analytics_events USING (true) WITH CHECK (true);


--
-- Name: audit_logs Service role can manage audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage audit logs" ON public.audit_logs USING (true) WITH CHECK (true);


--
-- Name: booking_slots Service role can manage booking slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage booking slots" ON public.booking_slots TO service_role USING (true) WITH CHECK (true);


--
-- Name: booking_versions Service role can manage booking versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage booking versions" ON public.booking_versions USING (true) WITH CHECK (true);


--
-- Name: customer_profiles Service role can manage customer profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage customer profiles" ON public.customer_profiles USING (true) WITH CHECK (true);


--
-- Name: table_holds Service role can manage holds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage holds" ON public.table_holds TO service_role USING (true) WITH CHECK (true);


--
-- Name: loyalty_point_events Service role can manage loyalty events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage loyalty events" ON public.loyalty_point_events USING (true) WITH CHECK (true);


--
-- Name: loyalty_points Service role can manage loyalty points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage loyalty points" ON public.loyalty_points USING (true) WITH CHECK (true);


--
-- Name: loyalty_programs Service role can manage loyalty programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage loyalty programs" ON public.loyalty_programs USING (true) WITH CHECK (true);


--
-- Name: restaurant_operating_hours Service role can manage operating hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage operating hours" ON public.restaurant_operating_hours TO service_role USING (true) WITH CHECK (true);


--
-- Name: profiles Service role can manage profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage profiles" ON public.profiles USING (true) WITH CHECK (true);


--
-- Name: restaurant_service_periods Service role can manage service periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage service periods" ON public.restaurant_service_periods TO service_role USING (true) WITH CHECK (true);


--
-- Name: service_policy Service role can manage service policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage service policy" ON public.service_policy TO service_role USING (true) WITH CHECK (true);


--
-- Name: stripe_events Service role can manage stripe events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage stripe events" ON public.stripe_events USING (true) WITH CHECK (true);


--
-- Name: booking_table_assignments Service role can manage table assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage table assignments" ON public.booking_table_assignments TO service_role USING (true) WITH CHECK (true);


--
-- Name: table_hold_members Service role can manage table hold members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage table hold members" ON public.table_hold_members TO service_role USING (true) WITH CHECK (true);


--
-- Name: table_inventory Service role can manage table inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage table inventory" ON public.table_inventory TO service_role USING (true) WITH CHECK (true);


--
-- Name: zones Service role can manage zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage zones" ON public.zones TO service_role USING (true) WITH CHECK (true);


--
-- Name: bookings Staff can create bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create bookings" ON public.bookings FOR INSERT WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: customers Staff can create customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create customers" ON public.customers FOR INSERT WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: table_adjacencies Staff can manage adjacencies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage adjacencies" ON public.table_adjacencies TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.table_inventory ti
  WHERE ((ti.id = table_adjacencies.table_a) AND (ti.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.table_inventory ti
  WHERE ((ti.id = table_adjacencies.table_a) AND (ti.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))))));


--
-- Name: allowed_capacities Staff can manage allowed capacities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage allowed capacities" ON public.allowed_capacities TO authenticated USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: booking_slots Staff can manage booking slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage booking slots" ON public.booking_slots USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: restaurant_operating_hours Staff can manage operating hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage operating hours" ON public.restaurant_operating_hours USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: restaurant_service_periods Staff can manage service periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage service periods" ON public.restaurant_service_periods USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: booking_table_assignments Staff can manage table assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage table assignments" ON public.booking_table_assignments USING ((EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = booking_table_assignments.booking_id) AND (b.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = booking_table_assignments.booking_id) AND (b.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))))));


--
-- Name: table_inventory Staff can manage table inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage table inventory" ON public.table_inventory USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: zones Staff can manage zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage zones" ON public.zones TO authenticated USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: bookings Staff can update bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update bookings" ON public.bookings FOR UPDATE USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: customers Staff can update customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update customers" ON public.customers FOR UPDATE USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: allocations Staff can view allocations for their restaurants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view allocations for their restaurants" ON public.allocations FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: bookings Staff can view bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view bookings" ON public.bookings FOR SELECT USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: customer_profiles Staff can view customer profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view customer profiles" ON public.customer_profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.id = customer_profiles.customer_id) AND (c.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))))));


--
-- Name: customers Staff can view customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view customers" ON public.customers FOR SELECT USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: service_policy Staff can view service policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view service policy" ON public.service_policy FOR SELECT TO authenticated USING (true);


--
-- Name: table_hold_members Staff can view table hold members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view table hold members" ON public.table_hold_members FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.table_holds h
  WHERE ((h.id = table_hold_members.hold_id) AND (h.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))))));


--
-- Name: table_holds Staff can view table holds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view table holds" ON public.table_holds FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: demand_profiles Users can view demand profiles for their restaurants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view demand profiles for their restaurants" ON public.demand_profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = demand_profiles.restaurant_id) AND (rm.user_id = auth.uid())))));


--
-- Name: restaurant_memberships Users can view memberships in their restaurants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view memberships in their restaurants" ON public.restaurant_memberships FOR SELECT USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: table_scarcity_metrics Users can view scarcity metrics for their restaurants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view scarcity metrics for their restaurants" ON public.table_scarcity_metrics FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = table_scarcity_metrics.restaurant_id) AND (rm.user_id = auth.uid())))));


--
-- Name: strategic_simulation_runs Users can view simulation runs for their restaurants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view simulation runs for their restaurants" ON public.strategic_simulation_runs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = strategic_simulation_runs.restaurant_id) AND (rm.user_id = auth.uid())))));


--
-- Name: strategic_configs Users can view strategic configs for their restaurants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view strategic configs for their restaurants" ON public.strategic_configs FOR SELECT USING (((restaurant_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = strategic_configs.restaurant_id) AND (rm.user_id = auth.uid()))))));


--
-- Name: allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: allowed_capacities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.allowed_capacities ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurants anon_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_read_all ON public.restaurants FOR SELECT TO anon USING (true);


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurants authenticated_can_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_can_create ON public.restaurants FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: restaurants authenticated_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_all ON public.restaurants FOR SELECT TO authenticated USING (true);


--
-- Name: booking_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_table_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_table_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: demand_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demand_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_point_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_point_events ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurants owners_admins_can_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owners_admins_can_update ON public.restaurants FOR UPDATE TO authenticated USING ((id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text])))))) WITH CHECK ((id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));


--
-- Name: restaurants owners_can_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owners_can_delete ON public.restaurants FOR DELETE TO authenticated USING ((id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = 'owner'::text)))));


--
-- Name: profile_update_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_update_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_update_requests profile_update_requests_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_update_requests_delete ON public.profile_update_requests FOR DELETE USING ((auth.uid() = profile_id));


--
-- Name: profile_update_requests profile_update_requests_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_update_requests_insert ON public.profile_update_requests FOR INSERT WITH CHECK ((auth.uid() = profile_id));


--
-- Name: profile_update_requests profile_update_requests_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_update_requests_select ON public.profile_update_requests FOR SELECT USING ((auth.uid() = profile_id));


--
-- Name: profile_update_requests profile_update_requests_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_update_requests_update ON public.profile_update_requests FOR UPDATE USING ((auth.uid() = profile_id)) WITH CHECK ((auth.uid() = profile_id));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_operating_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_operating_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_service_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_service_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

--
-- Name: service_policy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_policy ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurants service_role_all_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_access ON public.restaurants TO service_role USING (true) WITH CHECK (true);


--
-- Name: restaurants service_role_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_read_all ON public.restaurants FOR SELECT TO service_role USING (true);


--
-- Name: strategic_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.strategic_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: strategic_simulation_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.strategic_simulation_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

--
-- Name: table_adjacencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_adjacencies ENABLE ROW LEVEL SECURITY;

--
-- Name: table_hold_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_hold_members ENABLE ROW LEVEL SECURITY;

--
-- Name: table_holds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_holds ENABLE ROW LEVEL SECURITY;

--
-- Name: table_inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: table_scarcity_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_scarcity_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict mXExBCr5fo0ca01PVodAj2Jdmb2m2WSHtj3MaaP13cn7iJ5jGBOvmc88lR68cjx
