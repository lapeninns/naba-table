\set ON_ERROR_STOP on
reset role;
update public.gbp_terminal_outcome_notices_v1
set status = 'pending', available_at = timezone('utc', now()),
    claimed_by = null, lease_token = null, lease_expires_at = null,
    delivered_at = null, failed_at = null
where event_id = 'grant-terminal-wave2d-1';
select count(*) as ready_count
from public.gbp_terminal_outcome_notices_v1
where event_id = 'grant-terminal-wave2d-1' and status = 'pending';
