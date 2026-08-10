\set ON_ERROR_STOP on
begin;
set role service_role;
select count(*) from public.issue_and_claim_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'account-new', 'profile-new', 'location-new', 2, 2,
  '41000000-0000-0000-0000-000000000090', repeat('9', 64),
  'policy-1', 'renderer-1', timezone('utc', now()),
  timezone('utc', now()) + interval '10 minutes',
  array[public.driver_gbp_grant_item(
    '31000000-0000-0000-0000-000000000090', 1, repeat('a', 64),
    array['title']::text[], 'location-new'
  )], '51000000-0000-0000-0000-000000000090'
);
select pg_sleep(2);
commit;
