-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
BEGIN;

-- Regression for supabase/migrations/20260927140000_menu_mutation_integrity.sql:
--   * atomic item create (item + extensions + options), idempotent retry per restaurant key
--   * server-side display_order (max + 1) for items, sections and options
--   * partial jsonb merge patches: two partial edits to different fields both survive
--   * one reorder command per level, validated against the parent and the restaurant

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  v_menu_id constant uuid := '00000000-0000-4000-8000-000000714001';
  v_section_id constant uuid := '00000000-0000-4000-8000-000000714101';
  v_second_section_id constant uuid := '00000000-0000-4000-8000-000000714102';
  v_other_menu_id constant uuid := '00000000-0000-4000-8000-000000714002';
  v_other_section_id constant uuid := '00000000-0000-4000-8000-000000714201';
  v_label constant jsonb := '[{"displayName":"Synthetic","languageCode":"en-GB"}]';
  v_result jsonb;
  v_replay jsonb;
  v_item_id uuid;
  v_first_item_id uuid;
  v_second_item_id uuid;
  v_count integer;
  v_orders integer[];
  v_row record;
  v_section_row public.restaurant_menu_sections%ROWTYPE;
  v_option_row public.restaurant_menu_item_options%ROWTYPE;
  v_option_ids uuid[];
  v_section_ids uuid[];
  v_raised boolean;
