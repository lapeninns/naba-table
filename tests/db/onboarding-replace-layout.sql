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
BEGIN
  SELECT jsonb_build_object(
    'zones', (SELECT count(*) FROM public.zones WHERE restaurant_id = v_restaurant_id),
    'tables', (SELECT count(*) FROM public.table_inventory WHERE restaurant_id = v_restaurant_id)
  ) INTO v_other_before;

  -- 1. First replace creates zones, tables and allowed capacities.
  v_first := public.onboarding_replace_layout(v_other_restaurant_id, v_zones, v_tables);

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
  v_second := public.onboarding_replace_layout(v_other_restaurant_id, v_zones, v_tables);
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
    '[{"table_number":"T1","capacity":3},{"table_number":"T4","capacity":2,"zone_name":"Main Dining"}]'
  );
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
    PERFORM public.onboarding_replace_layout(v_other_restaurant_id, '[{"name":"A"},{"name":"a"}]', '[]');
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
      '[{"table_number":"T1","capacity":2},{"table_number":"T1","capacity":4}]');
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
      '[{"table_number":"T1","capacity":2,"zone_name":"Nowhere"}]');
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
      v_other_restaurant_id, '[{"name":"Main Dining"}]', '[{"table_number":"T1","capacity":"two"}]');
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
    PERFORM public.onboarding_replace_layout(v_other_restaurant_id, '[]', '[]');
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
    PERFORM public.onboarding_replace_layout(v_restaurant_id, '[{"name":"X"}]', '[]');
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
    PERFORM public.onboarding_replace_layout('00000000-0000-4000-8000-00000000ffff'::uuid, '[{"name":"X"}]', '[]');
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN SQLSTATE 'P0002' THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'unknown restaurant was not rejected' USING ERRCODE = 'NB001';
  END IF;

  -- 7. Privilege boundary: service_role only.
  IF has_function_privilege('anon', 'public.onboarding_replace_layout(uuid,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.onboarding_replace_layout(uuid,jsonb,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.onboarding_replace_layout(uuid,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'onboarding_replace_layout privileges changed unexpectedly' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'onboarding replace layout regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'onboarding replace layout regression FAILED';
    RAISE;
END;
$regression$;

ROLLBACK;
