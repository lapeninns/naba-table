<contents of seed-today-bookings.sql>
-- Seed 50 bookings for today
-- Restaurant ID: 259590fb-fd34-4a12-a346-f6557acc4e16
-- Migration: Runs every time db push is executed
-- Note: This will delete existing bookings for today before creating new ones

-- Ensure predictable timezone math
SET TIME ZONE 'UTC';

-- Delete existing seeded bookings for today to ensure idempotency
DELETE FROM public.bookings
WHERE restaurant_id = '259590fb-fd34-4a12-a346-f6557acc4e16'
  AND booking_date = CURRENT_DATE
  AND source = 'seed-today';

-- Generate 50 customers first (if they don't exist)
WITH customer_data AS (
  SELECT
    '259590fb-fd34-4a12-a346-f6557acc4e16'::uuid AS restaurant_id,
    gs AS idx,
    'Customer ' || gs AS full_name,
    'customer' || gs || '@example.com' AS email,
    '+44' || (7000000000 + gs)::text AS phone,
    CASE WHEN gs % 3 = 0 THEN true ELSE false END AS marketing_opt_in
  FROM generate_series(1, 50) AS gs
),
inserted_customers AS (
  INSERT INTO public.customers (
    restaurant_id,
    full_name,
    email,
    phone,
    marketing_opt_in
  )
  SELECT
    restaurant_id,
    full_name,
    email,
    phone,
    marketing_opt_in
  FROM customer_data
  ON CONFLICT (restaurant_id, email_normalized) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        marketing_opt_in = EXCLUDED.marketing_opt_in
  RETURNING id, full_name, email, phone, marketing_opt_in
),
customer_lookup AS (
  SELECT
    ROW_NUMBER() OVER (ORDER BY id) AS idx,
    id,
    full_name,
    email,
    phone,
    marketing_opt_in
  FROM inserted_customers
),
booking_base AS (
  SELECT
    '259590fb-fd34-4a12-a346-f6557acc4e16'::uuid AS restaurant_id,
    gs AS booking_idx,
    CURRENT_DATE AS booking_date,
    -- Distribute bookings across different time slots
    CASE ((gs - 1) % 8)
      WHEN 0 THEN '11:30'::time
      WHEN 1 THEN '12:15'::time
      WHEN 2 THEN '13:00'::time
      WHEN 3 THEN '14:00'::time
      WHEN 4 THEN '17:30'::time
      WHEN 5 THEN '18:30'::time
      WHEN 6 THEN '19:30'::time
      ELSE '20:30'::time
    END AS start_time,
    -- Party size between 2 and 6
    ((gs - 1) % 5) + 2 AS party_size,
    -- Booking type distribution
    CASE ((gs - 1) % 4)
      WHEN 0 THEN 'dinner'::booking_type
      WHEN 1 THEN 'lunch'::booking_type
      WHEN 2 THEN 'dinner'::booking_type
      ELSE 'lunch'::booking_type
    END AS booking_type,
    -- Seating preference
    CASE ((gs - 1) % 6)
      WHEN 0 THEN 'window'::seating_preference_type
      WHEN 1 THEN 'any'::seating_preference_type
      WHEN 2 THEN 'indoor'::seating_preference_type
      WHEN 3 THEN 'outdoor'::seating_preference_type
      WHEN 4 THEN 'quiet'::seating_preference_type
      ELSE 'booth'::seating_preference_type
    END AS seating_preference,
    -- Status distribution (mostly confirmed, some pending)
    CASE
      WHEN gs % 10 = 0 THEN 'pending'::booking_status
      WHEN gs % 7 = 0 THEN 'pending_allocation'::booking_status
      ELSE 'confirmed'::booking_status
    END AS status
  FROM generate_series(1, 50) AS gs
),
booking_enriched AS (
  SELECT
    bb.*,
    bb.start_time + interval '90 minutes' AS end_time,
    (
      bb.booking_date::timestamp
      + bb.start_time::interval
    ) AT TIME ZONE 'UTC' AS start_at,
    (
      bb.booking_date::timestamp
      + bb.start_time::interval
      + interval '90 minutes'
    ) AT TIME ZONE 'UTC' AS end_at
  FROM booking_base bb
),
booking_with_customers AS (
  SELECT
    b.*,
    c.id AS customer_id,
    c.full_name,
    c.email,
    c.phone,
    c.marketing_opt_in,
    'TDY-' || UPPER(SUBSTRING(b.restaurant_id::text, 1, 8)) || '-' || LPAD(b.booking_idx::text, 4, '0') AS reference
  FROM booking_enriched b
  JOIN customer_lookup c ON c.idx = b.booking_idx
)
INSERT INTO public.bookings (
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
  booking_type,
  details,
  marketing_opt_in
)
SELECT
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
  full_name,
  email,
  phone,
  'Today booking #' || booking_idx || ' - Seeded on ' || CURRENT_DATE::text,
  reference,
  'seed-today',
  booking_type,
  jsonb_build_object(
    'seeded', true,
    'source', 'migration-seed',
    'sequence', booking_idx,
    'created_date', CURRENT_DATE
  ),
  marketing_opt_in
FROM booking_with_customers;
