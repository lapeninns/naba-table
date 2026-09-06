-- Manual release must invalidate the same allocation state that assignment creates.
-- Lock order matches assign_tables_atomic_v2: booking, then inventory IDs in order.
CREATE OR REPLACE FUNCTION public.remove_booking_table_assignments_and_reopen_if_empty(
  p_booking_id uuid,
  p_table_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_removed_table_ids uuid[];
  v_removed_keys text[];
  v_touched_merge_ids uuid[];
  v_removed_count integer := 0;
  v_remaining_count integer := 0;
  v_table_id uuid;
BEGIN
  SELECT booking.restaurant_id INTO v_restaurant_id
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found for table unassignment' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    array_agg(DISTINCT assignment.table_id ORDER BY assignment.table_id),
    array_agg(DISTINCT assignment.idempotency_key)
      FILTER (WHERE assignment.idempotency_key IS NOT NULL),
    array_agg(DISTINCT assignment.merge_group_id)
      FILTER (WHERE assignment.merge_group_id IS NOT NULL)
  INTO v_removed_table_ids, v_removed_keys, v_touched_merge_ids
  FROM public.booking_table_assignments AS assignment
  JOIN public.table_inventory AS inventory ON inventory.id = assignment.table_id
  WHERE assignment.booking_id = p_booking_id
    AND inventory.restaurant_id = v_restaurant_id
    AND assignment.table_id = ANY(p_table_ids);

  -- Replays and unrelated table IDs cannot invalidate a live assignment's ledger.
  IF COALESCE(cardinality(v_removed_table_ids), 0) = 0 THEN
    RETURN 0;
  END IF;

  PERFORM inventory.id
  FROM public.table_inventory AS inventory
  WHERE inventory.restaurant_id = v_restaurant_id
    AND inventory.id = ANY(v_removed_table_ids)
  ORDER BY inventory.id
  FOR UPDATE;

  DELETE FROM public.booking_table_assignments AS assignment
  WHERE assignment.booking_id = p_booking_id
    AND assignment.table_id = ANY(v_removed_table_ids);
  GET DIAGNOSTICS v_removed_count = ROW_COUNT;

  SELECT count(*) INTO v_remaining_count
  FROM public.booking_table_assignments AS remaining
  WHERE remaining.booking_id = p_booking_id;

  -- A partial release invalidates the original set, but not a disjoint assignment.
  DELETE FROM public.booking_assignment_idempotency AS ledger
  WHERE ledger.booking_id = p_booking_id
    AND (
      v_remaining_count = 0
      OR ledger.table_ids && v_removed_table_ids
      OR ledger.idempotency_key = ANY(COALESCE(v_removed_keys, ARRAY[]::text[]))
      OR ledger.merge_group_allocation_id = ANY(COALESCE(v_touched_merge_ids, ARRAY[]::uuid[]))
    );

  -- Preserve surviving members and their merge-group allocation. Only groups made
  -- orphaned by this release are archived, along with the released table resources.
  WITH released AS (
    DELETE FROM public.allocations AS allocation
    WHERE allocation.booking_id = p_booking_id
      AND allocation.restaurant_id = v_restaurant_id
      AND (
        (allocation.resource_type = 'table' AND allocation.resource_id = ANY(v_removed_table_ids))
        OR (
          allocation.resource_type = 'merge_group'
          AND allocation.id = ANY(COALESCE(v_touched_merge_ids, ARRAY[]::uuid[]))
          AND NOT EXISTS (
            SELECT 1 FROM public.booking_table_assignments AS remaining
            WHERE remaining.booking_id = p_booking_id
              AND remaining.merge_group_id = allocation.id
          )
        )
      )
    RETURNING allocation.*
  )
  INSERT INTO public.allocations_archive (
    id, booking_id, resource_type, resource_id, created_at, updated_at, shadow,
    restaurant_id, "window", created_by, is_maintenance, archived_at
  )
  SELECT
    released.id, released.booking_id, released.resource_type, released.resource_id,
    released.created_at, released.updated_at, released.shadow, released.restaurant_id,
    released."window", released.created_by, released.is_maintenance, timezone('utc', now())
  FROM released
  ON CONFLICT (id) DO NOTHING;

  IF v_remaining_count = 0 THEN
    UPDATE public.bookings AS booking
    SET assigned_zone_id = NULL,
        status = CASE WHEN booking.status = 'confirmed' THEN 'pending'::public.booking_status ELSE booking.status END,
        updated_at = now()
    WHERE booking.id = p_booking_id
      AND booking.restaurant_id = v_restaurant_id;
  END IF;

  FOREACH v_table_id IN ARRAY v_removed_table_ids LOOP
    PERFORM public.refresh_table_status(v_table_id);
  END LOOP;

  RETURN v_removed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_booking_table_assignments_and_reopen_if_empty(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_booking_table_assignments_and_reopen_if_empty(uuid, uuid[]) TO service_role;

-- Keep the existing second entry point on the same atomic release implementation.
-- Its NULL/empty-array convention means all tables; the canonical RPC stays explicit.
CREATE OR REPLACE FUNCTION public.unassign_tables_atomic(
  p_booking_id uuid,
  p_table_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(table_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_target_table_ids uuid[];
  v_requested_table_ids uuid[] := NULLIF(p_table_ids, ARRAY[]::uuid[]);
BEGIN
  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking id is required' USING ERRCODE = '22023';
  END IF;

  SELECT booking.restaurant_id INTO v_restaurant_id
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
  END IF;

  SELECT array_agg(DISTINCT assignment.table_id ORDER BY assignment.table_id)
  INTO v_target_table_ids
  FROM public.booking_table_assignments AS assignment
  JOIN public.table_inventory AS inventory ON inventory.id = assignment.table_id
  WHERE assignment.booking_id = p_booking_id
    AND inventory.restaurant_id = v_restaurant_id
    AND (v_requested_table_ids IS NULL OR assignment.table_id = ANY(v_requested_table_ids));

  PERFORM public.remove_booking_table_assignments_and_reopen_if_empty(
    p_booking_id, COALESCE(v_target_table_ids, ARRAY[]::uuid[])
  );

  RETURN QUERY SELECT unnest(COALESCE(v_target_table_ids, ARRAY[]::uuid[]));
END;
$$;

REVOKE ALL ON FUNCTION public.unassign_tables_atomic(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unassign_tables_atomic(uuid, uuid[]) TO service_role;
