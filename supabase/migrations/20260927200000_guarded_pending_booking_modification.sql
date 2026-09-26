-- Booking modification, pending path: apply a change that found no table to a booking
-- that is still awaiting allocation, under a status compare-and-set.
--
-- server/bookings/modification-flow.ts reads the booking, then quotes tables for the
-- new window (up to the inline timeout). When no table fits and the booking it READ
-- was pending/pending_allocation, it used update_booking_and_clear_assignments, which
-- has no status check and never archives allocations. A booking confirmed onto a table
-- in the meantime (post-create auto-assign, or staff) ended 'confirmed' with no
-- assignment while its allocation still blocked the table at the old window.
--
-- This function, under the booking row lock:
--   1. refuses with P0004 when the booking is missing for this restaurant, is not
--      pending/pending_allocation, or no longer has the status the caller read;
--   2. applies the patch through update_booking_and_clear_assignments (the patch can
--      change neither status nor tenant), which also deletes assignments and the
--      assignment idempotency ledger;
--   3. archives the booking's allocations and deletes its holds;
--   4. refreshes the status of the tables it released.
-- The app maps P0004 to a 409 BOOKING_STATE_CONFLICT; nothing changed.
--
-- Rollout: apply to staging, then production (pnpm db:plan-remote first), BEFORE the
-- app change that calls it is merged (under Option A a merge deploys the web app).
-- Without it the app refuses pending-path modifications with 409
-- MODIFICATION_UNAVAILABLE instead of risking the unguarded write.
-- Rollback: DROP FUNCTION IF EXISTS public.modify_pending_booking_and_clear_assignments(uuid, uuid, jsonb, text);
-- and redeploy the previous server/bookings/modification-flow.ts. No schema or data changes.
BEGIN;

CREATE OR REPLACE FUNCTION public.modify_pending_booking_and_clear_assignments(
  p_booking_id uuid,
  p_restaurant_id uuid,
  p_patch jsonb,
  p_expected_status text
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_patch jsonb;
  v_released_table_ids uuid[];
  v_table_id uuid;
BEGIN
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'Modification patch must be a JSON object' USING ERRCODE = '22023';
  END IF;

  SELECT booking.* INTO v_booking
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id
    AND booking.restaurant_id = p_restaurant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found'
      USING ERRCODE = 'P0004',
            DETAIL = 'Booking not found for restaurant-scoped modification';
  END IF;

  IF v_booking.status::text NOT IN ('pending', 'pending_allocation')
     OR p_expected_status IS NULL
     OR v_booking.status::text <> p_expected_status THEN
    RAISE EXCEPTION 'booking_state_conflict'
      USING ERRCODE = 'P0004',
            DETAIL = format('Current status %s does not allow a pending-path modification', v_booking.status);
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

  v_patch := p_patch - 'status' - 'restaurant_id' - 'id';

  PERFORM public.update_booking_and_clear_assignments(p_booking_id, p_restaurant_id, v_patch);
  PERFORM public.archive_booking_allocations(p_booking_id, p_restaurant_id);

  DELETE FROM public.table_holds AS hold
  WHERE hold.booking_id = p_booking_id
    AND hold.restaurant_id = p_restaurant_id;

  FOR v_table_id IN
    SELECT inventory.id
    FROM public.table_inventory AS inventory
    WHERE inventory.restaurant_id = p_restaurant_id
      AND inventory.id = ANY(COALESCE(v_released_table_ids, ARRAY[]::uuid[]))
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

REVOKE ALL ON FUNCTION public.modify_pending_booking_and_clear_assignments(uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.modify_pending_booking_and_clear_assignments(uuid, uuid, jsonb, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
