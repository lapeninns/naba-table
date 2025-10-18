-- Seed data for SajiloReserveX
-- Generated via tasks/seed-eight-pubs-dataset-20251011-1240

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
WHERE id IN (
  '259590fb-fd34-4a12-a346-f6557acc4e16',
  '357d90b5-ce94-4a0b-bc0e-2e3cc38f3571',
  '39cb1346-20fb-4fa2-b163-0230e1caf749',
  'a23976e4-fef1-4c3a-98eb-fde2718d8253',
  'bcd27051-65ad-4d11-b0cf-67604dc37b35',
  'd7d26f37-a8fb-4116-9a24-0f3684d18ebe',
  'e24a1635-62d9-4290-ab8c-fe19862b3edd',
  'f19562bf-7ccc-4840-a95f-d9c2259397f4'
);

WITH constants AS (
  SELECT
    current_date AS seed_today,
    (date_trunc('month', current_date) + interval '1 month - 1 day')::date AS month_end,
    100 AS past_count,
    40 AS today_count,
    120 AS future_count
),
restaurant_input AS (
  SELECT *
  FROM (VALUES
    (
      'the-railway-pub',
      '259590fb-fd34-4a12-a346-f6557acc4e16'::uuid,
      'The Railway Pub',
      135,
      'therailway@lapeninns.com',
      '01733 788345',
      '139 Station Road, Whittlesey, PE7 1UF',
      'Reserve at 01733 788345 or therailway@lapeninns.com. Walk-ins welcome, bookings ensure your table.',
      'Europe/London',
      15,
      90,
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00',
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00'
    ),
    (
      'the-bell-sawtry',
      '357d90b5-ce94-4a0b-bc0e-2e3cc38f3571'::uuid,
      'The Bell Sawtry',
      115,
      'thebell@lapeninns.com',
      '01487 900149',
      '82 Green End Road, Sawtry, Huntingdon, PE28 5UY',
      'Book your table at 01487 900149 or thebell@lapeninns.com. Large parties please reserve in advance.',
      'Europe/London',
      15,
      90,
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00',
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00'
    ),
    (
      'the-queen-elizabeth-pub',
      '39cb1346-20fb-4fa2-b163-0230e1caf749'::uuid,
      'The Queen Elizabeth Pub',
      140,
      'thequeen@lapeninns.com',
      '01553 824083',
      '32 Gayton Road, Kings Lynn, PE30 4EL',
      'Call us at 01553 824083 or email thequeen@lapeninns.com for reservations. Walk-ins welcome based on availability.',
      'Europe/London',
      15,
      90,
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00',
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00'
    ),
    (
      'the-corner-house-pub',
      'a23976e4-fef1-4c3a-98eb-fde2718d8253'::uuid,
      'The Corner House Pub',
      130,
      'cornerhouse@lapeninns.com',
      '01223 921122',
      '231 Newmarket Road, Cambridge, CB5 8JE',
      'Contact us at 01223 921122 or cornerhouse@lapeninns.com to book. Weekend reservations recommended.',
      'Europe/London',
      15,
      90,
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00',
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00'
    ),
    (
      'the-barley-mow-pub',
      'bcd27051-65ad-4d11-b0cf-67604dc37b35'::uuid,
      'The Barley Mow Pub',
      128,
      'barleymow@lapeninns.com',
      '01480 450550',
      '42 Main St, Hartford, Huntingdon, PE29 1XU',
      'Call 01480 450550 or email barleymow@lapeninns.com to book. Mobile: 07399 835329 for urgent requests.',
      'Europe/London',
      15,
      90,
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00',
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00'
    ),
    (
      'prince-of-wales-pub',
      'd7d26f37-a8fb-4116-9a24-0f3684d18ebe'::uuid,
      'Prince of Wales Pub',
      125,
      'theprince@lapeninns.com',
      '01234 822447',
      '8 Northampton Rd, Bedford, MK43 8PE',
      'Call 01234 822447 or email theprince@lapeninns.com for bookings. Mobile: 07588 864819 for urgent inquiries.',
      'Europe/London',
      15,
      90,
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00',
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00'
    ),
    (
      'old-crown-pub',
      'e24a1635-62d9-4290-ab8c-fe19862b3edd'::uuid,
      'Old Crown Pub',
      120,
      'oldcrown@lapeninns.com',
      '01223 276027',
      '89 High Street, Girton, Cambridge, CB3 0QQ',
      'Book your table by calling 01223 276027 or emailing oldcrown@lapeninns.com. Same-day reservations welcome.',
      'Europe/London',
      15,
      90,
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00',
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00'
    ),
    (
      'white-horse-pub',
      'f19562bf-7ccc-4840-a95f-d9c2259397f4'::uuid,
      'White Horse Pub',
      110,
      'whitehorse@lapeninns.com',
      '01223 277217',
      '89 High Street, Cambridge, CB3 0QD',
      'Reserve your table at 01223 277217 or whitehorse@lapeninns.com. Groups of 6+ please call ahead.',
      'Europe/London',
      15,
      90,
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00',
      TIMESTAMPTZ '2025-10-08 16:28:38.225+00'
    )
  ) AS r(
    slug,
    id,
    name,
    capacity,
    contact_email,
    contact_phone,
    address,
    booking_policy,
    timezone,
    reservation_interval_minutes,
    reservation_default_duration_minutes,
    created_at,
    updated_at
  )
),
inserted_restaurants AS (
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
    created_at,
    updated_at
  )
  SELECT
    r.id,
    r.name,
    r.slug,
    r.timezone,
    r.capacity,
    r.contact_email,
    r.contact_phone,
    r.address,
    r.booking_policy,
    r.reservation_interval_minutes,
    r.reservation_default_duration_minutes,
    r.created_at,
    r.updated_at
  FROM restaurant_input r
  RETURNING id, slug, name
),
restaurants_ranked AS (
  SELECT
    id,
    slug,
    name,
    ROW_NUMBER() OVER (ORDER BY slug) AS restaurant_rank
  FROM inserted_restaurants
),
default_operating_hours AS (
  SELECT
    r.id AS restaurant_id,
    dow AS day_of_week,
    '12:00'::time AS opens_at,
    '23:00'::time AS closes_at
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
    ('Lunch', 'lunch', '12:00'::time, '15:00'::time),
    ('Happy Hour', 'drinks', '15:00'::time, '17:00'::time),
    ('Dinner', 'dinner', '17:00'::time, '21:30'::time),
    ('Late Drinks', 'drinks', '21:30'::time, '23:00'::time)
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
    rr.id AS restaurant_id,
    rr.slug,
    rr.restaurant_rank,
    generate_series(1, 60) AS customer_index
  FROM restaurants_ranked rr
),
normalized_customer_pool AS (
  SELECT
    restaurant_id,
    slug,
    customer_index,
    lower(
      format('%s-customer-%02s@seedsajilo.dev', slug, customer_index)
    ) AS email,
    format('+447%08s', lpad(((restaurant_rank * 1000) + customer_index)::text, 8, '0')) AS phone,
    initcap(replace(slug, '-', ' ')) || ' Guest ' || lpad(customer_index::text, 2, '0') AS full_name,
    CASE WHEN customer_index % 5 = 0 THEN true ELSE false END AS marketing_opt_in
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
booking_counts AS (
  SELECT
    past_count,
    today_count,
    future_count,
    past_count + today_count + future_count AS total
  FROM constants
),
booking_sequence AS (
  SELECT
    gs AS booking_index,
    CASE
      WHEN gs <= bc.past_count THEN 'past'
      WHEN gs <= bc.past_count + bc.today_count THEN 'today'
      ELSE 'future'
    END AS bucket,
    ((gs - 1) % 8) + 1 AS restaurant_rank
  FROM booking_counts bc,
       generate_series(1, bc.total) AS gs
),
booking_bucketed AS (
  SELECT
    bs.*,
    ROW_NUMBER() OVER (PARTITION BY bucket ORDER BY booking_index) AS bucket_position
  FROM booking_sequence bs
),
booking_dates AS (
  SELECT
    bb.*,
    CASE
      WHEN bb.bucket = 'past' THEN c.seed_today - ((((bb.bucket_position - 1) % 20) + 1)::int)
      WHEN bb.bucket = 'today' THEN c.seed_today
      ELSE c.seed_today + ((((bb.bucket_position - 1) % GREATEST((c.month_end - c.seed_today), 1)) + 1)::int)
    END AS booking_date
  FROM booking_bucketed bb
  CROSS JOIN constants c
),
booking_with_restaurant AS (
  SELECT
    bd.*,
    rr.id AS restaurant_id,
    rr.slug
  FROM booking_dates bd
  JOIN restaurants_ranked rr
    ON rr.restaurant_rank = bd.restaurant_rank
),
booking_prepared AS (
  SELECT
    bwr.*,
    ((bwr.booking_index - 1) % 60) + 1 AS customer_slot,
    ((bwr.booking_index - 1) % 8) AS start_slot,
    ((bwr.booking_index - 1) % 5) + 2 AS party_size
  FROM booking_with_restaurant bwr
),
booking_enriched AS (
  SELECT
    bp.*,
    ((time '12:00') + (bp.start_slot * interval '45 minutes'))::time AS start_time,
    (((time '12:00') + (bp.start_slot * interval '45 minutes')) + interval '90 minutes')::time AS end_time,
    (
      bp.booking_date::timestamp
      + interval '12 hours'
      + (bp.start_slot * interval '45 minutes')
    ) AS local_start_at
  FROM booking_prepared bp
),
booking_payload AS (
  SELECT
    be.booking_index,
    be.booking_date,
    be.bucket,
    be.restaurant_id,
    be.slug,
    ic.id AS customer_id,
    ic.full_name,
    ic.email,
    ic.phone,
    ic.marketing_opt_in,
    ic.slug AS customer_slug,
    be.party_size,
    be.start_time,
    be.end_time,
    be.local_start_at,
    CASE be.bucket
      WHEN 'past' THEN
        CASE
          WHEN be.booking_index % 15 = 0 THEN 'no_show'::booking_status
          WHEN be.booking_index % 10 = 0 THEN 'cancelled'::booking_status
          ELSE 'completed'::booking_status
        END
      WHEN 'today' THEN
        CASE
          WHEN be.booking_index % 5 = 0 THEN 'pending'::booking_status
          WHEN be.booking_index % 7 = 0 THEN 'pending_allocation'::booking_status
          ELSE 'confirmed'::booking_status
        END
      ELSE
        CASE
          WHEN be.booking_index % 9 = 0 THEN 'pending_allocation'::booking_status
          WHEN be.booking_index % 6 = 0 THEN 'pending'::booking_status
          ELSE 'confirmed'::booking_status
        END
    END AS status,
    CASE (be.booking_index % 6)
      WHEN 0 THEN 'window'::seating_preference_type
      WHEN 1 THEN 'any'::seating_preference_type
      WHEN 2 THEN 'indoor'::seating_preference_type
      WHEN 3 THEN 'outdoor'::seating_preference_type
      WHEN 4 THEN 'quiet'::seating_preference_type
      ELSE 'booth'::seating_preference_type
    END AS seating_preference,
    CASE ((be.booking_index - 1) % 4)
      WHEN 0 THEN 'dinner'::booking_type
      WHEN 1 THEN 'lunch'::booking_type
      WHEN 2 THEN 'drinks'::booking_type
      ELSE 'breakfast'::booking_type
    END AS booking_type
  FROM booking_enriched be
  JOIN indexed_customers ic
    ON ic.restaurant_id = be.restaurant_id
   AND ic.customer_index = be.customer_slot
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
    marketing_opt_in,
    checked_in_at,
    checked_out_at
  )
  SELECT
    bp.restaurant_id,
    bp.customer_id,
    bp.booking_date,
    bp.start_time,
    bp.end_time,
    (bp.local_start_at AT TIME ZONE 'Europe/London') AS start_at,
    ((bp.local_start_at + interval '90 minutes') AT TIME ZONE 'Europe/London') AS end_at,
    bp.party_size,
    bp.seating_preference,
    bp.status,
    bp.full_name,
    bp.email,
    bp.phone,
    format('Seeded booking %s (%s bucket)', bp.booking_index, bp.bucket),
    upper(left(regexp_replace(bp.slug, '[^a-z]', '', 'g'), 3)) || '-' || bp.restaurant_id || '-' || lpad(bp.booking_index::text, 4, '0') AS reference,
    'seed.sql',
    bp.booking_type,
    jsonb_build_object(
      'seeded', true,
      'bucket', bp.bucket,
      'source', 'supabase/seed.sql',
      'sequence', bp.booking_index,
      'restaurant_slug', bp.slug
    ) AS details,
    bp.marketing_opt_in,
    CASE 
      WHEN bp.status = 'completed' THEN (bp.local_start_at AT TIME ZONE 'Europe/London')
      ELSE NULL
    END AS checked_in_at,
    CASE 
      WHEN bp.status = 'completed' THEN ((bp.local_start_at + interval '90 minutes') AT TIME ZONE 'Europe/London')
      ELSE NULL
    END AS checked_out_at
  FROM booking_payload bp
  ORDER BY bp.restaurant_id, bp.booking_index
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
  NULL
FROM inserted_customers c
JOIN inserted_bookings b
  ON b.customer_id = c.id
GROUP BY c.id, c.marketing_opt_in;

-- Validation helper (run manually after executing this seed):
-- SELECT
--   COUNT(*) FILTER (WHERE booking_date < current_date) AS past_bookings,
--   COUNT(*) FILTER (WHERE booking_date = current_date) AS today_bookings,
--   COUNT(*) FILTER (WHERE booking_date > current_date) AS future_bookings
-- FROM public.bookings;

-- ============================================================================
-- SECTION: Zones Seed
-- Purpose: Create default zones for all restaurants
-- ============================================================================

WITH restaurants_to_seed AS (
    SELECT r.id
    FROM public.restaurants r
),
zone_data AS (
    SELECT
        r.id AS restaurant_id,
        zone_name,
        sort_order
    FROM restaurants_to_seed r
    CROSS JOIN (
        VALUES
            ('Main Dining', 1),
            ('Bar Area', 2),
            ('Patio', 3),
            ('Private Room', 4)
    ) AS z(zone_name, sort_order)
)
INSERT INTO public.zones (restaurant_id, name, sort_order)
SELECT restaurant_id, zone_name, sort_order
FROM zone_data
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION: Table Inventory Seed
-- Source: supabase/seed-table-inventory.sql
-- Purpose: Create table inventory for all restaurants
-- ============================================================================

WITH restaurants_to_seed AS (
    SELECT r.id
    FROM public.restaurants r
),
zone_lookup AS (
    SELECT
        z.restaurant_id,
        z.id AS zone_id,
        z.name AS zone_name
    FROM public.zones z
    WHERE z.name = 'Main Dining'
),
table_blueprint AS (
    SELECT
        r.id AS restaurant_id,
        ('T' || lpad(gs::text, 2, '0')) AS table_number,
        CASE
            WHEN gs BETWEEN 1 AND 4 THEN 2
            WHEN gs BETWEEN 5 AND 10 THEN 4
            WHEN gs BETWEEN 11 AND 14 THEN 5
            ELSE 7
        END AS capacity,
        CASE
            WHEN gs BETWEEN 1 AND 4 THEN 1
            WHEN gs BETWEEN 5 AND 10 THEN 2
            WHEN gs BETWEEN 11 AND 14 THEN 4
            ELSE 5
        END AS min_party_size,
        CASE
            WHEN gs BETWEEN 1 AND 4 THEN 2
            WHEN gs BETWEEN 5 AND 10 THEN 4
            WHEN gs BETWEEN 11 AND 14 THEN 5
            ELSE 7
        END AS max_party_size,
        CASE
            WHEN gs BETWEEN 1 AND 8 THEN 'Main Floor'
            WHEN gs BETWEEN 9 AND 12 THEN 'Patio'
            WHEN gs BETWEEN 13 AND 14 THEN 'Bar High-Tops'
            ELSE 'Private Room'
        END AS section,
        'available'::public.table_status AS status,
        jsonb_build_object(
            'x', ((gs - 1) % 4) * 150,
            'y', ((gs - 1) / 4) * 150
        ) AS position,
        zl.zone_id,
        'dining'::public.table_category AS category,
        'standard'::public.table_seating_type AS seating_type,
        'movable'::public.table_mobility AS mobility
    FROM restaurants_to_seed r
    CROSS JOIN generate_series(1, 16) AS gs
    LEFT JOIN zone_lookup zl ON zl.restaurant_id = r.id
),
upserted_tables AS (
    INSERT INTO public.table_inventory (
        restaurant_id,
        table_number,
        capacity,
        min_party_size,
        max_party_size,
        section,
        status,
        position,
        zone_id,
        category,
        seating_type,
        mobility
    )
    SELECT
        restaurant_id,
        table_number,
        capacity,
        min_party_size,
        max_party_size,
        section,
        status,
        position,
        zone_id,
        category,
        seating_type,
        mobility
    FROM table_blueprint
    ON CONFLICT (restaurant_id, table_number) DO UPDATE
    SET
        capacity = EXCLUDED.capacity,
        min_party_size = EXCLUDED.min_party_size,
        max_party_size = EXCLUDED.max_party_size,
        section = EXCLUDED.section,
        zone_id = EXCLUDED.zone_id,
        category = EXCLUDED.category,
        seating_type = EXCLUDED.seating_type,
        mobility = EXCLUDED.mobility,
        updated_at = now()
    RETURNING 1
)
SELECT count(*) AS seeded_or_updated_tables
FROM upserted_tables;

-- ============================================================================
-- SECTION: Today's Bookings Seed (50 bookings for first restaurant)
-- Source: supabase/seed-today-bookings.sql
-- Purpose: Generate 50 sample bookings for today
-- ============================================================================

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
),
inserted_today_bookings AS (
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
    marketing_opt_in,
    checked_in_at,
    checked_out_at
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
      'source', 'supabase/seed.sql (from seed-today-bookings)',
      'sequence', booking_idx,
      'created_date', CURRENT_DATE
    ),
    marketing_opt_in,
    CASE 
      WHEN status = 'completed' THEN start_at
      WHEN status = 'checked_in' THEN start_at
      ELSE NULL
    END AS checked_in_at,
    CASE 
      WHEN status = 'completed' THEN end_at
      ELSE NULL
    END AS checked_out_at
  FROM booking_with_customers
  RETURNING id, restaurant_id, customer_id, start_at, status, party_size, reference
)
SELECT
  COUNT(*) AS total_today_bookings_created,
  SUM(party_size) AS total_covers_today,
  MIN(start_at) AS first_booking_time_today,
  MAX(start_at) AS last_booking_time_today
