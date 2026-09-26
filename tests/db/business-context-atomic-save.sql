-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
BEGIN;

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  v_category_id constant uuid := '00000000-0000-4000-8000-00000000f501';
  v_other_category_id constant uuid := '00000000-0000-4000-8000-00000000f502';
  v_result jsonb;
  v_count integer;
  v_log_count integer;
  v_name text;
BEGIN
  -- Only service_role may call the new functions.
  IF has_function_privilege('anon',
       'public.replace_restaurant_business_context_v2(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, bigint)',
       'EXECUTE')
     OR has_function_privilege('authenticated',
       'public.replace_restaurant_business_context_v2(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, bigint)',
       'EXECUTE')
     OR NOT has_function_privilege('service_role',
       'public.replace_restaurant_business_context_v2(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, bigint)',
       'EXECUTE') THEN
    RAISE EXCEPTION 'replace_restaurant_business_context_v2 privileges are wrong' USING ERRCODE = 'NB001';
  END IF;
  IF has_function_privilege('authenticated',
       'public.get_restaurant_business_context_revision_v1(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'revision reader must be service-role only' USING ERRCODE = 'NB001';
  END IF;
  IF has_table_privilege('authenticated', 'public.restaurant_business_context_revisions', 'SELECT') THEN
    RAISE EXCEPTION 'revision table must be service-role only' USING ERRCODE = 'NB001';
  END IF;

  IF public.get_restaurant_business_context_revision_v1(v_restaurant_id) <> 0 THEN
    RAISE EXCEPTION 'an unsaved restaurant must start at revision 0' USING ERRCODE = 'NB001';
  END IF;

  -- Restaurant B has its own category, which no call for restaurant A may touch.
  PERFORM public.replace_restaurant_business_context_v2(
    v_other_restaurant_id,
    p_categories => jsonb_build_array(jsonb_build_object(
      'id', v_other_category_id, 'display_name', 'Other pub', 'category_code', 'gcid:pub',
      'more_hours_types_json', '[]'::jsonb, 'is_primary', true, 'display_order', 0))
  );

  -- 1. One call applies every section, writes its change-log rows and bumps the revision.
  --    A restaurant_id smuggled into a change-log row is ignored: rows are scoped to the call.
  v_result := public.replace_restaurant_business_context_v2(
    v_restaurant_id,
    p_business_details => jsonb_build_object(
      'opening_date', '2020-01-01', 'business_status', 'open', 'is_service_area_business', true),
    p_categories => jsonb_build_array(jsonb_build_object(
      'id', v_category_id, 'display_name', 'Gastropub', 'category_code', 'gcid:gastropub',
      'more_hours_types_json', '[]'::jsonb, 'is_primary', true, 'display_order', 0)),
    p_change_log_rows => jsonb_build_array(
      jsonb_build_object('restaurant_id', v_other_restaurant_id,
        'entity_table', 'restaurant_business_details', 'field_path', '$',
        'change_origin', 'owner', 'changed_via', 'regression', 'status', 'applied'),
      jsonb_build_object('entity_table', 'restaurant_categories', 'field_path', '$',
        'change_origin', 'owner', 'changed_via', 'regression', 'status', 'applied')),
    p_expected_revision => 0
  );
  IF v_result->>'status' <> 'applied' OR (v_result->>'revision')::bigint <> 1 THEN
    RAISE EXCEPTION 'first save should apply at revision 1, got %', v_result USING ERRCODE = 'NB001';
  END IF;

  SELECT count(*) INTO v_log_count FROM public.restaurant_profile_change_log
  WHERE restaurant_id = v_restaurant_id AND changed_via = 'regression';
  IF v_log_count <> 2 THEN
    RAISE EXCEPTION 'expected 2 change-log rows in the save transaction, got %', v_log_count
      USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_count FROM public.restaurant_profile_change_log
  WHERE restaurant_id = v_other_restaurant_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'change-log rows leaked to another restaurant' USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_count FROM public.restaurant_business_details
  WHERE restaurant_id = v_restaurant_id AND source = 'nabatable' AND is_service_area_business;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'business details were not applied in the same call' USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_count FROM public.restaurant_categories
  WHERE restaurant_id = v_other_restaurant_id AND id = v_other_category_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'another restaurant''s categories were touched' USING ERRCODE = 'NB001';
  END IF;

  -- 2. A stale revision writes nothing and reports the current revision.
  v_result := public.replace_restaurant_business_context_v2(
    v_restaurant_id,
    p_categories => jsonb_build_array(jsonb_build_object(
      'id', v_category_id, 'display_name', 'Stale write', 'is_primary', true, 'display_order', 0)),
    p_change_log_rows => jsonb_build_array(jsonb_build_object(
      'entity_table', 'restaurant_categories', 'change_origin', 'owner', 'changed_via', 'regression')),
    p_expected_revision => 0
  );
  IF v_result->>'status' <> 'stale' OR (v_result->>'revision')::bigint <> 1 THEN
    RAISE EXCEPTION 'stale save should be refused at revision 1, got %', v_result USING ERRCODE = 'NB001';
  END IF;
  SELECT display_name INTO v_name FROM public.restaurant_categories WHERE id = v_category_id;
  IF v_name <> 'Gastropub' THEN
    RAISE EXCEPTION 'a stale save changed the data' USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_count FROM public.restaurant_profile_change_log
  WHERE restaurant_id = v_restaurant_id AND changed_via = 'regression';
  IF v_count <> v_log_count THEN
    RAISE EXCEPTION 'a stale save wrote change-log rows' USING ERRCODE = 'NB001';
  END IF;

  -- 3. A change-log failure rolls the replacement and the revision back with it.
  BEGIN
    PERFORM public.replace_restaurant_business_context_v2(
      v_restaurant_id,
      p_categories => jsonb_build_array(jsonb_build_object(
        'id', v_category_id, 'display_name', 'Must not persist', 'is_primary', true,
        'display_order', 0)),
      p_change_log_rows => jsonb_build_array(jsonb_build_object(
        'entity_table', 'restaurant_categories', 'change_origin', 'not-an-origin')),
      p_expected_revision => 1
    );
    RAISE EXCEPTION 'an invalid change-log row should fail the save' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
  SELECT display_name INTO v_name FROM public.restaurant_categories WHERE id = v_category_id;
  IF v_name <> 'Gastropub' THEN
    RAISE EXCEPTION 'replacement survived a failed change-log insert' USING ERRCODE = 'NB001';
  END IF;
  IF public.get_restaurant_business_context_revision_v1(v_restaurant_id) <> 1 THEN
    RAISE EXCEPTION 'revision moved on a failed save' USING ERRCODE = 'NB001';
  END IF;

  -- 4. Without a precondition the save applies (legacy callers) and still bumps the revision.
  v_result := public.replace_restaurant_business_context_v2(
    v_restaurant_id,
    p_categories => jsonb_build_array(jsonb_build_object(
      'id', v_category_id, 'display_name', 'Imported', 'is_primary', true, 'display_order', 0))
  );
  IF v_result->>'status' <> 'applied' OR (v_result->>'revision')::bigint <> 2 THEN
    RAISE EXCEPTION 'unconditional save should apply at revision 2, got %', v_result
      USING ERRCODE = 'NB001';
  END IF;
  IF public.get_restaurant_business_context_revision_v1(v_other_restaurant_id) <> 1 THEN
    RAISE EXCEPTION 'revisions are not per restaurant' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'business-context-atomic-save regression PASSED';
END;
$regression$;

ROLLBACK;
