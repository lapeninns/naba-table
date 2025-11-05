-- Seed file: Single Restaurant with 50 Bookings
-- Restaurant: Demo Restaurant with 2 zones (Dining 1 + Dining 2)
-- Dining 1: 3 tables of 2 seats, 5 tables of 4 seats (all movable)
-- Dining 2: 6 tables of 4 seats, 2 tables of 2 seats (all movable)
-- Total: 50 bookings across multiple dates

BEGIN;

SET LOCAL client_min_messages = warning;
SET LOCAL search_path = public;

-- -----------------------------------------------------------------------------
-- Stage 0: Configuration
-- -----------------------------------------------------------------------------
SELECT set_config('app.holds.strict_conflicts.enabled', 'off', true);

-- -----------------------------------------------------------------------------
-- Stage 1: Truncate existing data for clean slate
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
-- Stage 2: Static catalogues and feature configuration
-- -----------------------------------------------------------------------------
INSERT INTO public.booking_occasions (key, label, short_label, description, availability, default_duration_minutes, display_order, is_active, created_at, updated_at)
VALUES
    (
        'lunch',
        'Lunch',
        'Lunch',
        'Midday dining experience',
        '[{"kind":"time_window","start":"11:45","end":"15:30"}]'::jsonb,
        90,
        10,
        true,
        timezone('utc', now()),
        timezone('utc', now())
    ),
    (
        'dinner',
        'Dinner',
        'Dinner',
        'Evening service',
        '[{"kind":"time_window","start":"17:00","end":"23:00"}]'::jsonb,
        120,
        20,
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

-- -----------------------------------------------------------------------------
-- Stage 3: Staff account
-- -----------------------------------------------------------------------------
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
    '6babb126-c166-41a0-b9f2-57ef473b179b',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner@demorestuarant.com',
    '$2a$10$zW3U70B4rxY1NpTy9M6t4O0bVwQHmxJf8b0Dm5jul1n/6XHlzZpGq',
    timezone('utc', now()),
    '{"provider":"email"}'::jsonb,
    '{"display_name":"Demo Owner"}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
)
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.profiles (id, email, name, phone, image, has_access, created_at, updated_at)
VALUES (
    '6babb126-c166-41a0-b9f2-57ef473b179b',
    'owner@demorestuarant.com',
    'Demo Owner',
    '+447700900001',
    NULL,
    true,
    timezone('utc', now()),
    timezone('utc', now())
);

-- -----------------------------------------------------------------------------
-- Stage 4: Create single restaurant
-- -----------------------------------------------------------------------------
INSERT INTO public.restaurants (id, name, slug, timezone, capacity, contact_email, contact_phone, address, booking_policy, reservation_interval_minutes, reservation_default_duration_minutes, reservation_last_seating_buffer_minutes, is_active, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'Demo Restaurant',
    'demo-restaurant',
    'Europe/London',
    180,
    'contact@demorestuarant.com',
    '01234 567890',
    '123 Main Street, Demo City, DC1 1AA',
    'Online booking available 7 days a week',
    15,
    90,
    120,
    true,
    timezone('utc', now()),
    timezone('utc', now())
);

-- Link owner to restaurant
INSERT INTO public.restaurant_memberships (restaurant_id, user_id, role, created_at)
SELECT r.id, '6babb126-c166-41a0-b9f2-57ef473b179b', 'owner', timezone('utc', now())
FROM public.restaurants r
WHERE r.slug = 'demo-restaurant';

-- Operating hours: Mon-Sun open
INSERT INTO public.restaurant_operating_hours (id, restaurant_id, day_of_week, opens_at, closes_at, is_closed, notes, created_at, updated_at)
SELECT
    gen_random_uuid(),
    r.id,
    dow,
    time '12:00',
    time '22:00',
    false,
    NULL,
    timezone('utc', now()),
    timezone('utc', now())
FROM public.restaurants r
CROSS JOIN generate_series(0, 6) AS dow
WHERE r.slug = 'demo-restaurant';

