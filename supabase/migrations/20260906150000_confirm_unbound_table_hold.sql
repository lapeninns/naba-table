-- Confirming an unbound hold must consume that lease without bypassing other
-- bookings' holds. Preserve the existing RPC signature and privilege boundary.
BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_hold_assignment_tx(p_hold_id uuid, p_booking_id uuid, p_idempotency_key text, p_require_adjacency boolean DEFAULT false, p_assigned_by uuid DEFAULT NULL::uuid, p_window_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_window_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_expected_policy_version text DEFAULT NULL::text, p_expected_adjacency_hash text DEFAULT NULL::text, p_target_status booking_status DEFAULT NULL::booking_status, p_history_reason text DEFAULT 'auto_assign_confirm'::text, p_history_metadata jsonb DEFAULT '{}'::jsonb, p_history_changed_by uuid DEFAULT NULL::uuid)
 RETURNS TABLE(assignment_id uuid, table_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, merge_group_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hold public.table_holds%ROWTYPE;
  v_booking_restaurant_id uuid;
  v_now timestamptz := timezone('utc', now());
  v_table_ids uuid[];
  v_zone_id uuid;
  v_policy_version text;
  v_snapshot_hash text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_window tstzrange;
  v_rows integer;
  v_booking_status public.booking_status;
  v_payload_checksum text;
  v_dedupe_key text;
  v_table_list text;
  v_hold_payload jsonb;
BEGIN
  IF p_window_start IS NULL AND p_window_end IS NOT NULL THEN
    RAISE EXCEPTION 'confirm_hold_assignment_tx requires both start and end when providing custom window'
      USING ERRCODE = '22023';
  END IF;
  IF p_window_start IS NOT NULL AND p_window_end IS NULL THEN
    RAISE EXCEPTION 'confirm_hold_assignment_tx requires both start and end when providing custom window'
      USING ERRCODE = '22023';
  END IF;

  -- Global order: booking before hold, matching terminal cancellation.
  SELECT restaurant_id,status INTO v_booking_restaurant_id,v_booking_status
  FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE='P0002';
  END IF;

  IF v_booking_status IN ('cancelled','completed','no_show') THEN
    RAISE EXCEPTION 'Terminal booking cannot confirm a hold' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_hold
  FROM public.table_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hold % not found', p_hold_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_hold.restaurant_id <> v_booking_restaurant_id THEN
    RAISE EXCEPTION 'Hold and booking belong to different restaurants' USING ERRCODE='42501';
  END IF;
  IF v_hold.status <> 'active' THEN
    RAISE EXCEPTION 'Hold % is not active', p_hold_id USING ERRCODE='23514';
  END IF;

  IF v_hold.booking_id IS NOT NULL AND v_hold.booking_id <> p_booking_id THEN
    RAISE EXCEPTION 'Hold % belongs to booking % (expected %)', p_hold_id, v_hold.booking_id, p_booking_id
      USING ERRCODE = 'P0001';
  END IF;

  v_now := clock_timestamp();
  IF v_hold.expires_at <= v_now THEN
    RAISE EXCEPTION 'Hold % expired at %', p_hold_id, v_hold.expires_at
      USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(thm.table_id ORDER BY thm.table_id)
  INTO v_table_ids
  FROM public.table_hold_members thm
  WHERE thm.hold_id = p_hold_id;

  IF v_table_ids IS NULL OR array_length(v_table_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Hold % has no table members', p_hold_id
      USING ERRCODE = 'P0001';
  END IF;

  v_zone_id := v_hold.zone_id;
  v_policy_version := COALESCE((v_hold.metadata ->> 'policyVersion'), NULL);
  v_snapshot_hash := v_hold.metadata -> 'selection' -> 'snapshot' -> 'adjacency' ->> 'hash';

  IF p_expected_policy_version IS NOT NULL AND v_policy_version IS NOT NULL AND v_policy_version <> p_expected_policy_version THEN
    RAISE EXCEPTION 'Policy version changed (hold %, expected %, actual %)', p_hold_id, p_expected_policy_version, v_policy_version
      USING ERRCODE = 'P0003';
  END IF;

  IF p_expected_adjacency_hash IS NOT NULL AND v_snapshot_hash IS NOT NULL AND v_snapshot_hash <> p_expected_adjacency_hash THEN
    RAISE EXCEPTION 'Adjacency snapshot changed for hold %', p_hold_id
      USING ERRCODE = 'P0003';
  END IF;

  v_start_at := COALESCE(p_window_start, v_hold.start_at);
  v_end_at := COALESCE(p_window_end, v_hold.end_at);

  IF v_start_at IS NULL OR v_end_at IS NULL THEN
    RAISE EXCEPTION 'Hold % missing scheduling window', p_hold_id
      USING ERRCODE = '22000';
  END IF;

  IF v_start_at >= v_end_at THEN
    RAISE EXCEPTION 'Hold % has invalid window', p_hold_id
      USING ERRCODE = '22000';
  END IF;

  v_window := tstzrange(v_start_at, v_end_at, '[)');

  -- Hold ownership is immutable. Consume the selected lease only while its
  -- inventory rows are locked in the same order used by hold admission. Other
  -- hold/assignment writers cannot enter the released window before the new
  -- assignment commits. Any later failure restores the lease on rollback.
  PERFORM id FROM public.table_inventory
  WHERE id=ANY(v_table_ids) AND restaurant_id=v_hold.restaurant_id
  ORDER BY id FOR UPDATE;
  DELETE FROM public.table_holds WHERE id=p_hold_id;

  DROP TABLE IF EXISTS tmp_confirm_assignments_tx;
  CREATE TEMP TABLE tmp_confirm_assignments_tx ON COMMIT DROP AS
    SELECT *
    FROM public.assign_tables_atomic_v2(
      p_booking_id,
      v_table_ids,
      p_idempotency_key,
      p_require_adjacency,
      p_assigned_by,
      v_start_at,
      v_end_at
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 returned no assignments for booking %', p_booking_id
      USING ERRCODE = 'P0003';
  END IF;

  IF p_target_status IS NOT NULL THEN
    SELECT status INTO v_booking_status
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking % not found during transition', p_booking_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_booking_status <> p_target_status THEN
      PERFORM public.apply_booking_state_transition(
        p_booking_id,
        p_target_status,
        NULL,
        NULL,
        v_now,
        v_booking_status,
        p_target_status,
        p_history_changed_by,
        v_now,
        COALESCE(p_history_reason, 'auto_assign_confirm'),
        COALESCE(p_history_metadata, '{}'::jsonb)
      );
    END IF;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    v_payload_checksum := encode(
      digest(
        jsonb_build_object(
          'bookingId', p_booking_id,
          'tableIds', v_table_ids,
          'startAt', v_start_at,
          'endAt', v_end_at,
          'actorId', p_assigned_by,
          'holdId', p_hold_id
        )::text,
        'sha256'
      ),
      'hex'
    );

    UPDATE public.booking_assignment_idempotency
      SET payload_checksum = v_payload_checksum
    WHERE booking_id = p_booking_id
      AND idempotency_key = p_idempotency_key;
  END IF;

  v_table_list := array_to_string(v_table_ids, ',');
  v_dedupe_key := format('%s:%s:%s:%s', p_booking_id, to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), v_table_list);

  BEGIN
    INSERT INTO public.capacity_outbox (
      event_type,
      dedupe_key,
      restaurant_id,
      booking_id,
      idempotency_key,
      payload
    ) VALUES (
      'capacity.assignment.sync',
      v_dedupe_key,
      v_hold.restaurant_id,
      p_booking_id,
      p_idempotency_key,
      jsonb_build_object(
        'bookingId', p_booking_id,
        'restaurantId', v_hold.restaurant_id,
        'tableIds', v_table_ids,
        'startAt', to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'endAt', to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'mergeGroupId', (SELECT tmp.merge_group_id FROM tmp_confirm_assignments_tx tmp LIMIT 1),
        'idempotencyKey', p_idempotency_key
      )
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  BEGIN
    v_hold_payload := jsonb_build_object(
      'holdId', p_hold_id,
      'bookingId', p_booking_id,
      'restaurantId', v_hold.restaurant_id,
      'zoneId', v_zone_id,
      'tableIds', v_table_ids,
      'startAt', to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'endAt', to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'expiresAt', to_char(v_hold.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'actorId', p_assigned_by,
      'metadata', v_hold.metadata
    );

    INSERT INTO public.capacity_outbox (
      event_type,
      dedupe_key,
      restaurant_id,
      booking_id,
      idempotency_key,
      payload
    ) VALUES (
      'capacity.hold.confirmed',
      format('%s:%s:hold.confirmed', p_booking_id, p_hold_id),
      v_hold.restaurant_id,
      p_booking_id,
      p_idempotency_key,
      v_hold_payload
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    BEGIN
      INSERT INTO public.booking_confirmation_results (
        booking_id,
        hold_id,
        restaurant_id,
        idempotency_key,
        table_ids,
        assignment_window,
        actor_id,
        metadata
      ) VALUES (
        p_booking_id,
        p_hold_id,
        v_hold.restaurant_id,
        p_idempotency_key,
        v_table_ids,
        v_window,
        p_assigned_by,
        COALESCE(v_hold.metadata, '{}'::jsonb)
      )
      ON CONFLICT (booking_id, idempotency_key) DO UPDATE
        SET table_ids = EXCLUDED.table_ids,
            assignment_window = EXCLUDED.assignment_window,
            restaurant_id = EXCLUDED.restaurant_id,
            hold_id = EXCLUDED.hold_id,
            actor_id = EXCLUDED.actor_id,
            metadata = EXCLUDED.metadata,
            created_at = EXCLUDED.created_at;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_column THEN NULL;
    END;
  END IF;

  RETURN QUERY
    SELECT bta.id,
           tmp.table_id,
           tmp.start_at,
           tmp.end_at,
           tmp.merge_group_id
    FROM tmp_confirm_assignments_tx tmp
    JOIN public.booking_table_assignments bta
      ON bta.booking_id = p_booking_id
     AND bta.table_id = tmp.table_id;
END;
$function$
;

COMMIT;
