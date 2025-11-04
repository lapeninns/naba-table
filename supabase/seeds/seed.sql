-- Seed dataset for SajiloReserveX (La Pen Inns)
-- Generates restaurants, tables, bookings, assignments, holds, analytics, and supporting fixtures.

BEGIN;

SET LOCAL client_min_messages = warning;
SET LOCAL search_path = public;

-- -----------------------------------------------------------------------------
-- Stage 0: reset derived configuration/state
-- -----------------------------------------------------------------------------
SELECT set_config('app.holds.strict_conflicts.enabled', 'off', true);

-- -----------------------------------------------------------------------------
-- Stage 1: truncate existing data (idempotent reruns)
-- -----------------------------------------------------------------------------
TRUNCATE TABLE
    public.table_hold_windows,
    public.table_hold_members,
    public.table_holds,
    public.booking_assignment_idempotency,
    public.booking_table_assignments,
    public.allocations,
    public.observability_events,
    public.analytics_events,
    public.booking_slots,
    public.booking_state_history,
    public.booking_versions,
    public.booking_occasions,
    public.bookings,
    public.customer_profiles,
    public.customers,
    public.loyalty_point_events,
    public.loyalty_points,
    public.loyalty_programs,
    public.restaurant_invites,
    public.restaurant_memberships,
    public.restaurant_operating_hours,
    public.restaurant_service_periods,
    public.restaurants,
    public.service_policy,
    public.feature_flag_overrides,
    public.table_adjacencies,
    public.table_inventory,
    public.allowed_capacities,
    public.zones,
    public.profile_update_requests,
    public.profiles
CASCADE;

TRUNCATE TABLE auth.users CASCADE;

-- -----------------------------------------------------------------------------
-- Stage 2: static catalogues and feature configuration
-- -----------------------------------------------------------------------------
INSERT INTO public.booking_occasions (key, label, short_label, description, availability, default_duration_minutes, display_order, is_active, created_at, updated_at)
VALUES
    (
        'lunch',
        'Lunch',
        'Lunch',
        'Midday dining experience with hearty pub classics.',
        '[{"kind":"time_window","start":"11:45","end":"15:30"}]'::jsonb,
        90,
        10,
        true,
        timezone('utc', now()),
        timezone('utc', now())
    ),
    (
        'drinks',
        'Drinks & Cocktails',
        'Drinks',
        'Bar reservations, cocktails, and casual catch-ups.',
        '[{"kind":"time_window","start":"15:00","end":"18:30"}]'::jsonb,
        60,
        20,
        true,
        timezone('utc', now()),
        timezone('utc', now())
    ),
    (
        'dinner',
        'Dinner',
        'Dinner',
        'Evening service featuring signature dishes.',
        '[{"kind":"time_window","start":"17:00","end":"23:00"}]'::jsonb,
        120,
        30,
        true,
        timezone('utc', now()),
        timezone('utc', now())
    ),
    (
        'christmas_party',
        'Christmas Party',
        'Christmas',
        'Seasonal banquet menu for festive gatherings.',
        '[{"kind":"month_only","months":[12]}]'::jsonb,
        150,
        40,
        true,
        timezone('utc', now()),
        timezone('utc', now())
    ),
    (
        'curry_and_carols',
        'Curry & Carols',
        'Curry & Carols',
        'Limited-edition curry feast accompanied by live carols.',
        '[{"kind":"specific_dates","dates":["2025-12-15","2025-12-22"]}]'::jsonb,
        150,
        50,
        true,
        timezone('utc', now()),
        timezone('utc', now())
    )
ON CONFLICT (key) DO UPDATE
SET
    label = EXCLUDED.label,
    short_label = EXCLUDED.short_label,
    description = EXCLUDED.description,
    availability = EXCLUDED.availability,
    default_duration_minutes = EXCLUDED.default_duration_minutes,
    display_order = EXCLUDED.display_order,
    is_active = true,
    updated_at = timezone('utc', now());

INSERT INTO public.service_policy (id, lunch_start, lunch_end, dinner_start, dinner_end, clean_buffer_minutes, allow_after_hours, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    time '12:00',
    time '15:30',
    time '17:00',
    time '22:30',
    10,
    false,
    timezone('utc', now()),
    timezone('utc', now())
);

INSERT INTO public.feature_flag_overrides (flag, environment, value, notes, updated_at, updated_by)
VALUES
    ('allocator.strict_conflicts', 'staging', true, '{"seeded": true, "reason": "Exercise strict conflict flow"}'::jsonb, timezone('utc', now()), NULL),
    ('allocator.strict_conflicts', 'production', false, '{"seeded": true, "reason": "Production defaults remain soft"}'::jsonb, timezone('utc', now()), NULL),
    ('booking.waitlist.enabled', 'staging', true, '{"seeded": true}'::jsonb, timezone('utc', now()), NULL)
ON CONFLICT (flag, environment) DO UPDATE
SET value = EXCLUDED.value,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at,
    updated_by = NULL;

-- -----------------------------------------------------------------------------
-- Stage 3: staff accounts
-- -----------------------------------------------------------------------------
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
    '6babb126-c166-41a0-b9f2-57ef473b179b',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner@lapeninns.com',
    '$2a$10$zW3U70B4rxY1NpTy9M6t4O0bVwQHmxJf8b0Dm5jul1n/6XHlzZpGq',
    timezone('utc', now()),
    '{"provider":"email"}'::jsonb,
    '{"display_name":"La Pen Owner"}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
)
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.profiles (id, email, name, phone, image, has_access, created_at, updated_at)
VALUES (
    '6babb126-c166-41a0-b9f2-57ef473b179b',
    'owner@lapeninns.com',
    'La Pen Owner',
    '+447700900001',
    NULL,
    true,
    timezone('utc', now()),
    timezone('utc', now())
);

