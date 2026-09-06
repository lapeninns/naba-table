-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
BEGIN;

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  v_customer_id constant uuid := '00000000-0000-4000-8000-00000000c001';
  v_other_customer_id constant uuid := '00000000-0000-4000-8000-00000000c011';
  v_booking_id constant uuid := '00000000-0000-4000-8000-00000000b111';
  v_other_booking_id constant uuid := '00000000-0000-4000-8000-00000000b112';
  v_table_id constant uuid := '00000000-0000-4000-8000-00000000e001';
  v_second_table_id constant uuid := '00000000-0000-4000-8000-00000000e011';
  v_third_table_id constant uuid := '00000000-0000-4000-8000-00000000e012';
  v_other_table_id constant uuid := '00000000-0000-4000-8000-00000000e021';
  v_zone_id constant uuid := '00000000-0000-4000-8000-00000000d001';
  v_other_zone_id constant uuid := '00000000-0000-4000-8000-00000000d011';
  v_group_id uuid;
  v_removed integer;
  v_returned_ids uuid[];
  v_replay_count integer;
  v_other_before jsonb;
  v_other_after jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.table_inventory WHERE id = v_table_id AND restaurant_id = v_restaurant_id) THEN
    RAISE EXCEPTION 'synthetic table fixture is missing' USING ERRCODE = 'NB001';
  END IF;

  INSERT INTO public.customers (id, restaurant_id, full_name, email)
  VALUES (v_other_customer_id, v_other_restaurant_id, 'Synthetic fixture', 'manual-other@test.invalid');
  INSERT INTO public.zones (id, restaurant_id, name)
  VALUES (v_other_zone_id, v_other_restaurant_id, 'Synthetic other zone');
  INSERT INTO public.allowed_capacities (restaurant_id, capacity) VALUES (v_other_restaurant_id, 4);
  INSERT INTO public.table_inventory (id, restaurant_id, table_number, capacity, zone_id, category, mobility)
  VALUES
    (v_second_table_id, v_restaurant_id, 'SYN-MANUAL-2', 4, v_zone_id, 'dining', 'movable'),
    (v_third_table_id, v_restaurant_id, 'SYN-MANUAL-3', 4, v_zone_id, 'dining', 'movable'),
    (v_other_table_id, v_other_restaurant_id, 'SYN-MANUAL-OTHER', 4, v_other_zone_id, 'dining', 'movable');

  INSERT INTO public.bookings (
    id, restaurant_id, customer_id, booking_date, start_time, end_time, start_at, end_at,
    party_size, status, customer_name, customer_email, customer_phone, reference
  ) VALUES
    (v_booking_id, v_restaurant_id, v_customer_id, DATE '2099-09-06', TIME '19:00', TIME '20:30',
     TIMESTAMPTZ '2099-09-06 19:00:00+00', TIMESTAMPTZ '2099-09-06 20:30:00+00',
     2, 'confirmed', 'Synthetic fixture', 'manual-release@test.invalid', '+447000000021', 'REG-MANUAL-RELEASE'),
    (v_other_booking_id, v_other_restaurant_id, v_other_customer_id, DATE '2099-09-06', TIME '19:00', TIME '20:30',
     TIMESTAMPTZ '2099-09-06 19:00:00+00', TIMESTAMPTZ '2099-09-06 20:30:00+00',
     2, 'confirmed', 'Synthetic fixture', 'manual-other@test.invalid', '+447000000022', 'REG-MANUAL-OTHER');

  PERFORM public.assign_tables_atomic_v2(v_booking_id, ARRAY[v_table_id, v_second_table_id, v_third_table_id],
    'manual-initial', false, NULL, TIMESTAMPTZ '2099-09-06 19:00:00+00', TIMESTAMPTZ '2099-09-06 20:30:00+00');
  PERFORM public.assign_tables_atomic_v2(v_other_booking_id, ARRAY[v_other_table_id],
    'manual-other', false, NULL, TIMESTAMPTZ '2099-09-06 19:00:00+00', TIMESTAMPTZ '2099-09-06 20:30:00+00');

  SELECT merge_group_allocation_id INTO v_group_id FROM public.booking_assignment_idempotency
  WHERE booking_id = v_booking_id AND idempotency_key = 'manual-initial';
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'initial merged assignment was not exercised' USING ERRCODE = 'NB001';
  END IF;
  SELECT jsonb_build_object(
    'booking', (SELECT to_jsonb(b) FROM public.bookings b WHERE b.id = v_other_booking_id),
    'assignments', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.booking_table_assignments a WHERE a.booking_id = v_other_booking_id),
    'allocations', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.allocations a WHERE a.booking_id = v_other_booking_id),
    'ledger', (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.idempotency_key) FROM public.booking_assignment_idempotency l WHERE l.booking_id = v_other_booking_id)
  ) INTO v_other_before;

  -- Wrong-tenant, empty and NULL selectors are no-ops in the explicit-table RPC.
  v_removed := public.remove_booking_table_assignments_and_reopen_if_empty(v_booking_id, ARRAY[v_other_table_id]);
  IF v_removed <> 0
     OR public.remove_booking_table_assignments_and_reopen_if_empty(v_booking_id, ARRAY[]::uuid[]) <> 0
     OR public.remove_booking_table_assignments_and_reopen_if_empty(v_booking_id, NULL) <> 0
     OR NOT EXISTS (SELECT 1 FROM public.booking_assignment_idempotency WHERE booking_id = v_booking_id AND idempotency_key = 'manual-initial') THEN
    RAISE EXCEPTION 'zero-removal call invalidated a live assignment' USING ERRCODE = 'NB001';
  END IF;

  -- Partial release: one member removed, two survivors retain the same group and zone.
  v_removed := public.remove_booking_table_assignments_and_reopen_if_empty(v_booking_id, ARRAY[v_table_id, v_table_id, v_other_table_id]);
  IF v_removed <> 1
     OR (SELECT count(*) FROM public.booking_table_assignments WHERE booking_id = v_booking_id) <> 2
     OR (SELECT count(*) FROM public.booking_table_assignments WHERE booking_id = v_booking_id AND merge_group_id = v_group_id) <> 2
     OR NOT EXISTS (SELECT 1 FROM public.allocations WHERE id = v_group_id AND booking_id = v_booking_id)
     OR EXISTS (SELECT 1 FROM public.allocations WHERE booking_id = v_booking_id AND resource_type = 'table' AND resource_id = v_table_id)
     OR NOT EXISTS (SELECT 1 FROM public.allocations_archive WHERE booking_id = v_booking_id AND resource_type = 'table' AND resource_id = v_table_id)
     OR EXISTS (SELECT 1 FROM public.booking_assignment_idempotency WHERE booking_id = v_booking_id AND idempotency_key = 'manual-initial')
     OR NOT EXISTS (SELECT 1 FROM public.bookings WHERE id = v_booking_id AND status = 'confirmed' AND assigned_zone_id = v_zone_id) THEN
    RAISE EXCEPTION 'partial release corrupted surviving assignment or retained released state' USING ERRCODE = 'NB001';
  END IF;

  -- Fresh-key reassignment is the original live regression. Repeat that key once as well.
  PERFORM public.assign_tables_atomic_v2(v_booking_id, ARRAY[v_table_id], 'manual-reassigned', false, NULL,
    TIMESTAMPTZ '2099-09-06 19:00:00+00', TIMESTAMPTZ '2099-09-06 20:30:00+00');
  SELECT count(*) INTO v_replay_count
  FROM public.assign_tables_atomic_v2(v_booking_id, ARRAY[v_table_id], 'manual-reassigned', false, NULL,
    TIMESTAMPTZ '2099-09-06 19:00:00+00', TIMESTAMPTZ '2099-09-06 20:30:00+00');
  IF v_replay_count <> 1
     OR (SELECT count(*) FROM public.booking_table_assignments WHERE booking_id = v_booking_id AND table_id = v_table_id) <> 1 THEN
    RAISE EXCEPTION 'reassignment replay did not preserve one assignment' USING ERRCODE = 'NB001';
  END IF;

  -- A one-member surviving merge group must also remain intact.
  v_removed := public.remove_booking_table_assignments_and_reopen_if_empty(v_booking_id, ARRAY[v_second_table_id]);
  IF v_removed <> 1
     OR NOT EXISTS (SELECT 1 FROM public.booking_table_assignments WHERE booking_id = v_booking_id AND table_id = v_third_table_id AND merge_group_id = v_group_id)
     OR NOT EXISTS (SELECT 1 FROM public.allocations WHERE id = v_group_id AND booking_id = v_booking_id)
     OR NOT EXISTS (SELECT 1 FROM public.booking_assignment_idempotency WHERE booking_id = v_booking_id AND idempotency_key = 'manual-reassigned') THEN
    RAISE EXCEPTION 'partial release removed a surviving group or disjoint idempotency entry' USING ERRCODE = 'NB001';
  END IF;

  v_removed := public.remove_booking_table_assignments_and_reopen_if_empty(v_booking_id, ARRAY[v_third_table_id]);
  IF v_removed <> 1
     OR EXISTS (SELECT 1 FROM public.allocations WHERE id = v_group_id)
     OR NOT EXISTS (SELECT 1 FROM public.allocations_archive WHERE id = v_group_id AND booking_id = v_booking_id)
     OR NOT EXISTS (SELECT 1 FROM public.booking_assignment_idempotency WHERE booking_id = v_booking_id AND idempotency_key = 'manual-reassigned') THEN
    RAISE EXCEPTION 'orphaned merge allocation was retained or disjoint ledger was removed' USING ERRCODE = 'NB001';
  END IF;

  v_removed := public.remove_booking_table_assignments_and_reopen_if_empty(v_booking_id, ARRAY[v_table_id]);
  IF v_removed <> 1
     OR EXISTS (SELECT 1 FROM public.booking_table_assignments WHERE booking_id = v_booking_id)
     OR EXISTS (SELECT 1 FROM public.allocations WHERE booking_id = v_booking_id)
     OR EXISTS (SELECT 1 FROM public.booking_assignment_idempotency WHERE booking_id = v_booking_id)
     OR NOT EXISTS (SELECT 1 FROM public.bookings WHERE id = v_booking_id AND status = 'pending' AND assigned_zone_id IS NULL) THEN
    RAISE EXCEPTION 'final release retained allocation state or failed to reopen the booking' USING ERRCODE = 'NB001';
  END IF;

  -- Exactly the original table set can now be allocated with a new key (the unique hash).
  PERFORM public.assign_tables_atomic_v2(v_booking_id, ARRAY[v_table_id, v_second_table_id, v_third_table_id],
    'manual-fresh-original-set', false, NULL, TIMESTAMPTZ '2099-09-06 19:00:00+00', TIMESTAMPTZ '2099-09-06 20:30:00+00');
  IF (SELECT count(*) FROM public.booking_table_assignments WHERE booking_id = v_booking_id) <> 3 THEN
    RAISE EXCEPTION 'fresh-key original-set reassignment did not persist all tables' USING ERRCODE = 'NB001';
  END IF;
  UPDATE public.bookings SET status = 'confirmed' WHERE id = v_booking_id AND restaurant_id = v_restaurant_id;

  -- The legacy entry point returns actual removed IDs and keeps its all-table convention.
  SELECT array_agg(removed.table_id ORDER BY removed.table_id) INTO v_returned_ids
  FROM public.unassign_tables_atomic(v_booking_id, ARRAY[v_table_id, v_table_id]) AS removed;
  IF v_returned_ids IS DISTINCT FROM ARRAY[v_table_id]
     OR (SELECT count(*) FROM public.booking_table_assignments WHERE booking_id = v_booking_id) <> 2 THEN
    RAISE EXCEPTION 'legacy partial unassignment returned incorrect IDs' USING ERRCODE = 'NB001';
  END IF;
  SELECT array_agg(removed.table_id ORDER BY removed.table_id) INTO v_returned_ids
  FROM public.unassign_tables_atomic(v_booking_id, NULL) AS removed;
  IF v_returned_ids IS DISTINCT FROM ARRAY[v_second_table_id, v_third_table_id]
     OR EXISTS (SELECT 1 FROM public.allocations WHERE booking_id = v_booking_id)
     OR EXISTS (SELECT 1 FROM public.booking_assignment_idempotency WHERE booking_id = v_booking_id) THEN
    RAISE EXCEPTION 'legacy NULL-selector unassignment left state behind' USING ERRCODE = 'NB001';
  END IF;
  PERFORM public.assign_tables_atomic_v2(v_booking_id, ARRAY[v_table_id], 'manual-empty-wrapper', false, NULL,
    TIMESTAMPTZ '2099-09-06 19:00:00+00', TIMESTAMPTZ '2099-09-06 20:30:00+00');
  SELECT array_agg(removed.table_id ORDER BY removed.table_id) INTO v_returned_ids
  FROM public.unassign_tables_atomic(v_booking_id, ARRAY[]::uuid[]) AS removed;
  IF v_returned_ids IS DISTINCT FROM ARRAY[v_table_id]
     OR EXISTS (SELECT 1 FROM public.allocations WHERE booking_id = v_booking_id)
     OR EXISTS (SELECT 1 FROM public.booking_assignment_idempotency WHERE booking_id = v_booking_id) THEN
    RAISE EXCEPTION 'legacy empty-selector unassignment left state behind' USING ERRCODE = 'NB001';
  END IF;

  SELECT jsonb_build_object(
    'booking', (SELECT to_jsonb(b) FROM public.bookings b WHERE b.id = v_other_booking_id),
    'assignments', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.booking_table_assignments a WHERE a.booking_id = v_other_booking_id),
    'allocations', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.allocations a WHERE a.booking_id = v_other_booking_id),
    'ledger', (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.idempotency_key) FROM public.booking_assignment_idempotency l WHERE l.booking_id = v_other_booking_id)
  ) INTO v_other_after;
  IF v_other_before IS DISTINCT FROM v_other_after THEN
    RAISE EXCEPTION 'manual unassignment changed another tenant booking' USING ERRCODE = 'NB001';
  END IF;

  IF has_function_privilege('anon', 'public.remove_booking_table_assignments_and_reopen_if_empty(uuid,uuid[])', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.remove_booking_table_assignments_and_reopen_if_empty(uuid,uuid[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.unassign_tables_atomic(uuid,uuid[])', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.unassign_tables_atomic(uuid,uuid[])', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.remove_booking_table_assignments_and_reopen_if_empty(uuid,uuid[])', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.unassign_tables_atomic(uuid,uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'manual unassignment RPC privileges changed unexpectedly' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'manual table unassignment regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'manual table unassignment regression FAILED';
    RAISE;
END;
$regression$;

ROLLBACK;
