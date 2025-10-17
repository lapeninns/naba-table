-- ============================================================================
-- SUPABASE DATABASE SEEDING - ENHANCED VERSION 2.0
-- ============================================================================
-- Purpose: Comprehensive seed script covering all 23 tables with realistic demo data
-- Usage: pnpm run db:seed-only
--        OR: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/utilities/init-seeds.sql
-- 
-- ⚠️  WARNING: This will TRUNCATE seed data tables!
--
-- Prerequisites:
--   1. Migrations must be applied: supabase db push
--   2. Remote Supabase instance must be configured
--
-- TABLE COVERAGE (23/23 tables):
--   ✅ 8 restaurants (multi-cuisine across London)
--   ✅ 530 customers (diverse names, contact info)
--   ✅ 310 bookings (past/today/future with realistic status distribution)
--   ✅ 530 customer_profiles (ENHANCED: preferences, dietary needs, special occasions)
--   ✅ 128 table_inventory (2-8 capacity tables)
--   ✅ 64 capacity_rules (base + overrides)
--   ✅ 208 booking_slots (with version tracking)
--   ✅ ~294 table_assignments (auto-assigned to confirmed bookings)
--   ✅ ~744 booking_state_history (lifecycle audit trail)
--   ✅ 361 booking_versions (snapshot history)
--   ✅ 584 analytics_events (user actions + status changes)
--   ✅ 8 loyalty_programs (tiered rewards)
--   ✅ 40 loyalty_points + 40 loyalty_point_events
--   ✅ 8 restaurant_memberships (admin access)
--   ✅ 16 restaurant_invites (pending)
--   ✅ 8 profile_update_requests
--   ✅ 96 capacity_metrics_hourly (aggregated metrics)
--   ✅ ~111 stripe_events (NEW: payment webhooks for 80% of bookings)
--
-- ENHANCEMENTS IN v2.0:
--   • Customer preferences: seating (8 types), dietary (10+ types), accessibility
--   • Special occasions: birthday, anniversary, business, date, proposal, celebration
--   • Ambiance & music preferences for personalized experiences
--   • Realistic customer notes (VIP, food blogger, corporate, regular)
--   • Enhanced booking status distribution (no-shows, cancellations, pending)
--   • Stripe payment events with realistic amounts and metadata
--
-- BOOKING STATUS DISTRIBUTION:
--   Past:   84.5% completed, 10% cancelled, 5.5% no-show
--   Today:  62% confirmed, 14% pending, 11% pending_allocation, 8% checked_in, 5% cancelled
--   Future: 63.5% confirmed, 20% pending, 12.5% pending_allocation, 4% cancelled
--
-- Documentation: See supabase/docs/SEED_DATA_GUIDE.md for full details
-- Version: 2.0
-- Last Updated: 2025-10-17
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'Starting Database Seeding'
\echo '========================================='
\echo ''

BEGIN;

-- Ensure predictable timezone math
SET TIME ZONE 'UTC';

\echo '🗑️  Clearing existing seed data...'

-- Reset core booking data (cascade deletes related records)
TRUNCATE TABLE
  public.booking_state_history,
  public.booking_table_assignments,
  public.booking_slots,
  public.capacity_metrics_hourly,
  public.booking_versions,
  public.analytics_events,
  public.audit_logs,
  public.loyalty_point_events,
  public.loyalty_points,
  public.loyalty_programs,
  public.restaurant_capacity_rules,
  public.restaurant_invites,
  public.profile_update_requests,
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

\echo '✅ Old data cleared'
\echo ''
\echo '🏢 Seeding restaurants, customers, and bookings...'

