-- Booking modification: move a booking to its new date/time/party size and to the
-- tables selected for it in ONE transaction.
--
-- Before this function, server/bookings/modification-flow.ts set the booking to
-- 'pending' and deleted its table assignments (update_booking_and_clear_assignments)
-- before it looked for new tables. A modification that found no table left a
-- confirmed booking pending with no table, and its old tables were already free for
-- other bookings.
--
-- The app now quotes tables for the NEW window first. The quote creates a live hold
-- bound to the booking (create_table_hold_atomic), which excludes the booking's own
-- current assignments from its conflict checks, so the old tables stay assigned while
-- the new ones are held. This function then, under the booking row lock:
--   1. checks the booking exists for this restaurant and still has the status the
--      caller read, and is modifiable (pending, pending_allocation or confirmed);
--      P0004 otherwise (non-retryable). P0002 is raised only for a missing hold;
--   2. checks the hold is live, belongs to this restaurant and is bound to this booking;
--   3. applies the patch through update_booking_and_clear_assignments (status keys
--      are ignored; the booking ends 'confirmed');
--   4. archives the old allocations, deletes the booking's other holds;
--   5. assigns the held tables and confirms through confirm_hold_assignment_tx;
--   6. refreshes the status of released tables.
-- Any failure rolls the whole modification back: the booking keeps its old
-- date/time/party size, status and tables. When no table fits, the app never calls
-- this function and fails the modification with a 409 instead.
--
-- Rollout order: apply 20260927160000 and 20260927160100 to staging, then
-- production (pnpm db:plan-remote first), BEFORE the app change that calls them is
-- merged: under Option A a merge deploys the web app. Without 20260927160100 the app
-- refuses table-changing modifications with a 409 MODIFICATION_UNAVAILABLE.
-- Rollback: DROP FUNCTION IF EXISTS public.modify_booking_with_table_swap(uuid, uuid, jsonb, uuid, text, text, boolean, text, jsonb);
-- and redeploy the previous server/bookings/modification-flow.ts. No schema or data changes.
BEGIN;

CREATE OR REPLACE FUNCTION public.modify_booking_with_table_swap(
  p_booking_id uuid,
  p_restaurant_id uuid,
  p_patch jsonb,
  p_hold_id uuid,
  p_expected_status text,
  p_idempotency_key text,
  p_require_adjacency boolean DEFAULT false,
  p_history_reason text DEFAULT 'modification_table_swap',
  p_history_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_hold public.table_holds%ROWTYPE;
  v_patch jsonb;
  v_released_table_ids uuid[];
  v_new_table_ids uuid[];
  v_table_id uuid;
BEGIN
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'Modification patch must be a JSON object' USING ERRCODE = '22023';
  END IF;

  -- Global lock order: booking, then hold, then inventory (as confirm_hold_assignment_tx).
  SELECT booking.* INTO v_booking
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id
    AND booking.restaurant_id = p_restaurant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    -- P0004, not P0002: P0002 is reserved for a vanished hold, which the app treats
    -- as retryable. A missing (or other-tenant) booking can never succeed on retry.
    RAISE EXCEPTION 'booking_not_found'
      USING ERRCODE = 'P0004',
            DETAIL = 'Booking not found for restaurant-scoped modification';
  END IF;

  IF v_booking.status::text NOT IN ('pending', 'pending_allocation', 'confirmed')
     OR (p_expected_status IS NOT NULL AND v_booking.status::text <> p_expected_status) THEN
    RAISE EXCEPTION 'booking_state_conflict'
      USING ERRCODE = 'P0004',
            DETAIL = format('Current status %s does not allow this modification', v_booking.status);
  END IF;

  SELECT hold.* INTO v_hold
  FROM public.table_holds AS hold
  WHERE hold.id = p_hold_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hold % not found', p_hold_id USING ERRCODE = 'P0002';
  END IF;
  IF v_hold.restaurant_id <> p_restaurant_id THEN
    RAISE EXCEPTION 'Hold and booking belong to different restaurants' USING ERRCODE = '42501';
  END IF;
  IF v_hold.booking_id IS DISTINCT FROM p_booking_id THEN
    RAISE EXCEPTION 'Modification hold is not bound to this booking' USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(DISTINCT affected.table_id ORDER BY affected.table_id)
  INTO v_released_table_ids
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

  -- The final status is decided below; never let the patch set it, or move the
  -- booking to another tenant.
  v_patch := p_patch - 'status' - 'restaurant_id' - 'id';

  PERFORM public.update_booking_and_clear_assignments(p_booking_id, p_restaurant_id, v_patch);
  PERFORM public.archive_booking_allocations(p_booking_id, p_restaurant_id);

  DELETE FROM public.table_holds AS hold
  WHERE hold.booking_id = p_booking_id
    AND hold.restaurant_id = p_restaurant_id
    AND hold.id <> p_hold_id;

  PERFORM public.confirm_hold_assignment_tx(
    p_hold_id,
    p_booking_id,
    p_idempotency_key,
    COALESCE(p_require_adjacency, false),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'confirmed'::public.booking_status,
    COALESCE(p_history_reason, 'modification_table_swap'),
    COALESCE(p_history_metadata, '{}'::jsonb),
    NULL
  );

  SELECT array_agg(assignment.table_id ORDER BY assignment.table_id)
  INTO v_new_table_ids
  FROM public.booking_table_assignments AS assignment
  WHERE assignment.booking_id = p_booking_id;

  FOR v_table_id IN
    SELECT inventory.id
    FROM public.table_inventory AS inventory
    WHERE inventory.restaurant_id = p_restaurant_id
      AND inventory.id = ANY(COALESCE(v_released_table_ids, ARRAY[]::uuid[]))
      AND NOT (inventory.id = ANY(COALESCE(v_new_table_ids, ARRAY[]::uuid[])))
    ORDER BY inventory.id
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.refresh_table_status(v_table_id);
  END LOOP;

  SELECT booking.* INTO v_booking
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id;

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.modify_booking_with_table_swap(uuid, uuid, jsonb, uuid, text, text, boolean, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.modify_booking_with_table_swap(uuid, uuid, jsonb, uuid, text, text, boolean, text, jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
