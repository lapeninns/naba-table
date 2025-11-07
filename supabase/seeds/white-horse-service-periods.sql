-- White Horse Pub (Waterbeach) - Restaurant seed only
-- Creates the restaurant entity with operating hours and service periods
-- Run remotely (see AGENTS instructions) via: psql "$SUPABASE_DB_URL" -f supabase/seeds/white-horse-service-periods.sql

BEGIN;

-- Insert or update the White Horse Pub restaurant
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
  gen_random_uuid(),
  'White Horse Pub',
  'white-horse-pub-waterbeach',
  'Europe/London',
  50,
  'info@whitehorsewaterbeach.co.uk',
  '01223 860000',
  'Waterbeach, Cambridge CB25 9JU',
  NULL,
  15,
  90,
  30,
  true,
  timezone('utc', now()),
  timezone('utc', now())
)
ON CONFLICT (slug) DO UPDATE
SET 
  name = EXCLUDED.name,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  address = EXCLUDED.address,
  updated_at = timezone('utc', now());

-- Delete existing operating hours for this restaurant
WITH target AS (
  SELECT id
  FROM public.restaurants
  WHERE slug = 'white-horse-pub-waterbeach'
  LIMIT 1
)
DELETE FROM public.restaurant_operating_hours
WHERE restaurant_id IN (SELECT id FROM target)
  AND effective_date IS NULL;

