-- Seeding SajiloReserveX sample data for La Pen Inns pubs...

BEGIN;

SET LOCAL client_min_messages = warning;
SET LOCAL search_path = public;

TRUNCATE TABLE
    public.allocations,
    public.allowed_capacities,
    public.analytics_events,
    public.audit_logs,
    public.booking_slots,
    public.booking_state_history,
    public.booking_table_assignments,
    public.booking_versions,
    public.booking_occasions,
    public.bookings,
    public.customer_profiles,
    public.customers,
    public.loyalty_point_events,
    public.loyalty_points,
    public.loyalty_programs,
    public.profile_update_requests,
    public.restaurant_invites,
    public.restaurant_memberships,
    public.restaurant_operating_hours,
    public.restaurant_service_periods,
    public.restaurants,
    public.service_policy,
    public.stripe_events,
    public.table_adjacencies,
    public.table_inventory,
    public.zones,
    public.profiles
CASCADE;

TRUNCATE TABLE auth.users CASCADE;

-- Seed a single owner account reused across every venue.
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '6babb126-c166-41a0-b9f2-57ef473b179b',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner@lapeninns.com',
    '$2a$10$placeholder-hash-owner............................',
    now(),
    '{"provider":"email"}'::jsonb,
    '{"display_name":"La Pen Owner"}'::jsonb,
    now(),
    now()
)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = EXCLUDED.updated_at;

INSERT INTO public.profiles (id, email, name, phone, image, has_access, created_at, updated_at)
VALUES (
    '6babb126-c166-41a0-b9f2-57ef473b179b',
    'owner@lapeninns.com',
    'La Pen Owner',
    '+447700900001',
    NULL,
    true,
    now(),
    now()
)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = EXCLUDED.updated_at;

-- Occasion catalogue (only dynamic entries used by service periods).
INSERT INTO public.booking_occasions (
    key,
    label,
    short_label,
    description,
    availability,
    default_duration_minutes,
    display_order,
    is_active,
    created_at,
    updated_at
) VALUES
    (
        'lunch',
        'Lunch',
        'Lunch',
        'Midday dining service.',
        '[{"kind":"time_window","start":"12:00","end":"15:00"}]'::jsonb,
        90,
        10,
        true,
        now(),
        now()
    ),
    (
        'drinks',
        'Drinks & Cocktails',
        'Drinks',
        'Bar-led experiences and happy hours.',
        '[{"kind":"time_window","start":"15:00","end":"22:00"}]'::jsonb,
        60,
        20,
        true,
        now(),
        now()
    ),
    (
        'dinner',
        'Dinner',
        'Dinner',
        'Evening dining service.',
        '[{"kind":"time_window","start":"17:00","end":"23:00"}]'::jsonb,
        105,
        30,
        true,
        now(),
        now()
    );

