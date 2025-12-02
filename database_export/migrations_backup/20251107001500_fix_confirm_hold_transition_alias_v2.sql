-- Recreate confirm_hold_assignment_with_transition with proper aliasing (no redundant column definition list)

BEGIN;
DROP FUNCTION IF EXISTS public.confirm_hold_assignment_with_transition(
  uuid,
  uuid[],
  text,
  boolean,
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  public.booking_status,
  uuid,
  text,
  jsonb
);
CREATE FUNCTION public.confirm_hold_assignment_with_transition(
  p_booking_id uuid,
  p_table_ids uuid[],
  p_idempotency_key text,
  p_require_adjacency boolean DEFAULT false,
  p_assigned_by uuid DEFAULT NULL::uuid,
  p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_target_status public.booking_status DEFAULT 'confirmed'::public.booking_status,
  p_history_changed_by uuid DEFAULT NULL::uuid,
  p_history_reason text DEFAULT 'auto_assign_atomic_confirm'::text,
  p_history_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(table_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, merge_group_id uuid)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_history_from public.booking_status;
  v_now timestamptz := timezone('utc', now());
  v_transition_needed boolean := true;
BEGIN
  SELECT status INTO v_history_from
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id
      USING ERRCODE = 'P0002';
  END IF;

  DROP TABLE IF EXISTS tmp_confirm_assignments;
  CREATE TEMP TABLE tmp_confirm_assignments ON COMMIT DROP AS
    SELECT ata.table_id, ata.start_at, ata.end_at, ata.merge_group_id
    FROM public.assign_tables_atomic_v2(
      p_booking_id,
      p_table_ids,
      p_idempotency_key,
      p_require_adjacency,
      p_assigned_by,
      p_start_at,
      p_end_at
    ) AS ata;

  IF NOT EXISTS (SELECT 1 FROM tmp_confirm_assignments) THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 returned no assignments for booking %', p_booking_id
      USING ERRCODE = 'P0003';
  END IF;

  IF v_history_from = p_target_status THEN
    v_transition_needed := false;
  END IF;

  IF v_transition_needed THEN
    PERFORM public.apply_booking_state_transition(
      p_booking_id,
      p_target_status,
      NULL,
      NULL,
      v_now,
      v_history_from,
      p_target_status,
      p_history_changed_by,
      v_now,
      COALESCE(p_history_reason, 'auto_assign_atomic_confirm'),
      COALESCE(p_history_metadata, '{}'::jsonb)
    );
  END IF;

  RETURN QUERY
    SELECT t.table_id, t.start_at, t.end_at, t.merge_group_id
    FROM tmp_confirm_assignments AS t;
END;
$$;
GRANT ALL ON FUNCTION public.confirm_hold_assignment_with_transition(
  uuid,
  uuid[],
  text,
  boolean,
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  public.booking_status,
  uuid,
  text,
  jsonb
) TO service_role;
COMMIT;
