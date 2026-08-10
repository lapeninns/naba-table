\set ON_ERROR_STOP on
set role service_role;
begin;
select (public.dispatch_gbp_terminal_notice_v1(
  restaurant_id, id, 'truth-dispatch-race', lease_token,
  'gbp-terminal:' || id::text || ':' || lease_token::text,
  timezone('utc', now())
)).status
from public.gbp_terminal_outcome_notices_v1
where status = 'claimed' and claimed_by = 'truth-dispatch-race';
select pg_sleep(2);
commit;
