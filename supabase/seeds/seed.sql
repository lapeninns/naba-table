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
INSERT INTO public.restaurants (id, name, slug, timezone, capacity, contact_email, contact_phone, address, booking_policy, reservation_interval_minutes, reservation_default_duration_minutes, is_active, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'The Queen Elizabeth Pub', 'the-queen-elizabeth-pub', 'Europe/London', 120, 'thequeen@lapeninns.com', '01553 824083', '32 Gayton Road, King''s Lynn, PE30 4EL', 'Visit: https://thequeenelizabethpub.co.uk', 15, 90, true, now(), now()),
    (gen_random_uuid(), 'Old Crown Pub (Girton)', 'old-crown-pub-girton', 'Europe/London', 120, 'oldcrown@lapeninns.com', '01223 277217', '89 High Street, Girton, Cambridge, CB3 0QQ', 'Visit: https://oldcrowngirton.com', 15, 90, true, now(), now()),
    (gen_random_uuid(), 'White Horse Pub (Waterbeach)', 'white-horse-pub-waterbeach', 'Europe/London', 120, 'whitehorse@lapeninns.com', '01223 375578', '12 Green Side, Waterbeach, Cambridge, CB25 9HP', 'Visit: https://whitehorsepub.co', 15, 90, true, now(), now()),
    (gen_random_uuid(), 'The Corner House Pub (Cambridge)', 'the-corner-house-pub-cambridge', 'Europe/London', 120, 'cornerhouse@lapeninns.com', '01223 921122', '231 Newmarket Road, Cambridge, CB5 8JE', 'Visit: https://thecornerhousepub.co', 15, 90, true, now(), now()),
    (gen_random_uuid(), 'Prince of Wales Pub (Bromham)', 'prince-of-wales-pub-bromham', 'Europe/London', 120, 'theprince@lapeninns.com', '01234 822447', '8 Northampton Road, Bromham, Bedford, MK43 8PE', 'Visit: https://princeofwalesbromham.com - Mobile: +44 7438 699609', 15, 90, true, now(), now()),
    (gen_random_uuid(), 'The Bell (Sawtry)', 'the-bell-sawtry', 'Europe/London', 120, 'thebell@lapeninns.com', '01487 900149', '82 Green End Road, Sawtry, Huntingdon, PE28 5UY', 'Visit: https://thebellsawtry.com', 15, 90, true, now(), now()),
    (gen_random_uuid(), 'The Railway Pub (Whittlesey)', 'the-railway-pub-whittlesey', 'Europe/London', 120, 'therailway@lapeninns.com', '01733 788345', '139 Station Road, Whittlesey, PE7 1UF', 'Visit: https://therailwaypub.co', 15, 90, true, now(), now()),
    (gen_random_uuid(), 'The Barley Mow Pub (Hartford)', 'the-barley-mow-pub-hartford', 'Europe/London', 120, 'barleymow@lapeninns.com', '01480 450550', '42 Main St, Hartford, Huntingdon, PE29 1XU', 'Visit: https://barleymowhartford.co.uk - Mobile: +44 7399 835329', 15, 90, true, now(), now());

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
WITH booking_data AS (
    SELECT
        gen_random_uuid() AS id,
        r.id AS restaurant_id,
        c.id AS customer_id,
        c.email AS customer_email,
        c.full_name AS customer_name,
        c.phone AS customer_phone,
        CASE 
            WHEN b.n <= 8 THEN current_date - (b.n || ' days')::interval
            WHEN b.n <= 17 THEN current_date
            ELSE current_date + ((b.n - 17) || ' days')::interval
        END::date AS booking_date,
        CASE 
            WHEN b.n % 3 = 0 THEN '12:00:00'
            WHEN b.n % 3 = 1 THEN '15:30:00'
            ELSE '18:00:00'
        END AS start_time,
        CASE 
            WHEN b.n % 3 = 0 THEN '13:30:00'
            WHEN b.n % 3 = 1 THEN '16:30:00'
            ELSE '20:00:00'
        END AS end_time,
        CASE 
            WHEN b.n % 3 = 0 THEN 'lunch'
            WHEN b.n % 3 = 1 THEN 'drinks'
            ELSE 'dinner'
        END AS booking_type,
        2 + (b.n % 6) AS party_size,
        CASE WHEN b.n % 4 = 0 THEN 'outdoor' ELSE 'indoor' END AS seating_preference,
        CASE 
            WHEN b.n <= 8 THEN 
                CASE WHEN b.n % 10 = 0 THEN 'cancelled' ELSE 'confirmed' END
            ELSE 'confirmed'
        END AS status,
        'LP-' || upper(substring(md5(random()::text), 1, 6)) AS reference,
        now() - (random() * interval '30 days') AS created_at
    FROM public.restaurants r
    CROSS JOIN generate_series(1, 25) AS b(n)
    JOIN LATERAL (
        SELECT id, email, full_name, phone
        FROM public.customers
        WHERE restaurant_id = r.id
        ORDER BY random()
        LIMIT 1
    ) c ON true
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
    id,
    restaurant_id,
    customer_id,
    customer_email,
    customer_name,
    customer_phone,
    booking_date,
    start_time::time,
    end_time::time,
    booking_type,
    party_size,
    seating_preference::seating_preference_type,
    status::booking_status,
    'web',
    reference,
    created_at,
    created_at,
    true,
    CASE 
        WHEN party_size >= 6 THEN 'Large party - needs spacious table'
        WHEN seating_preference = 'outdoor' THEN 'Prefers outdoor seating'
        ELSE NULL
    END
FROM booking_data;

COMMIT;
