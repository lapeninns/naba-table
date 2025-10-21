BEGIN;

-- Remove merge-specific triggers before dropping supporting objects
DROP TRIGGER IF EXISTS merge_group_members_validate_connectivity ON public.merge_group_members;
DROP TRIGGER IF EXISTS merge_rules_updated_at ON public.merge_rules;

-- Drop merge validation helper
DROP FUNCTION IF EXISTS public.validate_merge_group_members();

-- Replace assign/unassign RPCs with merge-free variants
DROP FUNCTION IF EXISTS public.assign_tables_atomic(uuid, uuid[], tstzrange, uuid, text);
DROP FUNCTION IF EXISTS public.unassign_tables_atomic(uuid, uuid[], uuid);

-- Clean up merge allocations prior to dropping tables
DELETE FROM public.allocations WHERE resource_type = 'merge_group';

-- Remove merge group references from booking assignments
ALTER TABLE public.booking_table_assignments
  DROP CONSTRAINT IF EXISTS booking_table_assignments_merge_group_id_fkey;
ALTER TABLE public.booking_table_assignments
  DROP COLUMN IF EXISTS merge_group_id;

-- Drop merge metadata tables
DROP TABLE IF EXISTS public.merge_group_members CASCADE;
DROP TABLE IF EXISTS public.merge_groups CASCADE;
DROP TABLE IF EXISTS public.merge_rules CASCADE;

-- Recreate assign_tables_atomic without merge support
CREATE FUNCTION public.assign_tables_atomic(
  p_booking_id uuid,
  p_table_ids uuid[],
  p_window tstzrange,
  p_assigned_by uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS TABLE(table_id uuid, assignment_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
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

ALTER FUNCTION public.assign_tables_atomic(uuid, uuid[], tstzrange, uuid, text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.assign_tables_atomic(uuid, uuid[], tstzrange, uuid, text) TO service_role;

-- Recreate unassign_tables_atomic without merge support
CREATE FUNCTION public.unassign_tables_atomic(
  p_booking_id uuid,
  p_table_ids uuid[] DEFAULT NULL
) RETURNS TABLE(table_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
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

ALTER FUNCTION public.unassign_tables_atomic(uuid, uuid[]) OWNER TO postgres;
GRANT ALL ON FUNCTION public.unassign_tables_atomic(uuid, uuid[]) TO service_role;

COMMIT;
