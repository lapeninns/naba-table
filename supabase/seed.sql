-- Seed data for SajiloReserveX
-- Generated via tasks/restaurant-booking-seed

BEGIN;

-- Ensure predictable timezone math
SET TIME ZONE 'UTC';

-- Reset core booking data
TRUNCATE TABLE
  public.booking_versions,
  public.analytics_events,
  public.loyalty_point_events,
  public.bookings,
  public.customer_profiles,
  public.customers,
  public.restaurant_operating_hours,
  public.restaurant_service_periods,
  public.restaurant_memberships
RESTART IDENTITY CASCADE;

-- Remove restaurants we manage in this seed (bookings/truncate above already cascaded)
DELETE FROM public.restaurants
WHERE slug IN (
  'the-queen-elizabeth-pub',
  'old-crown-pub',
  'white-horse-pub',
  'the-corner-house-pub',
  'prince-of-wales-pub',
  'the-bell-sawtry',
  'the-railway-pub',
  'the-barley-mow-pub'
);

WITH restaurant_input AS (
  SELECT *
  FROM (VALUES
    (
      'the-queen-elizabeth-pub',
      '39cb1346-20fb-4fa2-b163-0230e1caf749',
      'The Queen Elizabeth Pub',
      140,
      'thequeen@lapeninns.com',
      '01553 824083',
      '32 Gayton Road, Kings Lynn, PE30 4EL',
      'Call us at 01553 824083 or email thequeen@lapeninns.com for reservations. Walk-ins welcome based on availability.'
    ),
    (
      'old-crown-pub',
      gen_random_uuid()::text,
      'Old Crown Pub',
      120,
      'oldcrown@lapeninns.com',
      '01223 276027',
      '89 High Street, Girton, Cambridge, CB3 0QQ',
      'Book your table by calling 01223 276027 or emailing oldcrown@lapeninns.com. Same-day reservations welcome.'
    ),
    (
      'white-horse-pub',
      gen_random_uuid()::text,
      'White Horse Pub',
      110,
      'whitehorse@lapeninns.com',
      '01223 277217',
      '89 High Street, Cambridge, CB3 0QD',
      'Reserve your table at 01223 277217 or whitehorse@lapeninns.com. Groups of 6+ please call ahead.'
    ),
    (
      'the-corner-house-pub',
      gen_random_uuid()::text,
      'The Corner House Pub',
      130,
      'cornerhouse@lapeninns.com',
      '01223 921122',
      '231 Newmarket Road, Cambridge, CB5 8JE',
      'Contact us at 01223 921122 or cornerhouse@lapeninns.com to book. Weekend reservations recommended.'
    ),
    (
      'prince-of-wales-pub',
      gen_random_uuid()::text,
      'Prince of Wales Pub',
      125,
      'theprince@lapeninns.com',
      '01234 822447',
      '8 Northampton Rd, Bedford, MK43 8PE',
      'Call 01234 822447 or email theprince@lapeninns.com for bookings. Mobile: 07588 864819 for urgent inquiries.'
    ),
    (
      'the-bell-sawtry',
      gen_random_uuid()::text,
      'The Bell Sawtry',
      115,
      'thebell@lapeninns.com',
      '01487 900149',
      '82 Green End Road, Sawtry, Huntingdon, PE28 5UY',
      'Book your table at 01487 900149 or thebell@lapeninns.com. Large parties please reserve in advance.'
    ),
    (
      'the-railway-pub',
      gen_random_uuid()::text,
      'The Railway Pub',
      135,
      'therailway@lapeninns.com',
      '01733 788345',
      '139 Station Road, Whittlesey, PE7 1UF',
      'Reserve at 01733 788345 or therailway@lapeninns.com. Walk-ins welcome, bookings ensure your table.'
    ),
    (
      'the-barley-mow-pub',
      gen_random_uuid()::text,
      'The Barley Mow Pub',
      128,
      'barleymow@lapeninns.com',
      '01480 450550',
      '42 Main St, Hartford, Huntingdon, PE29 1XU',
      'Call 01480 450550 or email barleymow@lapeninns.com to book. Mobile: 07399 835329 for urgent requests.'
    )
  ) AS r(slug, id_text, name, capacity, contact_email, contact_phone, address, booking_policy)
),
inserted_restaurants AS (
  INSERT INTO public.restaurants (id, name, slug, timezone, capacity, contact_email, contact_phone, address, booking_policy)
  SELECT
    id_text::uuid,
    name,
    slug,
    'Europe/London',
    capacity,
    contact_email,
    contact_phone,
    address,
    booking_policy
  FROM restaurant_input
  RETURNING id, slug, name
),
default_operating_hours AS (
  SELECT
    r.id AS restaurant_id,
    dow AS day_of_week,
    '12:00'::text AS opens_at,
    '23:00'::text AS closes_at
  FROM inserted_restaurants r
  CROSS JOIN generate_series(0, 6) AS dow
),
inserted_operating_hours AS (
  INSERT INTO public.restaurant_operating_hours (id, restaurant_id, day_of_week, opens_at, closes_at, is_closed, notes)
  SELECT
    gen_random_uuid(),
    restaurant_id,
    day_of_week,
    opens_at,
    closes_at,
    false,
    NULL
  FROM default_operating_hours
  RETURNING restaurant_id
),
service_period_templates AS (
  SELECT *
  FROM (VALUES
    ('Lunch', 'lunch', '12:00', '15:00'),
    ('Happy Hour', 'drinks', '15:00', '17:00'),
    ('Dinner', 'dinner', '17:00', '21:30'),
    ('Late Drinks', 'drinks', '21:30', '23:00')
  ) AS t(name, booking_option, start_time, end_time)
),
inserted_service_periods AS (
  INSERT INTO public.restaurant_service_periods (id, restaurant_id, name, booking_option, start_time, end_time, day_of_week)
  SELECT
    gen_random_uuid(),
    r.id,
    t.name,
    t.booking_option,
    t.start_time,
    t.end_time,
    NULL
  FROM inserted_restaurants r
  CROSS JOIN service_period_templates t
  RETURNING restaurant_id
),
customer_pool AS (
  SELECT
    r.id AS restaurant_id,
    r.slug,
    g AS customer_index,
    dense_rank() OVER (ORDER BY r.slug) AS restaurant_rank
  FROM inserted_restaurants r
  CROSS JOIN generate_series(1, 50) AS g
),
normalized_customer_pool AS (
  SELECT
    restaurant_id,
    slug,
    customer_index,
    lower(
      CASE
        WHEN customer_index = 1 THEN 'amanshresthaaaaa@gmail.com'
        ELSE format('%s-customer-%02s@seedsajilo.dev', slug, customer_index)
      END
    ) AS email,
    CASE
      WHEN customer_index = 1 THEN '079' || lpad((100000 + restaurant_rank)::text, 8, '0')
      ELSE '07' || lpad(((restaurant_rank * 1000) + customer_index + 2000)::text, 9, '0')
    END AS phone,
    CASE
      WHEN customer_index = 1 THEN initcap(replace(slug, '-', ' ')) || ' Regular'
      ELSE initcap(replace(slug, '-', ' ')) || ' Guest ' || lpad(customer_index::text, 2, '0')
    END AS full_name,
    CASE WHEN customer_index % 7 = 0 THEN true ELSE false END AS marketing_opt_in
  FROM customer_pool
),
inserted_customers AS (
  INSERT INTO public.customers (id, restaurant_id, full_name, email, phone, marketing_opt_in)
  SELECT
    gen_random_uuid(),
    restaurant_id,
    full_name,
    email,
    phone,
    marketing_opt_in
  FROM normalized_customer_pool
  RETURNING id, restaurant_id, full_name, email, phone, marketing_opt_in
),
indexed_customers AS (
  SELECT
    nc.restaurant_id,
    nc.customer_index,
    c.id,
    c.full_name,
    c.email,
    c.phone,
    c.marketing_opt_in,
    nc.slug
  FROM normalized_customer_pool nc
  JOIN inserted_customers c
    ON c.restaurant_id = nc.restaurant_id
   AND c.email = nc.email
),
booking_base AS (
  SELECT
    r.id AS restaurant_id,
    r.slug,
    gs AS booking_index,
    ((gs - 1) % 50) + 1 AS customer_slot,
    CASE
      WHEN gs <= 60 THEN (current_date - (61 - gs))::date
      WHEN gs <= 80 THEN current_date
      ELSE (current_date + (gs - 80))::date
    END AS booking_date,
    CASE
      WHEN gs <= 60 THEN
        CASE
          WHEN gs % 15 = 0 THEN 'no_show'::booking_status
          WHEN gs % 10 = 0 THEN 'cancelled'::booking_status
          ELSE 'completed'::booking_status
        END
      WHEN gs <= 80 THEN
        CASE
          WHEN gs % 4 = 0 THEN 'pending'::booking_status
          ELSE 'confirmed'::booking_status
        END
      ELSE
        CASE
          WHEN gs % 9 = 0 THEN 'pending_allocation'::booking_status
          WHEN gs % 7 = 0 THEN 'pending'::booking_status
          ELSE 'confirmed'::booking_status
        END
    END AS status,
    CASE ((gs - 1) % 4)
      WHEN 0 THEN 'dinner'::booking_type
      WHEN 1 THEN 'lunch'::booking_type
      WHEN 2 THEN 'drinks'::booking_type
      ELSE 'breakfast'::booking_type
    END AS booking_type,
    ((gs - 1) % 8) AS start_slot,
    ((gs - 1) % 5) + 2 AS party_size,
    gs
  FROM inserted_restaurants r
  CROSS JOIN generate_series(1, 150) AS gs
),
booking_enriched AS (
  SELECT
    bb.restaurant_id,
    bb.slug,
    bb.booking_index,
    bb.booking_date,
    bb.status,
    bb.booking_type,
    bb.party_size,
    bb.gs AS raw_index,
    ((time '11:30') + (bb.start_slot * interval '45 minutes'))::time AS start_time,
    (((time '11:30') + (bb.start_slot * interval '45 minutes')) + interval '90 minutes')::time AS end_time,
    (
      bb.booking_date::timestamp
      + interval '11 hours 30 minutes'
      + (bb.start_slot * interval '45 minutes')
    ) AS local_start_at
  FROM booking_base bb
),
booking_payload AS (
  SELECT
    b.restaurant_id,
    c.id AS customer_id,
    c.full_name,
    c.email,
    c.phone,
    b.booking_index,
    b.booking_date,
    b.status,
    b.booking_type,
    CASE (b.booking_index % 6)
      WHEN 0 THEN 'window'::seating_preference_type
      WHEN 1 THEN 'any'::seating_preference_type
      WHEN 2 THEN 'indoor'::seating_preference_type
      WHEN 3 THEN 'outdoor'::seating_preference_type
      WHEN 4 THEN 'quiet'::seating_preference_type
      ELSE 'booth'::seating_preference_type
    END AS seating_preference,
    b.party_size,
    b.start_time,
    b.end_time,
    (b.local_start_at AT TIME ZONE 'Europe/London') AS start_at,
    (b.local_start_at + interval '90 minutes') AT TIME ZONE 'Europe/London' AS end_at,
    upper(left(regexp_replace(b.slug, '[^a-z]', '', 'g'), 3)) || '-' || b.restaurant_id || '-' || lpad(b.booking_index::text, 4, '0') AS reference,
    c.marketing_opt_in,
    jsonb_build_object(
      'seeded', true,
      'source', 'supabase/seed.sql',
      'sequence', b.booking_index,
      'restaurant_slug', b.slug
    ) AS details,
    c.slug AS customer_slug
  FROM booking_enriched b
  JOIN booking_base bb
    ON bb.restaurant_id = b.restaurant_id
   AND bb.booking_index = b.booking_index
  JOIN indexed_customers c
    ON c.restaurant_id = bb.restaurant_id
   AND c.customer_index = bb.customer_slot
),
inserted_bookings AS (
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
    format('Seeded booking %s for %s', booking_index, customer_slug),
    reference,
    'seed.sql',
    booking_type,
    details,
    marketing_opt_in
  FROM booking_payload
  ORDER BY restaurant_id, booking_index
  RETURNING id, restaurant_id, customer_id, start_at, status, party_size
)
INSERT INTO public.customer_profiles (
  customer_id,
  first_booking_at,
  last_booking_at,
  total_bookings,
  total_covers,
  total_cancellations,
  marketing_opt_in,
  updated_at,
  notes
)
SELECT
  c.id,
  MIN(b.start_at),
  MAX(b.start_at),
  COUNT(*),
  SUM(b.party_size),
  COUNT(*) FILTER (WHERE b.status = 'cancelled'),
  c.marketing_opt_in,
  NOW(),
  CASE
    WHEN c.email = 'amanshresthaaaaa@gmail.com' THEN 'VIP guest seeded via supabase/seed.sql'
    ELSE NULL
  END
FROM inserted_customers c
JOIN inserted_bookings b
  ON b.customer_id = c.id
GROUP BY c.id, c.marketing_opt_in, c.email;

COMMIT;
