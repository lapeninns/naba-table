-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
BEGIN;
INSERT INTO public.restaurant_external_profiles
  (id,restaurant_id,provider,external_account_id,external_profile_id,external_location_id,connection_generation,consent_epoch)
VALUES
  ('00000000-0000-4000-8000-00000000b001','00000000-0000-4000-8000-00000000a001','google_business_profile','test-account','test-profile','test-location',1,1),
  ('00000000-0000-4000-8000-00000000b002','00000000-0000-4000-8000-00000000a002','google_business_profile','other-account','other-profile','other-location',1,1);
INSERT INTO public.gbp_write_policy_config_v1
  (backup_window_days,proven_content_ttl_days,policy_version,renderer_version,approved_by_user_id,approved_at)
VALUES (7,22,'synthetic-menu-policy','synthetic-menu-renderer','00000000-0000-4000-8000-00000000a001',now())
ON CONFLICT (provider) DO UPDATE SET
  backup_window_days=excluded.backup_window_days,proven_content_ttl_days=excluded.proven_content_ttl_days,
  policy_version=excluded.policy_version,renderer_version=excluded.renderer_version,
  approved_by_user_id=excluded.approved_by_user_id,approved_at=excluded.approved_at;
INSERT INTO public.gbp_write_readiness_evidence_v1
  (policy_version,renderer_version,backup_window_days,live_content_ttl_days,backup_retention_verified_at,
   backup_restore_verified_at,pitr_verified_at,policy_approved_at,transformed_content_approved_at,issued_by_user_id,valid_until)
VALUES ('synthetic-menu-policy','synthetic-menu-renderer',7,22,now(),null,now(),now(),now(),
  '00000000-0000-4000-8000-00000000a001',now()+interval '1 day');

SET LOCAL ROLE service_role;
DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_profile_id constant uuid := '00000000-0000-4000-8000-00000000b001';
  first_row public.restaurant_gbp_food_menu_snapshots;
  second_row public.restaurant_gbp_food_menu_snapshots;
BEGIN
  first_row := public.persist_gbp_food_menu_projection_v1(v_restaurant_id,v_profile_id,'manual',null,'{"menus":[]}',repeat('a',64),null);
  second_row := public.persist_gbp_food_menu_projection_v1(v_restaurant_id,v_profile_id,'manual',null,'{"menus":[]}',repeat('a',64),null);
  IF first_row.id <> second_row.id OR first_row.snapshot_kind <> 'nabatable_projection' THEN
    RAISE EXCEPTION 'Projection retry did not deduplicate' USING ERRCODE = 'NB001';
  END IF;
  BEGIN
    PERFORM public.persist_gbp_food_menu_projection_v1(v_restaurant_id,'00000000-0000-4000-8000-00000000b002','manual',null,'{}',repeat('b',64),null);
    RAISE EXCEPTION 'Cross-tenant profile accepted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.persist_gbp_food_menu_projection_v1(v_restaurant_id,v_profile_id,'manual',null,'{}',repeat('b',64),'00000000-0000-4000-8000-00000000a002');
    RAISE EXCEPTION 'Non-member actor accepted' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.restaurant_gbp_food_menu_snapshots (restaurant_id,provider,snapshot_kind,source)
    VALUES (v_restaurant_id,'google_business_profile','google_pull','manual');
    RAISE EXCEPTION 'Direct provider snapshot insert allowed' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN insufficient_privilege THEN NULL;
  END;
  first_row := public.persist_gbp_food_menu_snapshot_v1(v_restaurant_id,v_profile_id,'test-account','test-profile','test-location',1,1,
    '00000000-0000-4000-8000-00000000e101','manual',null,'{"menus":[]}',null,now());
  second_row := public.persist_gbp_food_menu_snapshot_v1(v_restaurant_id,v_profile_id,'test-account','test-profile','test-location',1,1,
    '00000000-0000-4000-8000-00000000e102','manual',null,'{"menus":[]}',null,now());
  IF first_row.id = second_row.id OR first_row.snapshot_hash <> second_row.snapshot_hash THEN
    RAISE EXCEPTION 'Fresh equal provider observations must have separate snapshots' USING ERRCODE = 'NB001';
  END IF;
  IF (SELECT count(*) FROM public.gbp_content_lineage_v1 WHERE source_row_id IN (first_row.id,second_row.id)) <> 2 THEN
    RAISE EXCEPTION 'Provider observation lineage missing' USING ERRCODE = 'NB001';
  END IF;
  IF has_function_privilege('authenticated','public.persist_gbp_food_menu_projection_v1(uuid,uuid,text,text,jsonb,text,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.persist_gbp_food_menu_projection_v1(uuid,uuid,text,text,jsonb,text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Projection RPC exposed to client roles' USING ERRCODE = 'NB001';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'GBP menu projection regression FAILED: %', SQLERRM;
    RAISE;
END;
$regression$;
ROLLBACK;