-- Service periods
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
CROSS JOIN generate_series(0, 6) AS dow
CROSS JOIN LATERAL (
    VALUES
        ('Lunch Service',  time '12:00', time '15:00', 'lunch'),
        ('Dinner Service', time '17:00', time '22:00', 'dinner')
) AS sp(name, start_time, end_time, booking_option)
WHERE r.slug = 'demo-restaurant';

-- Allowed capacities
INSERT INTO public.allowed_capacities (restaurant_id, capacity, created_at, updated_at)
SELECT r.id, caps.capacity, timezone('utc', now()), timezone('utc', now())
FROM public.restaurants r
CROSS JOIN (VALUES (2), (4), (6), (8)) AS caps(capacity)
WHERE r.slug = 'demo-restaurant';

-- -----------------------------------------------------------------------------
-- Stage 5: Create 2 zones (Dining 1 + Dining 2)
-- -----------------------------------------------------------------------------
INSERT INTO public.zones (id, restaurant_id, name, sort_order, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    r.id,
    z.name,
    z.sort_order,
    timezone('utc', now()),
    timezone('utc', now())
FROM public.restaurants r
CROSS JOIN (
    VALUES
        ('Dining 1', 1),
        ('Dining 2', 2)
) AS z(name, sort_order)
WHERE r.slug = 'demo-restaurant';

-- -----------------------------------------------------------------------------
-- Stage 6: Create tables
-- Dining 1: 3 tables of 2 seats, 5 tables of 4 seats (all movable)
-- Dining 2: 6 tables of 4 seats, 2 tables of 2 seats (all movable)
-- -----------------------------------------------------------------------------
WITH restaurant_ctx AS (
    SELECT id, timezone FROM public.restaurants WHERE slug = 'demo-restaurant'
),
zone_lookup AS (
    SELECT z.id, z.name, z.restaurant_id
    FROM public.zones z
    JOIN restaurant_ctx r ON r.id = z.restaurant_id
),
table_definitions AS (
    SELECT * FROM (
        VALUES
            -- Dining 1: 3 tables of 2 seats
            ('Dining 1', 'D1-T01', 2, 1, 2, 'dining', 'standard', 'movable'),
            ('Dining 1', 'D1-T02', 2, 1, 2, 'dining', 'standard', 'movable'),
            ('Dining 1', 'D1-T03', 2, 1, 2, 'dining', 'standard', 'movable'),
            -- Dining 1: 5 tables of 4 seats
            ('Dining 1', 'D1-T04', 4, 2, 4, 'dining', 'standard', 'movable'),
            ('Dining 1', 'D1-T05', 4, 2, 4, 'dining', 'standard', 'movable'),
            ('Dining 1', 'D1-T06', 4, 2, 4, 'dining', 'standard', 'movable'),
            ('Dining 1', 'D1-T07', 4, 2, 4, 'dining', 'standard', 'movable'),
            ('Dining 1', 'D1-T08', 4, 2, 4, 'dining', 'standard', 'movable'),
            -- Dining 2: 6 tables of 4 seats
            ('Dining 2', 'D2-T01', 4, 2, 4, 'dining', 'standard', 'movable'),
            ('Dining 2', 'D2-T02', 4, 2, 4, 'dining', 'standard', 'movable'),
            ('Dining 2', 'D2-T03', 4, 2, 4, 'dining', 'standard', 'movable'),
            ('Dining 2', 'D2-T04', 4, 2, 4, 'dining', 'standard', 'movable'),
            ('Dining 2', 'D2-T05', 4, 2, 4, 'dining', 'standard', 'movable'),
            ('Dining 2', 'D2-T06', 4, 2, 4, 'dining', 'standard', 'movable'),
            -- Dining 2: 2 tables of 2 seats
            ('Dining 2', 'D2-T07', 2, 1, 2, 'dining', 'standard', 'movable'),
            ('Dining 2', 'D2-T08', 2, 1, 2, 'dining', 'standard', 'movable')
    ) AS t(zone_name, table_number, capacity, min_party, max_party, category, seating_type, mobility)
)
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
SELECT
    gen_random_uuid(),
    zl.restaurant_id,
    td.table_number,
    td.capacity,
    td.min_party,
    td.max_party,
    td.zone_name,
    'available'::public.table_status,
    NULL,
    CONCAT(td.zone_name, ' - ', td.capacity, ' seats'),
    timezone('utc', now()),
    timezone('utc', now()),
    zl.id,
    td.category::public.table_category,
    td.seating_type::public.table_seating_type,
    td.mobility::public.table_mobility,
    true
FROM zone_lookup zl
JOIN table_definitions td ON td.zone_name = zl.name;

-- Table adjacencies (tables in same zone can be combined)
INSERT INTO public.table_adjacencies (table_a, table_b, created_at)
SELECT DISTINCT ON (t1.id, t2.id)
    LEAST(t1.id, t2.id) AS table_a,
    GREATEST(t1.id, t2.id) AS table_b,
    timezone('utc', now())
FROM public.table_inventory t1
JOIN public.table_inventory t2
  ON t1.restaurant_id = t2.restaurant_id
 AND t1.zone_id = t2.zone_id
 AND t1.id < t2.id
WHERE t1.category = t2.category
  AND ABS(t1.capacity - t2.capacity) <= 2;

-- -----------------------------------------------------------------------------
-- Stage 7: Create 50 customers (one per booking)
-- -----------------------------------------------------------------------------
WITH restaurant_ctx AS (
    SELECT id, slug FROM public.restaurants WHERE slug = 'demo-restaurant'
)
INSERT INTO public.customers (id, restaurant_id, full_name, email, phone, marketing_opt_in, auth_user_id, notes, created_at, updated_at)
SELECT
    gen_random_uuid(),
    r.id,
    'Guest ' || LPAD(g.seq::text, 2, '0'),
    'guest' || LPAD(g.seq::text, 2, '0') || '@example.com',
    '+447' || LPAD((700000000 + g.seq)::text, 9, '0'),
    (g.seq % 3 = 0),
    NULL,
    CASE WHEN g.seq % 10 = 0 THEN 'VIP guest' ELSE NULL END,
    timezone('utc', now()) - (g.seq || ' hours')::interval,
    timezone('utc', now())
FROM restaurant_ctx r
CROSS JOIN generate_series(1, 50) AS g(seq);

-- -----------------------------------------------------------------------------
-- Stage 8: Create 50 bookings
-- Distributed across: today, tomorrow, and day after tomorrow
-- Mixed lunch (12:00-15:00) and dinner (17:00-22:00) slots
-- Party sizes: 2, 3, 4, 5, 6
-- -----------------------------------------------------------------------------
WITH restaurant_ctx AS (
    SELECT id, timezone FROM public.restaurants WHERE slug = 'demo-restaurant'
),
date_spread AS (
    SELECT 
        current_date AS today,
        current_date + interval '1 day' AS tomorrow,
        current_date + interval '2 days' AS day_after
),
customer_list AS (
    SELECT 
        c.id,
        c.restaurant_id,
        c.email,
        c.full_name,
        c.phone,
        c.marketing_opt_in,
        ROW_NUMBER() OVER (ORDER BY c.created_at) AS rn
    FROM public.customers c
    JOIN restaurant_ctx r ON r.id = c.restaurant_id
),
booking_specs AS (
    SELECT
        r.id AS restaurant_id,
        r.timezone,
        g.seq,
        -- Distribute dates: 17 today, 17 tomorrow, 16 day after
        CASE
            WHEN g.seq <= 17 THEN ds.today
            WHEN g.seq <= 34 THEN ds.tomorrow
            ELSE ds.day_after
        END AS booking_date,
        -- Alternate between lunch and dinner
        CASE WHEN g.seq % 2 = 1 THEN 'lunch' ELSE 'dinner' END AS booking_type,
        -- Generate time slots
        CASE 
            WHEN g.seq % 2 = 1 THEN 
                time '12:00' + ((g.seq % 12) * interval '15 minutes')
            ELSE 
                time '17:00' + ((g.seq % 20) * interval '15 minutes')
        END AS start_time,
        -- Duration: lunch 90 min, dinner 120 min
        CASE 
            WHEN g.seq % 2 = 1 THEN 
                time '12:00' + ((g.seq % 12) * interval '15 minutes') + interval '90 minutes'
            ELSE 
                time '17:00' + ((g.seq % 20) * interval '15 minutes') + interval '120 minutes'
        END AS end_time,
        -- Party sizes: cycle 2, 3, 4, 5, 6
        2 + ((g.seq - 1) % 5) AS party_size,
        -- Seating preference
        CASE WHEN g.seq % 4 = 0 THEN 'window' ELSE 'indoor' END AS seating_preference,
        -- Status: mostly confirmed, some pending
        CASE 
            WHEN g.seq % 10 = 0 THEN 'pending'
            ELSE 'confirmed'
        END AS status,
        -- Marketing opt-in
        (g.seq % 3 = 0) AS marketing_opt_in
    FROM restaurant_ctx r
    CROSS JOIN date_spread ds
    CROSS JOIN generate_series(1, 50) AS g(seq)
    WHERE g.seq <= 50
)
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
    marketing_opt_in,
    details
)
SELECT
    gen_random_uuid(),
    bs.restaurant_id,
    cl.id,
    bs.booking_date,
    bs.start_time,
    bs.end_time,
    make_timestamptz(
        EXTRACT(YEAR FROM bs.booking_date)::int,
        EXTRACT(MONTH FROM bs.booking_date)::int,
        EXTRACT(DAY FROM bs.booking_date)::int,
        EXTRACT(HOUR FROM bs.start_time)::int,
        EXTRACT(MINUTE FROM bs.start_time)::int,
        0,
        bs.timezone
    ),
    make_timestamptz(
        EXTRACT(YEAR FROM bs.booking_date)::int,
        EXTRACT(MONTH FROM bs.booking_date)::int,
        EXTRACT(DAY FROM bs.booking_date)::int,
        EXTRACT(HOUR FROM bs.end_time)::int,
        EXTRACT(MINUTE FROM bs.end_time)::int,
        0,
        bs.timezone
    ),
    bs.party_size,
    bs.seating_preference::public.seating_preference_type,
    bs.status::public.booking_status,
    cl.full_name,
    cl.email,
    cl.phone,
    CASE 
        WHEN bs.party_size >= 6 THEN 'Large party - may need multiple tables'
        ELSE NULL
    END,
    'DEMO-' || UPPER(substring(md5(bs.restaurant_id::text || bs.seq::text), 1, 8)),
    'web',
    timezone('utc', now()) - (bs.seq || ' minutes')::interval,
    timezone('utc', now()),
    bs.booking_type,
    bs.marketing_opt_in OR cl.marketing_opt_in,
    jsonb_build_object(
        'occasion', bs.booking_type,
        'requested_area', bs.seating_preference,
        'special_requests', CASE WHEN bs.seq % 7 = 0 THEN 'Window seat preferred' ELSE NULL END
    )
