\echo 'Running tenant RLS tests (bookings, audit_logs)'

BEGIN;

SET client_min_messages TO WARNING;

SELECT plan(12);

-- =========================================================================
-- Test setup
-- =========================================================================

-- Constants for deterministic IDs used throughout the test run.
WITH upsert_restaurants AS (
  INSERT INTO public.restaurants (id, name, slug, timezone, capacity)
  VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Test Tenant Alpha', 'tenant-alpha', 'Europe/London', 50),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Test Tenant Beta',  'tenant-beta',  'Europe/London', 75)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
)
SELECT ok(count(*) = 2, 'Upserted tenants alpha & beta') FROM upsert_restaurants;

-- Ensure dependent tables have expected rows for both tenants.
WITH table_seed AS (
  INSERT INTO public.restaurant_tables (id, restaurant_id, label, capacity, seating_type)
  VALUES
    ('aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Alpha-Table-1', 4, 'indoor'),
    ('bbbb1111-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Beta-Table-1', 4, 'indoor')
  ON CONFLICT (id) DO UPDATE SET capacity = EXCLUDED.capacity
  RETURNING id
)
SELECT ok(count(*) = 2, 'Seeded reference tables for both tenants') FROM table_seed;

DELETE FROM public.bookings WHERE reference IN ('TENANT-ALPHA', 'TENANT-BETA');
DELETE FROM public.audit_logs WHERE metadata ? 'test_case';

INSERT INTO public.bookings (
  id,
  restaurant_id,
  table_id,
  booking_date,
  start_time,
  end_time,
  party_size,
  booking_type,
  seating_preference,
  status,
  customer_name,
  customer_email,
  customer_phone,
  reference,
  marketing_opt_in
) VALUES
  ('aaaa2222-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '2025-06-01', '19:00', '21:00', 2, 'dinner', 'indoor', 'confirmed', 'Alpha Tester', 'alpha@example.com', '+441111111', 'TENANT-ALPHA', false),
  ('bbbb2222-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'bbbb1111-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '2025-06-01', '20:00', '22:00', 4, 'dinner', 'indoor', 'confirmed', 'Beta Tester', 'beta@example.com', '+442222222', 'TENANT-BETA', false)
ON CONFLICT (id) DO UPDATE SET updated_at = now();

INSERT INTO public.audit_logs (id, actor, action, entity, entity_id, metadata)
VALUES
  (900001, 'system', 'booking.created', 'booking', 'aaaa2222-aaaa-4aaa-8aaa-aaaaaaaaaaa1', jsonb_build_object('restaurant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'test_case', 'tenant_rls')),
  (900002, 'system', 'booking.created', 'booking', 'bbbb2222-bbbb-4bbb-8bbb-bbbbbbbbbbb2', jsonb_build_object('restaurant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'test_case', 'tenant_rls'))
ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata;

SELECT ok(true, 'Prepared bookings and audit log fixtures');

-- =========================================================================
-- Service-role visibility should include all tenants
-- =========================================================================

SET LOCAL ROLE service_role;
PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

SELECT is(
  (SELECT COUNT(*) FROM public.bookings WHERE reference IN ('TENANT-ALPHA', 'TENANT-BETA')),
  2::bigint,
  'service_role can see bookings across tenants'
);

SELECT is(
  (SELECT COUNT(*) FROM public.audit_logs WHERE metadata ->> 'test_case' = 'tenant_rls'),
  2::bigint,
  'service_role can see audit logs across tenants'
);

RESET ROLE;
PERFORM set_config('request.jwt.claims', NULL, true);

-- =========================================================================
-- Authenticated user scoped to tenant alpha
-- =========================================================================

SET LOCAL ROLE authenticated;
PERFORM set_config('request.jwt.claims', json_build_object(
  'role', 'authenticated',
  'tenant_ids', json_build_array('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
)::text, true);

SELECT is(
  (SELECT COUNT(*) FROM public.bookings WHERE reference IN ('TENANT-ALPHA', 'TENANT-BETA')),
  1::bigint,
  'tenant alpha member only sees their tenant bookings'
);

SELECT is(
  (SELECT COUNT(*) FROM public.audit_logs WHERE metadata ->> 'test_case' = 'tenant_rls'),
  1::bigint,
  'tenant alpha member only sees their tenant audit logs'
);

SELECT throws_ok(
  $$INSERT INTO public.bookings (restaurant_id, booking_date, start_time, end_time, party_size, booking_type, seating_preference, status, customer_name, customer_email, customer_phone) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '2025-06-02', '18:00', '20:00', 2, 'dinner', 'indoor', 'confirmed', 'Intruder', 'intruder@example.com', '+443333333')$$,
  '42501',
  'tenant user cannot insert bookings directly'
);

RESET ROLE;
PERFORM set_config('request.jwt.claims', NULL, true);

-- =========================================================================
-- Authenticated user with unrelated tenant should see nothing
-- =========================================================================

SET LOCAL ROLE authenticated;
PERFORM set_config('request.jwt.claims', json_build_object(
  'role', 'authenticated',
  'tenant_ids', json_build_array('cccccccc-cccc-4ccc-8ccc-ccccccccccc3')
)::text, true);

SELECT is(
  (SELECT COUNT(*) FROM public.bookings WHERE reference IN ('TENANT-ALPHA', 'TENANT-BETA')),
  0::bigint,
  'unrelated tenant sees zero bookings'
);

SELECT is(
  (SELECT COUNT(*) FROM public.audit_logs WHERE metadata ->> 'test_case' = 'tenant_rls'),
  0::bigint,
  'unrelated tenant sees zero audit logs'
);

RESET ROLE;
PERFORM set_config('request.jwt.claims', NULL, true);

SELECT finish();
ROLLBACK;
