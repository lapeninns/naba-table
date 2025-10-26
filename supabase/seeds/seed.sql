-- Comprehensive seed data for SajiloReserveX - La Pen Inns
-- 8 Restaurants | 400 Customers | 200 Bookings (Past, Present, Future)
BEGIN;

SET LOCAL client_min_messages = warning;
SET LOCAL search_path = public;

-- Clean existing data
TRUNCATE TABLE
    public.bookings,
    public.customers,
    public.restaurant_service_periods,
    public.restaurant_operating_hours,
    public.restaurant_memberships,
    public.restaurants,
    public.profiles
CASCADE;

TRUNCATE TABLE auth.users CASCADE;

-- Create owner account
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) 
VALUES (
    '6babb126-c166-41a0-b9f2-57ef473b179b',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner@lapeninns.com',
    '$2a$10$placeholder-hash-owner-account',
    now(),
    '{"provider":"email"}'::jsonb,
    '{"display_name":"La Pen Owner"}'::jsonb,
    now(),
    now()
);

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
);

-- Insert 8 restaurants
INSERT INTO public.restaurants (id, name, slug, timezone, capacity, contact_email, contact_phone, address, booking_policy, reservation_interval_minutes, reservation_default_duration_minutes, reservation_last_seating_buffer_minutes, is_active, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'The Queen Elizabeth Pub', 'the-queen-elizabeth-pub', 'Europe/London', 120, 'thequeen@lapeninns.com', '01553 824083', '32 Gayton Road, King''s Lynn, PE30 4EL', 'Visit: https://thequeenelizabethpub.co.uk', 15, 90, 120, true, now(), now()),
    (gen_random_uuid(), 'Old Crown Pub (Girton)', 'old-crown-pub-girton', 'Europe/London', 120, 'oldcrown@lapeninns.com', '01223 277217', '89 High Street, Girton, Cambridge, CB3 0QQ', 'Visit: https://oldcrowngirton.com', 15, 90, 120, true, now(), now()),
    (gen_random_uuid(), 'White Horse Pub (Waterbeach)', 'white-horse-pub-waterbeach', 'Europe/London', 120, 'whitehorse@lapeninns.com', '01223 375578', '12 Green Side, Waterbeach, Cambridge, CB25 9HP', 'Visit: https://whitehorsepub.co', 15, 90, 120, true, now(), now()),
    (gen_random_uuid(), 'The Corner House Pub (Cambridge)', 'the-corner-house-pub-cambridge', 'Europe/London', 120, 'cornerhouse@lapeninns.com', '01223 921122', '231 Newmarket Road, Cambridge, CB5 8JE', 'Visit: https://thecornerhousepub.co', 15, 90, 120, true, now(), now()),
    (gen_random_uuid(), 'Prince of Wales Pub (Bromham)', 'prince-of-wales-pub-bromham', 'Europe/London', 120, 'theprince@lapeninns.com', '01234 822447', '8 Northampton Road, Bromham, Bedford, MK43 8PE', 'Visit: https://princeofwalesbromham.com - Mobile: +44 7438 699609', 15, 90, 120, true, now(), now()),
    (gen_random_uuid(), 'The Bell (Sawtry)', 'the-bell-sawtry', 'Europe/London', 120, 'thebell@lapeninns.com', '01487 900149', '82 Green End Road, Sawtry, Huntingdon, PE28 5UY', 'Visit: https://thebellsawtry.com', 15, 90, 120, true, now(), now()),
    (gen_random_uuid(), 'The Railway Pub (Whittlesey)', 'the-railway-pub-whittlesey', 'Europe/London', 120, 'therailway@lapeninns.com', '01733 788345', '139 Station Road, Whittlesey, PE7 1UF', 'Visit: https://therailwaypub.co', 15, 90, 120, true, now(), now()),
    (gen_random_uuid(), 'The Barley Mow Pub (Hartford)', 'the-barley-mow-pub-hartford', 'Europe/London', 120, 'barleymow@lapeninns.com', '01480 450550', '42 Main St, Hartford, Huntingdon, PE29 1XU', 'Visit: https://barleymowhartford.co.uk - Mobile: +44 7399 835329', 15, 90, 120, true, now(), now());

-- Set up memberships for owner
INSERT INTO public.restaurant_memberships (restaurant_id, user_id, role, created_at)
SELECT id, '6babb126-c166-41a0-b9f2-57ef473b179b', 'owner', now() 
FROM public.restaurants;

-- Set up operating hours (Mon-Fri: 12:00-22:00, Sat-Sun: Closed)
INSERT INTO public.restaurant_operating_hours (id, restaurant_id, day_of_week, opens_at, closes_at, is_closed, notes, created_at, updated_at)
SELECT gen_random_uuid(), r.id, dow, '12:00:00'::time, '22:00:00'::time, false, NULL, now(), now()
FROM public.restaurants r
CROSS JOIN generate_series(1, 5) AS dow;

