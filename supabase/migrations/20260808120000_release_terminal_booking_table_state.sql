-- allow: SIZE_OK — one transactional migration owns release, conflict filtering, and RPC wiring.
CREATE OR REPLACE FUNCTION public.archive_booking_allocations(
  p_booking_id uuid,
  p_restaurant_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_count integer := 0;
BEGIN
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
    allocation.id,
    allocation.booking_id,
    allocation.resource_type,
    allocation.resource_id,
    allocation.created_at,
    allocation.updated_at,
    allocation.shadow,
    allocation.restaurant_id,
    allocation."window",
    allocation.created_by,
    allocation.is_maintenance,
    timezone('utc', now())
  FROM public.allocations AS allocation
  WHERE allocation.booking_id = p_booking_id
    AND allocation.restaurant_id = p_restaurant_id
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  DELETE FROM public.allocations AS allocation
  WHERE allocation.booking_id = p_booking_id
    AND allocation.restaurant_id = p_restaurant_id;

  RETURN archived_count;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_booking_allocations(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_booking_allocations(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.archive_booking_allocations(uuid, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.archive_booking_allocations(uuid, uuid) FROM service_role;

CREATE OR REPLACE FUNCTION public.release_booking_table_state(
  p_booking_id uuid,
  p_restaurant_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_table_ids uuid[];
  removed_count integer := 0;
  target_table_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.bookings AS booking
    WHERE booking.id = p_booking_id
      AND booking.restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'Booking not found for restaurant-scoped table release'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT array_agg(DISTINCT table_id ORDER BY table_id)
  INTO affected_table_ids
  FROM (
    SELECT assignment.table_id
    FROM public.booking_table_assignments AS assignment
    WHERE assignment.booking_id = p_booking_id
    UNION
    SELECT allocation.resource_id
    FROM public.allocations AS allocation
    WHERE allocation.booking_id = p_booking_id
      AND allocation.restaurant_id = p_restaurant_id
      AND allocation.resource_type = 'table'
  ) AS affected;

  PERFORM public.archive_booking_allocations(p_booking_id, p_restaurant_id);

  DELETE FROM public.booking_table_assignments AS assignment
  WHERE assignment.booking_id = p_booking_id
    AND EXISTS (
      SELECT 1
      FROM public.bookings AS booking
      WHERE booking.id = assignment.booking_id
        AND booking.restaurant_id = p_restaurant_id
    );

  GET DIAGNOSTICS removed_count = ROW_COUNT;

  DELETE FROM public.booking_assignment_idempotency AS idempotency
  WHERE idempotency.booking_id = p_booking_id
    AND EXISTS (
      SELECT 1
      FROM public.bookings AS booking
      WHERE booking.id = idempotency.booking_id
        AND booking.restaurant_id = p_restaurant_id
    );

  UPDATE public.bookings AS booking
  SET assigned_zone_id = NULL
  WHERE booking.id = p_booking_id
    AND booking.restaurant_id = p_restaurant_id
    AND booking.assigned_zone_id IS NOT NULL;

  FOR target_table_id IN
    SELECT inventory.id
    FROM public.table_inventory AS inventory
    WHERE inventory.restaurant_id = p_restaurant_id
      AND inventory.id = ANY(COALESCE(affected_table_ids, ARRAY[]::uuid[]))
    ORDER BY inventory.id
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.refresh_table_status(target_table_id);
  END LOOP;

  RETURN removed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.release_booking_table_state(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_booking_table_state(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.release_booking_table_state(uuid, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.release_booking_table_state(uuid, uuid) FROM service_role;

CREATE OR REPLACE FUNCTION public.release_terminal_booking_table_state_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('cancelled', 'completed', 'no_show') THEN
    PERFORM public.release_booking_table_state(NEW.id, NEW.restaurant_id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.release_terminal_booking_table_state_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_terminal_booking_table_state_trigger() FROM anon;
REVOKE ALL ON FUNCTION public.release_terminal_booking_table_state_trigger() FROM authenticated;
REVOKE ALL ON FUNCTION public.release_terminal_booking_table_state_trigger() FROM service_role;

DROP TRIGGER IF EXISTS release_terminal_booking_table_state ON public.bookings;
CREATE TRIGGER release_terminal_booking_table_state
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.release_terminal_booking_table_state_trigger();

CREATE OR REPLACE FUNCTION public.release_nonblocking_table_conflicts(
  p_booking_id uuid,
  p_restaurant_id uuid,
  p_table_id uuid,
  p_slot_id uuid,
  p_window tstzrange
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_booking record;
  released_count integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.bookings AS booking
    WHERE booking.id = p_booking_id
      AND booking.restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'Assignment booking does not belong to the supplied restaurant'
      USING ERRCODE = '23503';
  END IF;

  FOR conflict_booking IN
    SELECT DISTINCT booking.id, booking.status
    FROM public.bookings AS booking
    WHERE booking.restaurant_id = p_restaurant_id
      AND booking.id <> p_booking_id
      AND booking.status IN ('cancelled', 'completed', 'no_show', 'checked_in')
      AND (
        EXISTS (
          SELECT 1
          FROM public.booking_table_assignments AS assignment
          WHERE assignment.booking_id = booking.id
            AND assignment.table_id = p_table_id
            AND (
              (p_slot_id IS NOT NULL AND assignment.slot_id = p_slot_id)
              OR (p_window IS NOT NULL AND assignment.assignment_window && p_window)
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.allocations AS allocation
          WHERE allocation.booking_id = booking.id
            AND allocation.restaurant_id = p_restaurant_id
            AND allocation.resource_type = 'table'
            AND allocation.resource_id = p_table_id
            AND (p_window IS NULL OR allocation."window" && p_window)
        )
      )
    ORDER BY booking.id
  LOOP
    IF conflict_booking.status = 'checked_in' THEN
      PERFORM public.archive_booking_allocations(conflict_booking.id, p_restaurant_id);

      UPDATE public.booking_table_assignments AS assignment
      SET
        slot_id = NULL,
        allocation_id = NULL,
        merge_group_id = NULL,
        updated_at = timezone('utc', now())
      WHERE assignment.booking_id = conflict_booking.id
        AND assignment.table_id = p_table_id;

      DELETE FROM public.booking_assignment_idempotency AS idempotency
      WHERE idempotency.booking_id = conflict_booking.id;
    ELSE
      PERFORM public.release_booking_table_state(conflict_booking.id, p_restaurant_id);
    END IF;

    released_count := released_count + 1;
  END LOOP;

  RETURN released_count;
END;
$$;

REVOKE ALL ON FUNCTION public.release_nonblocking_table_conflicts(uuid, uuid, uuid, uuid, tstzrange)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_nonblocking_table_conflicts(uuid, uuid, uuid, uuid, tstzrange)
  FROM anon;
REVOKE ALL ON FUNCTION public.release_nonblocking_table_conflicts(uuid, uuid, uuid, uuid, tstzrange)
  FROM authenticated;
REVOKE ALL ON FUNCTION public.release_nonblocking_table_conflicts(uuid, uuid, uuid, uuid, tstzrange)
  FROM service_role;

CREATE OR REPLACE FUNCTION public.release_nonblocking_before_assignment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_restaurant_id uuid;
BEGIN
  SELECT booking.restaurant_id
  INTO target_restaurant_id
  FROM public.bookings AS booking
  WHERE booking.id = NEW.booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment booking not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.release_nonblocking_table_conflicts(
    NEW.booking_id,
    target_restaurant_id,
    NEW.table_id,
    NEW.slot_id,
    CASE
      WHEN NEW.start_at IS NOT NULL AND NEW.end_at IS NOT NULL
      THEN tstzrange(NEW.start_at, NEW.end_at, '[)')
      ELSE NULL
    END
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.release_nonblocking_before_assignment_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_nonblocking_before_assignment_insert() FROM anon;
REVOKE ALL ON FUNCTION public.release_nonblocking_before_assignment_insert() FROM authenticated;
REVOKE ALL ON FUNCTION public.release_nonblocking_before_assignment_insert() FROM service_role;

DROP TRIGGER IF EXISTS release_nonblocking_before_assignment_insert
  ON public.booking_table_assignments;
CREATE TRIGGER release_nonblocking_before_assignment_insert
BEFORE INSERT ON public.booking_table_assignments
FOR EACH ROW
EXECUTE FUNCTION public.release_nonblocking_before_assignment_insert();

CREATE OR REPLACE FUNCTION public.release_nonblocking_before_allocation_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.booking_id IS NOT NULL AND NEW.resource_type = 'table' THEN
    PERFORM public.release_nonblocking_table_conflicts(
      NEW.booking_id,
      NEW.restaurant_id,
      NEW.resource_id,
      NULL,
      NEW."window"
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.release_nonblocking_before_allocation_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_nonblocking_before_allocation_insert() FROM anon;
REVOKE ALL ON FUNCTION public.release_nonblocking_before_allocation_insert() FROM authenticated;
REVOKE ALL ON FUNCTION public.release_nonblocking_before_allocation_insert() FROM service_role;

DROP TRIGGER IF EXISTS release_nonblocking_before_allocation_insert ON public.allocations;
CREATE TRIGGER release_nonblocking_before_allocation_insert
BEFORE INSERT ON public.allocations
FOR EACH ROW
EXECUTE FUNCTION public.release_nonblocking_before_allocation_insert();

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

REVOKE ALL ON FUNCTION public.cancel_booking_and_release_table_state(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_booking_and_release_table_state(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_booking_and_release_table_state(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_and_release_table_state(uuid, uuid) TO service_role;

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
RETURNS TABLE (
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
BEGIN
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
    p_history_metadata
  ) AS transition;

  SELECT booking.restaurant_id
  INTO target_restaurant_id
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found after state transition' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.release_booking_table_state(p_booking_id, target_restaurant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_booking_state_transition_and_clear_assignments(
  uuid,
  public.booking_status,
  timestamptz,
  timestamptz,
  timestamptz,
  public.booking_status,
  public.booking_status,
  uuid,
  timestamptz,
  text,
  jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_booking_state_transition_and_clear_assignments(
  uuid,
  public.booking_status,
  timestamptz,
  timestamptz,
  timestamptz,
  public.booking_status,
  public.booking_status,
  uuid,
  timestamptz,
  text,
  jsonb
) FROM anon;
REVOKE ALL ON FUNCTION public.apply_booking_state_transition_and_clear_assignments(
  uuid,
  public.booking_status,
  timestamptz,
  timestamptz,
  timestamptz,
  public.booking_status,
  public.booking_status,
  uuid,
  timestamptz,
  text,
  jsonb
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_booking_state_transition_and_clear_assignments(
  uuid,
  public.booking_status,
  timestamptz,
  timestamptz,
  timestamptz,
  public.booking_status,
  public.booking_status,
  uuid,
  timestamptz,
  text,
  jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.is_table_available_v2(
  p_table_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
SELECT NOT EXISTS (
  SELECT 1
  FROM public.booking_table_assignments AS assignment
  JOIN public.bookings AS booking ON booking.id = assignment.booking_id
  JOIN public.table_inventory AS inventory ON inventory.id = assignment.table_id
  WHERE assignment.table_id = p_table_id
    AND inventory.restaurant_id = booking.restaurant_id
    AND assignment.start_at IS NOT NULL
    AND assignment.end_at IS NOT NULL
    AND tstzrange(assignment.start_at, assignment.end_at, '[)')
      && tstzrange(p_start_at, p_end_at, '[)')
    AND (p_exclude_booking_id IS NULL OR booking.id <> p_exclude_booking_id)
    AND booking.status IN ('pending', 'pending_allocation', 'confirmed')
);
$$;

NOTIFY pgrst, 'reload schema';