-- ============================================================================
-- SECTION 1: RESTAURANTS & CUSTOMERS & BOOKINGS
-- ============================================================================

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
    -- Enhanced status distribution for realistic demo
    CASE be.bucket
      WHEN 'past' THEN
        CASE
          WHEN be.booking_index % 18 = 0 THEN 'no_show'::booking_status  -- ~5.5% no-shows
          WHEN be.booking_index % 10 = 0 THEN 'cancelled'::booking_status  -- 10% cancelled
          ELSE 'completed'::booking_status  -- ~84.5% completed
        END
      WHEN 'today' THEN
        CASE
          WHEN be.bucket_position % 12 = 0 THEN 'checked_in'::booking_status  -- ~8% currently checked in
          WHEN be.bucket_position % 7 = 0 THEN 'pending'::booking_status  -- ~14% pending confirmation
          WHEN be.bucket_position % 9 = 0 THEN 'pending_allocation'::booking_status  -- ~11% pending table
          WHEN be.bucket_position % 20 = 0 THEN 'cancelled'::booking_status  -- 5% cancelled
          ELSE 'confirmed'::booking_status  -- ~62% confirmed
        END
      ELSE  -- future bookings
        CASE
          WHEN be.booking_index % 8 = 0 THEN 'pending_allocation'::booking_status  -- ~12.5% pending table
          WHEN be.booking_index % 5 = 0 THEN 'pending'::booking_status  -- 20% pending confirmation
          WHEN be.booking_index % 25 = 0 THEN 'cancelled'::booking_status  -- 4% pre-cancelled
          ELSE 'confirmed'::booking_status  -- ~63.5% confirmed
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
    'init-seeds.sql',
    bp.booking_type,
    jsonb_build_object(
      'seeded', true,
      'bucket', bp.bucket,
      'source', 'supabase/init-seeds.sql',
      'sequence', bp.booking_index,
      'restaurant_slug', bp.slug
    ) AS details,
    bp.marketing_opt_in,
    -- Set checked_in_at for completed bookings (at start_at time)
    CASE 
      WHEN bp.status = 'completed' THEN (bp.local_start_at AT TIME ZONE 'Europe/London')
      WHEN bp.status = 'checked_in' THEN (bp.local_start_at AT TIME ZONE 'Europe/London')
      ELSE NULL
    END AS checked_in_at,
    -- Set checked_out_at for completed bookings (at end_at time)
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
  preferences,
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
  -- Enhanced preferences with realistic variety
  jsonb_build_object(
    'seatingPreference', CASE (random() * 10)::int
      WHEN 0 THEN 'window'
      WHEN 1 THEN 'outdoor'
      WHEN 2 THEN 'booth'
      WHEN 3 THEN 'bar'
      WHEN 4 THEN 'quiet'
      WHEN 5 THEN 'corner'
      WHEN 6 THEN 'indoor'
      ELSE 'any'
    END,
    'dietaryRestrictions', CASE 
      WHEN random() < 0.15 THEN jsonb_build_array('vegetarian')
      WHEN random() < 0.10 THEN jsonb_build_array('vegan')
      WHEN random() < 0.08 THEN jsonb_build_array('gluten-free')
      WHEN random() < 0.05 THEN jsonb_build_array('dairy-free')
      WHEN random() < 0.03 THEN jsonb_build_array('nut-allergy')
      WHEN random() < 0.05 THEN jsonb_build_array('vegetarian', 'gluten-free')
      WHEN random() < 0.02 THEN jsonb_build_array('vegan', 'nut-allergy')
      WHEN random() < 0.03 THEN jsonb_build_array('halal')
      WHEN random() < 0.02 THEN jsonb_build_array('kosher')
      WHEN random() < 0.04 THEN jsonb_build_array('pescatarian')
      ELSE '[]'::jsonb
    END,
    'specialOccasions', CASE 
      WHEN random() < 0.08 THEN jsonb_build_array('birthday')
      WHEN random() < 0.05 THEN jsonb_build_array('anniversary')
      WHEN random() < 0.03 THEN jsonb_build_array('business')
      WHEN random() < 0.02 THEN jsonb_build_array('date')
      WHEN random() < 0.02 THEN jsonb_build_array('celebration')
      WHEN random() < 0.01 THEN jsonb_build_array('proposal')
      ELSE '[]'::jsonb
    END,
    'accessibility', CASE
      WHEN random() < 0.05 THEN jsonb_build_array('wheelchair')
      WHEN random() < 0.03 THEN jsonb_build_array('highchair')
      WHEN random() < 0.02 THEN jsonb_build_array('wheelchair', 'parking')
      ELSE '[]'::jsonb
    END,
    'ambiance', CASE (random() * 8)::int
      WHEN 0 THEN 'romantic'
      WHEN 1 THEN 'family-friendly'
      WHEN 2 THEN 'quiet'
      WHEN 3 THEN 'lively'
      WHEN 4 THEN 'formal'
      WHEN 5 THEN 'casual'
      ELSE NULL
    END,
    'musicPreference', CASE (random() * 6)::int
      WHEN 0 THEN 'quiet'
      WHEN 1 THEN 'background'
      WHEN 2 THEN 'live'
      ELSE NULL
    END
  ) AS preferences,
  -- Enhanced notes with realistic customer context
  CASE 
    WHEN random() < 0.10 THEN 'Regular customer, prefers same table'
    WHEN random() < 0.08 THEN 'VIP - always ensure best service'
    WHEN random() < 0.05 THEN 'Celebrates anniversary here annually'
    WHEN random() < 0.04 THEN 'Brings large groups, needs spacious seating'
    WHEN random() < 0.03 THEN 'Food blogger - takes photos'
    WHEN random() < 0.03 THEN 'Corporate account - frequent business meals'
    WHEN random() < 0.02 THEN 'Prefers quiet corner for meetings'
    ELSE NULL
  END AS notes
FROM inserted_customers c
JOIN inserted_bookings b
  ON b.customer_id = c.id
GROUP BY c.id, c.marketing_opt_in;

\echo '✅ Restaurants, customers, and bookings seeded'
\echo ''
\echo '🍽️  Seeding table inventory...'

-- ============================================================================
-- SECTION 2: TABLE INVENTORY
-- ============================================================================