FROM booking_specs bs
JOIN customer_list cl ON cl.rn = bs.seq;

-- -----------------------------------------------------------------------------
-- Stage 9: Booking lifecycle artifacts
-- -----------------------------------------------------------------------------

-- Booking state history
INSERT INTO public.booking_state_history (id, booking_id, from_status, to_status, changed_by, changed_at, reason, metadata)
SELECT
    nextval('public.booking_state_history_id_seq'),
    b.id,
    'pending'::public.booking_status,
    b.status::public.booking_status,
    NULL::uuid,
    b.created_at + interval '2 minutes',
    CASE 
        WHEN b.status = 'pending' THEN 'Awaiting table allocation'
        ELSE 'Auto-confirmed by system'
    END,
    jsonb_build_object('source', 'seed', 'reference', b.reference)
FROM public.bookings b;

-- Booking versions
INSERT INTO public.booking_versions (version_id, booking_id, restaurant_id, change_type, changed_by, changed_at, old_data, new_data, created_at)
SELECT
    gen_random_uuid(),
    b.id,
    b.restaurant_id,
    'created'::public.booking_change_type,
    'seed-script',
    b.created_at,
    NULL,
    to_jsonb(b) - 'confirmation_token' - 'confirmation_token_expires_at',
    timezone('utc', now())
