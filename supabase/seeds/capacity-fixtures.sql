-- Deterministic capacity fixtures for allocator regression tests.
-- Creates dense/sparse adjacency graphs, overlapping bookings, and conflicting holds.
BEGIN;

SET LOCAL client_min_messages = warning;
SET LOCAL search_path = public;

-- ---------------------------------------------------------------------------
-- Fixture identifiers (UUID literals must remain stable for idempotency)
-- ---------------------------------------------------------------------------
WITH params AS (
  SELECT
    '11111111-2222-4333-8444-555555555555'::uuid AS restaurant_id,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001'::uuid AS dense_zone_id,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002'::uuid AS sparse_zone_id
)
SELECT 1;

-- Clean previous fixture data (safe to rerun)
DELETE FROM public.table_hold_members
WHERE hold_id IN (
  'dddddddd-eeee-4fff-8000-111111111001'::uuid,
  'dddddddd-eeee-4fff-8000-111111111002'::uuid
);

DELETE FROM public.table_holds
WHERE id IN (
  'dddddddd-eeee-4fff-8000-111111111001'::uuid,
  'dddddddd-eeee-4fff-8000-111111111002'::uuid
);

DELETE FROM public.booking_table_assignments
WHERE booking_id IN (
  'cccccccc-dddd-4eee-8fff-000000000001'::uuid,
  'cccccccc-dddd-4eee-8fff-000000000002'::uuid
);

DELETE FROM public.bookings
WHERE id IN (
  'cccccccc-dddd-4eee-8fff-000000000001'::uuid,
  'cccccccc-dddd-4eee-8fff-000000000002'::uuid,
  'cccccccc-dddd-4eee-8fff-000000000003'::uuid
);

DELETE FROM public.customers
WHERE id IN (
  'bbbbbbbb-cccc-4ddd-8eee-ffffffff0001'::uuid,
  'bbbbbbbb-cccc-4ddd-8eee-ffffffff0002'::uuid
);

DELETE FROM public.table_adjacencies
WHERE table_a IN (
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1001'::uuid,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1002'::uuid,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1003'::uuid,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1004'::uuid,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2001'::uuid,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2002'::uuid,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2003'::uuid
  )
   OR table_b IN (
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1001'::uuid,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1002'::uuid,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1003'::uuid,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1004'::uuid,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2001'::uuid,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2002'::uuid,
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2003'::uuid
  );

DELETE FROM public.table_inventory
WHERE id IN (
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1001'::uuid,
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1002'::uuid,
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1003'::uuid,
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1004'::uuid,
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2001'::uuid,
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2002'::uuid,
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2003'::uuid
);

DELETE FROM public.zones
WHERE id IN (
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001'::uuid,
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002'::uuid
);

DELETE FROM public.restaurants
WHERE id = '11111111-2222-4333-8444-555555555555'::uuid;

-- ---------------------------------------------------------------------------
-- Restaurant + zones
-- ---------------------------------------------------------------------------
INSERT INTO public.restaurants (
  id,
  name,
  slug,
  timezone,
  capacity,
  contact_email,
  contact_phone,
  address,
  booking_policy,
  reservation_interval_minutes,
  reservation_default_duration_minutes,
  reservation_last_seating_buffer_minutes,
  is_active,
  created_at,
  updated_at
)
VALUES (
  '11111111-2222-4333-8444-555555555555',
  'Capacity Fixture Lab',
  'capacity-fixture-lab',
  'UTC',
  48,
  'fixtures@example.com',
  '+15555555550',
  '1 Test Drive, Fixture City',
  'Allocator fixture dataset for automated regression.',
  15,
  90,
  120,
  true,
  timezone('utc', now()),
  timezone('utc', now())
);

INSERT INTO public.zones (id, restaurant_id, name, sort_order, created_at, updated_at)
VALUES
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001', '11111111-2222-4333-8444-555555555555', 'Dense Cluster', 0, timezone('utc', now()), timezone('utc', now())),
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002', '11111111-2222-4333-8444-555555555555', 'Sparse Chain', 1, timezone('utc', now()), timezone('utc', now()));

