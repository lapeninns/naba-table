-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
BEGIN;

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  z constant uuid := '00000000-0000-4000-8000-00000000d001';
  same_tenant_other_z constant uuid := '00000000-0000-4000-8000-00000000d032';
  other_z constant uuid := '00000000-0000-4000-8000-00000000d031';
  t constant uuid := '00000000-0000-4000-8000-00000000e001';
  other_t constant uuid := '00000000-0000-4000-8000-00000000e031';
  b constant uuid := '00000000-0000-4000-8000-00000000b002';
  terminal_b constant uuid := '00000000-0000-4000-8000-00000000b001';
  empty_h constant uuid := '00000000-0000-4000-8000-00000000f031';
  h uuid;
  h2 uuid;
  n bigint;
  start_time constant timestamptz := TIMESTAMPTZ '2099-09-06 19:00:00+00';
  end_time constant timestamptz := TIMESTAMPTZ '2099-09-06 20:30:00+00';
BEGIN
  INSERT INTO public.zones(id,restaurant_id,name) VALUES(other_z,v_other_restaurant_id,'Synthetic hold other zone');
  INSERT INTO public.zones(id,restaurant_id,name) VALUES(same_tenant_other_z,v_restaurant_id,'Synthetic second hold zone');
  INSERT INTO public.allowed_capacities(restaurant_id,capacity) VALUES(v_other_restaurant_id,4);
  INSERT INTO public.table_inventory(id,restaurant_id,table_number,capacity,zone_id,category)
  VALUES(other_t,v_other_restaurant_id,'SYN-HOLD-OTHER',4,other_z,'dining');
  IF NOT public.is_holds_strict_conflicts_enabled() THEN
    RAISE EXCEPTION 'Strict hold enforcement is not installed' USING ERRCODE = 'NB001';
  END IF;

  SELECT id INTO h FROM public.create_table_hold_atomic(NULL,v_restaurant_id,z,ARRAY[t,t],start_time,end_time,clock_timestamp()+interval '120 seconds');
  IF (SELECT count(*) FROM public.table_hold_members WHERE hold_id=h)<>1
     OR NOT EXISTS (SELECT 1 FROM public.table_hold_windows WHERE hold_id=h AND table_id=t
       AND restaurant_id=v_restaurant_id AND hold_window=tstzrange(start_time,end_time,'[)')) THEN
    RAISE EXCEPTION 'Atomic create did not persist deduplicated members and exact projection' USING ERRCODE = 'NB001';
  END IF;
  SELECT count(*) INTO n FROM public.table_holds WHERE restaurant_id=v_restaurant_id;
  BEGIN
    PERFORM public.create_table_hold_atomic(b,v_restaurant_id,z,ARRAY[t],start_time,end_time,clock_timestamp()+interval '120 seconds');
    RAISE EXCEPTION 'Overlapping live hold was admitted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN exclusion_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM public.table_holds WHERE restaurant_id=v_restaurant_id)<>n THEN
    RAISE EXCEPTION 'Rejected atomic creation left an orphan header' USING ERRCODE = 'NB001';
  END IF;

  -- Direct assignment and maintenance writers must respect a live anonymous hold.
  BEGIN
    INSERT INTO public.booking_table_assignments(booking_id,table_id,start_at,end_at)
    VALUES(b,t,start_time,end_time);
    RAISE EXCEPTION 'Direct assignment took another live hold' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN exclusion_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.allocations(restaurant_id,resource_type,resource_id,"window",is_maintenance)
    VALUES(v_restaurant_id,'table',t,tstzrange(start_time,end_time,'[)'),true);
    RAISE EXCEPTION 'Maintenance allocation took a live hold' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN exclusion_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM public.table_hold_windows WHERE hold_id=h;
    RAISE EXCEPTION 'Direct writer erased the hold projection' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN insufficient_privilege THEN NULL;
  END;

  -- Expiry is checked using the database clock; no sweep or status mutation required.
  UPDATE public.table_holds SET expires_at=created_at+interval '1 microsecond' WHERE id=h;
  SELECT id INTO h2 FROM public.create_table_hold_atomic(NULL,v_restaurant_id,z,ARRAY[t],start_time,end_time,clock_timestamp()+interval '120 seconds');
  BEGIN
    UPDATE public.table_holds SET expires_at=clock_timestamp()+interval '120 seconds' WHERE id=h;
    RAISE EXCEPTION 'Expired hold renewed across a new live lease' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN exclusion_violation THEN NULL;
  END;
  PERFORM public.release_hold_and_emit(h,NULL);
  UPDATE public.table_holds SET end_at=end_time+interval '30 minutes',expires_at=clock_timestamp()+interval '180 seconds' WHERE id=h2;
  IF NOT EXISTS (SELECT 1 FROM public.table_hold_windows w JOIN public.table_holds header ON header.id=w.hold_id
      WHERE w.hold_id=h2 AND w.end_at=header.end_at AND w.expires_at=header.expires_at
        AND w.hold_window=tstzrange(header.start_at,header.end_at,'[)')) THEN
    RAISE EXCEPTION 'Header renewal did not synchronize projection' USING ERRCODE = 'NB001';
  END IF;
  UPDATE public.table_holds SET status='cancelled' WHERE id=h2;
  IF EXISTS (SELECT 1 FROM public.table_hold_windows WHERE hold_id=h2) THEN
    RAISE EXCEPTION 'Inactive hold retained a projected window' USING ERRCODE = 'NB001';
  END IF;
  PERFORM public.release_hold_and_emit(h2,NULL);

  BEGIN
    PERFORM public.create_table_hold_atomic(NULL,v_restaurant_id,same_tenant_other_z,ARRAY[t],start_time,end_time,clock_timestamp()+interval '120 seconds');
    RAISE EXCEPTION 'Table from another same-tenant zone was admitted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN check_violation THEN NULL;
  END;

  UPDATE public.table_inventory SET status='out_of_service' WHERE id=t AND restaurant_id=v_restaurant_id;
  BEGIN
    PERFORM public.create_table_hold_atomic(NULL,v_restaurant_id,z,ARRAY[t],start_time,end_time,clock_timestamp()+interval '120 seconds');
    RAISE EXCEPTION 'Out-of-service table was admitted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN check_violation THEN NULL;
  END;
  UPDATE public.table_inventory SET status='available' WHERE id=t AND restaurant_id=v_restaurant_id;

  UPDATE public.table_inventory SET active=false WHERE id=t AND restaurant_id=v_restaurant_id;
  BEGIN
    PERFORM public.create_table_hold_atomic(NULL,v_restaurant_id,z,ARRAY[t],start_time,end_time,clock_timestamp()+interval '120 seconds');
    RAISE EXCEPTION 'Inactive table was admitted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN check_violation THEN NULL;
  END;
  UPDATE public.table_inventory SET active=true WHERE id=t AND restaurant_id=v_restaurant_id;
  UPDATE public.zones SET active=false WHERE id=z AND restaurant_id=v_restaurant_id;
  BEGIN
    PERFORM public.create_table_hold_atomic(NULL,v_restaurant_id,z,ARRAY[t],start_time,end_time,clock_timestamp()+interval '120 seconds');
    RAISE EXCEPTION 'Inactive zone was admitted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN check_violation THEN NULL;
  END;
  UPDATE public.zones SET active=true WHERE id=z AND restaurant_id=v_restaurant_id;

  -- Cross-tenant references fail through both the canonical RPC and direct member writes.
  BEGIN
    PERFORM public.create_table_hold_atomic(NULL,v_restaurant_id,z,ARRAY[other_t],start_time,end_time,clock_timestamp()+interval '120 seconds');
    RAISE EXCEPTION 'Cross-tenant table was admitted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.create_table_hold_atomic(b,v_other_restaurant_id,other_z,ARRAY[other_t],start_time,end_time,clock_timestamp()+interval '120 seconds');
    RAISE EXCEPTION 'Cross-tenant booking was admitted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.create_table_hold_atomic(NULL,v_restaurant_id,other_z,ARRAY[t],start_time,end_time,clock_timestamp()+interval '120 seconds');
    RAISE EXCEPTION 'Cross-tenant zone was admitted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN insufficient_privilege THEN NULL;
  END;
  SELECT id INTO h FROM public.create_table_hold_atomic(b,v_restaurant_id,z,ARRAY[t],start_time,end_time,clock_timestamp()+interval '120 seconds');
  BEGIN
    INSERT INTO public.table_hold_members(hold_id,table_id) VALUES(h,other_t);
    RAISE EXCEPTION 'Direct member write admitted another tenant table' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN insufficient_privilege THEN NULL;
  END;

  -- Same-booking assignment is the legitimate confirmation path. Other holds are blocked.
  PERFORM public.assign_tables_atomic_v2(b,ARRAY[t],'hold-own-confirm',false,NULL,start_time,end_time);
  PERFORM public.release_hold_and_emit(h,NULL);
  BEGIN
    PERFORM public.create_table_hold_atomic(NULL,v_restaurant_id,z,ARRAY[t],start_time,end_time,clock_timestamp()+interval '120 seconds');
    RAISE EXCEPTION 'Hold overlapped another booking assignment' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN exclusion_violation THEN NULL;
  END;
  SELECT id INTO h FROM public.create_table_hold_atomic(b,v_restaurant_id,z,ARRAY[t],start_time,end_time,clock_timestamp()+interval '120 seconds');
  PERFORM public.cancel_booking_and_release_table_state(b,v_restaurant_id);
  IF EXISTS (SELECT 1 FROM public.table_holds WHERE id=h)
     OR EXISTS (SELECT 1 FROM public.table_hold_members WHERE hold_id=h)
     OR EXISTS (SELECT 1 FROM public.table_hold_windows WHERE hold_id=h)
     OR EXISTS (SELECT 1 FROM public.booking_table_assignments WHERE booking_id=b)
     OR EXISTS (SELECT 1 FROM public.allocations WHERE booking_id=b) THEN
    RAISE EXCEPTION 'Cancellation retained hold or assignment capacity' USING ERRCODE = 'NB001';
  END IF;
  BEGIN
    PERFORM public.create_table_hold_atomic(terminal_b,v_restaurant_id,z,ARRAY[t],start_time,end_time,clock_timestamp()+interval '120 seconds');
    RAISE EXCEPTION 'Terminal booking acquired a hold' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN check_violation THEN NULL;
  END;

  -- A direct header cannot remain without its members; deferred checking permits
  -- the canonical RPC and release to perform multiple statements atomically.
  BEGIN
    INSERT INTO public.table_holds(id,restaurant_id,zone_id,start_at,end_at,expires_at)
    VALUES(empty_h,v_restaurant_id,z,start_time,end_time,clock_timestamp()+interval '120 seconds');
    SET CONSTRAINTS strict_hold_requires_members IMMEDIATE;
    RAISE EXCEPTION 'Direct orphan header passed deferred validation' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN check_violation THEN NULL;
  END;
  IF EXISTS(SELECT 1 FROM public.table_holds WHERE id=empty_h) THEN
    RAISE EXCEPTION 'Rejected orphan header remained persisted' USING ERRCODE = 'NB001';
  END IF;
  IF has_function_privilege('anon','public.create_table_hold_atomic(uuid,uuid,uuid,uuid[],timestamptz,timestamptz,timestamptz,uuid,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.create_table_hold_atomic(uuid,uuid,uuid,uuid[],timestamptz,timestamptz,timestamptz,uuid,jsonb)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.create_table_hold_atomic(uuid,uuid,uuid,uuid[],timestamptz,timestamptz,timestamptz,uuid,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Atomic hold RPC privilege boundary is incorrect' USING ERRCODE = 'NB001';
  END IF;
  RAISE NOTICE 'atomic table hold enforcement regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'atomic table hold enforcement regression FAILED: %',SQLERRM;
    RAISE;
END;
$regression$;

ROLLBACK;
