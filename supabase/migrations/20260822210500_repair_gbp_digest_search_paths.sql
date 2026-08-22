do $migration$
declare
  v_function_names constant text[] := array[
    'cancel_gbp_claimed_bundle_before_dispatch_v1',
    'claim_gbp_write_bundle_v1',
    'dispatch_gbp_write_bundle_v1',
    'dispatch_gbp_write_grant_v1',
    'enqueue_gbp_core_change_v1',
    'enqueue_gbp_operating_hours_change_v1',
    'enqueue_gbp_restaurants_change_v1',
    'enqueue_gbp_service_period_change_v1',
    'finalize_gbp_write_bundle_v1',
    'finalize_gbp_write_grant_v1',
    'persist_gbp_dual_sync_snapshot_run_v1',
    'persist_gbp_external_profile_snapshot_v1',
    'persist_gbp_food_menu_snapshot_v1',
    'record_gbp_grant_created_v1',
    'recover_stale_gbp_dispatched_grants_v1',
    'set_gbp_readiness_hash_v1'
  ];
  v_function regprocedure;
  v_function_count integer;
begin
  select count(*)
  into v_function_count
  from pg_catalog.pg_proc routine
  join pg_catalog.pg_namespace namespace on namespace.oid = routine.pronamespace
  where namespace.nspname = 'public'
    and routine.proname = any (v_function_names);

  if v_function_count <> cardinality(v_function_names) then
    raise exception using
      errcode = '55000',
      message = format(
        'expected %s GBP digest functions, found %s',
        cardinality(v_function_names),
        v_function_count
      );
  end if;

  for v_function in
    select routine.oid::regprocedure
    from pg_catalog.pg_proc routine
    join pg_catalog.pg_namespace namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = any (v_function_names)
  loop
    execute format(
      'alter function %s set search_path = public, extensions',
      v_function
    );
  end loop;
end;
$migration$;
