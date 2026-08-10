\set ON_ERROR_STOP on
begin;
set role service_role;
select id, lease_token, attempt_count
from public.claim_gbp_core_changes_v2('concurrent-a', 1, 60);
select pg_sleep(2);
commit;
