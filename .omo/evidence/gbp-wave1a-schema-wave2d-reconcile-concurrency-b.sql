\set ON_ERROR_STOP on
set role service_role;
select id, grant_id from public.reconcile_missing_gbp_terminal_notices_v1(
  1, timezone('utc', now())
);