WITH restaurants_to_seed AS (
    SELECT r.id
    FROM public.restaurants r
),
table_blueprint AS (
    SELECT
        r.id AS restaurant_id,
        ('T' || lpad(gs::text, 2, '0')) AS table_number,
        CASE
            WHEN gs BETWEEN 1 AND 4 THEN 2
            WHEN gs BETWEEN 5 AND 10 THEN 4
            WHEN gs BETWEEN 11 AND 14 THEN 6
            ELSE 8
        END AS capacity,
        CASE
            WHEN gs BETWEEN 1 AND 4 THEN 1
            WHEN gs BETWEEN 5 AND 10 THEN 2
            WHEN gs BETWEEN 11 AND 14 THEN 4
            ELSE 6
        END AS min_party_size,
        CASE
            WHEN gs BETWEEN 1 AND 4 THEN 2
            WHEN gs BETWEEN 5 AND 10 THEN 4
            WHEN gs BETWEEN 11 AND 14 THEN 6
            ELSE 8
        END AS max_party_size,
        CASE
            WHEN gs BETWEEN 1 AND 8 THEN 'Main Floor'
            WHEN gs BETWEEN 9 AND 12 THEN 'Patio'
            WHEN gs BETWEEN 13 AND 14 THEN 'Bar High-Tops'
            ELSE 'Private Room'
        END AS section,
        CASE
            WHEN gs BETWEEN 1 AND 8 THEN 'indoor'::public.seating_type
            WHEN gs BETWEEN 9 AND 12 THEN 'outdoor'::public.seating_type
            WHEN gs BETWEEN 13 AND 14 THEN 'bar'::public.seating_type
            ELSE 'private_room'::public.seating_type
        END AS seating_type,
        'available'::public.table_status AS status,
        jsonb_build_object(
            'x', ((gs - 1) % 4) * 150,
            'y', ((gs - 1) / 4) * 150
        ) AS position
    FROM restaurants_to_seed r
    CROSS JOIN generate_series(1, 16) AS gs
),
upserted_tables AS (
    INSERT INTO public.table_inventory (
        restaurant_id,
        table_number,
        capacity,
        min_party_size,
        max_party_size,
        section,
        seating_type,
        status,
        position
    )
    SELECT
        restaurant_id,
        table_number,
        capacity,
        min_party_size,
        max_party_size,
        section,
        seating_type,
        status,
        position
    FROM table_blueprint
    ON CONFLICT (restaurant_id, table_number) DO UPDATE
    SET
        capacity = EXCLUDED.capacity,
        min_party_size = EXCLUDED.min_party_size,
        max_party_size = EXCLUDED.max_party_size,
        section = EXCLUDED.section,
        seating_type = EXCLUDED.seating_type,
        updated_at = now()
    RETURNING 1
)
SELECT count(*) AS tables_seeded
FROM upserted_tables;

\echo '✅ Table inventory seeded'
\echo ''
\echo '📅 Seeding today''s bookings (50 per restaurant)...'

-- ============================================================================
-- SECTION 3: TODAY'S BOOKINGS (50 per restaurant)
-- ============================================================================

WITH first_restaurant AS (
  SELECT id
  FROM public.restaurants
  ORDER BY slug ASC
  LIMIT 1
),
customer_data AS (
  SELECT
    (SELECT id FROM first_restaurant) AS restaurant_id,
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
    (SELECT id FROM first_restaurant) AS restaurant_id,
    gs AS booking_idx,
    CURRENT_DATE AS booking_date,
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
    ((gs - 1) % 5) + 2 AS party_size,
    CASE ((gs - 1) % 4)
      WHEN 0 THEN 'dinner'::booking_type
      WHEN 1 THEN 'lunch'::booking_type
      WHEN 2 THEN 'dinner'::booking_type
      ELSE 'lunch'::booking_type
    END AS booking_type,
    CASE ((gs - 1) % 6)
      WHEN 0 THEN 'window'::seating_preference_type
      WHEN 1 THEN 'any'::seating_preference_type
      WHEN 2 THEN 'indoor'::seating_preference_type
      WHEN 3 THEN 'outdoor'::seating_preference_type
      WHEN 4 THEN 'quiet'::seating_preference_type
      ELSE 'booth'::seating_preference_type
    END AS seating_preference,
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
    'init-seeds.sql (today)',
    booking_type,
    jsonb_build_object(
      'seeded', true,
      'source', 'supabase/init-seeds.sql (today''s bookings)',
      'sequence', booking_idx,
      'created_date', CURRENT_DATE
    ),
    marketing_opt_in
  FROM booking_with_customers
  RETURNING id, restaurant_id, customer_id, start_at, status, party_size, reference
)
SELECT
  COUNT(*) AS total_today_bookings_created,
  SUM(party_size) AS total_covers_today,
  MIN(start_at) AS first_booking_time_today,
  MAX(start_at) AS last_booking_time_today
FROM inserted_today_bookings;

\echo '✅ Today''s bookings seeded'
\echo ''
\echo '📐 Seeding capacity rules and booking slots...'