-- ---------------------------------------------------------------------------
-- Table inventory (dense clique + sparse chain)
-- ---------------------------------------------------------------------------
INSERT INTO public.table_inventory (
  id,
  restaurant_id,
  table_number,
  capacity,
  min_party_size,
  max_party_size,
  section,
  status,
  position,
  notes,
  created_at,
  updated_at,
  zone_id,
  category,
  seating_type,
  mobility,
  active
)
VALUES
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1001', '11111111-2222-4333-8444-555555555555', 'D-01', 4, 1, 6, 'Dense', 'available', NULL, 'Dense adjacency table 1', timezone('utc', now()), timezone('utc', now()), 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001', 'dining', 'standard', 'movable', true),
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1002', '11111111-2222-4333-8444-555555555555', 'D-02', 4, 1, 6, 'Dense', 'available', NULL, 'Dense adjacency table 2', timezone('utc', now()), timezone('utc', now()), 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001', 'dining', 'standard', 'movable', true),
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1003', '11111111-2222-4333-8444-555555555555', 'D-03', 4, 1, 6, 'Dense', 'available', NULL, 'Dense adjacency table 3', timezone('utc', now()), timezone('utc', now()), 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001', 'dining', 'standard', 'movable', true),
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1004', '11111111-2222-4333-8444-555555555555', 'D-04', 6, 2, 8, 'Dense', 'available', NULL, 'Dense adjacency table 4', timezone('utc', now()), timezone('utc', now()), 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001', 'dining', 'standard', 'movable', true),
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2001', '11111111-2222-4333-8444-555555555555', 'S-01', 2, 1, 2, 'Sparse', 'available', NULL, 'Sparse chain table 1', timezone('utc', now()), timezone('utc', now()), 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002', 'dining', 'standard', 'movable', true),
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2002', '11111111-2222-4333-8444-555555555555', 'S-02', 2, 1, 2, 'Sparse', 'available', NULL, 'Sparse chain table 2', timezone('utc', now()), timezone('utc', now()), 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002', 'dining', 'standard', 'movable', true),
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2003', '11111111-2222-4333-8444-555555555555', 'S-03', 4, 1, 4, 'Sparse', 'available', NULL, 'Sparse chain table 3', timezone('utc', now()), timezone('utc', now()), 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002', 'dining', 'standard', 'movable', true);

-- Dense adjacency (mix directed/undirected orientation to test query flag)
INSERT INTO public.table_adjacencies (table_a, table_b, created_at)
VALUES
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1001', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1002', timezone('utc', now())),
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1003', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1002', timezone('utc', now())),
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1003', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1004', timezone('utc', now())),
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1004', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1001', timezone('utc', now()));

-- Sparse adjacency (single-direction chain)
INSERT INTO public.table_adjacencies (table_a, table_b, created_at)
VALUES
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2001', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2002', timezone('utc', now())),
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2002', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee2003', timezone('utc', now()));

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
INSERT INTO public.customers (
  id,
  restaurant_id,
  full_name,
  email,
  phone,
  marketing_opt_in,
  auth_user_id,
  notes,
  created_at,
  updated_at
)
VALUES
  ('bbbbbbbb-cccc-4ddd-8eee-ffffffff0001', '11111111-2222-4333-8444-555555555555', 'Dense Graph Guest', 'dense.guest@example.com', '+15555550001', false, NULL, 'Fixture customer for dense stress tests', timezone('utc', now()), timezone('utc', now())),
  ('bbbbbbbb-cccc-4ddd-8eee-ffffffff0002', '11111111-2222-4333-8444-555555555555', 'Sparse Graph Guest', 'sparse.guest@example.com', '+15555550002', false, NULL, 'Fixture customer for sparse stress tests', timezone('utc', now()), timezone('utc', now()));

-- ---------------------------------------------------------------------------
-- Bookings (overlapping windows for dense scenario)
-- ---------------------------------------------------------------------------
INSERT INTO public.bookings (
  id,
  restaurant_id,
  customer_id,
  booking_date,
  start_time,
  end_time,
  start_at,
  end_at,
  party_size,
  seating_preference,
  status,
  customer_name,
  customer_email,
  customer_phone,
  notes,
  reference,
  source,
  created_at,
  updated_at,
  booking_type,
  idempotency_key,
  client_request_id,
  details,
  marketing_opt_in,
  loyalty_points_awarded
)
VALUES
  (
    'cccccccc-dddd-4eee-8fff-000000000001',
    '11111111-2222-4333-8444-555555555555',
    'bbbbbbbb-cccc-4ddd-8eee-ffffffff0001',
    '2025-01-20',
    '18:00:00',
    '20:00:00',
    '2025-01-20 18:00:00+00',
    '2025-01-20 20:00:00+00',
    6,
    'any',
    'confirmed',
    'Dense Graph Guest',
    'dense.guest@example.com',
    '+15555550001',
    'Primary dense booking',
    'CFX-DENSE-1',
    'api.fixture',
    timezone('utc', now()),
    timezone('utc', now()),
    'dinner',
    'fixture-dense-1',
    'fixture-request-dense-1',
    '{"channel":"seed.fixture"}'::jsonb,
    false,
    0
  ),
  (
    'cccccccc-dddd-4eee-8fff-000000000002',
    '11111111-2222-4333-8444-555555555555',
    'bbbbbbbb-cccc-4ddd-8eee-ffffffff0001',
    '2025-01-20',
    '19:00:00',
    '21:00:00',
    '2025-01-20 19:00:00+00',
    '2025-01-20 21:00:00+00',
    4,
    'any',
    'confirmed',
    'Dense Graph Guest',
    'dense.guest@example.com',
    '+15555550001',
    'Conflicting dense booking',
    'CFX-DENSE-2',
    'api.fixture',
    timezone('utc', now()),
    timezone('utc', now()),
    'dinner',
    'fixture-dense-2',
    'fixture-request-dense-2',
    '{"channel":"seed.fixture","note":"overlaps dense booking"}'::jsonb,
    false,
    0
  ),
  (
    'cccccccc-dddd-4eee-8fff-000000000003',
    '11111111-2222-4333-8444-555555555555',
    'bbbbbbbb-cccc-4ddd-8eee-ffffffff0002',
    '2025-01-20',
    '18:30:00',
    '19:30:00',
    '2025-01-20 18:30:00+00',
    '2025-01-20 19:30:00+00',
    2,
    'any',
    'confirmed',
    'Sparse Graph Guest',
    'sparse.guest@example.com',
    '+15555550002',
    'Sparse chain booking (no conflicts)',
    'CFX-SPARSE-1',
    'api.fixture',
    timezone('utc', now()),
    timezone('utc', now()),
    'dinner',
    'fixture-sparse-1',
    'fixture-request-sparse-1',
    '{"channel":"seed.fixture"}'::jsonb,
    false,
    0
  );

