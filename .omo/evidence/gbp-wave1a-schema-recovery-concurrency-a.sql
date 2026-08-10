\set ON_ERROR_STOP on
set role service_role;
select count(*) as recovered_a
from public.recover_stale_gbp_dispatched_grants_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'account-new', 'profile-new', 'location-new', 2, 2,
  timezone('utc', now()) - interval '30 minutes', 1, timezone('utc', now())
);
