-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
BEGIN;

DO $regression$
DECLARE
  -- Restaurant B has no zones, tables or bookings in the fixtures: a fresh onboarding tenant.
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  -- Restaurant A has bookings in the fixtures.
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_zones jsonb := '[{"name":"Main Dining","sort_order":0},{"name":"Terrace","sort_order":1}]';
  v_tables jsonb := '[
    {"table_number":"T1","capacity":2,"zone_name":"Main Dining"},
    {"table_number":"T2","capacity":4,"zone_name":"terrace"},
    {"table_number":"T3","capacity":6}
  ]';
  v_first jsonb;
  v_second jsonb;
  v_third jsonb;
  v_count integer;
  v_t1_id uuid;
  v_main_zone uuid;
  v_updated_before timestamptz;
  v_updated_after timestamptz;
  v_other_before jsonb;
  v_other_after jsonb;
  v_raised boolean;
  v_snapshot jsonb;
  v_revision text;
BEGIN
  SELECT jsonb_build_object(
    'zones', (SELECT count(*) FROM public.zones WHERE restaurant_id = v_restaurant_id),
    'tables', (SELECT count(*) FROM public.table_inventory WHERE restaurant_id = v_restaurant_id)
  ) INTO v_other_before;

  -- 1. First replace creates zones, tables and allowed capacities.
  v_first := public.onboarding_replace_layout(v_other_restaurant_id, v_zones, v_tables, NULL);
  IF v_first->>'revision' IS NULL
     OR v_first->>'revision' <> public.onboarding_layout_revision(v_other_restaurant_id) THEN
    RAISE EXCEPTION 'replace did not return the current revision: %', v_first->>'revision' USING ERRCODE = 'NB001';
  END IF;
  v_snapshot := public.onboarding_layout_snapshot(v_other_restaurant_id);
  IF v_snapshot->>'revision' <> v_first->>'revision'
     OR jsonb_array_length(v_snapshot->'zones') <> 2 OR jsonb_array_length(v_snapshot->'tables') <> 3 THEN
    RAISE EXCEPTION 'snapshot disagrees with the replace result: %', v_snapshot USING ERRCODE = 'NB001';
  END IF;

  IF jsonb_array_length(v_first->'zones') <> 2 OR jsonb_array_length(v_first->'tables') <> 3 THEN
    RAISE EXCEPTION 'first replace returned % zones / % tables',
      jsonb_array_length(v_first->'zones'), jsonb_array_length(v_first->'tables') USING ERRCODE = 'NB001';
  END IF;

  SELECT id INTO v_main_zone FROM public.zones WHERE restaurant_id = v_other_restaurant_id AND name = 'Main Dining';
  IF (SELECT zone_id FROM public.table_inventory WHERE restaurant_id = v_other_restaurant_id AND table_number = 'T3')
     IS DISTINCT FROM v_main_zone THEN
    RAISE EXCEPTION 'table without zone_name was not placed in the first zone' USING ERRCODE = 'NB001';
  END IF;
  IF (SELECT lower(z.name) FROM public.table_inventory t JOIN public.zones z ON z.id = t.zone_id
      WHERE t.restaurant_id = v_other_restaurant_id AND t.table_number = 'T2') <> 'terrace' THEN
    RAISE EXCEPTION 'zone_name match is not case-insensitive' USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_count FROM public.allowed_capacities WHERE restaurant_id = v_other_restaurant_id;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'expected 3 allowed capacities, got %', v_count USING ERRCODE = 'NB001';
  END IF;

  SELECT id, updated_at INTO v_t1_id, v_updated_before
  FROM public.table_inventory WHERE restaurant_id = v_other_restaurant_id AND table_number = 'T1';

  -- 2. Replaying the same payload is a no-op: same ids, no duplicate rows, no row rewrite.
  v_second := public.onboarding_replace_layout(v_other_restaurant_id, v_zones, v_tables, v_first->>'revision');
  IF v_second <> v_first THEN
    RAISE EXCEPTION 'replay changed the result: % vs %', v_second, v_first USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_count FROM public.zones WHERE restaurant_id = v_other_restaurant_id;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'replay duplicated zones (%)', v_count USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_count FROM public.table_inventory WHERE restaurant_id = v_other_restaurant_id;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'replay duplicated tables (%)', v_count USING ERRCODE = 'NB001';
  END IF;
  SELECT updated_at INTO v_updated_after FROM public.table_inventory WHERE id = v_t1_id;
  IF v_updated_after IS DISTINCT FROM v_updated_before THEN
    RAISE EXCEPTION 'replay rewrote an unchanged table row' USING ERRCODE = 'NB001';
  END IF;

  -- 3. Replace semantics: drop Terrace and T2/T3, change T1 capacity, add T4. T1 keeps its id.
  v_third := public.onboarding_replace_layout(
    v_other_restaurant_id,
    '[{"name":"Main Dining"}]',
    '[{"table_number":"T1","capacity":3},{"table_number":"T4","capacity":2,"zone_name":"Main Dining"}]',
    v_second->>'revision'
  );
  IF v_third->>'revision' = v_second->>'revision' THEN
    RAISE EXCEPTION 'revision did not change after a layout change' USING ERRCODE = 'NB001';
  END IF;
  v_revision := v_third->>'revision';
  IF jsonb_array_length(v_third->'zones') <> 1 OR jsonb_array_length(v_third->'tables') <> 2 THEN
    RAISE EXCEPTION 'replace did not remove missing rows: %', v_third USING ERRCODE = 'NB001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.table_inventory WHERE id = v_t1_id AND capacity = 3) THEN
    RAISE EXCEPTION 'T1 lost its id or capacity was not updated' USING ERRCODE = 'NB001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.zones WHERE restaurant_id = v_other_restaurant_id AND name = 'Terrace') THEN
    RAISE EXCEPTION 'Terrace zone was not removed' USING ERRCODE = 'NB001';
  END IF;
  IF (v_third->'tables'->0->>'table_number') <> 'T1' OR (v_third->'tables'->1->>'table_number') <> 'T4' THEN
    RAISE EXCEPTION 'tables are not returned in payload order: %', v_third->'tables' USING ERRCODE = 'NB001';
  END IF;

  -- 4. Invalid payloads are refused without changing anything.
  v_raised := false;
  BEGIN
    PERFORM public.onboarding_replace_layout(v_other_restaurant_id, '[{"name":"A"},{"name":"a"}]', '[]', v_revision);
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE '22023' THEN
    v_raised := SQLERRM LIKE 'ONBOARDING_LAYOUT_INVALID:%';
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'duplicate zone names were not rejected' USING ERRCODE = 'NB001';
  END IF;

  v_raised := false;
  BEGIN
    PERFORM public.onboarding_replace_layout(
      v_other_restaurant_id, '[{"name":"Main Dining"}]',
      '[{"table_number":"T1","capacity":2},{"table_number":"T1","capacity":4}]', v_revision);
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE '22023' THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'duplicate table numbers were not rejected' USING ERRCODE = 'NB001';
  END IF;

  v_raised := false;
  BEGIN
    PERFORM public.onboarding_replace_layout(
      v_other_restaurant_id, '[{"name":"Main Dining"}]',
      '[{"table_number":"T1","capacity":2,"zone_name":"Nowhere"}]', v_revision);
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE '22023' THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'unknown zone reference was not rejected' USING ERRCODE = 'NB001';
  END IF;

  v_raised := false;
  BEGIN
    PERFORM public.onboarding_replace_layout(
      v_other_restaurant_id, '[{"name":"Main Dining"}]', '[{"table_number":"T1","capacity":"two"}]', v_revision);
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE '22023' THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'malformed capacity was not rejected' USING ERRCODE = 'NB001';
  END IF;

  v_raised := false;
  BEGIN
    PERFORM public.onboarding_replace_layout(v_other_restaurant_id, '[]', '[]', v_revision);
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE '22023' THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'empty zone list was not rejected' USING ERRCODE = 'NB001';
  END IF;

  SELECT count(*) INTO v_count FROM public.table_inventory WHERE restaurant_id = v_other_restaurant_id;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'a rejected payload changed the layout (% tables)', v_count USING ERRCODE = 'NB001';
  END IF;

  -- 5. A restaurant with bookings is locked; nothing changes there.
  v_raised := false;
  BEGIN
    PERFORM public.onboarding_replace_layout(v_restaurant_id, '[{"name":"X"}]', '[]', NULL);
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE '55000' THEN
    v_raised := SQLERRM = 'ONBOARDING_LAYOUT_LOCKED';
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'restaurant with bookings was not locked' USING ERRCODE = 'NB001';
  END IF;
  SELECT jsonb_build_object(
    'zones', (SELECT count(*) FROM public.zones WHERE restaurant_id = v_restaurant_id),
    'tables', (SELECT count(*) FROM public.table_inventory WHERE restaurant_id = v_restaurant_id)
  ) INTO v_other_after;
  IF v_other_after <> v_other_before THEN
    RAISE EXCEPTION 'booked restaurant layout changed: % -> %', v_other_before, v_other_after USING ERRCODE = 'NB001';
  END IF;

  -- 6. Unknown restaurant.
  v_raised := false;
  BEGIN
    PERFORM public.onboarding_replace_layout('00000000-0000-4000-8000-00000000ffff'::uuid, '[{"name":"X"}]', '[]', NULL);
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE 'P0002' THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'unknown restaurant was not rejected' USING ERRCODE = 'NB001';
  END IF;

  -- 8. Optimistic concurrency: a table added from the ops app after the wizard loaded the
  --    layout makes a save with the old revision fail with ONBOARDING_LAYOUT_CHANGED, and
  --    the added table survives.
  SELECT id INTO v_main_zone FROM public.zones WHERE restaurant_id = v_other_restaurant_id AND name = 'Main Dining';
  INSERT INTO public.allowed_capacities (restaurant_id, capacity)
  VALUES (v_other_restaurant_id, 8) ON CONFLICT DO NOTHING;
  INSERT INTO public.table_inventory (
    restaurant_id, table_number, capacity, zone_id, category, seating_type, mobility, status
  )
  VALUES (v_other_restaurant_id, 'OPS1', 8, v_main_zone, 'dining', 'standard', 'fixed', 'available');

  v_raised := false;
  BEGIN
    PERFORM public.onboarding_replace_layout(
      v_other_restaurant_id, '[{"name":"Main Dining"}]', '[{"table_number":"T1","capacity":3}]', v_revision);
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE '55000' THEN
    v_raised := SQLERRM = 'ONBOARDING_LAYOUT_CHANGED';
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'stale revision was not refused' USING ERRCODE = 'NB001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.table_inventory WHERE restaurant_id = v_other_restaurant_id AND table_number = 'OPS1')
     OR (SELECT count(*) FROM public.table_inventory WHERE restaurant_id = v_other_restaurant_id) <> 3 THEN
    RAISE EXCEPTION 'a refused stale save changed the layout' USING ERRCODE = 'NB001';
  END IF;

  -- NULL means "I expect no layout yet"; it is refused once one exists.
  v_raised := false;
  BEGIN
    PERFORM public.onboarding_replace_layout(
      v_other_restaurant_id, '[{"name":"Main Dining"}]', '[{"table_number":"T1","capacity":3}]', NULL);
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE '55000' THEN
    v_raised := SQLERRM = 'ONBOARDING_LAYOUT_CHANGED';
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'NULL revision over an existing layout was not refused' USING ERRCODE = 'NB001';
  END IF;

  -- An edit to an existing row (capacity) also changes the revision.
  v_snapshot := public.onboarding_layout_snapshot(v_other_restaurant_id);
  UPDATE public.table_inventory SET capacity = 8
  WHERE restaurant_id = v_other_restaurant_id AND table_number = 'T4';
  IF public.onboarding_layout_revision(v_other_restaurant_id) = v_snapshot->>'revision' THEN
    RAISE EXCEPTION 'a capacity edit did not change the revision' USING ERRCODE = 'NB001';
  END IF;

  -- Reloading the current snapshot and saving with its revision works and keeps OPS1 once
  -- the client includes it.
  v_snapshot := public.onboarding_layout_snapshot(v_other_restaurant_id);
  IF NOT (v_snapshot->'tables') @> '[{"table_number":"OPS1"}]'::jsonb THEN
    RAISE EXCEPTION 'snapshot does not include the ops table: %', v_snapshot USING ERRCODE = 'NB001';
  END IF;
  v_third := public.onboarding_replace_layout(
    v_other_restaurant_id, '[{"name":"Main Dining"}]',
    '[{"table_number":"T1","capacity":3},{"table_number":"T4","capacity":2},{"table_number":"OPS1","capacity":8}]',
    v_snapshot->>'revision');
  IF jsonb_array_length(v_third->'tables') <> 3
     OR v_third->>'revision' <> public.onboarding_layout_revision(v_other_restaurant_id) THEN
    RAISE EXCEPTION 'save after reload failed: %', v_third USING ERRCODE = 'NB001';
  END IF;

  -- 7. Privilege boundary: service_role only.
  IF has_function_privilege('anon', 'public.onboarding_replace_layout(uuid,jsonb,jsonb,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.onboarding_replace_layout(uuid,jsonb,jsonb,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.onboarding_replace_layout(uuid,jsonb,jsonb,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.onboarding_layout_snapshot(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.onboarding_layout_snapshot(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.onboarding_layout_snapshot(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.onboarding_layout_revision(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.onboarding_layout_revision(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.onboarding_layout_revision(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'onboarding layout function privileges changed unexpectedly' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'onboarding replace layout regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'onboarding replace layout regression FAILED';
    RAISE;
END;
$regression$;

ROLLBACK;