-- Table assignments to create overlapping usage
INSERT INTO public.booking_table_assignments (
  id,
  booking_id,
  table_id,
  slot_id,
  assigned_at,
  assigned_by,
  notes,
  created_at,
  updated_at,
  idempotency_key,
  merge_group_id
)
VALUES
  ('aaaa1111-bbbb-4ccc-8ddd-eeeeffff0001', 'cccccccc-dddd-4eee-8fff-000000000001', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1001', NULL, timezone('utc', now()), NULL, 'Fixture assignment', timezone('utc', now()), timezone('utc', now()), 'fixture-assignment-dense-1', NULL),
  ('aaaa1111-bbbb-4ccc-8ddd-eeeeffff0002', 'cccccccc-dddd-4eee-8fff-000000000001', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1002', NULL, timezone('utc', now()), NULL, 'Fixture assignment', timezone('utc', now()), timezone('utc', now()), 'fixture-assignment-dense-1', NULL),
  ('aaaa1111-bbbb-4ccc-8ddd-eeeeffff0003', 'cccccccc-dddd-4eee-8fff-000000000002', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1002', NULL, timezone('utc', now()), NULL, 'Conflicting assignment', timezone('utc', now()), timezone('utc', now()), 'fixture-assignment-dense-2', NULL),
  ('aaaa1111-bbbb-4ccc-8ddd-eeeeffff0004', 'cccccccc-dddd-4eee-8fff-000000000002', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1003', NULL, timezone('utc', now()), NULL, 'Conflicting assignment', timezone('utc', now()), timezone('utc', now()), 'fixture-assignment-dense-2', NULL);

-- ---------------------------------------------------------------------------
-- Holds (overlapping for strict conflict testing)
-- ---------------------------------------------------------------------------
INSERT INTO public.table_holds (
  id,
  restaurant_id,
  booking_id,
  zone_id,
  start_at,
  end_at,
  expires_at,
  created_by,
  created_at,
  updated_at,
  metadata
)
VALUES
  (
    'dddddddd-eeee-4fff-8000-111111111001',
    '11111111-2222-4333-8444-555555555555',
    'cccccccc-dddd-4eee-8fff-000000000001',
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001',
    '2025-01-20 17:55:00+00',
    '2025-01-20 20:00:00+00',
    '2025-01-20 18:05:00+00',
    NULL,
    timezone('utc', now()),
    timezone('utc', now()),
    '{"seed":"capacity-fixtures","kind":"primary"}'::jsonb
  ),
  (
    'dddddddd-eeee-4fff-8000-111111111002',
    '11111111-2222-4333-8444-555555555555',
    'cccccccc-dddd-4eee-8fff-000000000002',
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001',
    '2025-01-20 18:10:00+00',
    '2025-01-20 21:00:00+00',
    '2025-01-20 18:40:00+00',
    NULL,
    timezone('utc', now()),
    timezone('utc', now()),
    '{"seed":"capacity-fixtures","kind":"conflict"}'::jsonb
  );

INSERT INTO public.table_hold_members (id, hold_id, table_id, created_at)
VALUES
  ('feed1111-2222-4333-8444-555555555001', 'dddddddd-eeee-4fff-8000-111111111001', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1001', timezone('utc', now())),
  ('feed1111-2222-4333-8444-555555555002', 'dddddddd-eeee-4fff-8000-111111111001', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1002', timezone('utc', now())),
  ('feed1111-2222-4333-8444-555555555003', 'dddddddd-eeee-4fff-8000-111111111002', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1002', timezone('utc', now())),
  ('feed1111-2222-4333-8444-555555555004', 'dddddddd-eeee-4fff-8000-111111111002', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1003', timezone('utc', now()));

COMMIT;
