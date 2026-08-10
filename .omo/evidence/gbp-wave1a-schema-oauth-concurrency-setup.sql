\set ON_ERROR_STOP on
set role service_role;
select id from public.create_gbp_oauth_attempt_v1(
  '00000000-0000-0000-0000-000000000005',
  '20000000-0000-0000-0000-000000000001', repeat('a', 64), repeat('b', 64),
  '/settings/restaurant/google-business-profile',
  timezone('utc', now()) + interval '10 minutes', null, null, null, null, 1, 1
);