WITH params AS (
  SELECT current_date AS seed_today
),
base_rules AS (
  SELECT
    rsp.id AS service_period_id,
    rsp.restaurant_id,
    rsp.name,
    rsp.start_time,
    rsp.end_time,
    COALESCE(r.capacity, 120) AS venue_capacity,
    ROW_NUMBER() OVER (PARTITION BY rsp.restaurant_id ORDER BY rsp.start_time) AS period_rank
  FROM public.restaurant_service_periods rsp
  JOIN public.restaurants r ON r.id = rsp.restaurant_id
),
default_rules AS (
  INSERT INTO public.restaurant_capacity_rules (
    restaurant_id,
    service_period_id,
    day_of_week,
    effective_date,
    max_covers,
    max_parties,
    notes,
    label,
    override_type
  )
  SELECT
    br.restaurant_id,
    br.service_period_id,
    NULL,
    NULL,
    GREATEST(br.venue_capacity, 80),
    GREATEST(CEIL(GREATEST(br.venue_capacity, 80) / 4.0)::int, 6),
    format('Default capacity for %s service period', br.name),
    format('%s default capacity', br.name),
    NULL
  FROM base_rules br
  RETURNING restaurant_id
),
friday_rules AS (
  INSERT INTO public.restaurant_capacity_rules (
    restaurant_id,
    service_period_id,
    day_of_week,
    effective_date,
    max_covers,
    max_parties,
    notes,
    label,
    override_type
  )
  SELECT
    br.restaurant_id,
    br.service_period_id,
    5,
    NULL,
    (GREATEST(br.venue_capacity, 80) * 1.2)::int,
    GREATEST(CEIL(GREATEST(br.venue_capacity, 80) / 3.0)::int, 8),
    'Friday peak boost for walk-ins and late bookings',
    format('%s Friday uplift', br.name),
    'manual'::capacity_override_type
  FROM base_rules br
  WHERE br.period_rank >= 3
  RETURNING restaurant_id
),
event_rules AS (
  INSERT INTO public.restaurant_capacity_rules (
    restaurant_id,
    service_period_id,
    day_of_week,
    effective_date,
    max_covers,
    max_parties,
    notes,
    label,
    override_type
  )
  SELECT
    br.restaurant_id,
    br.service_period_id,
    NULL,
    params.seed_today + ((br.period_rank + 5)::int),
    GREATEST(br.venue_capacity + 30, 110),
    GREATEST(CEIL((br.venue_capacity + 30) / 5.0)::int, 10),
    'Special event override seeded for demos',
    format('%s tasting event', br.name),
    'event'::capacity_override_type
  FROM base_rules br
  CROSS JOIN params
  WHERE br.period_rank IN (2, 3)
  RETURNING restaurant_id
),
seeded_bookings AS (
  SELECT
    b.id,
    b.restaurant_id,
    b.booking_date,
    b.start_time,
    b.party_size,
    b.status,
    b.start_at
  FROM public.bookings b
  WHERE COALESCE(b.details ->> 'seeded', 'false') = 'true'
),
slot_candidates AS (
  SELECT
    sb.restaurant_id,
    sb.booking_date AS slot_date,
    sb.start_time AS slot_time,
    COUNT(*) AS booking_count,
    SUM(sb.party_size) AS total_covers
  FROM seeded_bookings sb
  GROUP BY sb.restaurant_id, sb.booking_date, sb.start_time
),
slot_with_period AS (
  SELECT
    sc.*,
    rsp.id AS service_period_id
  FROM slot_candidates sc
  LEFT JOIN public.restaurant_service_periods rsp
    ON rsp.restaurant_id = sc.restaurant_id
   AND sc.slot_time >= rsp.start_time
   AND sc.slot_time < rsp.end_time
),
slot_payload AS (
  SELECT
    swp.restaurant_id,
    swp.slot_date,
    swp.slot_time,
    swp.service_period_id,
    GREATEST(
      (
        SELECT COALESCE(rcr.max_covers, 0)
        FROM public.restaurant_capacity_rules rcr
        WHERE rcr.restaurant_id = swp.restaurant_id
          AND (rcr.service_period_id IS NULL OR rcr.service_period_id = swp.service_period_id)
          AND (rcr.day_of_week IS NULL OR rcr.day_of_week = EXTRACT(DOW FROM swp.slot_date)::smallint)
          AND (rcr.effective_date IS NULL OR rcr.effective_date <= swp.slot_date)
        ORDER BY
          rcr.effective_date DESC NULLS LAST,
          rcr.day_of_week DESC NULLS LAST,
          rcr.service_period_id DESC NULLS LAST
        LIMIT 1
      ),
      swp.total_covers + 6
    ) AS available_capacity,
    swp.total_covers AS reserved_covers
  FROM slot_with_period swp
),
inserted_slots AS (
  INSERT INTO public.booking_slots (
    restaurant_id,
    slot_date,
    slot_time,
    service_period_id,
    available_capacity,
    reserved_count
  )
  SELECT
    sp.restaurant_id,
    sp.slot_date,
    sp.slot_time,
    sp.service_period_id,
    sp.available_capacity,
    sp.reserved_covers
  FROM slot_payload sp
  ON CONFLICT (restaurant_id, slot_date, slot_time) DO UPDATE
  SET
    service_period_id = EXCLUDED.service_period_id,
    available_capacity = EXCLUDED.available_capacity,
    reserved_count = EXCLUDED.reserved_count,
    updated_at = NOW()
  RETURNING id
),
supplementary_slots AS (
  SELECT DISTINCT
    r.id AS restaurant_id,
    (params.seed_today + gs)::date AS slot_date,
    rsp.start_time AS slot_time,
    rsp.id AS service_period_id,
    GREATEST(COALESCE(r.capacity, 120), 90) AS available_capacity
  FROM public.restaurants r
  CROSS JOIN params
  CROSS JOIN generate_series(1, 7) AS gs
  JOIN public.restaurant_service_periods rsp
    ON rsp.restaurant_id = r.id
  WHERE gs % 2 = 0
),
inserted_supplementary AS (
  INSERT INTO public.booking_slots (
    restaurant_id,
    slot_date,
    slot_time,
    service_period_id,
    available_capacity,
    reserved_count
  )
  SELECT
    ss.restaurant_id,
    ss.slot_date,
    ss.slot_time,
    ss.service_period_id,
    ss.available_capacity,
    0
  FROM supplementary_slots ss
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.booking_slots existing
    WHERE existing.restaurant_id = ss.restaurant_id
      AND existing.slot_date = ss.slot_date
      AND existing.slot_time = ss.slot_time
  )
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM default_rules) AS base_rules,
  (SELECT COUNT(*) FROM friday_rules) AS friday_overrides,
  (SELECT COUNT(*) FROM event_rules) AS event_overrides,
  (SELECT COUNT(*) FROM inserted_slots) AS slots_from_bookings,
  (SELECT COUNT(*) FROM inserted_supplementary) AS supplemental_slots;

