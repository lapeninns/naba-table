\set ON_ERROR_STOP on
set role service_role;
select id, lease_token, attempt_count
from public.claim_gbp_core_changes_v2('concurrent-b', 1, 60);