-- Insert operating hours
WITH target AS (
  SELECT id
  FROM public.restaurants
  WHERE slug = 'white-horse-pub-waterbeach'
  LIMIT 1
)
INSERT INTO public.restaurant_operating_hours (
  id,
  restaurant_id,
  day_of_week,
  opens_at,
  closes_at,
  is_closed,
  notes,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid() AS id,
  target.id,
  hours.day_of_week,
  hours.opens_at,
  hours.closes_at,
  false,
  NULL,
  timezone('utc', now()),
  timezone('utc', now())
FROM target
CROSS JOIN (
  VALUES
    (0, time '12:00', time '22:00'), -- Sunday
    (1, time '12:00', time '22:00'), -- Monday
    (2, time '12:00', time '22:00'), -- Tuesday
    (3, time '12:00', time '22:00'), -- Wednesday
    (4, time '12:00', time '22:00'), -- Thursday
    (5, time '12:00', time '23:00'), -- Friday
    (6, time '12:00', time '23:00')  -- Saturday
) AS hours(day_of_week, opens_at, closes_at);

-- Delete existing service periods
WITH target AS (
  SELECT id
  FROM public.restaurants
  WHERE slug = 'white-horse-pub-waterbeach'
  LIMIT 1
)
DELETE FROM public.restaurant_service_periods
WHERE restaurant_id IN (SELECT id FROM target);

-- Insert service periods
WITH target AS (
  SELECT id
  FROM public.restaurants
  WHERE slug = 'white-horse-pub-waterbeach'
  LIMIT 1
)
INSERT INTO public.restaurant_service_periods (
  id,
  restaurant_id,
  name,
  day_of_week,
  start_time,
  end_time,
  booking_option,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  target.id,
  sp.name,
  sp.day_of_week,
  sp.start_time,
  sp.end_time,
  sp.booking_option,
  timezone('utc', now()),
  timezone('utc', now())
FROM target
CROSS JOIN (
  VALUES
    -- Sunday (kitchen 12-21, drinks 12-22)
    ('Sunday Lunch',  0, time '12:00', time '15:00', 'lunch'),
    ('Sunday Dinner', 0, time '17:00', time '21:00', 'dinner'),
    ('Sunday Drinks', 0, time '12:00', time '22:00', 'drinks'),

    -- Monday–Thursday (kitchen 12-15 & 17-22, drinks 12-22)
    ('Weekday Lunch',  1, time '12:00', time '15:00', 'lunch'),
    ('Weekday Dinner', 1, time '17:00', time '22:00', 'dinner'),
    ('Weekday Drinks', 1, time '12:00', time '22:00', 'drinks'),

    ('Weekday Lunch',  2, time '12:00', time '15:00', 'lunch'),
    ('Weekday Dinner', 2, time '17:00', time '22:00', 'dinner'),
    ('Weekday Drinks', 2, time '12:00', time '22:00', 'drinks'),

    ('Weekday Lunch',  3, time '12:00', time '15:00', 'lunch'),
    ('Weekday Dinner', 3, time '17:00', time '22:00', 'dinner'),
    ('Weekday Drinks', 3, time '12:00', time '22:00', 'drinks'),

    ('Weekday Lunch',  4, time '12:00', time '15:00', 'lunch'),
    ('Weekday Dinner', 4, time '17:00', time '22:00', 'dinner'),
    ('Weekday Drinks', 4, time '12:00', time '22:00', 'drinks'),

    -- Friday (kitchen 12-15 & 17-22, drinks until close)
    ('Friday Lunch',  5, time '12:00', time '15:00', 'lunch'),
    ('Friday Dinner', 5, time '17:00', time '22:00', 'dinner'),
    ('Friday Drinks', 5, time '12:00', time '23:00', 'drinks'),

    -- Saturday (kitchen continuous 12-22)
    ('Saturday Lunch',  6, time '12:00', time '15:00', 'lunch'),
    ('Saturday Dinner', 6, time '17:00', time '22:00', 'dinner'),
    ('Saturday Drinks', 6, time '12:00', time '23:00', 'drinks')
) AS sp(name, day_of_week, start_time, end_time, booking_option);

-- Delete existing zones
WITH target AS (
  SELECT id
  FROM public.restaurants
  WHERE slug = 'white-horse-pub-waterbeach'
  LIMIT 1
)
DELETE FROM public.zones
WHERE restaurant_id IN (SELECT id FROM target);

-- Insert zones
WITH target AS (
  SELECT id
  FROM public.restaurants
  WHERE slug = 'white-horse-pub-waterbeach'
  LIMIT 1
)
INSERT INTO public.zones (
  id,
  restaurant_id,
  name,
  sort_order,
  area_type,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  target.id,
  z.name,
  z.sort_order,
  z.area_type::area_type,
  timezone('utc', now()),
  timezone('utc', now())
FROM target
CROSS JOIN (
  VALUES
    ('Main Bar',      1, 'indoor'),
    ('Dining Room',   2, 'indoor'),
    ('Garden',        3, 'outdoor')
) AS z(name, sort_order, area_type);

-- Insert allowed capacities (must be before tables due to FK constraint)
WITH target AS (
  SELECT id
  FROM public.restaurants
  WHERE slug = 'white-horse-pub-waterbeach'
  LIMIT 1
)
DELETE FROM public.allowed_capacities
WHERE restaurant_id IN (SELECT id FROM target);

WITH target AS (
  SELECT id
  FROM public.restaurants
  WHERE slug = 'white-horse-pub-waterbeach'
  LIMIT 1
)
INSERT INTO public.allowed_capacities (
  restaurant_id,
  capacity,
  created_at,
  updated_at
)
SELECT
  target.id,
  caps.capacity,
  timezone('utc', now()),
  timezone('utc', now())
FROM target
CROSS JOIN (VALUES (2), (4), (6), (8)) AS caps(capacity);

-- Delete existing tables
WITH target AS (
  SELECT id
  FROM public.restaurants
  WHERE slug = 'white-horse-pub-waterbeach'
  LIMIT 1
)
DELETE FROM public.table_inventory
WHERE restaurant_id IN (SELECT id FROM target);

-- Insert tables
WITH target AS (
  SELECT id
  FROM public.restaurants
  WHERE slug = 'white-horse-pub-waterbeach'
  LIMIT 1
),
zone_lookup AS (
  SELECT z.id, z.name, r.id as restaurant_id
  FROM public.zones z
  JOIN public.restaurants r ON r.id = z.restaurant_id
  WHERE r.slug = 'white-horse-pub-waterbeach'
)
INSERT INTO public.table_inventory (
  id,
  restaurant_id,
  zone_id,
  table_number,
  capacity,
  min_party_size,
  max_party_size,
  category,
  seating_type,
  mobility,
  status,
  active,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  zl.restaurant_id,
  zl.id,
  t.table_number,
  t.capacity,
  t.min_party_size,
  t.max_party_size,
  t.category::table_category,
  t.seating_type::table_seating_type,
  'movable'::table_mobility,
  'available'::table_status,
  true,
  timezone('utc', now()),
  timezone('utc', now())
FROM zone_lookup zl
CROSS JOIN LATERAL (
  VALUES
    -- Main Bar (zone 1) - 8 tables
    ('B1',  2, 1, 2, 'bar', 'standard'),
    ('B2',  2, 1, 2, 'bar', 'standard'),
    ('B3',  4, 2, 4, 'bar', 'standard'),
    ('B4',  4, 2, 4, 'bar', 'standard'),
    ('B5',  6, 4, 6, 'bar', 'standard'),
    ('B6',  6, 4, 6, 'bar', 'standard'),
    ('B7',  4, 2, 4, 'bar', 'high_top'),
    ('B8',  4, 2, 4, 'bar', 'high_top')
) AS t(table_number, capacity, min_party_size, max_party_size, category, seating_type)
WHERE zl.name = 'Main Bar'

UNION ALL

SELECT
  gen_random_uuid(),
  zl.restaurant_id,
  zl.id,
  t.table_number,
  t.capacity,
  t.min_party_size,
  t.max_party_size,
  t.category::table_category,
  t.seating_type::table_seating_type,
  'movable'::table_mobility,
  'available'::table_status,
  true,
  timezone('utc', now()),
  timezone('utc', now())
FROM zone_lookup zl
CROSS JOIN LATERAL (
  VALUES
    -- Dining Room (zone 2) - 12 tables
    ('D1',  2, 2, 2, 'dining', 'standard'),
    ('D2',  2, 2, 2, 'dining', 'standard'),
    ('D3',  2, 2, 2, 'dining', 'standard'),
    ('D4',  2, 2, 2, 'dining', 'standard'),
    ('D5',  4, 2, 4, 'dining', 'standard'),
    ('D6',  4, 2, 4, 'dining', 'standard'),
    ('D7',  4, 2, 4, 'dining', 'standard'),
    ('D8',  4, 2, 4, 'dining', 'standard'),
    ('D9',  6, 4, 6, 'dining', 'standard'),
    ('D10', 6, 4, 6, 'dining', 'standard'),
    ('D11', 8, 6, 8, 'dining', 'standard'),
    ('D12', 8, 6, 8, 'dining', 'standard')
) AS t(table_number, capacity, min_party_size, max_party_size, category, seating_type)
WHERE zl.name = 'Dining Room'

UNION ALL

SELECT
  gen_random_uuid(),
  zl.restaurant_id,
  zl.id,
  t.table_number,
  t.capacity,
  t.min_party_size,
  t.max_party_size,
  t.category::table_category,
  t.seating_type::table_seating_type,
  'movable'::table_mobility,
  'available'::table_status,
  true,
  timezone('utc', now()),
  timezone('utc', now())
FROM zone_lookup zl
CROSS JOIN LATERAL (
  VALUES
    -- Garden (zone 3) - 6 tables
    ('G1', 4, 2, 4, 'patio', 'standard'),
    ('G2', 4, 2, 4, 'patio', 'standard'),
    ('G3', 4, 2, 4, 'patio', 'standard'),
    ('G4', 6, 4, 6, 'patio', 'standard'),
    ('G5', 6, 4, 6, 'patio', 'standard'),
    ('G6', 8, 6, 8, 'patio', 'standard')
) AS t(table_number, capacity, min_party_size, max_party_size, category, seating_type)
WHERE zl.name = 'Garden';

COMMIT;
