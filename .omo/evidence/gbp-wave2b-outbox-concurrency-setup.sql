\set ON_ERROR_STOP on
update public.gbp_core_change_outbox_v1
set status = 'completed', completed_at = timezone('utc', now()),
    claimed_by = null, claimed_at = null, lease_expires_at = null,
    lease_token = null, dead_lettered_at = null
where id <> '81000000-0000-0000-0000-000000000003';
update public.gbp_core_change_outbox_v1
set status = 'pending', attempt_count = 0, max_attempts = 5,
    available_at = timezone('utc', now()), claimed_by = null, claimed_at = null,
    lease_expires_at = null, lease_token = null, completed_at = null,
    dead_lettered_at = null, last_error_code = null
where id = '81000000-0000-0000-0000-000000000003';