BEGIN
  INSERT INTO public.restaurant_menus (id, restaurant_id, labels, menu_kind)
  VALUES
    (v_menu_id, v_restaurant_id, v_label, 'food'),
    (v_other_menu_id, v_other_restaurant_id, v_label, 'food');
  INSERT INTO public.restaurant_menu_sections (id, restaurant_id, menu_id, labels, display_order, legacy_category)
  VALUES
    (v_section_id, v_restaurant_id, v_menu_id, v_label, 0, 'Starters'),
    (v_second_section_id, v_restaurant_id, v_menu_id, v_label, 1, NULL),
    (v_other_section_id, v_other_restaurant_id, v_other_menu_id, v_label, 0, 'Other');

  -- 1. Items without display_order are appended (max + 1).
  v_result := public.create_restaurant_menu_item_v1(
    v_restaurant_id, v_menu_id, v_section_id,
    jsonb_build_object('item_kind', 'food', 'external_item_id', 'syn-item-1', 'item_name', 'One',
      'labels', v_label, 'google_attributes', '{"price":{"amount":4.5,"currencyCode":"GBP"}}'::jsonb),
    '{}'::jsonb, '[]'::jsonb, NULL);
  v_first_item_id := (v_result -> 'item' ->> 'id')::uuid;
  IF (v_result -> 'item' ->> 'display_order')::integer <> 0
    OR (v_result -> 'item' ->> 'category') <> 'Starters'
    OR (v_result -> 'item' ->> 'base_price')::numeric <> 4.5
    OR (v_result ->> 'replayed')::boolean THEN
    RAISE EXCEPTION 'first item create wrong: %', v_result USING ERRCODE = 'NB001';
  END IF;
  IF v_result -> 'extension' IS NULL OR jsonb_typeof(v_result -> 'extension') <> 'object' THEN
    RAISE EXCEPTION 'item create did not create extensions atomically' USING ERRCODE = 'NB001';
  END IF;

  -- 2. Create with extensions + options + idempotency key; retry returns the same item.
  v_result := public.create_restaurant_menu_item_v1(
    v_restaurant_id, v_menu_id, v_section_id,
    jsonb_build_object('item_kind', 'food', 'external_item_id', 'syn-item-2', 'item_name', 'Two',
      'labels', v_label),
    '{"availability_policy":{"soldOut":false,"servicePeriods":["lunch"]}}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('external_option_id', 'syn-opt-a', 'labels', v_label),
      jsonb_build_object('external_option_id', 'syn-opt-b', 'labels', v_label)
    ),
    'syn-create-key-0001');
  v_second_item_id := (v_result -> 'item' ->> 'id')::uuid;
  IF (v_result -> 'item' ->> 'display_order')::integer <> 1
    OR jsonb_array_length(v_result -> 'options') <> 2
    OR (v_result -> 'options' -> 0 ->> 'display_order')::integer <> 0
    OR (v_result -> 'options' -> 1 ->> 'display_order')::integer <> 1
    OR (v_result -> 'extension' -> 'availability_policy' -> 'servicePeriods') <> '["lunch"]'::jsonb
    OR v_result -> 'item' ? 'create_idempotency_key'
    OR v_result -> 'item' ? 'create_request_fingerprint' THEN
    RAISE EXCEPTION 'keyed item create wrong: %', v_result USING ERRCODE = 'NB001';
  END IF;

  -- The retry carries the same payload (key order does not matter: jsonb is normalised).
  v_replay := public.create_restaurant_menu_item_v1(
    v_restaurant_id, v_menu_id, v_section_id,
    jsonb_build_object('labels', v_label, 'item_name', 'Two', 'external_item_id', 'syn-item-2',
      'item_kind', 'food'),
    '{"availability_policy":{"servicePeriods":["lunch"],"soldOut":false}}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('labels', v_label, 'external_option_id', 'syn-opt-a'),
      jsonb_build_object('external_option_id', 'syn-opt-b', 'labels', v_label)
    ),
    'syn-create-key-0001');
  IF (v_replay -> 'item' ->> 'id')::uuid <> v_second_item_id
    OR NOT (v_replay ->> 'replayed')::boolean
    OR jsonb_array_length(v_replay -> 'options') <> 2 THEN
    RAISE EXCEPTION 'idempotent retry did not replay: %', v_replay USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO v_count FROM public.restaurant_menu_items
  WHERE restaurant_id = v_restaurant_id AND section_id = v_section_id;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'retry duplicated the item (% rows)', v_count USING ERRCODE = 'NB001';
  END IF;

  -- 2b. The same key with an edited payload (item, extensions or options) is a conflict, not a
  --     silent replay of the original: the user changed the draft after an ambiguous failure.
  FOR v_row IN
    SELECT * FROM (VALUES
      (jsonb_build_object('item_kind', 'food', 'external_item_id', 'syn-item-2', 'item_name', 'Two edited',
         'labels', v_label),
       '{"availability_policy":{"soldOut":false,"servicePeriods":["lunch"]}}'::jsonb,
       jsonb_build_array(
         jsonb_build_object('external_option_id', 'syn-opt-a', 'labels', v_label),
         jsonb_build_object('external_option_id', 'syn-opt-b', 'labels', v_label))),
      (jsonb_build_object('item_kind', 'food', 'external_item_id', 'syn-item-2', 'item_name', 'Two',
         'labels', v_label),
       '{}'::jsonb,
       jsonb_build_array(
         jsonb_build_object('external_option_id', 'syn-opt-a', 'labels', v_label),
         jsonb_build_object('external_option_id', 'syn-opt-b', 'labels', v_label))),
      (jsonb_build_object('item_kind', 'food', 'external_item_id', 'syn-item-2', 'item_name', 'Two',
         'labels', v_label),
       '{"availability_policy":{"soldOut":false,"servicePeriods":["lunch"]}}'::jsonb,
       jsonb_build_array(jsonb_build_object('external_option_id', 'syn-opt-a', 'labels', v_label)))
    ) AS cases(item, extensions, options)
  LOOP
    v_raised := false;
    BEGIN
      PERFORM public.create_restaurant_menu_item_v1(
        v_restaurant_id, v_menu_id, v_section_id, v_row.item, v_row.extensions, v_row.options,
        'syn-create-key-0001');
    EXCEPTION
      WHEN SQLSTATE 'NB001' THEN RAISE;
      WHEN sqlstate 'P0001' THEN
      v_raised := SQLERRM = 'menu_idempotency_key_reused';
    END;
    IF NOT v_raised THEN
      RAISE EXCEPTION 'key reuse with an edited payload was replayed silently: %', v_row.item
        USING ERRCODE = 'NB001';
    END IF;
  END LOOP;
  IF (SELECT item_name FROM public.restaurant_menu_items WHERE id = v_second_item_id) <> 'Two' THEN
    RAISE EXCEPTION 'rejected key reuse changed the original item' USING ERRCODE = 'NB001';
  END IF;

  -- 3. The same key for another section is a conflict, not a silent replay.
  v_raised := false;
  BEGIN
    PERFORM public.create_restaurant_menu_item_v1(
      v_restaurant_id, v_menu_id, v_second_section_id,
      jsonb_build_object('external_item_id', 'syn-item-3', 'item_name', 'Three', 'labels', v_label),
      '{}'::jsonb, '[]'::jsonb, 'syn-create-key-0001');
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN sqlstate 'P0001' THEN
    v_raised := SQLERRM = 'menu_idempotency_key_reused';
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'key reuse across sections was not rejected' USING ERRCODE = 'NB001';
  END IF;

  -- 4. A failure after the item insert leaves nothing behind (atomic create).
  v_raised := false;
  BEGIN
    PERFORM public.create_restaurant_menu_item_v1(
      v_restaurant_id, v_menu_id, v_section_id,
      jsonb_build_object('external_item_id', 'syn-item-atomic', 'item_name', 'Atomic', 'labels', v_label),
      '{}'::jsonb,
      jsonb_build_array(
        jsonb_build_object('external_option_id', 'syn-dup', 'labels', v_label),
        jsonb_build_object('external_option_id', 'syn-dup', 'labels', v_label)
      ),
      'syn-create-key-atomic');
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN unique_violation THEN
    v_raised := true;
  END;
  IF NOT v_raised OR EXISTS (
    SELECT 1 FROM public.restaurant_menu_items
    WHERE restaurant_id = v_restaurant_id AND external_item_id = 'syn-item-atomic'
  ) THEN
    RAISE EXCEPTION 'failed create left a half-created item' USING ERRCODE = 'NB001';
  END IF;

  -- 5. Tenant scope: another restaurant's section is not found.
  v_raised := false;
  BEGIN
    PERFORM public.create_restaurant_menu_item_v1(
      v_restaurant_id, v_other_menu_id, v_other_section_id,
      jsonb_build_object('external_item_id', 'syn-item-x', 'item_name', 'X', 'labels', v_label),
      '{}'::jsonb, '[]'::jsonb, NULL);
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN sqlstate 'P0002' THEN
    v_raised := SQLERRM = 'menu_section_not_found';
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'cross-tenant item create was not rejected' USING ERRCODE = 'NB001';
  END IF;

  -- 6. Partial merge patches to different fields both survive.
  PERFORM public.update_restaurant_menu_item_v1(
    v_restaurant_id, v_menu_id, v_section_id, v_second_item_id,
    '{}'::jsonb, '{"price":{"amount":9.25,"currencyCode":"GBP"}}'::jsonb, NULL, NULL);
  PERFORM public.update_restaurant_menu_item_v1(
    v_restaurant_id, v_menu_id, v_section_id, v_second_item_id,
    '{"active":false}'::jsonb, '{"spiciness":"MILD"}'::jsonb, NULL,
    '{"availability_policy":{"soldOut":true}}'::jsonb);
  v_result := public.restaurant_menu_item_snapshot_v1(v_restaurant_id, v_second_item_id);
  IF (v_result -> 'item' -> 'google_attributes' -> 'price' ->> 'amount')::numeric <> 9.25
    OR (v_result -> 'item' -> 'google_attributes' ->> 'spiciness') <> 'MILD'
    OR (v_result -> 'item' ->> 'base_price')::numeric <> 9.25
    OR (v_result -> 'item' ->> 'active')::boolean
    OR NOT (v_result -> 'extension' -> 'availability_policy' ->> 'soldOut')::boolean
    OR (v_result -> 'extension' -> 'availability_policy' -> 'servicePeriods') <> '["lunch"]'::jsonb THEN
    RAISE EXCEPTION 'partial merge lost a concurrent change: %', v_result USING ERRCODE = 'NB001';
  END IF;

  -- Full replacement (the full edit form) still replaces the column value.
  PERFORM public.update_restaurant_menu_item_v1(
    v_restaurant_id, v_menu_id, v_section_id, v_second_item_id,
    '{"google_attributes":{"allergen":[]}}'::jsonb, NULL,
    '{"availability_policy":{"orderable":true}}'::jsonb, NULL);
  v_result := public.restaurant_menu_item_snapshot_v1(v_restaurant_id, v_second_item_id);
  IF v_result -> 'item' -> 'google_attributes' <> '{"allergen":[]}'::jsonb
    OR (v_result -> 'item' ->> 'base_price')::numeric <> 0
    OR v_result -> 'extension' -> 'availability_policy' <> '{"orderable":true}'::jsonb
    OR v_result -> 'extension' -> 'drink_profile' <> '{}'::jsonb THEN
    RAISE EXCEPTION 'full replacement wrong: %', v_result USING ERRCODE = 'NB001';
  END IF;

  v_raised := false;
  BEGIN
    PERFORM public.update_restaurant_menu_item_v1(
      v_other_restaurant_id, v_menu_id, v_section_id, v_second_item_id,
      '{"active":true}'::jsonb, NULL, NULL, NULL);
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN sqlstate 'P0002' THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'cross-tenant item update was not rejected' USING ERRCODE = 'NB001';
  END IF;

  -- 7. Server-side display_order for sections and options.
  v_section_row := public.create_restaurant_menu_section_v1(
    v_restaurant_id, v_menu_id, jsonb_build_object('labels', v_label, 'legacy_category', 'Mains'));
  IF v_section_row.display_order <> 2 THEN
    RAISE EXCEPTION 'section display_order not max + 1: %', v_section_row.display_order USING ERRCODE = 'NB001';
  END IF;
  v_option_row := public.create_restaurant_menu_item_option_v1(
    v_restaurant_id, v_menu_id, v_section_id, v_second_item_id,
    jsonb_build_object('external_option_id', 'syn-opt-c', 'labels', v_label));
  IF v_option_row.display_order <> 2 THEN
    RAISE EXCEPTION 'option display_order not max + 1: %', v_option_row.display_order USING ERRCODE = 'NB001';
  END IF;
  v_raised := false;
  BEGIN
    PERFORM public.create_restaurant_menu_section_v1(
      v_restaurant_id, v_other_menu_id, jsonb_build_object('labels', v_label));
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN sqlstate 'P0002' THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'cross-tenant section create was not rejected' USING ERRCODE = 'NB001';
  END IF;

  -- 8. Reorder: one command per level renumbers 0..n-1.
  SELECT array_agg(id ORDER BY display_order DESC) INTO v_section_ids
  FROM public.restaurant_menu_sections WHERE restaurant_id = v_restaurant_id AND menu_id = v_menu_id;
  v_result := public.reorder_restaurant_menu_sections_v1(v_restaurant_id, v_menu_id, v_section_ids);
  SELECT array_agg(display_order ORDER BY array_position(v_section_ids, id)) INTO v_orders
  FROM public.restaurant_menu_sections WHERE restaurant_id = v_restaurant_id AND menu_id = v_menu_id;
  IF v_orders <> ARRAY[0, 1, 2] OR jsonb_array_length(v_result) <> 3 THEN
    RAISE EXCEPTION 'section reorder wrong: %', v_orders USING ERRCODE = 'NB001';
  END IF;

  PERFORM public.reorder_restaurant_menu_items_v1(
    v_restaurant_id, v_menu_id, v_section_id, ARRAY[v_second_item_id, v_first_item_id]);
  SELECT array_agg(display_order ORDER BY display_order) INTO v_orders FROM public.restaurant_menu_items
  WHERE id IN (v_second_item_id, v_first_item_id);
  IF (SELECT display_order FROM public.restaurant_menu_items WHERE id = v_second_item_id) <> 0
    OR (SELECT display_order FROM public.restaurant_menu_items WHERE id = v_first_item_id) <> 1 THEN
    RAISE EXCEPTION 'item reorder wrong' USING ERRCODE = 'NB001';
  END IF;

  SELECT array_agg(id ORDER BY display_order DESC) INTO v_option_ids
  FROM public.restaurant_menu_item_options WHERE menu_item_id = v_second_item_id;
  PERFORM public.reorder_restaurant_menu_item_options_v1(
    v_restaurant_id, v_menu_id, v_section_id, v_second_item_id, v_option_ids);
  SELECT array_agg(display_order ORDER BY array_position(v_option_ids, id)) INTO v_orders
  FROM public.restaurant_menu_item_options WHERE menu_item_id = v_second_item_id;
  IF v_orders <> ARRAY[0, 1, 2] THEN
    RAISE EXCEPTION 'option reorder wrong: %', v_orders USING ERRCODE = 'NB001';
  END IF;

  -- Stale or foreign ids are rejected and nothing moves.
  FOR v_row IN
    SELECT * FROM (VALUES
      (ARRAY[v_second_item_id]),                                   -- missing a child
      (ARRAY[v_second_item_id, v_second_item_id]),                 -- duplicate
      (ARRAY[v_second_item_id, v_first_item_id, v_other_section_id]) -- foreign id
    ) AS cases(ids)
  LOOP
    v_raised := false;
    BEGIN
      PERFORM public.reorder_restaurant_menu_items_v1(
        v_restaurant_id, v_menu_id, v_section_id, v_row.ids);
    EXCEPTION
      WHEN SQLSTATE 'NB001' THEN RAISE;
      WHEN sqlstate 'P0001' THEN
      v_raised := SQLERRM = 'menu_order_stale';
    END;
    IF NOT v_raised THEN
      RAISE EXCEPTION 'invalid reorder % was accepted', v_row.ids USING ERRCODE = 'NB001';
    END IF;
  END LOOP;
  IF (SELECT display_order FROM public.restaurant_menu_items WHERE id = v_second_item_id) <> 0 THEN
    RAISE EXCEPTION 'rejected reorder changed rows' USING ERRCODE = 'NB001';
  END IF;

  v_raised := false;
  BEGIN
    PERFORM public.reorder_restaurant_menu_sections_v1(
      v_other_restaurant_id, v_menu_id, v_section_ids);
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN sqlstate 'P0002' THEN
    v_raised := SQLERRM = 'menu_not_found';
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'cross-tenant reorder was not rejected' USING ERRCODE = 'NB001';
  END IF;

  -- 9. Privileges: service_role only.
  IF has_function_privilege('authenticated',
      'public.create_restaurant_menu_item_v1(uuid, uuid, uuid, jsonb, jsonb, jsonb, text)', 'EXECUTE')
    OR has_function_privilege('anon',
      'public.reorder_restaurant_menu_items_v1(uuid, uuid, uuid, uuid[])', 'EXECUTE')
    OR NOT has_function_privilege('service_role',
      'public.update_restaurant_menu_item_v1(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'menu RPC privileges are wrong' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'menu-mutation-integrity regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'nabatable-regression: menu-mutation-integrity FAILED (SQLSTATE %)', SQLSTATE;
    RAISE;
END;
$regression$;

ROLLBACK;
