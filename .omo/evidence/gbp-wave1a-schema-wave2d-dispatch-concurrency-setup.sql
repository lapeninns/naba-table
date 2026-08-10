\set ON_ERROR_STOP on
set role service_role;
select id, lease_token from public.claim_gbp_terminal_notices_v1(
  'truth-dispatch-race', 1, 60, timezone('utc', now())
);
