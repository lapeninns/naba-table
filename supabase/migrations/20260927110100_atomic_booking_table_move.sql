-- Atomic booking table move (stream S3a).
--
-- move_booking_tables(p_booking_id, p_restaurant_id, p_from_table_ids, p_to_table_ids,
--                     p_idempotency_key, p_moved_by)
-- releases the "from" tables and assigns the "to" tables in ONE transaction:
--   * locks the booking, then the table_inventory rows of every table involved (id order);
--   * compare-and-set on assignments: every "from" table must still be assigned;
--   * the booking status is never changed (no confirmed -> pending -> confirmed round trip,
--     unlike unassign + assign), so nothing downstream sees a pending booking and no
--     confirmation side effect can be triggered;
--   * reuses assign_tables_atomic_v2 for the "to" tables and mirrors the release half of
--     remove_booking_table_assignments_and_reopen_if_empty without its status reopen;
--   * idempotent by (booking_id, idempotency_key): the claim is a primary-key INSERT made
--     while the booking row lock is held, so a replay returns the current state, and the same
--     key with a different from/to raises idempotency_key_reused (P0003).
--
-- Errors (MESSAGE is the machine code, DETAIL is JSON with safe fields only):
--   booking_not_found        P0002
--   booking_state_conflict   P0004  {"currentStatus", "reason": STATUS|ASSIGNMENTS_CHANGED|DATE_LOCKED}
--   tables_unavailable       P0001  {"reason": CONFLICT|HOLD|INACTIVE|NOT_FOUND, "tableIds": [...]}
--   table_selection_invalid  P0001  {"reason": CAPACITY|ZONE|NOT_MOVABLE|ADJACENCY|WINDOW}
--   idempotency_key_reused   P0003
--   invalid_move_request     22023
--
-- Depends on public.booking_table_unavailability from 20260927110000.
--
-- Rollback (manual, forward-only repo):
--   DROP FUNCTION public.move_booking_tables(uuid, uuid, uuid[], uuid[], text, uuid);
--   DROP TABLE public.booking_table_moves;   -- idempotency ledger only, no business data
BEGIN;