FROM inserted_today_bookings;

-- ============================================================================
-- SECTION: Admin User Access
-- Purpose: Grant access to amanshresthaaaaa@gmail.com for all restaurants
-- Note: This only works if the user has already signed up via Supabase Auth
-- ============================================================================

-- Find the auth user ID for the admin email (if they exist)
WITH admin_user AS (
  SELECT id
  FROM auth.users
  WHERE email = 'amanshresthaaaaa@gmail.com'
  LIMIT 1
),
-- Create or update profile for admin user (only if they exist in auth.users)
upserted_profile AS (
  INSERT INTO public.profiles (
    id,
    email,
    name,
    created_at,
    updated_at
  )
  SELECT
    id,
    'amanshresthaaaaa@gmail.com',
    'Aman Kumar Shrestha',
    now(),
    now()
  FROM admin_user
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    updated_at = now()
  RETURNING id
)
-- Grant owner access to all restaurants (only if user exists)
INSERT INTO public.restaurant_memberships (
  user_id,
  restaurant_id,
  role,
  created_at
)
SELECT
  upserted_profile.id,
  restaurants.id,
  'owner',
  now()
FROM upserted_profile
CROSS JOIN public.restaurants
ON CONFLICT (user_id, restaurant_id) DO UPDATE
SET
  role = EXCLUDED.role;

COMMIT;
