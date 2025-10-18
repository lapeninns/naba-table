-- Migration: Enhance assign_tables_atomic for idempotency, locking, and overlap signalling
-- Date: 2025-10-18

DO $$
BEGIN
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.assign_tables_atomic(
      p_booking_id uuid,
      p_table_ids uuid[],
      p_window tstzrange,
      p_assigned_by uuid DEFAULT NULL,
      p_idempotency_key text DEFAULT NULL
    )
    RETURNS TABLE (
      table_id uuid,
      assignment_id uuid,
      merge_group_id uuid
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $body$
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
    $body$;
  $fn$;
END;
$$;