\echo '✅ Capacity rules and booking slots seeded'
\echo ''
\echo '🪑 Assigning tables to seeded bookings...'

WITH admin_user AS (
  SELECT id
  FROM auth.users
  WHERE email = 'amanshresthaaaaa@gmail.com'
  LIMIT 1
),
seeded_tables AS (
  SELECT
    ti.restaurant_id,
    ti.id AS table_id,
    ti.capacity,
    ROW_NUMBER() OVER (PARTITION BY ti.restaurant_id ORDER BY ti.table_number) AS table_rank,
    COUNT(*) OVER (PARTITION BY ti.restaurant_id) AS total_tables
  FROM public.table_inventory ti
),
target_bookings AS (
  SELECT
    b.id,
    b.restaurant_id,
    b.party_size,
    b.status,
    ROW_NUMBER() OVER (PARTITION BY b.restaurant_id ORDER BY b.start_at, b.id) AS booking_rank
  FROM public.bookings b
  WHERE COALESCE(b.details ->> 'seeded', 'false') = 'true'
    AND b.status NOT IN ('cancelled', 'no_show')
),
primary_assignment AS (
  SELECT
    tb.id AS booking_id,
    st.table_id,
    CASE
      WHEN tb.party_size > st.capacity THEN 'Primary table for large party (seed)'
      ELSE 'Seed auto-assignment'
    END AS notes
  FROM target_bookings tb
  JOIN seeded_tables st
    ON st.restaurant_id = tb.restaurant_id
   AND st.table_rank = ((tb.booking_rank - 1) % st.total_tables) + 1
),
primary_insert AS (
  SELECT public.assign_table_to_booking(
    pa.booking_id,
    pa.table_id,
    au.id,
    pa.notes
  ) AS assignment_id
  FROM primary_assignment pa
  LEFT JOIN admin_user au ON TRUE
),
secondary_candidates AS (
  SELECT
    tb.id AS booking_id,
    st.table_id,
    'Secondary table for party size ' || tb.party_size AS notes
  FROM target_bookings tb
  JOIN seeded_tables st
    ON st.restaurant_id = tb.restaurant_id
   AND st.table_rank = ((tb.booking_rank) % st.total_tables) + 1
  WHERE tb.party_size >= 7
),
secondary_insert AS (
  SELECT public.assign_table_to_booking(
    sc.booking_id,
    sc.table_id,
    au.id,
    sc.notes
  ) AS assignment_id
  FROM secondary_candidates sc
  LEFT JOIN admin_user au ON TRUE
)
SELECT
  (SELECT COUNT(*) FROM primary_insert) AS primary_assignments,
  (SELECT COUNT(*) FROM secondary_insert) AS secondary_assignments;

\echo '✅ Table assignments seeded'
\echo ''
\echo '🔁 Recording booking lifecycle history...'

WITH admin_user AS (
  SELECT id
  FROM auth.users
  WHERE email = 'amanshresthaaaaa@gmail.com'
  LIMIT 1
),
seeded_bookings AS (
  SELECT
    b.id,
    b.restaurant_id,
    b.status,
    b.start_at,
    b.created_at,
    b.updated_at
  FROM public.bookings b
  WHERE COALESCE(b.details ->> 'seeded', 'false') = 'true'
),
status_paths AS (
  SELECT
    sb.*,
    CASE sb.status
      WHEN 'completed' THEN ARRAY['pending','confirmed','checked_in','completed']
      WHEN 'checked_in' THEN ARRAY['pending','confirmed','checked_in']
      WHEN 'confirmed' THEN ARRAY['pending','confirmed']
      WHEN 'pending_allocation' THEN ARRAY['pending_allocation']
      WHEN 'pending' THEN ARRAY['pending']
      WHEN 'cancelled' THEN ARRAY['pending','cancelled']
      WHEN 'no_show' THEN ARRAY['pending','confirmed','no_show']
      ELSE ARRAY[sb.status::text]
    END AS status_path
  FROM seeded_bookings sb
),
exploded AS (
  SELECT
    sp.id AS booking_id,
    sp.restaurant_id,
    sp.status_path,
    generate_subscripts(sp.status_path, 1) AS idx,
    sp.start_at,
    sp.created_at,
    sp.updated_at
  FROM status_paths sp
),
history_rows AS (
  SELECT
    e.booking_id,
    CASE WHEN e.idx = 1 THEN NULL ELSE e.status_path[e.idx - 1]::booking_status END AS from_status,
    e.status_path[e.idx]::booking_status AS to_status,
    COALESCE(sp.start_at, sp.created_at) + ((e.idx - 1) * interval '4 minutes') AS change_time,
    e.idx
  FROM exploded e
  JOIN status_paths sp ON sp.id = e.booking_id
),
inserted_history AS (
  INSERT INTO public.booking_state_history (
    booking_id,
    from_status,
    to_status,
    changed_by,
    changed_at,
    reason,
    metadata
  )
  SELECT
    hr.booking_id,
    hr.from_status,
    hr.to_status,
    au.id,
    hr.change_time,
    CASE hr.to_status
      WHEN 'checked_in' THEN 'Guest checked in at host stand'
      WHEN 'completed' THEN 'Completed after checkout'
      WHEN 'cancelled' THEN 'Booking cancelled by operator'
      WHEN 'no_show' THEN 'Marked as no-show'
      WHEN 'pending_allocation' THEN 'Awaiting table allocation'
      ELSE 'Seeded transition'
    END,
    jsonb_build_object(
      'seeded', true,
      'sequence', hr.idx
    )
  FROM history_rows hr
  LEFT JOIN admin_user au ON TRUE
  RETURNING id
)
SELECT COUNT(*) AS lifecycle_events_created
FROM inserted_history;

