-- Ops booking lifecycle integrity (stream S3a).
--
-- 1. cancel_booking_and_release_table_state rejects bookings whose status forbids cancellation.
--    Cancellable: pending, pending_allocation, confirmed, PRIORITY_WAITLIST.
--    Already cancelled: unchanged idempotent no-op (cancelled = false).
--    checked_in, completed, no_show: RAISE 'booking_not_cancellable' (SQLSTATE P0004) with a
--    JSON DETAIL {"currentStatus": ...}. Rules: config/booking-state-machine.ts (checked_in,
--    completed and no_show have no cancelled target), the ops dialog (bookingDialogDomain.ts
--    canCancel) and docs/BUSINESS_LOGIC.md "Immutable Statuses". Signature unchanged.
-- 2. apply_booking_state_transition_and_clear_assignments records, before the release, which
--    tables the transition released: history metadata key "releasedTables"
--    {"tableIds": [...], "startAt": ..., "endAt": ...}. Signature unchanged.
-- 3. New undo_booking_no_show: one transaction that compare-and-sets no_show -> previous
--    status (through apply_booking_state_transition) and re-assigns the recorded released
--    tables when they are all still free (all-or-nothing, via assign_tables_atomic_v2).
--    It reports table_restoration: restored | not_needed | unavailable | unknown.
--
-- Rollback (manual, forward-only repo):
--   * cancel_booking_and_release_table_state: re-apply the body from
--     20260808120000_release_terminal_booking_table_state.sql:341-387 (same signature/grants).
--   * apply_booking_state_transition_and_clear_assignments: re-apply
--     20260808120000_release_terminal_booking_table_state.sql:389-446 (same signature/grants).
--   * DROP FUNCTION public.undo_booking_no_show(uuid, uuid, bigint, public.booking_status,
--       timestamptz, timestamptz, timestamptz, uuid, timestamptz, text, jsonb);
--   The "releasedTables" metadata already written stays in booking_state_history; it is inert.
BEGIN;

CREATE OR REPLACE FUNCTION public.cancel_booking_and_release_table_state(
  p_booking_id uuid,
  p_restaurant_id uuid
)
RETURNS TABLE(cancelled boolean, booking public.bookings)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_booking public.bookings%ROWTYPE;
  changed boolean;
