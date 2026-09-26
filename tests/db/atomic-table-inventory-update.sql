-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
-- Regression for public.update_table_inventory_atomic (migration 20260927130000).
-- The table PATCH writes the inventory row and its maintenance allocation in one
-- transaction: a rejected maintenance window must leave the row untouched, and the
-- function must stay tenant-scoped and service-role only.
BEGIN;

SET LOCAL app.capacity.post_assignment.enabled = 'off';

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  z constant uuid := '00000000-0000-4000-8000-00000000d001';
  other_z constant uuid := '00000000-0000-4000-8000-00000000d041';
  second_z constant uuid := '00000000-0000-4000-8000-00000000d042';
  t constant uuid := '00000000-0000-4000-8000-00000000e001';
  t2 constant uuid := '00000000-0000-4000-8000-00000000e041';
  start_time constant timestamptz := TIMESTAMPTZ '2099-09-27 10:00:00+00';
  end_time constant timestamptz := TIMESTAMPTZ '2099-09-27 18:00:00+00';
  row_after public.table_inventory%ROWTYPE;
  before_row public.table_inventory%ROWTYPE;
  h uuid;
  n bigint;
BEGIN
  INSERT INTO public.zones(id, restaurant_id, name)
  VALUES (other_z, v_other_restaurant_id, 'Synthetic inventory other zone'),
         (second_z, v_restaurant_id, 'Synthetic inventory second zone');
  INSERT INTO public.table_inventory(id, restaurant_id, table_number, capacity, zone_id, category)
  VALUES (t2, v_restaurant_id, 'SYN-INV-2', 4, z, 'dining');

  -- 1. Plain field patch updates only the named columns and returns the row.
  row_after := public.update_table_inventory_atomic(
    t, v_restaurant_id, jsonb_build_object('table_number', 'SYN-1B', 'notes', 'by window', 'zone_id', second_z)
  );
  IF row_after.table_number <> 'SYN-1B' OR row_after.notes <> 'by window'
     OR row_after.zone_id <> second_z OR row_after.capacity <> 4 THEN
    RAISE EXCEPTION 'Field patch did not apply exactly the named columns' USING ERRCODE = 'NB001';
  END IF;

  -- 2. Null clears a nullable column.
  row_after := public.update_table_inventory_atomic(t, v_restaurant_id, jsonb_build_object('notes', NULL));
  IF row_after.notes IS NOT NULL THEN
    RAISE EXCEPTION 'Explicit null did not clear notes' USING ERRCODE = 'NB001';
  END IF;

  -- 3. Out of service with a window: row and maintenance allocation are written together.
  row_after := public.update_table_inventory_atomic(
    t, v_restaurant_id, jsonb_build_object('status', 'out_of_service'), start_time, end_time, NULL
  );
  IF row_after.status <> 'out_of_service' THEN
    RAISE EXCEPTION 'Status was not set to out_of_service' USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO n FROM public.allocations
  WHERE resource_type = 'table' AND resource_id = t AND is_maintenance
    AND restaurant_id = v_restaurant_id AND booking_id IS NULL
    AND "window" = tstzrange(start_time, end_time, '[)');
  IF n <> 1 THEN
    RAISE EXCEPTION 'Maintenance allocation was not created with the exact window' USING ERRCODE = 'NB001';
  END IF;

  -- 4. A new window replaces the old one (never two maintenance rows).
  PERFORM public.update_table_inventory_atomic(
    t, v_restaurant_id, jsonb_build_object('status', 'out_of_service'),
    start_time + interval '1 day', end_time + interval '1 day', NULL
  );
  SELECT count(*) INTO n FROM public.allocations
  WHERE resource_type = 'table' AND resource_id = t AND is_maintenance;
  IF n <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.allocations WHERE resource_id = t AND is_maintenance
      AND "window" = tstzrange(start_time + interval '1 day', end_time + interval '1 day', '[)')
  ) THEN
    RAISE EXCEPTION 'Maintenance window was not replaced atomically' USING ERRCODE = 'NB001';
  END IF;

  -- 5. Back in service clears the maintenance window in the same transaction.
  row_after := public.update_table_inventory_atomic(t, v_restaurant_id, jsonb_build_object('status', 'available'));
  IF row_after.status <> 'available' OR EXISTS (
    SELECT 1 FROM public.allocations WHERE resource_id = t AND is_maintenance
  ) THEN
    RAISE EXCEPTION 'Returning to service did not clear maintenance' USING ERRCODE = 'NB001';
  END IF;

  -- 6. A live hold blocks the maintenance window and the whole patch rolls back
  --    (status, number and the previous window are untouched).
  SELECT id INTO h FROM public.create_table_hold_atomic(
    NULL, v_restaurant_id, z, ARRAY[t2], start_time, end_time, clock_timestamp() + interval '120 seconds'
  );
  SELECT * INTO before_row FROM public.table_inventory WHERE id = t2;
  BEGIN
    PERFORM public.update_table_inventory_atomic(
      t2, v_restaurant_id, jsonb_build_object('status', 'out_of_service', 'table_number', 'SYN-INV-X'),
      start_time, end_time, NULL
    );
    RAISE EXCEPTION 'Maintenance window was admitted over a live hold' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN exclusion_violation THEN NULL;
  END;
  SELECT * INTO row_after FROM public.table_inventory WHERE id = t2;
  IF row_after.status <> before_row.status OR row_after.table_number <> before_row.table_number
     OR EXISTS (SELECT 1 FROM public.allocations WHERE resource_id = t2 AND is_maintenance) THEN
    RAISE EXCEPTION 'Rejected maintenance left a partial table update' USING ERRCODE = 'NB001';
  END IF;
  PERFORM public.release_hold_and_emit(h, NULL);

  -- 7. Tenant scoping: another restaurant cannot patch this table.
  BEGIN
    PERFORM public.update_table_inventory_atomic(t, v_other_restaurant_id, jsonb_build_object('notes', 'x'));
    RAISE EXCEPTION 'Cross-tenant patch was admitted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN no_data_found THEN NULL;
  END;

  -- 8. A zone from another restaurant is rejected.
  BEGIN
    PERFORM public.update_table_inventory_atomic(t, v_restaurant_id, jsonb_build_object('zone_id', other_z));
    RAISE EXCEPTION 'Cross-tenant zone was admitted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN no_data_found THEN NULL;
  END;

  -- 9. Identity columns and unknown keys are rejected, not ignored.
  BEGIN
    PERFORM public.update_table_inventory_atomic(t, v_restaurant_id, jsonb_build_object('restaurant_id', v_other_restaurant_id));
    RAISE EXCEPTION 'restaurant_id was patchable' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN invalid_parameter_value THEN NULL;
  END;

  -- 10. A maintenance window without out_of_service, or an inverted window, is rejected.
  BEGIN
    PERFORM public.update_table_inventory_atomic(t, v_restaurant_id, '{}'::jsonb, start_time, end_time, NULL);
    RAISE EXCEPTION 'Maintenance window without out_of_service was admitted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.update_table_inventory_atomic(
      t, v_restaurant_id, jsonb_build_object('status', 'out_of_service'), end_time, start_time, NULL
    );
    RAISE EXCEPTION 'Inverted maintenance window was admitted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN invalid_parameter_value THEN NULL;
  END;

  -- 11. Duplicate table numbers surface as unique_violation.
  BEGIN
    PERFORM public.update_table_inventory_atomic(t, v_restaurant_id, jsonb_build_object('table_number', 'SYN-INV-2'));
    RAISE EXCEPTION 'Duplicate table number was admitted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN unique_violation THEN NULL;
  END;

  -- 12. Privileges: service_role only.
  IF has_function_privilege('anon', 'public.update_table_inventory_atomic(uuid,uuid,jsonb,timestamptz,timestamptz,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.update_table_inventory_atomic(uuid,uuid,jsonb,timestamptz,timestamptz,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.update_table_inventory_atomic(uuid,uuid,jsonb,timestamptz,timestamptz,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'update_table_inventory_atomic privileges are not service-role only' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'atomic-table-inventory-update regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'nabatable-regression: atomic-table-inventory-update FAILED (SQLSTATE %)', SQLSTATE;
    RAISE;
END;
$regression$;

ROLLBACK;