FROM public.bookings b;

-- Booking slots
WITH date_ctx AS (
    SELECT
        current_date AS today,
        current_date + interval '1 day' AS tomorrow,
        current_date + interval '2 days' AS day_after
),
restaurant_ctx AS (
    SELECT id FROM public.restaurants WHERE slug = 'demo-restaurant'
),
slots AS (
    SELECT
        rsp.restaurant_id,
        rsp.id AS service_period_id,
        date_val AS slot_date,
        (rsp.start_time + interval '15 minutes' * gs.idx)::time AS slot_time,
        rsp.booking_option,
        CASE
            WHEN rsp.booking_option = 'lunch' THEN 100
            ELSE 120
        END AS available_capacity
    FROM public.restaurant_service_periods rsp
    JOIN restaurant_ctx r ON r.id = rsp.restaurant_id
    CROSS JOIN (
        SELECT today AS date_val FROM date_ctx
        UNION ALL
        SELECT tomorrow FROM date_ctx
        UNION ALL
        SELECT day_after FROM date_ctx
    ) AS dates
    CROSS JOIN LATERAL generate_series(
        0, 
        GREATEST(0, (EXTRACT(EPOCH FROM (rsp.end_time - rsp.start_time)) / 900)::int - 1)
    ) AS gs(idx)
)
INSERT INTO public.booking_slots (
    id,
    restaurant_id,
    slot_date,
    slot_time,
    service_period_id,
    available_capacity,
    reserved_count,
    version,
    created_at,
    updated_at
)
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
) AS bc ON bc.restaurant_id = s.restaurant_id
    AND bc.slot_date = s.slot_date
    AND bc.slot_time = s.slot_time;