BEGIN
  SELECT source.*
  INTO current_booking
  FROM public.bookings AS source
  WHERE source.id = p_booking_id
    AND source.restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found for restaurant-scoped cancellation'
      USING ERRCODE = 'P0002';
  END IF;

  IF current_booking.status IN ('checked_in', 'completed', 'no_show') THEN
    RAISE EXCEPTION 'booking_not_cancellable'
      USING ERRCODE = 'P0004',
            DETAIL = jsonb_build_object('currentStatus', current_booking.status)::text;
  END IF;

  changed := current_booking.status <> 'cancelled';

  IF changed THEN
    UPDATE public.bookings AS target
    SET status = 'cancelled', updated_at = timezone('utc', now())
    WHERE target.id = p_booking_id
      AND target.restaurant_id = p_restaurant_id
    RETURNING target.* INTO current_booking;
  END IF;

  PERFORM public.release_booking_table_state(p_booking_id, p_restaurant_id);

  cancelled := changed;
  booking := current_booking;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_booking_and_release_table_state(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_and_release_table_state(uuid, uuid)
  TO service_role;

-- Internal: the tables a booking holds right now, as {"tableIds", "startAt", "endAt"}.
CREATE OR REPLACE FUNCTION public.booking_table_state_snapshot(p_booking_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH held AS (
    SELECT assignment.table_id,
           assignment.start_at,
           assignment.end_at
    FROM public.booking_table_assignments AS assignment
    WHERE assignment.booking_id = p_booking_id
    UNION ALL
    SELECT allocation.resource_id,
           lower(allocation."window"),
           upper(allocation."window")
    FROM public.allocations AS allocation
    WHERE allocation.booking_id = p_booking_id
      AND allocation.resource_type = 'table'
  )
  SELECT jsonb_build_object(
    'tableIds', COALESCE(jsonb_agg(DISTINCT held.table_id), '[]'::jsonb),
    'startAt', min(held.start_at),
    'endAt', max(held.end_at)
  )
  FROM held;
$$;

REVOKE ALL ON FUNCTION public.booking_table_state_snapshot(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_booking_state_transition_and_clear_assignments(
  p_booking_id uuid,
  p_status public.booking_status,
  p_checked_in_at timestamptz,
  p_checked_out_at timestamptz,
  p_updated_at timestamptz,
  p_history_from public.booking_status,
  p_history_to public.booking_status,
  p_history_changed_by uuid,
  p_history_changed_at timestamptz,
  p_history_reason text,
  p_history_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  status public.booking_status,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_restaurant_id uuid;
  released_tables jsonb;
BEGIN
  -- Lock first so the snapshot is exactly what the transition releases.
  SELECT booking.restaurant_id
  INTO target_restaurant_id
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
  END IF;

  released_tables := public.booking_table_state_snapshot(p_booking_id);

  RETURN QUERY
  SELECT
    transition.status,
    transition.checked_in_at,
    transition.checked_out_at,
    transition.updated_at
  FROM public.apply_booking_state_transition(
    p_booking_id,
    p_status,
    p_checked_in_at,
    p_checked_out_at,
    p_updated_at,
    p_history_from,
    p_history_to,
    p_history_changed_by,
    p_history_changed_at,
    p_history_reason,
    COALESCE(p_history_metadata, '{}'::jsonb)
      || jsonb_build_object('releasedTables', released_tables)
  ) AS transition;

  PERFORM public.release_booking_table_state(p_booking_id, target_restaurant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_booking_state_transition_and_clear_assignments(
  uuid, public.booking_status, timestamptz, timestamptz, timestamptz,
  public.booking_status, public.booking_status, uuid, timestamptz, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_booking_state_transition_and_clear_assignments(
  uuid, public.booking_status, timestamptz, timestamptz, timestamptz,
  public.booking_status, public.booking_status, uuid, timestamptz, text, jsonb
) TO service_role;

-- Internal: which of p_table_ids are unavailable to p_booking_id during p_window.
-- A table is unavailable when it is outside the restaurant, inactive or out of service, or
-- overlaps another live booking's assignment/allocation, a maintenance allocation, or an
-- active hold for another booking. Callers must hold the table_inventory row locks.
CREATE OR REPLACE FUNCTION public.booking_table_unavailability(
  p_booking_id uuid,
  p_restaurant_id uuid,
  p_table_ids uuid[],
  p_window tstzrange
)
RETURNS TABLE(table_id uuid, reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH requested AS (
    SELECT DISTINCT requested.table_id
    FROM unnest(p_table_ids) AS requested(table_id)
  )
  SELECT requested.table_id,
         CASE
           WHEN inventory.id IS NULL THEN 'NOT_FOUND'
           WHEN inventory.active IS NOT TRUE
             OR inventory.status = 'out_of_service'
             OR EXISTS (
               SELECT 1 FROM public.zones AS zone
               WHERE zone.id = inventory.zone_id AND zone.active IS FALSE
             ) THEN 'INACTIVE'
           WHEN EXISTS (
             SELECT 1
             FROM public.table_holds AS hold
             JOIN public.table_hold_members AS member ON member.hold_id = hold.id
             WHERE member.table_id = requested.table_id
               AND hold.booking_id IS DISTINCT FROM p_booking_id
               AND hold.status = 'active'
               AND hold.expires_at > clock_timestamp()
               AND tstzrange(hold.start_at, hold.end_at, '[)') && p_window
           ) THEN 'HOLD'
           ELSE 'CONFLICT'
         END
  FROM requested
  LEFT JOIN public.table_inventory AS inventory
    ON inventory.id = requested.table_id
   AND inventory.restaurant_id = p_restaurant_id
  WHERE inventory.id IS NULL
     OR inventory.active IS NOT TRUE
     OR inventory.status = 'out_of_service'
     OR EXISTS (
       SELECT 1 FROM public.zones AS zone
       WHERE zone.id = inventory.zone_id AND zone.active IS FALSE
     )
     OR EXISTS (
       SELECT 1
       FROM public.table_holds AS hold
       JOIN public.table_hold_members AS member ON member.hold_id = hold.id
       WHERE member.table_id = requested.table_id
         AND hold.booking_id IS DISTINCT FROM p_booking_id
         AND hold.status = 'active'
         AND hold.expires_at > clock_timestamp()
         AND tstzrange(hold.start_at, hold.end_at, '[)') && p_window
     )
     OR EXISTS (
       SELECT 1
       FROM public.allocations AS allocation
       LEFT JOIN public.bookings AS other ON other.id = allocation.booking_id
       WHERE allocation.restaurant_id = p_restaurant_id
         AND allocation.resource_type = 'table'
         AND allocation.resource_id = requested.table_id
         AND allocation."window" && p_window
         AND (
           (allocation.booking_id IS NULL AND allocation.is_maintenance)
           OR (
             allocation.booking_id <> p_booking_id
             AND other.status NOT IN ('cancelled', 'completed', 'no_show')
           )
         )
     )
     OR EXISTS (
       SELECT 1
       FROM public.booking_table_assignments AS assignment
       JOIN public.bookings AS other ON other.id = assignment.booking_id
       WHERE assignment.table_id = requested.table_id
         AND assignment.booking_id <> p_booking_id
         AND other.restaurant_id = p_restaurant_id
         AND other.status NOT IN ('cancelled', 'completed', 'no_show')
         AND tstzrange(
               COALESCE(assignment.start_at, other.start_at),
               COALESCE(assignment.end_at, other.end_at),
               '[)'
             ) && p_window
     );
$$;

REVOKE ALL ON FUNCTION public.booking_table_unavailability(uuid, uuid, uuid[], tstzrange)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.undo_booking_no_show(
  p_booking_id uuid,
  p_restaurant_id uuid,
  p_source_history_id bigint,
  p_status public.booking_status,
  p_checked_in_at timestamptz,
  p_checked_out_at timestamptz,
  p_updated_at timestamptz,
  p_history_changed_by uuid,
  p_history_changed_at timestamptz,
  p_history_reason text,
  p_history_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  status public.booking_status,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  updated_at timestamptz,
  table_restoration text,
  released_table_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_source_metadata jsonb;
  v_released jsonb;
  v_table_ids uuid[];
  v_start timestamptz;
  v_end timestamptz;
  v_window tstzrange;
  v_restoration text;
  v_transition record;
  v_history_id bigint;
BEGIN
  SELECT source.*
  INTO v_booking
  FROM public.bookings AS source
  WHERE source.id = p_booking_id
    AND source.restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
  END IF;

  SELECT history.metadata
  INTO v_source_metadata
  FROM public.booking_state_history AS history
  WHERE history.id = p_source_history_id
    AND history.booking_id = p_booking_id
    AND history.to_status = 'no_show';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_show_history_missing' USING ERRCODE = 'P0002';
  END IF;

  -- Compare-and-set no_show -> target (raises booking_state_conflict / P0004 on mismatch).
  SELECT transition.*
  INTO v_transition
  FROM public.apply_booking_state_transition(
    p_booking_id,
    p_status,
    p_checked_in_at,
    p_checked_out_at,
    p_updated_at,
    'no_show',
    p_status,
    p_history_changed_by,
    p_history_changed_at,
    p_history_reason,
    COALESCE(p_history_metadata, '{}'::jsonb)
  ) AS transition;

  v_released := v_source_metadata -> 'releasedTables';

  IF v_released IS NULL OR jsonb_typeof(v_released -> 'tableIds') IS DISTINCT FROM 'array' THEN
    v_restoration := 'unknown';
    v_table_ids := ARRAY[]::uuid[];
  ELSE
    SELECT COALESCE(array_agg(value::uuid ORDER BY value::uuid), ARRAY[]::uuid[])
    INTO v_table_ids
    FROM jsonb_array_elements_text(v_released -> 'tableIds') AS value;

    IF cardinality(v_table_ids) = 0 THEN
      v_restoration := 'not_needed';
    ELSE
      v_start := COALESCE((v_released ->> 'startAt')::timestamptz, v_booking.start_at);
      v_end := COALESCE((v_released ->> 'endAt')::timestamptz, v_booking.end_at);

      IF v_start IS NULL OR v_end IS NULL OR v_start >= v_end THEN
        v_restoration := 'unavailable';
      ELSE
        v_window := tstzrange(v_start, v_end, '[)');

        PERFORM inventory.id
        FROM public.table_inventory AS inventory
        WHERE inventory.id = ANY (v_table_ids)
        ORDER BY inventory.id
        FOR UPDATE;

        IF EXISTS (
          SELECT 1
          FROM public.booking_table_unavailability(
            p_booking_id, p_restaurant_id, v_table_ids, v_window
          )
        ) THEN
          v_restoration := 'unavailable';
        ELSE
          BEGIN
            PERFORM public.assign_tables_atomic_v2(
              p_booking_id,
              v_table_ids,
              'undo-no-show:' || p_source_history_id::text,
              false,
              p_history_changed_by,
              v_start,
              v_end
            );
            v_restoration := 'restored';
          EXCEPTION
            WHEN integrity_constraint_violation
              OR raise_exception
              OR no_data_found
              OR data_exception
              OR SQLSTATE 'P0003' THEN
              -- The subtransaction rolls back every partial row; the status change stands.
              v_restoration := 'unavailable';
          END;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Record the outcome on the history row this call inserted.
  SELECT history.id
  INTO v_history_id
  FROM public.booking_state_history AS history
  WHERE history.booking_id = p_booking_id
    AND history.from_status = 'no_show'
    AND history.to_status = p_status
    AND history.changed_at = p_history_changed_at
  ORDER BY history.id DESC
  LIMIT 1;

  IF v_history_id IS NOT NULL THEN
    UPDATE public.booking_state_history AS history
    SET metadata = history.metadata || jsonb_build_object(
      'tableRestoration', v_restoration,
      'restoredTableIds', CASE WHEN v_restoration = 'restored' THEN to_jsonb(v_table_ids) ELSE '[]'::jsonb END
    )
    WHERE history.id = v_history_id;
  END IF;

  RETURN QUERY
  SELECT
    v_transition.status,
    v_transition.checked_in_at,
    v_transition.checked_out_at,
    booking.updated_at,
    v_restoration,
    v_table_ids
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.undo_booking_no_show(
  uuid, uuid, bigint, public.booking_status, timestamptz, timestamptz, timestamptz,
  uuid, timestamptz, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_booking_no_show(
  uuid, uuid, bigint, public.booking_status, timestamptz, timestamptz, timestamptz,
  uuid, timestamptz, text, jsonb
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
