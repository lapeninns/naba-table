\set ON_ERROR_STOP on
set role service_role;
select id from public.complete_gbp_oauth_identity_v1(
  '00000000-0000-0000-0000-000000000005', repeat('a', 64), repeat('b', 64),
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000006', 'loser-b', 'b@example.com',
  'Loser B', 'gbp.1.legacy.iv.loserb.tag', array['scope-1'], 'Bearer',
  timezone('utc', now()), timezone('utc', now())
);
