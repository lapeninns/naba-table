-- Synthetic regression fixtures for the SQL regression pack.
--
-- Executed by scripts/db/migrations/sql-regression.ts inside the same transaction as each
-- regression file, immediately after BEGIN, and discarded by the trailing ROLLBACK.
--
-- Rules:
--   * Every identifier is deterministic (see scripts/db/migrations/fixtures.ts) so a
--     regression file names the exact row it exercises. No file may select an arbitrary
--     existing record.
--   * Every row is scoped to one of the two synthetic restaurants below.
--   * Contact details are reserved synthetic values (.invalid domain, +44700000xxxx range).
--   * Nothing here may enqueue an external delivery. Transactional rollback undoes rows,
--     not SMS/WhatsApp/email messages; fixtures only create ledger rows that the mobile
--     dispatch workers never read because the transaction is never committed.
--
-- Fixture identifiers:
--   restaurant A          00000000-0000-4000-8000-00000000a001
--   restaurant B          00000000-0000-4000-8000-00000000a002
--   customer A            00000000-0000-4000-8000-00000000c001
--   zone A                00000000-0000-4000-8000-00000000d001
--   table A               00000000-0000-4000-8000-00000000e001
--   completed booking A   00000000-0000-4000-8000-00000000b001
--   confirmed booking A   00000000-0000-4000-8000-00000000b002

SET LOCAL app.capacity.post_assignment.enabled = 'off';

INSERT INTO public.restaurants (id, name, slug)
VALUES
  (
    '00000000-0000-4000-8000-00000000a001',
    'Synthetic regression restaurant A',
    'synthetic-regression-restaurant-a'
  ),
  (
    '00000000-0000-4000-8000-00000000a002',
    'Synthetic regression restaurant B',
    'synthetic-regression-restaurant-b'
  );

INSERT INTO public.customers (id, restaurant_id, full_name, email)
VALUES (
  '00000000-0000-4000-8000-00000000c001',
  '00000000-0000-4000-8000-00000000a001',
  'Synthetic fixture',
  'synthetic-regression@test.invalid'
);

INSERT INTO public.zones (id, restaurant_id, name)
VALUES (
  '00000000-0000-4000-8000-00000000d001',
  '00000000-0000-4000-8000-00000000a001',
  'Synthetic regression zone'
);

INSERT INTO public.allowed_capacities (restaurant_id, capacity)
VALUES ('00000000-0000-4000-8000-00000000a001', 4);

INSERT INTO public.table_inventory (
  id,
  restaurant_id,
  table_number,
  capacity,
  zone_id,
  category
) VALUES (
  '00000000-0000-4000-8000-00000000e001',
  '00000000-0000-4000-8000-00000000a001',
  'SYN-1',
  4,
  '00000000-0000-4000-8000-00000000d001',
  'dining'
);

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
  status,
  customer_name,
  customer_email,
  customer_phone,
  reference,
  checked_in_at,
  checked_out_at
) VALUES
  (
    '00000000-0000-4000-8000-00000000b001',
    '00000000-0000-4000-8000-00000000a001',
    '00000000-0000-4000-8000-00000000c001',
    DATE '2099-01-01',
    TIME '12:00',
    TIME '13:30',
    TIMESTAMPTZ '2099-01-01 12:00:00+00',
    TIMESTAMPTZ '2099-01-01 13:30:00+00',
    2,
    'completed',
    'Synthetic fixture',
    'synthetic-regression@test.invalid',
    '+447000000003',
    'SYN-COMPLETED',
    TIMESTAMPTZ '2099-01-01 12:01:00+00',
    TIMESTAMPTZ '2099-01-01 13:31:00+00'
  ),
  (
    '00000000-0000-4000-8000-00000000b002',
    '00000000-0000-4000-8000-00000000a001',
    '00000000-0000-4000-8000-00000000c001',
    DATE '2099-01-02',
    TIME '12:00',
    TIME '13:30',
    TIMESTAMPTZ '2099-01-02 12:00:00+00',
    TIMESTAMPTZ '2099-01-02 13:30:00+00',
    2,
    'confirmed',
    'Synthetic fixture',
    'synthetic-regression@test.invalid',
    '+447000000010',
    'SYN-CONFIRMED',
    NULL,
    NULL
  );