WITH restaurant_source AS (
    SELECT *
    FROM (
        VALUES
            ('The Queen Elizabeth Pub',       'the-queen-elizabeth-pub',       'https://thequeenelizabethpub.co.uk', '32 Gayton Road, King''s Lynn, PE30 4EL',          '01553 824083', NULL,                'thequeen@lapeninns.com'),
            ('Old Crown Pub (Girton)',        'old-crown-pub-girton',          'https://oldcrowngirton.com',         '89 High Street, Girton, Cambridge, CB3 0QQ',      '01223 277217', NULL,                'oldcrown@lapeninns.com'),
            ('White Horse Pub (Waterbeach)',  'white-horse-pub-waterbeach',    'https://whitehorsepub.co',           '12 Green Side, Waterbeach, Cambridge, CB25 9HP',  '01223 375578', NULL,                'whitehorse@lapeninns.com'),
            ('The Corner House Pub (Cambridge)', 'the-corner-house-pub-cambridge', 'https://thecornerhousepub.co',   '231 Newmarket Road, Cambridge, CB5 8JE',           '01223 921122', NULL,                'cornerhouse@lapeninns.com'),
            ('Prince of Wales Pub (Bromham)', 'prince-of-wales-pub-bromham',   'https://princeofwalesbromham.com',   '8 Northampton Road, Bromham, Bedford, MK43 8PE',  '01234 822447', '+44 7438 699609',   'theprince@lapeninns.com'),
            ('The Bell (Sawtry)',             'the-bell-sawtry',               'https://thebellsawtry.com',          '82 Green End Road, Sawtry, Huntingdon, PE28 5UY', '01487 900149', NULL,                'thebell@lapeninns.com'),
            ('The Railway Pub (Whittlesey)',  'the-railway-pub-whittlesey',    'https://therailwaypub.co',           '139 Station Road, Whittlesey, PE7 1UF',           '01733 788345', NULL,                'therailway@lapeninns.com'),
            ('The Barley Mow Pub (Hartford)', 'the-barley-mow-pub-hartford',   'https://barleymowhartford.co.uk',    '42 Main St, Hartford, Huntingdon, PE29 1XU',      '01480 450550', '+44 7399 835329',   'barleymow@lapeninns.com')
    ) AS t(name, slug, website, address, phone, mobile, email)
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
        reservation_last_seating_buffer_minutes,
        is_active,
        created_at,
        updated_at
    )
    SELECT
        gen_random_uuid() AS id,
        rs.name,
        rs.slug,
        'Europe/London',
        120,
        rs.email,
        rs.phone,
        rs.address,
        FORMAT(
            'Standard reservations. Website: %s%s',
            rs.website,
            CASE
                WHEN rs.mobile IS NOT NULL AND rs.mobile <> '' THEN FORMAT(' • Mobile: %s', rs.mobile)
                ELSE ''
            END
        ),
        15,
        90,
        120,
        true,
        now(),
        now()
    FROM restaurant_source rs
    RETURNING id, name, slug
),
memberships AS (
    INSERT INTO public.restaurant_memberships (restaurant_id, user_id, role, created_at)
    SELECT ir.id, '6babb126-c166-41a0-b9f2-57ef473b179b', 'owner', now()
    FROM inserted_restaurants ir
    RETURNING 1
),
operating_hours_weekdays AS (
    INSERT INTO public.restaurant_operating_hours (id, restaurant_id, day_of_week, opens_at, closes_at, is_closed, notes, created_at, updated_at)
    SELECT gen_random_uuid(), ir.id, dow, '12:00:00', '22:00:00', false, NULL, now(), now()
    FROM inserted_restaurants ir
    CROSS JOIN generate_series(1, 5) AS dow
    RETURNING 1
),
operating_hours_weekends AS (
    INSERT INTO public.restaurant_operating_hours (id, restaurant_id, day_of_week, opens_at, closes_at, is_closed, notes, created_at, updated_at)
    SELECT gen_random_uuid(), ir.id, dow, NULL, NULL, true, 'Closed', now(), now()
    FROM inserted_restaurants ir
    CROSS JOIN (VALUES (0), (6)) AS weekend(dow)
    RETURNING 1
),
service_periods AS (
    INSERT INTO public.restaurant_service_periods (id, restaurant_id, name, day_of_week, start_time, end_time, booking_option, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        ir.id,
        sp.name,
        dow,
        sp.start_time,
        sp.end_time,
        sp.booking_option,
        now(),
        now()
    FROM inserted_restaurants ir
    CROSS JOIN (VALUES
        ('Weekday Lunch', '12:00:00'::time, '15:00:00'::time, 'lunch'),
        ('Happy Hour',    '15:00:00'::time, '17:00:00'::time, 'drinks'),
        ('Dinner Service','17:00:00'::time, '22:00:00'::time, 'dinner')
    ) AS sp(name, start_time, end_time, booking_option)
    CROSS JOIN generate_series(1, 5) AS dow
    RETURNING 1
),
-- Generate 5 zones per restaurant (40 zones total)
inserted_zones AS (
    INSERT INTO public.zones (id, restaurant_id, name, sort_order, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        ir.id,
        z.name,
        z.sort_order,
        now(),
        now()
    FROM inserted_restaurants ir
    CROSS JOIN (VALUES
        ('Main Dining', 1),
        ('Bar Area', 2),
        ('Patio', 3),
        ('Private Room', 4),
        ('Outdoor Garden', 5)
    ) AS z(name, sort_order)
    RETURNING id, restaurant_id, name
),
-- Add allowed capacities for each restaurant
inserted_capacities AS (
    INSERT INTO public.allowed_capacities (restaurant_id, capacity, created_at, updated_at)
    SELECT
        ir.id,
        cap.capacity,
        now(),
        now()
    FROM inserted_restaurants ir
    CROSS JOIN (VALUES (2), (4), (7), (9)) AS cap(capacity)
    ON CONFLICT (restaurant_id, capacity) DO NOTHING
    RETURNING 1
),
-- Generate 40 tables per restaurant (320 tables total)
-- Distributed across zones: 12 in Main Dining, 8 in Bar Area, 8 in Patio, 6 in Private Room, 6 in Outdoor Garden
inserted_tables AS (
    INSERT INTO public.table_inventory (
        id,
        restaurant_id,
        zone_id,
        table_number,
        capacity,
        category,
        seating_type,
        mobility,
        active,
        created_at,
        updated_at
    )
    SELECT
        gen_random_uuid(),
        z.restaurant_id,
        z.id,
        t.table_number,
        t.capacity,
        t.category::public.table_category,
        t.seating_type::public.table_seating_type,
        'movable'::public.table_mobility,
        true,
        now(),
        now()
    FROM inserted_zones z
    CROSS JOIN LATERAL (
        SELECT *
        FROM (
            VALUES
                -- Main Dining: 12 tables (table_number format: zone_initial + number)
                ('MD-01', 2, 'dining', 'standard'),
                ('MD-02', 2, 'dining', 'standard'),
                ('MD-03', 4, 'dining', 'standard'),
                ('MD-04', 4, 'dining', 'standard'),
                ('MD-05', 4, 'dining', 'standard'),
                ('MD-06', 4, 'dining', 'booth'),
                ('MD-07', 4, 'dining', 'booth'),
                ('MD-08', 7, 'dining', 'standard'),
                ('MD-09', 7, 'dining', 'standard'),
                ('MD-10', 7, 'dining', 'booth'),
                ('MD-11', 9, 'dining', 'standard'),
                ('MD-12', 9, 'dining', 'standard'),
                -- Bar Area: 8 tables
                ('BA-01', 2, 'bar', 'high_top'),
                ('BA-02', 2, 'bar', 'high_top'),
                ('BA-03', 2, 'bar', 'high_top'),
                ('BA-04', 4, 'bar', 'high_top'),
                ('BA-05', 4, 'bar', 'high_top'),
                ('BA-06', 4, 'lounge', 'sofa'),
                ('BA-07', 4, 'lounge', 'sofa'),
                ('BA-08', 7, 'bar', 'high_top'),
                -- Patio: 8 tables
                ('PT-01', 2, 'patio', 'standard'),
                ('PT-02', 2, 'patio', 'standard'),
                ('PT-03', 4, 'patio', 'standard'),
                ('PT-04', 4, 'patio', 'standard'),
                ('PT-05', 4, 'patio', 'standard'),
                ('PT-06', 7, 'patio', 'standard'),
                ('PT-07', 7, 'patio', 'standard'),
                ('PT-08', 9, 'patio', 'standard'),
                -- Private Room: 6 tables
                ('PR-01', 4, 'private', 'standard'),
                ('PR-02', 4, 'private', 'standard'),
                ('PR-03', 7, 'private', 'standard'),
                ('PR-04', 7, 'private', 'standard'),
                ('PR-05', 9, 'private', 'standard'),
                ('PR-06', 9, 'private', 'standard'),
                -- Outdoor Garden: 6 tables
                ('OG-01', 2, 'patio', 'standard'),
                ('OG-02', 4, 'patio', 'standard'),
                ('OG-03', 4, 'patio', 'standard'),
                ('OG-04', 7, 'patio', 'standard'),
                ('OG-05', 7, 'patio', 'standard'),
                ('OG-06', 9, 'patio', 'standard')
        ) AS t_data(table_number, capacity, category, seating_type)
        WHERE
            (z.name = 'Main Dining' AND t_data.table_number LIKE 'MD-%') OR
            (z.name = 'Bar Area' AND t_data.table_number LIKE 'BA-%') OR
            (z.name = 'Patio' AND t_data.table_number LIKE 'PT-%') OR
            (z.name = 'Private Room' AND t_data.table_number LIKE 'PR-%') OR
            (z.name = 'Outdoor Garden' AND t_data.table_number LIKE 'OG-%')
    ) AS t(table_number, capacity, category, seating_type)
    RETURNING 1
)
SELECT 1;

-- Generate customer records (400 per restaurant for replayable bookings).
WITH restaurants_cte AS (
    SELECT id, slug, name FROM public.restaurants
),
customer_rows AS (
    SELECT
        gen_random_uuid() AS id,
        r.id AS restaurant_id,
        LOWER(FORMAT('%s-guest-%s@lapeninns.com', r.slug, g)) AS email,
        INITCAP(replace(r.slug, '-', ' ')) || ' Guest ' || g AS full_name,
        '+447' || LPAD((ROW_NUMBER() OVER (ORDER BY r.id, g))::text, 8, '0') AS phone,
        now() AS created_at,
        now() AS updated_at
    FROM restaurants_cte r
    CROSS JOIN generate_series(1, 400) AS g
),
insert_customers AS (
    INSERT INTO public.customers (
        id,
        restaurant_id,
        email,
        full_name,
        phone,
        marketing_opt_in,
        notes,
        created_at,
        updated_at
    )
    SELECT
        id,
        restaurant_id,
        email,
        full_name,
        phone,
        true,
        NULL,
        created_at,
        updated_at
    FROM customer_rows
    RETURNING id, restaurant_id
)
SELECT 1;

-- Generate booking records for today.
WITH date_ctx AS (
    SELECT
        current_date AS today,
        CASE
            WHEN current_date - INTERVAL '5 days' < date_trunc('month', current_date) THEN
                GREATEST(current_date - INTERVAL '1 day', date_trunc('month', current_date))
            ELSE
                current_date - INTERVAL '5 days'
        END::date AS past_day,
        CASE
            WHEN current_date + INTERVAL '5 days' > date_trunc('month', current_date) + INTERVAL '1 month' - INTERVAL '1 day' THEN
                LEAST(current_date + INTERVAL '1 day', (date_trunc('month', current_date) + INTERVAL '1 month' - INTERVAL '1 day')::date)
            ELSE
                current_date + INTERVAL '5 days'
        END::date AS future_day
),
restaurant_list AS (
    SELECT id FROM public.restaurants
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
        ROW_NUMBER() OVER (PARTITION BY c.restaurant_id ORDER BY c.id) AS rn
    FROM public.customers c
),
series AS (
    SELECT
        g.n,
        CASE
            WHEN g.n <= 100 THEN 'lunch'
            WHEN g.n <= 150 THEN 'drinks'
            ELSE 'dinner'
        END AS booking_option,
        CASE
            WHEN g.n <= 100 THEN time '12:00' + ((g.n - 1) % 12) * interval '15 minutes'
            WHEN g.n <= 150 THEN time '15:00' + ((g.n - 101) % 8) * interval '15 minutes'
            ELSE time '17:00' + ((g.n - 151) % 16) * interval '15 minutes'
        END AS start_time,
        CASE
            WHEN g.n <= 100 THEN time '12:00' + ((g.n - 1) % 12) * interval '15 minutes' + interval '90 minutes'
            WHEN g.n <= 150 THEN time '15:00' + ((g.n - 101) % 8) * interval '15 minutes' + interval '60 minutes'
            ELSE time '17:00' + ((g.n - 151) % 16) * interval '15 minutes' + interval '105 minutes'
        END AS end_time,
        CASE
            WHEN g.n > 100 AND g.n <= 150 THEN 2
            ELSE 2 + ((g.n + 1) % 4)
        END AS party_size
    FROM generate_series(1, 250) AS g(n)
)
INSERT INTO public.bookings (
    id,
    restaurant_id,
    customer_id,
    booking_date,
    start_time,
    end_time,
    party_size,
    seating_preference,
    status,
    customer_name,
    customer_email,
    customer_phone,
    reference,
    source,
    created_at,
    updated_at,
    booking_type,
    marketing_opt_in
)
SELECT
    gen_random_uuid(),
    r.id,
    cust.id,
    d.today,
    s.start_time,
    s.end_time,
    s.party_size,
    'indoor'::public.seating_preference_type,
    'confirmed'::public.booking_status,
    cust.full_name,
    cust.email,
    cust.phone,
    CONCAT('LP-T-', upper(substring(md5(gen_random_uuid()::text || s.n::text || r.id::text), 1, 6))),
    'web',
    d.today::timestamp + s.start_time,
    d.today::timestamp + s.start_time,
    s.booking_option::text,
    true
FROM restaurant_list r
CROSS JOIN date_ctx d
JOIN customer_counts cc ON cc.restaurant_id = r.id
JOIN series s ON TRUE
JOIN customers_ranked cust
  ON cust.restaurant_id = r.id
 AND cust.rn = ((s.n - 1) % cc.cnt) + 1;

-- Generate booking records for a recent past day.
WITH date_ctx AS (
    SELECT
        current_date AS today,
        CASE
            WHEN current_date - INTERVAL '5 days' < date_trunc('month', current_date) THEN
                GREATEST(current_date - INTERVAL '1 day', date_trunc('month', current_date))
            ELSE
                current_date - INTERVAL '5 days'
        END::date AS past_day,
        CASE
            WHEN current_date + INTERVAL '5 days' > date_trunc('month', current_date) + INTERVAL '1 month' - INTERVAL '1 day' THEN
                LEAST(current_date + INTERVAL '1 day', (date_trunc('month', current_date) + INTERVAL '1 month' - INTERVAL '1 day')::date)
            ELSE
                current_date + INTERVAL '5 days'
        END::date AS future_day
),
restaurant_list AS (
    SELECT id FROM public.restaurants
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
        ROW_NUMBER() OVER (PARTITION BY c.restaurant_id ORDER BY c.id) AS rn
    FROM public.customers c
),
series AS (
    SELECT
        g.n,
        CASE
            WHEN g.n <= 100 THEN 'lunch'
            WHEN g.n <= 150 THEN 'drinks'
            ELSE 'dinner'
        END AS booking_option,
        CASE
            WHEN g.n <= 100 THEN time '12:00' + ((g.n - 1) % 12) * interval '15 minutes'
            WHEN g.n <= 150 THEN time '15:00' + ((g.n - 101) % 8) * interval '15 minutes'
            ELSE time '17:00' + ((g.n - 151) % 16) * interval '15 minutes'
        END AS start_time,
        CASE
            WHEN g.n <= 100 THEN time '12:00' + ((g.n - 1) % 12) * interval '15 minutes' + interval '90 minutes'
            WHEN g.n <= 150 THEN time '15:00' + ((g.n - 101) % 8) * interval '15 minutes' + interval '60 minutes'
            ELSE time '17:00' + ((g.n - 151) % 16) * interval '15 minutes' + interval '120 minutes'
        END AS end_time,
        CASE
            WHEN g.n > 100 AND g.n <= 150 THEN 2
            ELSE 2 + ((g.n + 2) % 5)
        END AS party_size
    FROM generate_series(1, 250) AS g(n)
)
INSERT INTO public.bookings (
    id,
    restaurant_id,
    customer_id,
    booking_date,
    start_time,
    end_time,
    party_size,
    seating_preference,
    status,
    customer_name,
    customer_email,
    customer_phone,
    reference,
    source,
    created_at,
    updated_at,
    booking_type,
    marketing_opt_in
)
SELECT
    gen_random_uuid(),
    r.id,
    cust.id,
    d.past_day,
    s.start_time,
    s.end_time,
    s.party_size,
    'indoor'::public.seating_preference_type,
    'confirmed'::public.booking_status,
    cust.full_name,
    cust.email,
    cust.phone,
    CONCAT('LP-P-', upper(substring(md5(gen_random_uuid()::text || s.n::text || r.id::text), 1, 6))),
    'web',
    d.past_day::timestamp + s.start_time,
    d.past_day::timestamp + s.start_time,
    s.booking_option::text,
    true
FROM restaurant_list r
CROSS JOIN date_ctx d
JOIN customer_counts cc ON cc.restaurant_id = r.id
JOIN series s ON TRUE
JOIN customers_ranked cust
  ON cust.restaurant_id = r.id
 AND cust.rn = ((s.n - 1) % cc.cnt) + 1;

-- Generate booking records for a near-future day.
WITH date_ctx AS (
    SELECT
        current_date AS today,
        CASE
            WHEN current_date - INTERVAL '5 days' < date_trunc('month', current_date) THEN
                GREATEST(current_date - INTERVAL '1 day', date_trunc('month', current_date))
            ELSE
                current_date - INTERVAL '5 days'
        END::date AS past_day,
        CASE
            WHEN current_date + INTERVAL '5 days' > date_trunc('month', current_date) + INTERVAL '1 month' - INTERVAL '1 day' THEN
                LEAST(current_date + INTERVAL '1 day', (date_trunc('month', current_date) + INTERVAL '1 month' - INTERVAL '1 day')::date)
            ELSE
                current_date + INTERVAL '5 days'
        END::date AS future_day
),
restaurant_list AS (
    SELECT id FROM public.restaurants
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
        ROW_NUMBER() OVER (PARTITION BY c.restaurant_id ORDER BY c.id) AS rn
    FROM public.customers c
),
series AS (
    SELECT
        g.n,
        CASE
            WHEN g.n <= 100 THEN 'lunch'
            WHEN g.n <= 150 THEN 'drinks'
            ELSE 'dinner'
        END AS booking_option,
        CASE
            WHEN g.n <= 100 THEN time '12:00' + ((g.n - 1) % 12) * interval '15 minutes'
            WHEN g.n <= 150 THEN time '15:00' + ((g.n - 101) % 8) * interval '15 minutes'
            ELSE time '17:00' + ((g.n - 151) % 16) * interval '15 minutes'
        END AS start_time,
        CASE
            WHEN g.n <= 100 THEN time '12:00' + ((g.n - 1) % 12) * interval '15 minutes' + interval '90 minutes'
            WHEN g.n <= 150 THEN time '15:00' + ((g.n - 101) % 8) * interval '15 minutes' + interval '60 minutes'
            ELSE time '17:00' + ((g.n - 151) % 16) * interval '15 minutes' + interval '120 minutes'
        END AS end_time,
        CASE
            WHEN g.n > 100 AND g.n <= 150 THEN 2
            ELSE 2 + ((g.n + 3) % 5)
        END AS party_size
    FROM generate_series(1, 250) AS g(n)
)
INSERT INTO public.bookings (
    id,
    restaurant_id,
    customer_id,
    booking_date,
    start_time,
    end_time,
    party_size,
    seating_preference,
    status,
    customer_name,
    customer_email,
    customer_phone,
    reference,
    source,
    created_at,
    updated_at,
    booking_type,
    marketing_opt_in
)
SELECT
    gen_random_uuid(),
    r.id,
    cust.id,
    d.future_day,
    s.start_time,
    s.end_time,
    s.party_size,
    'indoor'::public.seating_preference_type,
    'confirmed'::public.booking_status,
    cust.full_name,
    cust.email,
    cust.phone,
    CONCAT('LP-F-', upper(substring(md5(gen_random_uuid()::text || s.n::text || r.id::text), 1, 6))),
    'web',
    d.future_day::timestamp + s.start_time,
    d.future_day::timestamp + s.start_time,
    s.booking_option::text,
    true
FROM restaurant_list r
CROSS JOIN date_ctx d
JOIN customer_counts cc ON cc.restaurant_id = r.id
JOIN series s ON TRUE
JOIN customers_ranked cust
  ON cust.restaurant_id = r.id
 AND cust.rn = ((s.n - 1) % cc.cnt) + 1;

COMMIT;

-- Seed complete.