-- -----------------------------------------------------------------------------
-- Stage 4: restaurant scaffolding (8 venues)
-- -----------------------------------------------------------------------------
WITH restaurant_source AS (
    SELECT * FROM (
        VALUES
            ('The Queen Elizabeth Pub',       'the-queen-elizabeth-pub',       'Europe/London', '32 Gayton Road, King''s Lynn, PE30 4EL',          'thequeen@lapeninns.com',    '01553 824083', NULL,                 'Visit: https://thequeenelizabethpub.co.uk'),
            ('Old Crown Pub (Girton)',        'old-crown-pub-girton',          'Europe/London', '89 High Street, Girton, Cambridge, CB3 0QQ',      'oldcrown@lapeninns.com',    '01223 277217', NULL,                 'Visit: https://oldcrowngirton.com'),
            ('White Horse Pub (Waterbeach)',  'white-horse-pub-waterbeach',    'Europe/London', '12 Green Side, Waterbeach, Cambridge, CB25 9HP',  'whitehorse@lapeninns.com',  '01223 375578', NULL,                 'Visit: https://whitehorsepub.co'),
            ('The Corner House Pub (Cambridge)', 'the-corner-house-pub-cambridge', 'Europe/London', '231 Newmarket Road, Cambridge, CB5 8JE',       'cornerhouse@lapeninns.com', '01223 921122', NULL,                 'Visit: https://thecornerhousepub.co'),
            ('Prince of Wales Pub (Bromham)', 'prince-of-wales-pub-bromham',   'Europe/London', '8 Northampton Road, Bromham, Bedford, MK43 8PE',  'theprince@lapeninns.com',   '01234 822447', '+44 7438 699609',   'Visit: https://princeofwalesbromham.com • Mobile: +44 7438 699609'),
            ('The Bell (Sawtry)',             'the-bell-sawtry',               'Europe/London', '82 Green End Road, Sawtry, Huntingdon, PE28 5UY', 'thebell@lapeninns.com',     '01487 900149', NULL,                 'Visit: https://thebellsawtry.com'),
            ('The Railway Pub (Whittlesey)',  'the-railway-pub-whittlesey',    'Europe/London', '139 Station Road, Whittlesey, PE7 1UF',           'therailway@lapeninns.com',  '01733 788345', NULL,                 'Visit: https://therailwaypub.co'),
            ('The Barley Mow Pub (Hartford)', 'the-barley-mow-pub-hartford',   'Europe/London', '42 Main St, Hartford, Huntingdon, PE29 1XU',      'barleymow@lapeninns.com',   '01480 450550', '+44 7399 835329',   'Visit: https://barleymowhartford.co.uk • Mobile: +44 7399 835329')
    ) AS r(name, slug, timezone, address, email, phone, mobile, policy)
)
INSERT INTO public.restaurants (id, name, slug, timezone, capacity, contact_email, contact_phone, address, booking_policy, reservation_interval_minutes, reservation_default_duration_minutes, reservation_last_seating_buffer_minutes, is_active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    r.name,
    r.slug,
    r.timezone,
    180,
    r.email,
    r.phone,
    r.address,
    r.policy,
    15,
    90,
    120,
    true,
    timezone('utc', now()),
    timezone('utc', now())
FROM restaurant_source r;

INSERT INTO public.restaurant_memberships (restaurant_id, user_id, role, created_at)
SELECT r.id, '6babb126-c166-41a0-b9f2-57ef473b179b', 'owner', timezone('utc', now())
FROM public.restaurants r;

-- Operating hours: Mon-Fri open, weekends closed
INSERT INTO public.restaurant_operating_hours (id, restaurant_id, day_of_week, opens_at, closes_at, is_closed, notes, created_at, updated_at)
SELECT
    gen_random_uuid(),
    r.id,
    dow,
    CASE WHEN dow BETWEEN 1 AND 5 THEN time '12:00' ELSE NULL END,
    CASE WHEN dow BETWEEN 1 AND 5 THEN time '22:00' ELSE NULL END,
    CASE WHEN dow BETWEEN 1 AND 5 THEN false ELSE true END,
    CASE WHEN dow BETWEEN 1 AND 5 THEN NULL ELSE 'Closed on weekends' END,
    timezone('utc', now()),
    timezone('utc', now())
FROM public.restaurants r
CROSS JOIN generate_series(0, 6) AS dow;

-- Service periods per weekday
INSERT INTO public.restaurant_service_periods (id, restaurant_id, name, day_of_week, start_time, end_time, booking_option, created_at, updated_at)
SELECT
    gen_random_uuid(),
    r.id,
    sp.name,
    dow,
    sp.start_time,
    sp.end_time,
    sp.booking_option,
    timezone('utc', now()),
    timezone('utc', now())
FROM public.restaurants r
CROSS JOIN generate_series(1, 5) AS dow
CROSS JOIN LATERAL (
    VALUES
        ('Weekday Lunch',  time '12:00', time '15:00', 'lunch'),
        ('Happy Hour',     time '15:00', time '17:00', 'drinks'),
        ('Dinner Service', time '17:00', time '22:00', 'dinner')
) AS sp(name, start_time, end_time, booking_option);

-- Allowed capacities used by allocator
INSERT INTO public.allowed_capacities (restaurant_id, capacity, created_at, updated_at)
SELECT r.id, caps.capacity, timezone('utc', now()), timezone('utc', now())
FROM public.restaurants r
CROSS JOIN (VALUES (2), (4), (6), (8), (10)) AS caps(capacity);

-- Zone layout (5 per restaurant)
WITH zone_defs AS (
    SELECT * FROM (
        VALUES
            ('Main Dining',     1),
            ('Bar Area',        2),
            ('Patio',           3),
            ('Private Room',    4),
            ('Outdoor Garden',  5)
    ) AS z(name, sort_order)
)
INSERT INTO public.zones (id, restaurant_id, name, sort_order, created_at, updated_at)
SELECT gen_random_uuid(), r.id, z.name, z.sort_order, timezone('utc', now()), timezone('utc', now())
FROM public.restaurants r
CROSS JOIN zone_defs z;

-- Table inventory (40 tables per restaurant distributed across zones)
WITH zone_lookup AS (
    SELECT z.*, r.slug
    FROM public.zones z
    JOIN public.restaurants r ON r.id = z.restaurant_id
),
layout AS (
    SELECT * FROM (
        VALUES
            ('Main Dining', 'MD-01', 2, 1, 2, 'dining', 'standard'),
            ('Main Dining', 'MD-02', 2, 1, 2, 'dining', 'standard'),
            ('Main Dining', 'MD-03', 4, 2, 4, 'dining', 'standard'),
            ('Main Dining', 'MD-04', 4, 2, 4, 'dining', 'booth'),
            ('Main Dining', 'MD-05', 4, 2, 4, 'dining', 'standard'),
            ('Main Dining', 'MD-06', 4, 2, 4, 'dining', 'booth'),
            ('Main Dining', 'MD-07', 6, 3, 6, 'dining', 'standard'),
            ('Main Dining', 'MD-08', 6, 3, 6, 'dining', 'standard'),
            ('Main Dining', 'MD-09', 8, 4, 8, 'dining', 'standard'),
            ('Main Dining', 'MD-10', 8, 4, 8, 'dining', 'booth'),
            ('Main Dining', 'MD-11', 10, 5, 10, 'dining', 'standard'),
            ('Main Dining', 'MD-12', 10, 5, 10, 'dining', 'standard'),
            ('Bar Area',    'BA-01', 2, 1, 2, 'bar',    'high_top'),
            ('Bar Area',    'BA-02', 2, 1, 2, 'bar',    'high_top'),
            ('Bar Area',    'BA-03', 4, 2, 4, 'bar',    'high_top'),
            ('Bar Area',    'BA-04', 4, 2, 4, 'bar',    'high_top'),
            ('Bar Area',    'BA-05', 4, 2, 4, 'lounge', 'sofa'),
            ('Bar Area',    'BA-06', 4, 2, 4, 'lounge', 'sofa'),
            ('Bar Area',    'BA-07', 6, 3, 6, 'bar',    'high_top'),
            ('Bar Area',    'BA-08', 6, 3, 6, 'bar',    'high_top'),
            ('Patio',       'PT-01', 2, 1, 2, 'patio',  'standard'),
            ('Patio',       'PT-02', 2, 1, 2, 'patio',  'standard'),
            ('Patio',       'PT-03', 4, 2, 4, 'patio',  'standard'),
            ('Patio',       'PT-04', 4, 2, 4, 'patio',  'standard'),
            ('Patio',       'PT-05', 6, 3, 6, 'patio',  'standard'),
            ('Patio',       'PT-06', 6, 3, 6, 'patio',  'standard'),
            ('Patio',       'PT-07', 8, 4, 8, 'patio',  'standard'),
            ('Patio',       'PT-08', 8, 4, 8, 'patio',  'standard'),
            ('Private Room','PR-01', 4, 2, 6, 'private','standard'),
            ('Private Room','PR-02', 4, 2, 6, 'private','standard'),
            ('Private Room','PR-03', 6, 3, 8, 'private','standard'),
            ('Private Room','PR-04', 6, 3, 8, 'private','standard'),
            ('Private Room','PR-05', 10,5,10, 'private','standard'),
            ('Private Room','PR-06', 10,5,10, 'private','standard'),
            ('Outdoor Garden','OG-01', 2, 1, 2, 'patio','standard'),
            ('Outdoor Garden','OG-02', 4, 2, 4, 'patio','standard'),
            ('Outdoor Garden','OG-03', 4, 2, 4, 'patio','standard'),
            ('Outdoor Garden','OG-04', 6, 3, 6, 'patio','standard'),
            ('Outdoor Garden','OG-05', 6, 3, 6, 'patio','standard'),
            ('Outdoor Garden','OG-06', 8, 4, 8, 'patio','standard')
    ) AS l(zone_name, table_number, capacity, min_party, max_party, category, seating_type)
)
INSERT INTO public.table_inventory (id, restaurant_id, table_number, capacity, min_party_size, max_party_size, section, status, position, notes, created_at, updated_at, zone_id, category, seating_type, mobility, active)
SELECT
    gen_random_uuid(),
    zl.restaurant_id,
    l.table_number,
    l.capacity,
    l.min_party,
    l.max_party,
    l.zone_name,
    'available',
    NULL,
    CONCAT(l.zone_name, ' seating'),
    timezone('utc', now()),
    timezone('utc', now()),
    zl.id,
    l.category::public.table_category,
    l.seating_type::public.table_seating_type,
    'movable',
    true
FROM zone_lookup zl
JOIN layout l ON l.zone_name = zl.name;

-- Table adjacencies for allocator merge heuristics
INSERT INTO public.table_adjacencies (table_a, table_b, created_at)
SELECT DISTINCT ON (pairs.table_a, pairs.table_b)
    pairs.table_a,
    pairs.table_b,
    timezone('utc', now())
FROM (
    SELECT
        t1.id AS table_a,
        t2.id AS table_b,
        t1.restaurant_id,
        t1.zone_id
    FROM public.table_inventory t1
    JOIN public.table_inventory t2
      ON t1.restaurant_id = t2.restaurant_id
     AND t1.zone_id = t2.zone_id
     AND t1.id < t2.id
    WHERE t1.category = t2.category
      AND ABS(t1.capacity - t2.capacity) <= 2
) AS pairs;

-- -----------------------------------------------------------------------------
-- Stage 5: customers & loyalty programs
-- -----------------------------------------------------------------------------
WITH customer_base AS (
    SELECT
        r.id AS restaurant_id,
        r.slug,
        g.seq
    FROM public.restaurants r
    CROSS JOIN LATERAL generate_series(1, 120) AS g(seq)
),
customer_rows AS (
    SELECT
        gen_random_uuid() AS id,
        cb.restaurant_id,
        LOWER(CONCAT(cb.slug, '.guest', cb.seq, '@example.com')) AS email,
        INITCAP(replace(cb.slug, '-', ' ')) || ' Guest ' || cb.seq AS full_name,
        '+447' || LPAD((ROW_NUMBER() OVER (ORDER BY cb.restaurant_id, cb.seq))::text, 9, '0') AS phone,
        (cb.seq % 3 = 0) AS marketing_opt_in,
        CASE WHEN cb.seq % 20 = 0 THEN 'VIP customer' ELSE NULL END AS notes,
        timezone('utc', now()) - (cb.seq || ' minutes')::interval AS created_at,
        timezone('utc', now()) AS updated_at
    FROM customer_base cb
)
INSERT INTO public.customers (id, restaurant_id, full_name, email, phone, marketing_opt_in, auth_user_id, notes, created_at, updated_at)
SELECT
    c.id,
    c.restaurant_id,
    c.full_name,
    c.email,
    c.phone,
    c.marketing_opt_in,
    NULL,
    c.notes,
    c.created_at,
    c.updated_at
FROM customer_rows c;

INSERT INTO public.loyalty_programs (id, restaurant_id, name, is_active, accrual_rule, tier_definitions, created_at, updated_at, pilot_only)
SELECT
    gen_random_uuid(),
    r.id,
    CONCAT(r.name, ' Loyalty Club'),
    true,
    jsonb_build_object(
        'type', 'per_guest',
        'base_points', 10,
        'points_per_guest', 5,
        'minimum_party_size', 1
    ),
    jsonb_build_array(
        jsonb_build_object('tier', 'bronze', 'min_points', 0),
        jsonb_build_object('tier', 'silver', 'min_points', 250),
        jsonb_build_object('tier', 'gold', 'min_points', 600),
        jsonb_build_object('tier', 'platinum', 'min_points', 1200)
    ),
    timezone('utc', now()),
    timezone('utc', now()),
    false
FROM public.restaurants r;

-- -----------------------------------------------------------------------------
-- Stage 6: booking generation across past/today/future
-- -----------------------------------------------------------------------------
WITH date_ctx AS (
    SELECT
        current_date AS today,
        (current_date - interval '3 days')::date AS past_day,
        (current_date + interval '5 days')::date AS future_day
),
restaurants AS (
    SELECT id, timezone, name FROM public.restaurants
),
customer_counts AS (
    SELECT restaurant_id, COUNT(*) AS cnt
    FROM public.customers
    GROUP BY restaurant_id
),
customers_ranked AS (
    SELECT
        c.id,
        c.restaurant_id,
        c.email,
        c.full_name,
        c.phone,
        c.marketing_opt_in,
        ROW_NUMBER() OVER (PARTITION BY c.restaurant_id ORDER BY c.created_at, c.id) AS rn
    FROM public.customers c
),
booking_payload AS (
    SELECT
        r.id AS restaurant_id,
        r.timezone,
        g.seq,
        CASE
            WHEN g.seq <= 60 THEN dc.past_day
            WHEN g.seq <= 120 THEN dc.today
            ELSE dc.future_day
        END AS booking_date,
        CASE (g.seq - 1) % 3
            WHEN 0 THEN 'lunch'
            WHEN 1 THEN 'drinks'
            ELSE 'dinner'
        END AS booking_type,
        CASE (g.seq - 1) % 3
            WHEN 0 THEN (time '12:00' + ((g.seq - 1) % 8) * interval '15 minutes')
            WHEN 1 THEN (time '15:00' + ((g.seq - 1) % 6) * interval '15 minutes')
            ELSE (time '18:00' + ((g.seq - 1) % 10) * interval '15 minutes')
        END AS start_time,
        CASE (g.seq - 1) % 3
            WHEN 0 THEN (time '12:00' + ((g.seq - 1) % 8) * interval '15 minutes') + interval '90 minutes'
            WHEN 1 THEN (time '15:00' + ((g.seq - 1) % 6) * interval '15 minutes') + interval '60 minutes'
            ELSE (time '18:00' + ((g.seq - 1) % 10) * interval '15 minutes') + interval '120 minutes'
        END AS end_time,
        2 + ((g.seq + 1) % 6) AS party_size,
        CASE WHEN g.seq % 5 = 0 THEN 'outdoor' ELSE 'indoor' END AS seating_preference,
        CASE
            WHEN g.seq <= 60 AND g.seq % 10 = 0 THEN 'cancelled'
            WHEN g.seq > 160 THEN 'pending'
            WHEN g.seq % 12 = 0 THEN 'checked_in'
            ELSE 'confirmed'
        END AS status,
        (g.seq % 4 = 0) AS marketing_opt_in
    FROM restaurants r
    CROSS JOIN date_ctx dc
    CROSS JOIN LATERAL generate_series(1, 180) AS g(seq)
),
booking_with_customers AS (
    SELECT
        bp.restaurant_id,
        bp.timezone,
        bp.seq,
        bp.booking_date,
        bp.booking_type,
        bp.start_time,
        bp.end_time,
        bp.party_size,
        bp.seating_preference,
        bp.status,
        bp.marketing_opt_in,
        cust.id AS customer_id,
        cust.email AS customer_email,
        cust.full_name AS customer_name,
        cust.phone AS customer_phone,
        cust.marketing_opt_in AS customer_marketing
    FROM booking_payload bp
    JOIN customer_counts cc ON cc.restaurant_id = bp.restaurant_id
    JOIN customers_ranked cust
      ON cust.restaurant_id = bp.restaurant_id
     AND cust.rn = ((bp.seq - 1) % cc.cnt) + 1
)
INSERT INTO public.bookings (id, restaurant_id, customer_id, booking_date, start_time, end_time, start_at, end_at, party_size, seating_preference, status, customer_name, customer_email, customer_phone, notes, reference, source, created_at, updated_at, booking_type, marketing_opt_in, details, checked_in_at)
SELECT
    gen_random_uuid(),
    bwc.restaurant_id,
    bwc.customer_id,
    bwc.booking_date,
    bwc.start_time,
    bwc.end_time,
    make_timestamptz(EXTRACT(YEAR FROM bwc.booking_date)::int, EXTRACT(MONTH FROM bwc.booking_date)::int, EXTRACT(DAY FROM bwc.booking_date)::int, EXTRACT(HOUR FROM bwc.start_time)::int, EXTRACT(MINUTE FROM bwc.start_time)::int, 0, bwc.timezone),
    make_timestamptz(EXTRACT(YEAR FROM bwc.booking_date)::int, EXTRACT(MONTH FROM bwc.booking_date)::int, EXTRACT(DAY FROM bwc.booking_date)::int, EXTRACT(HOUR FROM bwc.end_time)::int, EXTRACT(MINUTE FROM bwc.end_time)::int, 0, bwc.timezone),
    bwc.party_size,
    bwc.seating_preference::public.seating_preference_type,
    bwc.status::public.booking_status,
    bwc.customer_name,
    bwc.customer_email,
    bwc.customer_phone,
    CASE
        WHEN bwc.party_size >= 8 THEN 'Large party – ensure combined seating'
        WHEN bwc.status = 'cancelled' THEN 'Cancelled due to guest request'
        ELSE NULL
    END,
    'LP-' || upper(substring(md5(bwc.restaurant_id::text || bwc.seq::text || bwc.booking_date::text), 1, 8)),
    'web',
    timezone('utc', now()) - (bwc.seq || ' minutes')::interval,
    timezone('utc', now()) - (bwc.seq || ' minutes')::interval,
    bwc.booking_type,
    bwc.marketing_opt_in OR bwc.customer_marketing,
    jsonb_build_object(
        'occasion', bwc.booking_type,
        'requested_area', bwc.seating_preference,
        'special_requests', CASE WHEN bwc.seq % 7 = 0 THEN 'Cake presentation' ELSE NULL END
    ),
    CASE
        WHEN bwc.status = 'checked_in' THEN make_timestamptz(EXTRACT(YEAR FROM bwc.booking_date)::int, EXTRACT(MONTH FROM bwc.booking_date)::int, EXTRACT(DAY FROM bwc.booking_date)::int, EXTRACT(HOUR FROM bwc.start_time)::int, EXTRACT(MINUTE FROM bwc.start_time)::int, 0, bwc.timezone)
        ELSE NULL
    END
FROM booking_with_customers bwc;

-- -----------------------------------------------------------------------------
-- Stage 7: booking lifecycle artifacts
-- -----------------------------------------------------------------------------
-- Booking state history
INSERT INTO public.booking_state_history (id, booking_id, from_status, to_status, changed_by, changed_at, reason, metadata)
SELECT
    nextval('public.booking_state_history_id_seq'),
    b.id,
    'pending'::public.booking_status,
    CASE 
        WHEN b.status = 'cancelled' THEN 'cancelled'::public.booking_status 
        WHEN b.status = 'pending' THEN 'pending'::public.booking_status 
        ELSE 'confirmed'::public.booking_status 
    END,
    NULL::uuid,
    b.created_at + interval '5 minutes',
    CASE 
        WHEN b.status = 'cancelled' THEN 'Guest called to cancel'
        WHEN b.status = 'pending' THEN 'Awaiting table allocation'
        ELSE 'Auto-confirmed by allocator' 
    END,
    jsonb_build_object('source', 'seed')
FROM public.bookings b
UNION ALL
SELECT
    nextval('public.booking_state_history_id_seq'),
    b.id,
    'confirmed'::public.booking_status,
    'checked_in'::public.booking_status,
    NULL::uuid,
    b.start_at - interval '10 minutes',
    'Front-of-house checked in guest',
    jsonb_build_object('method', 'manual')
FROM public.bookings b
WHERE b.status = 'checked_in'
UNION ALL
SELECT
    nextval('public.booking_state_history_id_seq'),
    b.id,
    'confirmed'::public.booking_status,
    'cancelled'::public.booking_status,
    NULL::uuid,
    b.booking_date::timestamp + interval '2 hours',
    'Guest cancellation recorded',
    jsonb_build_object('refund', true)
FROM public.bookings b
WHERE b.status = 'cancelled';

-- Booking versions snapshot
INSERT INTO public.booking_versions (version_id, booking_id, restaurant_id, change_type, changed_by, changed_at, old_data, new_data, created_at)
SELECT
    gen_random_uuid(),
    b.id,
    b.restaurant_id,
    'created',
    'seed-script',
    b.created_at,
    NULL,
    to_jsonb(b) - 'confirmation_token' - 'confirmation_token_expires_at',
    timezone('utc', now())
FROM public.bookings b;

-- Booking slots derived from service periods
WITH date_ctx AS (
    SELECT
        current_date AS today,
        (current_date - interval '3 days')::date AS past_day,
        (current_date + interval '5 days')::date AS future_day
),
slots AS (
    SELECT
        rsp.restaurant_id,
        rsp.id AS service_period_id,
        CASE bucket
            WHEN 'past' THEN dc.past_day
            WHEN 'today' THEN dc.today
            ELSE dc.future_day
        END AS slot_date,
        (rsp.start_time + interval '15 minutes' * gs.idx)::time AS slot_time,
        rsp.booking_option,
        CASE
            WHEN rsp.booking_option = 'drinks' THEN 80
            WHEN rsp.booking_option = 'lunch' THEN 140
            ELSE 160
        END AS available_capacity
    FROM public.restaurant_service_periods rsp
    CROSS JOIN date_ctx dc
    CROSS JOIN LATERAL (
        SELECT * FROM (
            VALUES ('past'), ('today'), ('future')
        ) AS buckets(bucket)
    ) AS b(bucket)
    CROSS JOIN LATERAL generate_series(0, GREATEST(0, (EXTRACT(EPOCH FROM (rsp.end_time - rsp.start_time)) / 900)::int - 1)) AS gs(idx)
)
INSERT INTO public.booking_slots (id, restaurant_id, slot_date, slot_time, service_period_id, available_capacity, reserved_count, version, created_at, updated_at)
SELECT DISTINCT ON (s.restaurant_id, s.slot_date, s.slot_time)
    gen_random_uuid(),
    s.restaurant_id,
    s.slot_date,
    s.slot_time,
    s.service_period_id,
    s.available_capacity,
    COALESCE(bc.reserved_count, 0),
    1,
    timezone('utc', now()),
    timezone('utc', now())
FROM slots s
LEFT JOIN (
    SELECT
        b.restaurant_id,
        b.booking_date AS slot_date,
        b.start_time AS slot_time,
        COUNT(*) AS reserved_count
    FROM public.bookings b
    GROUP BY b.restaurant_id, b.booking_date, b.start_time
) AS bc
  ON bc.restaurant_id = s.restaurant_id
 AND bc.slot_date = s.slot_date
 AND bc.slot_time = s.slot_time;

-- Booking table assignments (minimal set to demonstrate functionality)
-- Assign only 1 booking per restaurant to avoid time conflicts
WITH first_bookings AS (
    SELECT DISTINCT ON (b.restaurant_id)
        b.id AS booking_id,
        b.restaurant_id,
        b.start_at,
        b.end_at,
        b.party_size,
        b.booking_date,
        b.start_time
    FROM public.bookings b
    WHERE b.status IN ('confirmed', 'checked_in')
    ORDER BY b.restaurant_id, b.start_at
),
suitable_tables AS (
    SELECT DISTINCT ON (fb.booking_id)
        fb.booking_id,
        fb.restaurant_id,
        fb.start_at,
        fb.end_at,
        fb.party_size,
        fb.booking_date,
        fb.start_time,
        t.id AS table_id
    FROM first_bookings fb
    JOIN public.table_inventory t
      ON t.restaurant_id = fb.restaurant_id
     AND t.capacity >= fb.party_size
     AND t.active
    ORDER BY fb.booking_id, t.capacity, t.table_number
)
INSERT INTO public.booking_table_assignments (id, booking_id, table_id, slot_id, assigned_at, assigned_by, notes, created_at, updated_at, start_at, end_at)
SELECT
    gen_random_uuid(),
    st.booking_id,
    st.table_id,
    bs.id AS slot_id,
    timezone('utc', now()) - interval '30 minutes',
    '6babb126-c166-41a0-b9f2-57ef473b179b',
    CASE WHEN st.party_size >= 8 THEN 'Requires merge handler' ELSE NULL END,
    timezone('utc', now()),
    timezone('utc', now()),
    st.start_at,
    st.end_at
FROM suitable_tables st
JOIN public.bookings b ON b.id = st.booking_id
JOIN public.booking_slots bs
  ON bs.restaurant_id = b.restaurant_id
 AND bs.slot_date = b.booking_date
 AND bs.slot_time = b.start_time;

-- Allocations mirror table assignments
INSERT INTO public.allocations (id, booking_id, resource_type, resource_id, created_at, updated_at, shadow, restaurant_id, "window", created_by, is_maintenance)
SELECT
    gen_random_uuid(),
    bta.booking_id,
    'table',
    bta.table_id,
    timezone('utc', now()) - interval '30 minutes',
    timezone('utc', now()),
    false,
    b.restaurant_id,
    tstzrange(bta.start_at, bta.end_at, '[)'),
    '6babb126-c166-41a0-b9f2-57ef473b179b',
    false
FROM public.booking_table_assignments bta
JOIN public.bookings b ON b.id = bta.booking_id;

-- Assignment idempotency ledger per booking
INSERT INTO public.booking_assignment_idempotency (booking_id, idempotency_key, table_ids, assignment_window, created_at)
SELECT
    b.id,
    CONCAT('seed-', substring(b.reference from 1 for 8)),
    ARRAY_AGG(bta.table_id ORDER BY bta.table_id),
    tstzrange(MIN(bta.start_at), MAX(bta.end_at), '[)'),
    timezone('utc', now())
FROM public.bookings b
JOIN public.booking_table_assignments bta ON bta.booking_id = b.id
GROUP BY b.id, b.reference;

-- -----------------------------------------------------------------------------
-- Stage 8: table holds & availability windows
-- -----------------------------------------------------------------------------
-- Enable strict enforcement so triggers populate table_hold_windows automatically.
SELECT public.set_hold_conflict_enforcement(true);

WITH future_assignments AS (
    SELECT
        bta.booking_id,
        bta.table_id,
        bta.start_at,
        bta.end_at,
        bta.table_id AS assigned_table_id,
        t.zone_id,
        b.restaurant_id,
        b.status,
        ROW_NUMBER() OVER (PARTITION BY b.restaurant_id ORDER BY b.booking_date, b.start_time) AS rn
    FROM public.booking_table_assignments bta
    JOIN public.bookings b ON b.id = bta.booking_id
    JOIN public.table_inventory t ON t.id = bta.table_id
    WHERE b.booking_date >= current_date
      AND b.status IN ('pending', 'confirmed')
),
inserted_holds AS (
    INSERT INTO public.table_holds (id, restaurant_id, booking_id, zone_id, start_at, end_at, expires_at, created_by, created_at, updated_at, metadata)
    SELECT
        gen_random_uuid(),
        fa.restaurant_id,
        fa.booking_id,
        fa.zone_id,
        fa.start_at - interval '20 minutes',
        fa.start_at,
        fa.start_at - interval '5 minutes',
        '6babb126-c166-41a0-b9f2-57ef473b179b',
        timezone('utc', now()),
        timezone('utc', now()),
        jsonb_build_object('seeded', true, 'status_before_confirmation', fa.status)
    FROM future_assignments fa
    WHERE fa.rn <= 12
    RETURNING id, booking_id
)
INSERT INTO public.table_hold_members (id, hold_id, table_id, created_at)
SELECT
    gen_random_uuid(),
    ih.id,
    bta.table_id,
    timezone('utc', now())
FROM inserted_holds ih
JOIN public.booking_table_assignments bta ON bta.booking_id = ih.booking_id;

-- Disable strict enforcement after seeding
SELECT public.set_hold_conflict_enforcement(false);

-- -----------------------------------------------------------------------------
-- Stage 9: analytics, observability, loyalty totals, invites
-- -----------------------------------------------------------------------------
INSERT INTO public.observability_events (id, created_at, source, event_type, severity, context, restaurant_id, booking_id)
SELECT
    gen_random_uuid(),
    b.created_at + interval '1 minute',
    CASE WHEN b.status = 'cancelled' THEN 'capacity.rpc' ELSE 'capacity.selector' END,
    CASE WHEN b.status = 'cancelled' THEN 'capacity.rpc.conflict' ELSE 'capacity.selector.assignment' END,
    CASE WHEN b.status = 'cancelled' THEN 'warning' ELSE 'info' END,
    jsonb_build_object(
        'reference', b.reference,
        'partySize', b.party_size,
        'tableIds', ARRAY_AGG(bta.table_id)
    ),
    b.restaurant_id,
    b.id
FROM public.bookings b
LEFT JOIN public.booking_table_assignments bta ON bta.booking_id = b.id
GROUP BY b.id, b.created_at, b.status;

INSERT INTO public.analytics_events (id, event_type, schema_version, restaurant_id, booking_id, customer_id, emitted_by, payload, occurred_at, created_at)
SELECT
    gen_random_uuid(),
    CASE WHEN b.status = 'cancelled' THEN 'booking.cancelled'::public.analytics_event_type ELSE 'booking.created'::public.analytics_event_type END,
    'v1',
    b.restaurant_id,
    b.id,
    b.customer_id,
    'seed',
    jsonb_build_object('reference', b.reference, 'partySize', b.party_size, 'status', b.status),
    b.created_at,
    timezone('utc', now())
FROM public.bookings b;

INSERT INTO public.loyalty_points (id, restaurant_id, customer_id, total_points, tier, created_at, updated_at)
SELECT
    gen_random_uuid(),
    b.restaurant_id,
    b.customer_id,
    SUM(b.party_size) * 5,
    CASE
        WHEN SUM(b.party_size) * 5 >= 1200 THEN 'platinum'
        WHEN SUM(b.party_size) * 5 >= 600 THEN 'gold'
        WHEN SUM(b.party_size) * 5 >= 250 THEN 'silver'
        ELSE 'bronze'
    END::public.loyalty_tier,
    timezone('utc', now()),
    timezone('utc', now())
FROM public.bookings b
GROUP BY b.restaurant_id, b.customer_id;

INSERT INTO public.loyalty_point_events (id, restaurant_id, customer_id, booking_id, points_change, event_type, schema_version, metadata, created_at)
SELECT
    gen_random_uuid(),
    b.restaurant_id,
    b.customer_id,
    b.id,
    b.party_size * 5,
    'booking_awarded',
    1,
    jsonb_build_object('reference', b.reference),
    b.created_at
FROM public.bookings b
WHERE b.status IN ('confirmed', 'checked_in');

INSERT INTO public.customer_profiles (customer_id, first_booking_at, last_booking_at, total_bookings, total_covers, total_cancellations, marketing_opt_in, last_marketing_opt_in_at, preferences, notes, updated_at)
SELECT
    b.customer_id,
    MIN(b.start_at),
    MAX(b.start_at),
    COUNT(*) FILTER (WHERE b.status <> 'cancelled'),
    SUM(b.party_size) FILTER (WHERE b.status <> 'cancelled'),
    COUNT(*) FILTER (WHERE b.status = 'cancelled'),
    BOOL_OR(b.marketing_opt_in),
    MAX(CASE WHEN b.marketing_opt_in THEN b.created_at ELSE NULL END),
    jsonb_build_object('favouriteOccasion', mode() WITHIN GROUP (ORDER BY b.booking_type)),
    MAX(CASE WHEN b.party_size >= 8 THEN 'Prefers large gatherings' ELSE NULL END),
    timezone('utc', now())
FROM public.bookings b
GROUP BY b.customer_id;

INSERT INTO public.restaurant_invites (id, restaurant_id, email, role, token_hash, expires_at, created_at)
SELECT
    gen_random_uuid(),
    r.id,
    CONCAT('temp.manager+', r.slug, '@example.com'),
    'manager',
    md5(random()::text),
    timezone('utc', now()) + interval '7 days',
    timezone('utc', now())
FROM public.restaurants r;

INSERT INTO public.profile_update_requests (id, profile_id, idempotency_key, payload_hash, applied_at)
SELECT
    gen_random_uuid(),
    '6babb126-c166-41a0-b9f2-57ef473b179b',
    'seed-owner-update',
    md5(jsonb_build_object('email', 'owner+updated@lapeninns.com', 'phone', '+447700900099')::text),
    timezone('utc', now())
ON CONFLICT (profile_id, idempotency_key) DO NOTHING;

-- Optional manager grants if the user exists
DO $$
DECLARE
    _manager_id uuid;
BEGIN
    SELECT id INTO _manager_id FROM auth.users WHERE email = lower('amanshresthaaaaa@gmail.com');

    IF _manager_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, email, name, phone, has_access)
        VALUES (_manager_id, lower('amanshresthaaaaa@gmail.com'), 'Aman Shrestha', NULL, true)
        ON CONFLICT (id) DO UPDATE SET has_access = true, updated_at = timezone('utc', now());

        INSERT INTO public.restaurant_memberships (user_id, restaurant_id, role, created_at)
        SELECT _manager_id, r.id, 'manager', timezone('utc', now())
        FROM public.restaurants r
        ON CONFLICT (user_id, restaurant_id) DO UPDATE SET role = EXCLUDED.role;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Stage 10: Seed yield management data
