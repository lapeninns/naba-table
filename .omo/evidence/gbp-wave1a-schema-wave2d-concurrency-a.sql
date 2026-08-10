\set ON_ERROR_STOP on
set role service_role;
begin;
select id, claimed_by from public.claim_gbp_terminal_notices_v1(
  'wave2d-worker-a', 1, 60, timezone('utc', now())
);
select pg_sleep(2);
commit;