INSERT INTO public.restaurant_operating_hours (id, restaurant_id, day_of_week, opens_at, closes_at, is_closed, notes, created_at, updated_at)
SELECT gen_random_uuid(), r.id, dow, NULL::time, NULL::time, true, 'Closed on weekends', now(), now()
FROM public.restaurants r
CROSS JOIN (VALUES (0), (6)) AS weekend(dow);

-- Set up service periods
INSERT INTO public.restaurant_service_periods (id, restaurant_id, name, day_of_week, start_time, end_time, booking_option, created_at, updated_at)
SELECT gen_random_uuid(), r.id, sp_name, dow, sp_start::time, sp_end::time, sp_option, now(), now()
FROM public.restaurants r
CROSS JOIN (VALUES
    ('Weekday Lunch', '12:00:00', '15:00:00', 'lunch'),
    ('Happy Hour', '15:00:00', '17:00:00', 'drinks'),
    ('Dinner Service', '17:00:00', '22:00:00', 'dinner')
) AS sp(sp_name, sp_start, sp_end, sp_option)
CROSS JOIN generate_series(1, 5) AS dow;

-- Generate 50 customers per restaurant (400 total)
INSERT INTO public.customers (id, restaurant_id, email, full_name, phone, marketing_opt_in, notes, created_at, updated_at)
SELECT
    gen_random_uuid() AS id,
    r.id AS restaurant_id,
    lower(regexp_replace(r.name, '[^a-zA-Z0-9]', '', 'g')) || '.guest' || g || '@example.com' AS email,
    initcap(r.name) || ' Guest ' || g AS full_name,
    '+4477' || lpad((abs(hashtext(r.id::text || g::text)) % 100000000)::text, 8, '0') AS phone,
    (g % 3 = 0) AS marketing_opt_in,
    CASE WHEN g % 5 = 0 THEN 'VIP customer' ELSE NULL END AS notes,
    now() - (random() * interval '90 days') AS created_at,
    now() AS updated_at
FROM public.restaurants r
CROSS JOIN generate_series(1, 50) AS g;