CREATE TABLE IF NOT EXISTS public.booking_table_moves (
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 200),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  from_table_ids uuid[] NOT NULL,
  to_table_ids uuid[] NOT NULL,
  moved_by uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (booking_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS booking_table_moves_restaurant_created_idx
  ON public.booking_table_moves (restaurant_id, created_at DESC);

ALTER TABLE public.booking_table_moves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_table_moves FROM anon, authenticated;
GRANT ALL ON TABLE public.booking_table_moves TO service_role;

DROP POLICY IF EXISTS "Service role has full access" ON public.booking_table_moves;
CREATE POLICY "Service role has full access" ON public.booking_table_moves
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.move_booking_tables(
  p_booking_id uuid,
  p_restaurant_id uuid,
  p_from_table_ids uuid[],
  p_to_table_ids uuid[],
  p_idempotency_key text,
  p_moved_by uuid DEFAULT NULL
)
RETURNS TABLE(
  replayed boolean,
  booking_status public.booking_status,
  booking_party_size integer,
  booking_updated_at timestamptz,
  booking_date date,
  assignments jsonb,
  table_count integer,
  total_capacity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_from uuid[];
  v_to uuid[];
  v_current uuid[];
  v_remove uuid[];
  v_add uuid[];
  v_result uuid[];
  v_remaining uuid[];
  v_claim_rows integer;
  v_existing public.booking_table_moves%ROWTYPE;
  v_replayed boolean := false;
  v_timezone text;
  v_start timestamptz;
  v_end timestamptz;
  v_window tstzrange;
  v_unavailable_reason text;
  v_unavailable_ids uuid[];
  v_removed_keys text[];
  v_touched_merge_ids uuid[];
  v_remaining_count integer;
  v_table_id uuid;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = ''
     OR char_length(p_idempotency_key) > 200 THEN
    RAISE EXCEPTION 'invalid_move_request' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT t ORDER BY t), ARRAY[]::uuid[])
  INTO v_from
  FROM unnest(p_from_table_ids) AS t
  WHERE t IS NOT NULL;

  SELECT COALESCE(array_agg(DISTINCT t ORDER BY t), ARRAY[]::uuid[])
  INTO v_to
  FROM unnest(p_to_table_ids) AS t
  WHERE t IS NOT NULL;

  IF cardinality(v_from) = 0 OR cardinality(v_to) = 0 THEN
    RAISE EXCEPTION 'invalid_move_request' USING ERRCODE = '22023';
  END IF;

  SELECT source.*
  INTO v_booking
  FROM public.bookings AS source
  WHERE source.id = p_booking_id
    AND source.restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency claim: primary key, taken under the booking row lock.
  INSERT INTO public.booking_table_moves (
    booking_id, idempotency_key, restaurant_id, from_table_ids, to_table_ids, moved_by
  ) VALUES (
    p_booking_id, p_idempotency_key, p_restaurant_id, v_from, v_to, p_moved_by
  )
  ON CONFLICT (booking_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_claim_rows = ROW_COUNT;

  IF v_claim_rows = 0 THEN
    SELECT moves.*
    INTO v_existing
    FROM public.booking_table_moves AS moves
    WHERE moves.booking_id = p_booking_id
      AND moves.idempotency_key = p_idempotency_key;

    IF v_existing.from_table_ids IS DISTINCT FROM v_from
       OR v_existing.to_table_ids IS DISTINCT FROM v_to THEN
      RAISE EXCEPTION 'idempotency_key_reused' USING ERRCODE = 'P0003';
    END IF;

    v_replayed := true;
  ELSE
    IF v_booking.status NOT IN (
      'pending', 'pending_allocation', 'confirmed', 'PRIORITY_WAITLIST', 'checked_in'
    ) THEN
      RAISE EXCEPTION 'booking_state_conflict'
        USING ERRCODE = 'P0004',
              DETAIL = jsonb_build_object(
                'currentStatus', v_booking.status, 'reason', 'STATUS'
              )::text;
    END IF;

    SELECT COALESCE(NULLIF(restaurant.timezone, ''), 'UTC')
    INTO v_timezone
    FROM public.restaurants AS restaurant
    WHERE restaurant.id = p_restaurant_id;

    IF v_booking.booking_date IS NULL
       OR v_booking.booking_date < (now() AT TIME ZONE COALESCE(v_timezone, 'UTC'))::date THEN
      RAISE EXCEPTION 'booking_state_conflict'
        USING ERRCODE = 'P0004',
              DETAIL = jsonb_build_object(
                'currentStatus', v_booking.status, 'reason', 'DATE_LOCKED'
              )::text;
    END IF;

    SELECT
      COALESCE(array_agg(assignment.table_id ORDER BY assignment.table_id), ARRAY[]::uuid[]),
      min(assignment.start_at),
      max(assignment.end_at)
    INTO v_current, v_start, v_end
    FROM public.booking_table_assignments AS assignment
    WHERE assignment.booking_id = p_booking_id;

    IF NOT (v_from <@ v_current) THEN
      RAISE EXCEPTION 'booking_state_conflict'
        USING ERRCODE = 'P0004',
              DETAIL = jsonb_build_object(
                'currentStatus', v_booking.status, 'reason', 'ASSIGNMENTS_CHANGED'
              )::text;
    END IF;

    SELECT COALESCE(array_agg(t ORDER BY t), ARRAY[]::uuid[]) INTO v_remove
    FROM unnest(v_from) AS t WHERE NOT (t = ANY (v_to));

    SELECT COALESCE(array_agg(t ORDER BY t), ARRAY[]::uuid[]) INTO v_add
    FROM unnest(v_to) AS t WHERE NOT (t = ANY (v_current));

    SELECT COALESCE(array_agg(t ORDER BY t), ARRAY[]::uuid[]) INTO v_remaining
    FROM unnest(v_current) AS t WHERE NOT (t = ANY (v_remove));

    SELECT COALESCE(array_agg(DISTINCT t ORDER BY t), ARRAY[]::uuid[]) INTO v_result
    FROM unnest(v_remaining || v_to) AS t;

    v_start := COALESCE(v_start, v_booking.start_at);
    v_end := COALESCE(v_end, v_booking.end_at);
    IF v_start IS NULL OR v_end IS NULL OR v_start >= v_end THEN
      RAISE EXCEPTION 'table_selection_invalid'
        USING ERRCODE = 'P0001',
              DETAIL = jsonb_build_object('reason', 'WINDOW')::text;
    END IF;
    v_window := tstzrange(v_start, v_end, '[)');

    -- Same lock order as assign_tables_atomic_v2 (table_inventory by id).
    PERFORM inventory.id
    FROM public.table_inventory AS inventory
    WHERE inventory.id = ANY (v_from || v_to)
    ORDER BY inventory.id
    FOR UPDATE;

    SELECT min(problem.reason), array_agg(problem.table_id ORDER BY problem.table_id)
    INTO v_unavailable_reason, v_unavailable_ids
    FROM public.booking_table_unavailability(
      p_booking_id, p_restaurant_id, v_add, v_window
    ) AS problem;

    IF v_unavailable_ids IS NOT NULL THEN
      RAISE EXCEPTION 'tables_unavailable'
        USING ERRCODE = 'P0001',
              DETAIL = jsonb_build_object(
                'reason', v_unavailable_reason, 'tableIds', to_jsonb(v_unavailable_ids)
              )::text;
    END IF;

    IF (
      SELECT count(DISTINCT inventory.zone_id)
      FROM public.table_inventory AS inventory
      WHERE inventory.id = ANY (v_result)
    ) <> 1 THEN
      RAISE EXCEPTION 'table_selection_invalid'
        USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('reason', 'ZONE')::text;
    END IF;

    IF cardinality(v_result) > 1 AND EXISTS (
      SELECT 1 FROM public.table_inventory AS inventory
      WHERE inventory.id = ANY (v_result)
        AND inventory.mobility <> 'movable'::public.table_mobility
    ) THEN
      RAISE EXCEPTION 'table_selection_invalid'
        USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('reason', 'NOT_MOVABLE')::text;
    END IF;

    IF cardinality(v_result) > 1 AND EXISTS (
      SELECT 1
      FROM unnest(v_result) AS member(table_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.table_adjacencies AS adjacency
        WHERE (adjacency.table_a = member.table_id AND adjacency.table_b = ANY (v_result)
               AND adjacency.table_b <> member.table_id)
           OR (adjacency.table_b = member.table_id AND adjacency.table_a = ANY (v_result)
               AND adjacency.table_a <> member.table_id)
      )
    ) THEN
      RAISE EXCEPTION 'table_selection_invalid'
        USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('reason', 'ADJACENCY')::text;
    END IF;

    IF (
      SELECT COALESCE(sum(inventory.capacity), 0)
      FROM public.table_inventory AS inventory
      WHERE inventory.id = ANY (v_result)
    ) < v_booking.party_size THEN
      RAISE EXCEPTION 'table_selection_invalid'
        USING ERRCODE = 'P0001', DETAIL = jsonb_build_object('reason', 'CAPACITY')::text;
    END IF;

    -- Release half (as remove_booking_table_assignments_and_reopen_if_empty, minus the reopen).
    IF cardinality(v_remove) > 0 THEN
      SELECT
        array_agg(DISTINCT assignment.idempotency_key)
          FILTER (WHERE assignment.idempotency_key IS NOT NULL),
        array_agg(DISTINCT assignment.merge_group_id)
          FILTER (WHERE assignment.merge_group_id IS NOT NULL)
      INTO v_removed_keys, v_touched_merge_ids
      FROM public.booking_table_assignments AS assignment
      WHERE assignment.booking_id = p_booking_id
        AND assignment.table_id = ANY (v_remove);

      DELETE FROM public.booking_table_assignments AS assignment
      WHERE assignment.booking_id = p_booking_id
        AND assignment.table_id = ANY (v_remove);

      SELECT count(*) INTO v_remaining_count
      FROM public.booking_table_assignments AS remaining
      WHERE remaining.booking_id = p_booking_id;

      DELETE FROM public.booking_assignment_idempotency AS ledger
      WHERE ledger.booking_id = p_booking_id
        AND (
          v_remaining_count = 0
          OR ledger.table_ids && v_remove
          OR ledger.idempotency_key = ANY (COALESCE(v_removed_keys, ARRAY[]::text[]))
          OR ledger.merge_group_allocation_id = ANY (COALESCE(v_touched_merge_ids, ARRAY[]::uuid[]))
        );

      WITH released AS (
        DELETE FROM public.allocations AS allocation
        WHERE allocation.booking_id = p_booking_id
          AND allocation.restaurant_id = p_restaurant_id
          AND (
            (allocation.resource_type = 'table' AND allocation.resource_id = ANY (v_remove))
            OR (
              allocation.resource_type = 'merge_group'
              AND allocation.id = ANY (COALESCE(v_touched_merge_ids, ARRAY[]::uuid[]))
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
        -- Allow the move into another zone; assign_tables_atomic_v2 sets it again below.
        UPDATE public.bookings AS booking
        SET assigned_zone_id = NULL
        WHERE booking.id = p_booking_id;
      END IF;
    END IF;

    -- Assign half.
    IF cardinality(v_add) > 0 THEN
      -- A stale ledger row for the same table set would collide on its partial unique index.
      DELETE FROM public.booking_assignment_idempotency AS ledger
      WHERE ledger.booking_id = p_booking_id
        AND ledger.table_set_hash = md5(array_to_string(v_add, ','));

      BEGIN
        PERFORM public.assign_tables_atomic_v2(
          p_booking_id,
          v_add,
          'move:' || p_idempotency_key,
          false,
          p_moved_by,
          v_start,
          v_end
        );
      EXCEPTION
        WHEN integrity_constraint_violation OR raise_exception THEN
          RAISE EXCEPTION 'tables_unavailable'
            USING ERRCODE = 'P0001',
                  DETAIL = jsonb_build_object(
                    'reason', 'CONFLICT', 'tableIds', to_jsonb(v_add)
                  )::text;
      END;
    END IF;

    FOREACH v_table_id IN ARRAY v_remove LOOP
      PERFORM public.refresh_table_status(v_table_id);
    END LOOP;

    UPDATE public.bookings AS booking
    SET updated_at = timezone('utc', now())
    WHERE booking.id = p_booking_id;
  END IF;

  RETURN QUERY
  SELECT
    v_replayed,
    booking.status,
    booking.party_size,
    booking.updated_at,
    booking.booking_date,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', assignment.id,
          'booking_id', assignment.booking_id,
          'table_id', assignment.table_id,
          'assigned_at', assignment.assigned_at,
          'assigned_by', assignment.assigned_by
        )
        ORDER BY assignment.table_id
      )
      FROM public.booking_table_assignments AS assignment
      WHERE assignment.booking_id = p_booking_id
    ), '[]'::jsonb),
    (
      SELECT count(*)::integer
      FROM public.booking_table_assignments AS assignment
      WHERE assignment.booking_id = p_booking_id
    ),
    (
      SELECT COALESCE(sum(inventory.capacity), 0)::integer
      FROM public.booking_table_assignments AS assignment
      JOIN public.table_inventory AS inventory ON inventory.id = assignment.table_id
      WHERE assignment.booking_id = p_booking_id
    )
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.move_booking_tables(uuid, uuid, uuid[], uuid[], text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_booking_tables(uuid, uuid, uuid[], uuid[], text, uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