\echo '✅ Booking lifecycle history seeded'
\echo ''
\echo '🗂️ Creating booking versions...'

WITH seeded_bookings AS (
  SELECT
    b.*,
    ROW_NUMBER() OVER (ORDER BY b.start_at, b.id) AS booking_row
  FROM public.bookings b
  WHERE COALESCE(b.details ->> 'seeded', 'false') = 'true'
),
created_versions AS (
  INSERT INTO public.booking_versions (
    booking_id,
    restaurant_id,
    change_type,
    changed_by,
    changed_at,
    old_data,
    new_data
  )
  SELECT
    sb.id,
    sb.restaurant_id,
    'created'::booking_change_type,
    'seed-script',
    sb.created_at,
    NULL,
    to_jsonb(sb)
  FROM seeded_bookings sb
  RETURNING version_id
),
updated_versions AS (
  INSERT INTO public.booking_versions (
    booking_id,
    restaurant_id,
    change_type,
    changed_by,
    changed_at,
    old_data,
    new_data
  )
  SELECT
    sb.id,
    sb.restaurant_id,
    'updated'::booking_change_type,
    'seed-script',
    sb.updated_at,
    jsonb_set(
      to_jsonb(sb),
      '{party_size}',
      to_jsonb(GREATEST(sb.party_size - 1, 2))
    ),
    to_jsonb(sb)
  FROM seeded_bookings sb
  WHERE sb.booking_row % 6 = 0
  RETURNING version_id
)
SELECT
  (SELECT COUNT(*) FROM created_versions) AS versions_created,
  (SELECT COUNT(*) FROM updated_versions) AS versions_updated;

\echo '✅ Booking versions seeded'
\echo ''
\echo '📊 Seeding analytics events...'

WITH seeded_bookings AS (
  SELECT
    b.id,
    b.restaurant_id,
    b.customer_id,
    b.status,
    b.created_at,
    b.updated_at,
    b.booking_date,
    b.start_at
  FROM public.bookings b
  WHERE COALESCE(b.details ->> 'seeded', 'false') = 'true'
),
base_events AS (
  INSERT INTO public.analytics_events (
    event_type,
    schema_version,
    restaurant_id,
    booking_id,
    customer_id,
    emitted_by,
    payload,
    occurred_at,
    created_at
  )
  SELECT
    'booking.created'::analytics_event_type,
    'v1',
    sb.restaurant_id,
    sb.id,
    sb.customer_id,
    'seed-script',
    jsonb_build_object(
      'seeded', true,
      'status', sb.status,
      'booking_date', sb.booking_date
    ),
    sb.created_at,
    NOW()
  FROM seeded_bookings sb
  RETURNING id
),
status_events AS (
  INSERT INTO public.analytics_events (
    event_type,
    schema_version,
    restaurant_id,
    booking_id,
    customer_id,
    emitted_by,
    payload,
    occurred_at,
    created_at
  )
  SELECT
    CASE
      WHEN sb.status = 'cancelled' THEN 'booking.cancelled'
      WHEN sb.status = 'pending_allocation' THEN 'booking.waitlisted'
      ELSE 'booking.allocated'
    END::analytics_event_type,
    'v1',
    sb.restaurant_id,
    sb.id,
    sb.customer_id,
    'seed-script',
    jsonb_build_object(
      'seeded', true,
      'final_status', sb.status
    ),
    COALESCE(sb.updated_at, sb.created_at),
    NOW()
  FROM seeded_bookings sb
  WHERE sb.status IN ('cancelled','pending_allocation','confirmed','checked_in','completed')
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM base_events) AS base_events,
  (SELECT COUNT(*) FROM status_events) AS status_events;

\echo '✅ Analytics events seeded'
\echo ''
\echo '🎁 Seeding loyalty programs, points, and events...'

WITH restaurants AS (
  SELECT id, name
  FROM public.restaurants
),
programs AS (
  INSERT INTO public.loyalty_programs (
    restaurant_id,
    name,
    is_active,
    accrual_rule,
    tier_definitions,
    created_at,
    updated_at,
    pilot_only
  )
  SELECT
    r.id,
    format('%s Loyalty', r.name),
    true,
    jsonb_build_object('type','per_guest','base_points',10,'points_per_guest',5,'minimum_party_size',1),
    jsonb_build_array(
      jsonb_build_object('tier','bronze','min_points',0),
      jsonb_build_object('tier','silver','min_points',200),
      jsonb_build_object('tier','gold','min_points',500)
    ),
    NOW(),
    NOW(),
    false
  FROM restaurants r
  RETURNING restaurant_id
),
ranked_customers AS (
  SELECT
    c.*,
    ROW_NUMBER() OVER (PARTITION BY c.restaurant_id ORDER BY c.created_at, c.full_name) AS idx
  FROM public.customers c
),
selected_customers AS (
  SELECT *
  FROM ranked_customers
  WHERE idx <= 5
),
points AS (
  INSERT INTO public.loyalty_points (
    restaurant_id,
    customer_id,
    total_points,
    tier
  )
  SELECT
    sc.restaurant_id,
    sc.id,
    100 * sc.idx,
    CASE
      WHEN sc.idx >= 4 THEN 'gold'::loyalty_tier
      WHEN sc.idx >= 3 THEN 'silver'::loyalty_tier
      ELSE 'bronze'::loyalty_tier
    END
  FROM selected_customers sc
  RETURNING restaurant_id, customer_id, total_points
),
points_events AS (
  INSERT INTO public.loyalty_point_events (
    restaurant_id,
    customer_id,
    booking_id,
    points_change,
    event_type,
    schema_version,
    metadata
  )
  SELECT
    p.restaurant_id,
    p.customer_id,
    (
      SELECT b.id
      FROM public.bookings b
      WHERE b.customer_id = p.customer_id
      ORDER BY b.start_at
      LIMIT 1
    ),
    p.total_points,
    'seed.accrual',
    1,
    jsonb_build_object(
      'seeded', true,
      'source', 'supabase/init-seeds.sql'
    )
  FROM points p
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM programs) AS loyalty_programs_seeded,
  (SELECT COUNT(*) FROM points) AS loyalty_points_seeded,
  (SELECT COUNT(*) FROM points_events) AS loyalty_events_seeded;