-- Generate bookings (25 per restaurant = 200 total)
-- Distribution: 8 past, 9 today, 8 future per restaurant
WITH customer_counts AS (
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
booking_series AS (
    SELECT
        r.id AS restaurant_id,
        g.n,
        CASE 
            WHEN g.n <= 8 THEN current_date - (g.n || ' days')::interval
            WHEN g.n <= 17 THEN current_date
            ELSE current_date + ((g.n - 17) || ' days')::interval
        END::date AS booking_date,
        CASE 
            WHEN g.n % 3 = 0 THEN time '12:00'
            WHEN g.n % 3 = 1 THEN time '15:30'
            ELSE time '18:00'
        END AS start_time,
        CASE 
            WHEN g.n % 3 = 0 THEN time '13:30'
            WHEN g.n % 3 = 1 THEN time '16:30'
            ELSE time '20:00'
        END AS end_time,
        CASE 
            WHEN g.n % 3 = 0 THEN 'lunch'
            WHEN g.n % 3 = 1 THEN 'drinks'
            ELSE 'dinner'
        END AS booking_type,
        2 + (g.n % 6) AS party_size,
        CASE WHEN g.n % 4 = 0 THEN 'outdoor' ELSE 'indoor' END AS seating_preference,
        CASE 
            WHEN g.n <= 8 THEN 
                CASE WHEN g.n % 10 = 0 THEN 'cancelled' ELSE 'confirmed' END
            ELSE 'confirmed'
        END AS status,
        now() - (random() * interval '30 days') AS created_at
    FROM public.restaurants r
    CROSS JOIN generate_series(1, 25) AS g(n)
)
INSERT INTO public.bookings (
    id,
    restaurant_id,
    customer_id,
    customer_email,
    customer_name,
    customer_phone,
    booking_date,
    start_time,
    end_time,
    booking_type,
    party_size,
    seating_preference,
    status,
    source,
    reference,
    created_at,
    updated_at,
    marketing_opt_in,
    notes
)
SELECT
    gen_random_uuid(),
    bs.restaurant_id,
    cust.id,
    cust.email,
    cust.full_name,
    cust.phone,
    bs.booking_date,
    bs.start_time,
    bs.end_time,
    bs.booking_type,
    bs.party_size,
    bs.seating_preference::seating_preference_type,
    bs.status::booking_status,
    'web',
    'LP-' || upper(substring(md5(gen_random_uuid()::text), 1, 6)),
    bs.created_at,
    bs.created_at,
    true,
    CASE 
        WHEN bs.party_size >= 6 THEN 'Large party - needs spacious table'
        WHEN bs.seating_preference = 'outdoor' THEN 'Prefers outdoor seating'
        ELSE NULL
    END
FROM booking_series bs
JOIN customer_counts cc ON cc.restaurant_id = bs.restaurant_id
JOIN customers_ranked cust
  ON cust.restaurant_id = bs.restaurant_id
 AND cust.rn = ((bs.n - 1) % cc.cnt) + 1;

COMMIT;


-- Seed baseline table inventory for every restaurant.
-- Generates allowed capacities, a default zone, and four tables (capacities 2, 4, 7, 9).

BEGIN;

-- Step 1: Gather restaurant records
WITH restaurant_rows AS (
    SELECT id, slug
    FROM public.restaurants
),

-- Step 2: Define baseline table capacities
capacity_rows AS (
    SELECT r.id AS restaurant_id, caps.capacity
    FROM restaurant_rows r
    CROSS JOIN (VALUES (2), (4), (7), (9)) AS caps(capacity)
),

-- Step 3: Insert or update allowed capacities
allowed_caps AS (
    INSERT INTO public.allowed_capacities (restaurant_id, capacity)
    SELECT restaurant_id, capacity
    FROM capacity_rows
    ON CONFLICT (restaurant_id, capacity) DO UPDATE
    SET updated_at = timezone('utc', now())
    RETURNING restaurant_id, capacity
),

-- Step 4: Insert or update default "Main Dining" zone
zone_rows AS (
    INSERT INTO public.zones (id, restaurant_id, name, sort_order, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        r.id,
        'Main Dining',
        1,
        now(),
        now()
    FROM restaurant_rows r
    ON CONFLICT (restaurant_id, lower(name)) DO UPDATE
    SET updated_at = EXCLUDED.updated_at
    RETURNING id, restaurant_id
),

-- Step 5: Prepare data for table inventory seeding
table_source AS (
    SELECT
        ac.restaurant_id,
        z.id AS zone_id,
        ac.capacity,
        ROW_NUMBER() OVER (PARTITION BY ac.restaurant_id ORDER BY ac.capacity) AS ordinal
    FROM allowed_caps ac
    JOIN zone_rows z ON z.restaurant_id = ac.restaurant_id
)

-- Step 6: Insert or update table inventory
INSERT INTO public.table_inventory (
    id,
    restaurant_id,
    table_number,
    capacity,
    min_party_size,
    max_party_size,
    section,
    zone_id,
    category,
    seating_type,
    status,
    mobility,
    active
)
SELECT
    gen_random_uuid(),
    ts.restaurant_id,
    'T' || to_char(ts.capacity, 'FM00') || '-' || to_char(ts.ordinal, 'FM00') AS table_number,
    ts.capacity,
    CASE
        WHEN ts.capacity <= 2 THEN 1
        WHEN ts.capacity <= 4 THEN 2
        ELSE 4
    END AS min_party_size,
    ts.capacity AS max_party_size,
    'Main Dining' AS section,
    ts.zone_id,
    'dining'::public.table_category,
    'standard'::public.table_seating_type,
    'available'::public.table_status,
    'movable'::public.table_mobility,
    true AS active
FROM table_source ts
ON CONFLICT (restaurant_id, table_number) DO UPDATE
SET
    capacity = EXCLUDED.capacity,
    min_party_size = EXCLUDED.min_party_size,
    max_party_size = EXCLUDED.max_party_size,
    section = EXCLUDED.section,
    zone_id = EXCLUDED.zone_id,
    category = EXCLUDED.category,
    seating_type = EXCLUDED.seating_type,
    status = EXCLUDED.status,
    mobility = EXCLUDED.mobility,
    active = EXCLUDED.active,
    updated_at = now();

COMMIT;


-- Grants access to every restaurant for amanshresthaaaaa@gmail.com (if user exists).
-- Run against the target Supabase project (staging/prod) using a service-role connection.

-- ℹ️  If this user doesn't exist yet, create it manually in Supabase Auth Dashboard:
--    https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc/auth/users
--    Email: amanshresthaaaaa@gmail.com | Auto Confirm: YES

DO $$
DECLARE
    _user_id uuid;
BEGIN
    SELECT id INTO _user_id
    FROM auth.users
    WHERE email = lower('amanshresthaaaaa@gmail.com');

    IF _user_id IS NULL THEN
        RAISE NOTICE 'User amanshresthaaaaa@gmail.com not found in auth.users - skipping restaurant access grants';
        RAISE NOTICE 'Create this user in Supabase Auth Dashboard if needed';
        RETURN;
    END IF;

    RAISE NOTICE 'Found user amanshresthaaaaa@gmail.com (%), granting restaurant access', _user_id;

    -- Ensure profile row exists and has access enabled.
    INSERT INTO public.profiles (id, email, name, phone, has_access)
    VALUES (_user_id, lower('amanshresthaaaaa@gmail.com'), 'Aman Shrestha', NULL, true)
    ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            name = EXCLUDED.name,
            has_access = true,
            updated_at = timezone('utc', now());

    -- Grant manager-level membership to every restaurant.
    INSERT INTO public.restaurant_memberships (user_id, restaurant_id, role)
    SELECT _user_id, r.id, 'manager'
    FROM public.restaurants r
    ON CONFLICT (user_id, restaurant_id) DO UPDATE
        SET role = EXCLUDED.role;
END
$$;

-- Verification query (optional)
-- select restaurant_id, role from public.restaurant_memberships
-- where user_id = (select id from auth.users where email = 'amanshresthaaaaa@gmail.com')
-- order by restaurant_id;
