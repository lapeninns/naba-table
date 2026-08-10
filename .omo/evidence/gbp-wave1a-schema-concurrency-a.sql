\set ON_ERROR_STOP on
begin;
select id from public.restaurant_external_profiles
where id = '10000000-0000-0000-0000-000000000001'
for update;
select pg_sleep(2);
select count(*) from public.claim_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
  'location-1', 1, 1, '40000000-0000-0000-0000-000000000002',
  array['30000000-0000-0000-0000-000000000002']::uuid[], repeat('b', 64),
  array[repeat('a', 64)], array[repeat('8', 64)], array[repeat('9', 64)],
  array[repeat('a', 64)], 'policy-1', 'renderer-1',
  '50000000-0000-0000-0000-000000000010'
);
commit;