-- -----------------------------------------------------------------------------
-- Stage 10: Analytics and loyalty
-- -----------------------------------------------------------------------------

-- Analytics events
INSERT INTO public.analytics_events (
    id,
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
    gen_random_uuid(),
    'booking.created'::public.analytics_event_type,
    'v1',
    b.restaurant_id,
    b.id,
    b.customer_id,
    'seed',
    jsonb_build_object(
        'reference', b.reference,
        'partySize', b.party_size,
        'status', b.status,
        'bookingType', b.booking_type
    ),
    b.created_at,
    timezone('utc', now())
FROM public.bookings b;

-- Loyalty program
INSERT INTO public.loyalty_programs (
    id,
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
    gen_random_uuid(),
    r.id,
    'Demo Restaurant Loyalty Club',
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
FROM public.restaurants r
WHERE r.slug = 'demo-restaurant';

-- Customer profiles
INSERT INTO public.customer_profiles (
    customer_id,
    first_booking_at,
    last_booking_at,
    total_bookings,
    total_covers,
    total_cancellations,
    marketing_opt_in,
    last_marketing_opt_in_at,
    preferences,
    notes,
    updated_at
)
SELECT
    b.customer_id,
    MIN(b.start_at),
    MAX(b.start_at),
    COUNT(*),
    SUM(b.party_size),
    0,
    BOOL_OR(b.marketing_opt_in),
    MAX(CASE WHEN b.marketing_opt_in THEN b.created_at ELSE NULL END),
    jsonb_build_object(
        'favouriteOccasion', 
        MODE() WITHIN GROUP (ORDER BY b.booking_type)
    ),
    NULL,
    timezone('utc', now())
FROM public.bookings b
GROUP BY b.customer_id;

-- Loyalty points
INSERT INTO public.loyalty_points (
    id,
    restaurant_id,
    customer_id,
    total_points,
    tier,
    created_at,
    updated_at
)
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
WHERE b.status = 'confirmed'
GROUP BY b.restaurant_id, b.customer_id;

-- Loyalty point events
INSERT INTO public.loyalty_point_events (
    id,
    restaurant_id,
    customer_id,
    booking_id,
    points_change,
    event_type,
    schema_version,
    metadata,
    created_at
)
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
WHERE b.status = 'confirmed';

COMMIT;

-- Seed complete: 1 restaurant, 2 zones, 16 tables, 50 customers, 50 bookings
-- Created: 2025-11-05 19:11:18 UTC