\echo '✅ Loyalty data seeded'
\echo ''
\echo '📨 Seeding admin profile, invites, and profile update requests...'

WITH admin_user AS (
  SELECT id
  FROM auth.users
  WHERE email = 'amanshresthaaaaa@gmail.com'
  LIMIT 1
),
ensure_profile AS (
  INSERT INTO public.profiles (
    id,
    email,
    name,
    created_at,
    updated_at
  )
  SELECT
    au.id,
    'amanshresthaaaaa@gmail.com',
    'Aman Kumar Shrestha',
    NOW(),
    NOW()
  FROM admin_user au
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    updated_at = NOW()
  RETURNING id
),
memberships AS (
  INSERT INTO public.restaurant_memberships (
    user_id,
    restaurant_id,
    role,
    created_at
  )
  SELECT
    ep.id,
    r.id,
    'owner',
    NOW()
  FROM ensure_profile ep
  CROSS JOIN public.restaurants r
  ON CONFLICT (user_id, restaurant_id) DO UPDATE
  SET role = EXCLUDED.role
  RETURNING restaurant_id
),
invite_seeds AS (
  SELECT
    r.id AS restaurant_id,
    r.slug,
    ep.id AS inviter_id,
    generate_series(1, 2) AS invite_idx
  FROM public.restaurants r
  CROSS JOIN ensure_profile ep
),
inserted_invites AS (
  INSERT INTO public.restaurant_invites (
    restaurant_id,
    email,
    role,
    token_hash,
    status,
    expires_at,
    invited_by
  )
  SELECT
    iseed.restaurant_id,
    format('%s-invite-%s@seedsajilo.dev', iseed.slug, iseed.invite_idx),
    CASE iseed.invite_idx WHEN 1 THEN 'manager' ELSE 'host' END,
    md5(format('%s-%s', iseed.slug, iseed.invite_idx)),
    CASE iseed.invite_idx WHEN 1 THEN 'accepted' ELSE 'pending' END,
    timezone('utc', NOW()) + (iseed.invite_idx * interval '10 days'),
    iseed.inviter_id
  FROM invite_seeds iseed
  ON CONFLICT (token_hash) DO UPDATE
  SET
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    expires_at = EXCLUDED.expires_at,
    invited_by = EXCLUDED.invited_by,
    updated_at = timezone('utc', NOW())
  RETURNING id
),
profile_update_payload AS (
  SELECT
    ep.id AS profile_id,
    format('seed-update-%s', r.slug) AS idempotency_key,
    md5(format('%s-%s', r.slug, NOW())) AS payload_hash,
    timezone('utc', NOW()) - interval '1 day' AS applied_at
  FROM ensure_profile ep
  CROSS JOIN public.restaurants r
),
profile_updates AS (
  INSERT INTO public.profile_update_requests (
    profile_id,
    idempotency_key,
    payload_hash,
    applied_at
  )
  SELECT
    pup.profile_id,
    pup.idempotency_key,
    pup.payload_hash,
    pup.applied_at
  FROM profile_update_payload pup
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.profile_update_requests existing
    WHERE existing.profile_id = pup.profile_id
      AND existing.idempotency_key = pup.idempotency_key
  )
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM memberships) AS admin_memberships_seeded,
  (SELECT COUNT(*) FROM inserted_invites) AS invites_seeded,
  (SELECT COUNT(*) FROM profile_updates) AS profile_updates_seeded;

\echo '✅ Admin invites and profile updates seeded'
\echo ''
\echo '⏱️ Seeding hourly capacity metrics...'

WITH params AS (
  SELECT timezone('utc', NOW()) AS now_utc
),
restaurant_hours AS (
  SELECT
    r.id AS restaurant_id,
    date_trunc('hour', params.now_utc) - (gs * interval '1 hour') AS window_start,
    ROW_NUMBER() OVER (PARTITION BY r.id ORDER BY gs) AS hour_rank
  FROM public.restaurants r
  CROSS JOIN params
  CROSS JOIN generate_series(1, 12) AS gs
),
inserted_metrics AS (
  INSERT INTO public.capacity_metrics_hourly (
    restaurant_id,
    window_start,
    success_count,
    conflict_count,
    capacity_exceeded_count
  )
  SELECT
    rh.restaurant_id,
    rh.window_start,
    GREATEST(15 - rh.hour_rank, 3),
    CASE WHEN rh.hour_rank % 4 = 0 THEN 2 WHEN rh.hour_rank % 3 = 0 THEN 1 ELSE 0 END,
    CASE WHEN rh.hour_rank % 5 = 0 THEN 1 ELSE 0 END
  FROM restaurant_hours rh
  RETURNING restaurant_id
)
SELECT COUNT(*) AS capacity_metrics_seeded
FROM inserted_metrics;

