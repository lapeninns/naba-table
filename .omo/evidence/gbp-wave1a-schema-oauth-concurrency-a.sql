\set ON_ERROR_STOP on
begin;
select id from public.restaurants
where id = '00000000-0000-0000-0000-000000000005'
for update;
select pg_sleep(2);
set local role service_role;
select id from public.complete_gbp_oauth_identity_v1(
  '00000000-0000-0000-0000-000000000005', repeat('a', 64), repeat('b', 64),
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000005', 'winner-a', 'a@example.com',
  'Winner A', 'gbp.1.legacy.iv.winnera.tag', array['scope-1'], 'Bearer',
  timezone('utc', now()), timezone('utc', now())
);
commit;
