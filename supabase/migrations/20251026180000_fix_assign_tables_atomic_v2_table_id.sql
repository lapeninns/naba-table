-- Fix ambiguous table_id reference in assign_tables_atomic_v2
CREATE OR REPLACE FUNCTION public.assign_tables_atomic_v2(
      p_booking_id uuid,
      p_table_ids uuid[],
      p_idempotency_key text DEFAULT NULL,
      p_require_adjacency boolean DEFAULT false,
      p_assigned_by uuid DEFAULT NULL
    ) RETURNS TABLE (
      table_id uuid,
      start_at timestamptz,
      end_at timestamptz,
      merge_group_id uuid
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $function$
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

        UPDATE public.table_inventory
        SET status = 'reserved'::public.table_status
        WHERE id = v_table_id;

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
    $function$;

ALTER FUNCTION public.assign_tables_atomic_v2(uuid, uuid[], text, boolean, uuid) OWNER TO postgres;

GRANT ALL ON FUNCTION public.assign_tables_atomic_v2(uuid, uuid[], text, boolean, uuid) TO service_role;

-- Ensure booking slot helper tolerates missing capacity rules table.
CREATE OR REPLACE FUNCTION public.get_or_create_booking_slot(
  p_restaurant_id uuid,
  p_slot_date date,
  p_slot_time time without time zone,
  p_default_capacity integer DEFAULT 999
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
  ORDER BY day_of_week DESC NULLS LAST
  LIMIT 1;

  v_capacity := NULL;

  IF v_rules_exist THEN
    SELECT COALESCE(max_covers, p_default_capacity)
    INTO v_capacity
    FROM public.restaurant_capacity_rules
    WHERE restaurant_id = p_restaurant_id
      AND (service_period_id IS NULL OR service_period_id = v_service_period_id)
      AND (day_of_week IS NULL OR day_of_week = EXTRACT(DOW FROM p_slot_date)::smallint)
      AND (effective_date IS NULL OR effective_date <= p_slot_date)
    ORDER BY
      effective_date DESC NULLS LAST,
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
  RETURNING id INTO v_slot_id;

  RETURN v_slot_id;
END;
$function$;

ALTER FUNCTION public.get_or_create_booking_slot(uuid, date, time without time zone, integer) OWNER TO postgres;

GRANT ALL ON FUNCTION public.get_or_create_booking_slot(uuid, date, time without time zone, integer) TO service_role;

COMMENT ON FUNCTION public.get_or_create_booking_slot(uuid, date, time without time zone, integer)
  IS 'Get existing slot or create new one with capacity override fallback (works even if restaurant_capacity_rules is absent).';