-- -----------------------------------------------------------------------------
-- Seed demand profiles: default multipliers for each restaurant, day, service
INSERT INTO public.demand_profiles (restaurant_id, day_of_week, service_window, multiplier)
SELECT
    r.id,
    dow,
    sw.service_window,
    CASE
        WHEN dow IN (5, 6) THEN 1.5 -- Friday/Saturday higher demand
        WHEN sw.service_window = 'dinner' THEN 1.3
        WHEN sw.service_window = 'lunch' THEN 1.1
        ELSE 1.0
    END
FROM public.restaurants r
CROSS JOIN generate_series(0, 6) AS dow
CROSS JOIN (VALUES ('lunch'), ('drinks'), ('dinner')) AS sw(service_window)
ON CONFLICT DO NOTHING;

-- Seed table scarcity metrics: compute based on table frequency per restaurant
INSERT INTO public.table_scarcity_metrics (restaurant_id, table_type, scarcity_score)
SELECT
    r.id,
    CONCAT(t.capacity, '-seater') AS table_type,
    GREATEST(0.1, LEAST(1.0, 1.0 - (COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM public.table_inventory ti WHERE ti.restaurant_id = r.id), 0))))
FROM public.restaurants r
JOIN public.table_inventory t ON t.restaurant_id = r.id
GROUP BY r.id, t.capacity
ON CONFLICT (restaurant_id, table_type) DO UPDATE
SET scarcity_score = EXCLUDED.scarcity_score,
    computed_at = timezone('utc', now());

COMMIT;