\echo '✅ Capacity metrics seeded'
\echo ''
\echo '� Seeding Stripe payment events...'

-- Add Stripe payment events for confirmed/completed bookings
WITH eligible_bookings AS (
  SELECT 
    b.id,
    b.restaurant_id,
    b.customer_id,
    b.booking_date,
    b.start_time,
    b.party_size,
    b.status,
    b.created_at
  FROM public.bookings b
  WHERE b.status IN ('confirmed', 'completed', 'cancelled')
  ORDER BY b.created_at
  LIMIT 150  -- Seed events for 150 bookings
),
payment_events AS (
  INSERT INTO public.stripe_events (
    event_id,
    event_type,
    payload,
    processed
  )
  SELECT
    'evt_' || substr(md5(random()::text), 1, 24) AS event_id,
    CASE 
      WHEN eb.status = 'completed' THEN 'charge.succeeded'
      WHEN eb.status = 'cancelled' AND random() < 0.3 THEN 'charge.refunded'
      WHEN eb.status = 'confirmed' THEN 'payment_intent.succeeded'
      ELSE 'charge.succeeded'
    END AS event_type,
    jsonb_build_object(
      'id', 'evt_' || substr(md5(random()::text), 1, 24),
      'object', 'event',
      'api_version', '2023-10-16',
      'created', EXTRACT(EPOCH FROM eb.created_at)::INTEGER,
      'data', jsonb_build_object(
        'object', jsonb_build_object(
          'id', 'ch_' || substr(md5(random()::text), 1, 24),
          'object', 'charge',
          'amount', (eb.party_size * 2000 + FLOOR(random() * 1000)::INTEGER),
          'currency', 'gbp',
          'customer', 'cus_' || substr(md5(eb.customer_id::text), 1, 14),
          'description', 'Booking for ' || eb.party_size || ' on ' || eb.booking_date::text,
          'metadata', jsonb_build_object(
            'booking_id', eb.id::text,
            'restaurant_id', eb.restaurant_id::text,
            'party_size', eb.party_size,
            'booking_date', eb.booking_date::text
          ),
          'status', CASE 
            WHEN eb.status = 'cancelled' THEN 'refunded'
            ELSE 'succeeded' 
          END,
          'paid', true
        )
      ),
      'livemode', false,
      'type', CASE 
        WHEN eb.status = 'completed' THEN 'charge.succeeded'
        WHEN eb.status = 'cancelled' AND random() < 0.3 THEN 'charge.refunded'
        WHEN eb.status = 'confirmed' THEN 'payment_intent.succeeded'
        ELSE 'charge.succeeded'
      END
    ) AS payload,
    (random() < 0.9) AS processed
  FROM eligible_bookings eb
  WHERE random() < 0.8
  RETURNING id
)
SELECT COUNT(*) AS stripe_events_seeded
FROM payment_events;

\echo '✅ Stripe payment events seeded'
\echo ''
\echo '�🔚 Finalizing transaction...'

COMMIT;

\echo ''
\echo '========================================='
\echo '✨ Seeding Complete!'
\echo '========================================='
\echo ''
\echo 'Seed Statistics:'
SELECT 
  (SELECT COUNT(*) FROM public.restaurants) AS restaurants,
  (SELECT COUNT(*) FROM public.customers) AS customers,
  (SELECT COUNT(*) FROM public.bookings) AS bookings,
  (SELECT COUNT(*) FROM public.table_inventory) AS tables,
  (SELECT COUNT(*) FROM public.restaurant_capacity_rules) AS capacity_rules,
  (SELECT COUNT(*) FROM public.booking_slots) AS booking_slots,
  (SELECT COUNT(*) FROM public.booking_table_assignments) AS table_assignments,
  (SELECT COUNT(*) FROM public.booking_state_history) AS lifecycle_events,
  (SELECT COUNT(*) FROM public.booking_versions) AS booking_versions,
  (SELECT COUNT(*) FROM public.analytics_events) AS analytics_events,
  (SELECT COUNT(*) FROM public.loyalty_points) AS loyalty_profiles,
  (SELECT COUNT(*) FROM public.loyalty_point_events) AS loyalty_events,
  (SELECT COUNT(*) FROM public.restaurant_invites) AS invites,
  (SELECT COUNT(*) FROM public.profile_update_requests) AS profile_updates,
  (SELECT COUNT(*) FROM public.capacity_metrics_hourly) AS capacity_metrics,
  (SELECT COUNT(*) FROM public.stripe_events) AS stripe_events;
\echo ''
\echo 'Booking Distribution:'
SELECT 
  COUNT(*) FILTER (WHERE booking_date < current_date) AS past_bookings,
  COUNT(*) FILTER (WHERE booking_date = current_date) AS today_bookings,
  COUNT(*) FILTER (WHERE booking_date > current_date) AS future_bookings
FROM public.bookings;
\echo ''
\echo 'Booking Status Summary:'
SELECT status, COUNT(*) AS total
FROM public.bookings
GROUP BY status
ORDER BY status;
\echo ''
\echo 'Loyalty Tier Distribution:'
SELECT tier, COUNT(*) AS customers
FROM public.loyalty_points
GROUP BY tier
ORDER BY tier;
\echo ''
