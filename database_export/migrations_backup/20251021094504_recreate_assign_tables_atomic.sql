DO $migration$
BEGIN
  EXECUTE $create$
    CREATE FUNCTION public.assign_tables_atomic(
      p_booking_id uuid,
      p_table_ids uuid[],
      p_window tstzrange,
      p_assigned_by uuid DEFAULT NULL,
      p_idempotency_key text DEFAULT NULL
    ) RETURNS TABLE(table_id uuid, assignment_id uuid)
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $function$
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
    $function$
  $create$;

  EXECUTE $alter$
    ALTER FUNCTION public.assign_tables_atomic(uuid, uuid[], tstzrange, uuid, text) OWNER TO postgres
  $alter$;

  EXECUTE $grant$
    GRANT ALL ON FUNCTION public.assign_tables_atomic(uuid, uuid[], tstzrange, uuid, text) TO service_role
  $grant$;
END;
$migration$;
