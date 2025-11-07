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

COMMIT;
