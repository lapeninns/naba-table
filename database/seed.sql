-- ====================================================================
-- Booking Engine — Seed Data (Option B compatible, idempotent)
-- No reliance on constraint names for expression/partial indexes.
-- Requires schema + Option B patch applied first.
-- ====================================================================

-- Toggle full reset (default OFF). To enable for a clean slate:
-- SELECT set_config('app.seed_truncate', 'on', true);
DO $blk$
BEGIN
  IF coalesce(current_setting('app.seed_truncate', true), 'off') = 'on' THEN
    TRUNCATE TABLE
      public.analytics_events,
      public.observability_events,
      public.stripe_events,
      public.loyalty_point_events,
      public.loyalty_points,
      public.loyalty_programs,
      public.waiting_list,
      public.reviews,
      public.bookings,
      public.customer_profiles,
      public.customers,
      public.restaurant_tables,
      public.restaurant_areas,
      public.restaurant_memberships,
      public.restaurants
    RESTART IDENTITY CASCADE;
  END IF;
END
$blk$;

-- ====================================================================
-- Ensure unique indexes used by upserts exist (safe if already present)
-- ====================================================================
-- For tables: expression dedupe (we’ll UPDATE-then-INSERT instead of ON CONSTRAINT)
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_tables_restaurant_label_uidx
  ON public.restaurant_tables (restaurant_id, lower(label));

-- For availability rule upsert by columns (index inference)
CREATE UNIQUE INDEX IF NOT EXISTS availability_rules_nodup_uidx
  ON public.availability_rules (restaurant_id, day_of_week, booking_type);

-- For bookings idempotency (partial unique index; use index inference + WHERE)
CREATE UNIQUE INDEX IF NOT EXISTS bookings_idem_unique_per_restaurant
  ON public.bookings (restaurant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ====================================================================
-- Restaurants (stable IDs)
-- ====================================================================
INSERT INTO public.restaurants (id, name, slug, capacity)
VALUES
  ('a8d8f8c0-888e-4da3-a0e2-7c38e6f85aa3', 'The Queen Elizabeth Pub', 'the-queen-elizabeth-pub', 75),
  ('b7c7e7b0-777d-4c92-b0d1-6b27d5e74992', 'Old Crown Pub', 'old-crown-pub-girton', 60),
  ('c6b6d6a0-666c-4b81-c1e0-5a16c4d63881', 'White Horse Pub', 'white-horse-pub-waterbeach', 80),
  ('d5a5c590-555b-4a70-d2f1-4905b3c52770', 'The Corner House Pub', 'the-corner-house-pub', 90),
  ('e494b480-444a-496f-e302-37f4a2b4166f', 'Prince of Wales Pub', 'prince-of-wales-pub-bromham', 70),
  ('f383a370-3339-485e-f413-26e391a3055e', 'The Bell Sawtry', 'the-bell-sawtry', 55),
  ('02729260-2228-474d-0524-15d28092f44d', 'The Railway Pub', 'the-railway-pub-whittlesey', 65),
  ('11618150-1117-463c-1635-04c17f81e33c', 'The Barley Mow Pub', 'the-barley-mow-pub-hartford', 85)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, slug = EXCLUDED.slug, capacity = EXCLUDED.capacity;

-- ====================================================================
-- Areas & Tables (idempotent)
-- - Areas: simple upsert by (restaurant_id, name) via re-select
-- - Tables: Combined into a single INSERT ... ON CONFLICT statement
-- ====================================================================
DO $blk$
DECLARE
  rid uuid;
  area_main uuid;
  area_bar uuid;
  area_out uuid;
BEGIN
  FOR rid IN SELECT id FROM public.restaurants LOOP
    -- Insert areas if missing
    INSERT INTO public.restaurant_areas (id, restaurant_id, name, seating_type)
    VALUES
      (public.app_uuid(), rid, 'Main Dining', 'indoor'),
      (public.app_uuid(), rid, 'Bar Area', 'bar'),
      (public.app_uuid(), rid, 'Outdoor Garden', 'outdoor')
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO area_main FROM public.restaurant_areas WHERE restaurant_id = rid AND name = 'Main Dining'  LIMIT 1;
    SELECT id INTO area_bar  FROM public.restaurant_areas WHERE restaurant_id = rid AND name = 'Bar Area'     LIMIT 1;
    SELECT id INTO area_out  FROM public.restaurant_areas WHERE restaurant_id = rid AND name = 'Outdoor Garden' LIMIT 1;

    -- Prepare desired rows and upsert in a single statement
    WITH desired(label, area_id, cap, seat, feats) AS (
      VALUES
        ('T1', area_main, 2, 'window'::public.seating_preference_type,  ARRAY['window','quiet']),
        ('T2', area_main, 2, 'indoor'::public.seating_preference_type,  ARRAY[]::text[]),
        ('T3', area_main, 4, 'indoor'::public.seating_preference_type,  ARRAY[]::text[]),
        ('T4', area_main, 4, 'window'::public.seating_preference_type,  ARRAY['window']),
        ('T5', area_main, 4, 'booth'::public.seating_preference_type,   ARRAY['booth','private']),
        ('T6', area_main, 6, 'indoor'::public.seating_preference_type,  ARRAY[]::text[]),
        ('T7', area_main, 8, 'indoor'::public.seating_preference_type,  ARRAY['large-party']),
        ('B1', area_bar,  2, 'bar'::public.seating_preference_type,     ARRAY['high-top']),
        ('B2', area_bar,  2, 'bar'::public.seating_preference_type,     ARRAY['high-top']),
        ('B3', area_bar,  4, 'bar'::public.seating_preference_type,     ARRAY['booth']),
        ('G1', area_out,  2, 'outdoor'::public.seating_preference_type, ARRAY['garden-view']),
        ('G2', area_out,  4, 'outdoor'::public.seating_preference_type, ARRAY['umbrella']),
        ('G3', area_out,  4, 'outdoor'::public.seating_preference_type, ARRAY['garden-view','umbrella']),
        ('G4', area_out,  6, 'outdoor'::public.seating_preference_type, ARRAY['heater'])
    )
    INSERT INTO public.restaurant_tables (restaurant_id, area_id, label, capacity, seating_type, features)
    SELECT rid, d.area_id, d.label, d.cap, d.seat, d.feats
    FROM desired d
    ON CONFLICT (restaurant_id, lower(label)) DO UPDATE
    SET area_id = EXCLUDED.area_id,
        capacity = EXCLUDED.capacity,
        seating_type = EXCLUDED.seating_type,
        features = EXCLUDED.features;
  END LOOP;
END
$blk$;

-- ====================================================================
-- Availability Rules (idempotent; index inference upsert)
-- ====================================================================
DO $blk$
DECLARE rid uuid;
BEGIN
  FOR rid IN SELECT id FROM public.restaurants LOOP
    INSERT INTO public.availability_rules (restaurant_id, day_of_week, booking_type, open_time, close_time, is_closed)
    VALUES
      (rid, 1, 'lunch',  '12:00:00','15:00:00', false),
      (rid, 1, 'dinner', '18:00:00','22:00:00', false),
      (rid, 2, 'lunch',  '12:00:00','15:00:00', false),
      (rid, 2, 'dinner', '18:00:00','22:00:00', false),
      (rid, 3, 'lunch',  '12:00:00','15:00:00', false),
      (rid, 3, 'dinner', '18:00:00','22:00:00', false),
      (rid, 4, 'lunch',  '12:00:00','15:00:00', false),
      (rid, 4, 'dinner', '18:00:00','22:30:00', false),
      (rid, 5, 'lunch',  '12:00:00','16:00:00', false),
      (rid, 5, 'dinner', '17:30:00','23:00:00', false),
      (rid, 6, 'lunch',  '12:00:00','16:00:00', false),
      (rid, 6, 'dinner', '17:00:00','23:30:00', false),
      (rid, 0, 'lunch',  '12:00:00','17:00:00', false),
      (rid, 0, 'dinner', '18:00:00','21:00:00', false)
    ON CONFLICT (restaurant_id, day_of_week, booking_type) DO UPDATE
    SET open_time = EXCLUDED.open_time,
        close_time = EXCLUDED.close_time,
        is_closed = EXCLUDED.is_closed;
  END LOOP;
END
$blk$;

-- ====================================================================
-- Customers & Profiles (idempotent)
-- ====================================================================
WITH customer_data AS (
  SELECT r.id AS restaurant_id,
         'John ' || s AS full_name,
         lower('john.' || s || '@example.com') AS email,
         '+447911123' || lpad(s::text, 3, '0') AS phone
  FROM generate_series(1, 20) s, public.restaurants r WHERE r.id = 'a8d8f8c0-888e-4da3-a0e2-7c38e6f85aa3'
  UNION ALL
  SELECT r.id, 'Jane ' || s, lower('jane.' || s || '@example.com'), '+447911234' || lpad(s::text, 3, '0') FROM generate_series(1, 20) s, public.restaurants r WHERE r.id = 'b7c7e7b0-777d-4c92-b0d1-6b27d5e74992'
  UNION ALL
  SELECT r.id, 'Mike ' || s, lower('mike.' || s || '@example.com'), '+447911345' || lpad(s::text, 3, '0') FROM generate_series(1, 20) s, public.restaurants r WHERE r.id = 'c6b6d6a0-666c-4b81-c1e0-5a16c4d63881'
  UNION ALL
  SELECT r.id, 'Sarah ' || s, lower('sarah.' || s || '@example.com'), '+447911456' || lpad(s::text, 3, '0') FROM generate_series(1, 20) s, public.restaurants r WHERE r.id = 'd5a5c590-555b-4a70-d2f1-4905b3c52770'
  UNION ALL
  SELECT r.id, 'David ' || s, lower('david.' || s || '@example.com'), '+447911567' || lpad(s::text, 3, '0') FROM generate_series(1, 20) s, public.restaurants r WHERE r.id = 'e494b480-444a-496f-e302-37f4a2b4166f'
  UNION ALL
  SELECT r.id, 'Emily ' || s, lower('emily.' || s || '@example.com'), '+447911678' || lpad(s::text, 3, '0') FROM generate_series(1, 20) s, public.restaurants r WHERE r.id = 'f383a370-3339-485e-f413-26e391a3055e'
  UNION ALL
  SELECT r.id, 'Chris ' || s, lower('chris.' || s || '@example.com'), '+447911789' || lpad(s::text, 3, '0') FROM generate_series(1, 20) s, public.restaurants r WHERE r.id = '02729260-2228-474d-0524-15d28092f44d'
  UNION ALL
  SELECT r.id, 'Laura ' || s, lower('laura.' || s || '@example.com'), '+447911890' || lpad(s::text, 3, '0') FROM generate_series(1, 20) s, public.restaurants r WHERE r.id = '11618150-1117-463c-1635-04c17f81e33c'
),
upsert_customers AS (
  INSERT INTO public.customers (restaurant_id, full_name, email, phone, marketing_opt_in)
  SELECT restaurant_id, full_name, email, phone, (random() > 0.5) FROM customer_data
  ON CONFLICT ON CONSTRAINT customers_restaurant_contact_uidx DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone     = EXCLUDED.phone,
        marketing_opt_in = EXCLUDED.marketing_opt_in
  RETURNING id, marketing_opt_in
)
INSERT INTO public.customer_profiles (customer_id, marketing_opt_in)
SELECT id, marketing_opt_in FROM upsert_customers
ON CONFLICT (customer_id) DO UPDATE
  SET marketing_opt_in = EXCLUDED.marketing_opt_in;

-- ====================================================================
-- Bookings (non-overlapping; idempotent via deterministic idempotency_key)
-- ====================================================================
-- Requires pgcrypto (digest).
WITH slots AS (
  SELECT
    t.id AS table_id,
    t.restaurant_id,
    t.capacity,
    d.booking_date,
    s.start_time,
    (s.start_time + interval '2 hour') AS end_time
  FROM public.restaurant_tables t
  CROSS JOIN generate_series(
    (now() - interval '90 days')::date,
    (now() + interval '14 days')::date,
    interval '1 day'
  ) AS d(booking_date)
  CROSS JOIN (VALUES ('18:00:00'::time), ('20:30:00'::time)) AS s(start_time)
),
customers_list AS (
  SELECT
    c.id AS customer_id,
    c.restaurant_id,
    c.full_name,
    c.email,
    c.phone,
    c.marketing_opt_in,
    ROW_NUMBER() OVER (PARTITION BY c.restaurant_id ORDER BY c.id) AS rn
  FROM public.customers c
),
ordered_slots AS (
  SELECT
    s.*,
    ROW_NUMBER() OVER (PARTITION BY s.restaurant_id ORDER BY s.table_id, s.booking_date, s.start_time) AS rn,
    encode(digest((s.table_id::text || '|' || s.booking_date::text || '|' || s.start_time::text), 'sha256'), 'hex') AS idem_key
  FROM slots s
)
INSERT INTO public.bookings (
  restaurant_id, customer_id, table_id, booking_date, start_time, end_time,
  party_size, status, customer_name, customer_email, customer_phone, notes,
  client_request_id, marketing_opt_in, idempotency_key
)
SELECT
  s.restaurant_id,
  c.customer_id,
  s.table_id,
  s.booking_date,
  s.start_time,
  s.end_time,
  GREATEST(2, LEAST(s.capacity, 2 + (abs(mod(get_byte(c.customer_id::text::bytea, 0), 5)))::int)) AS party_size,
  'confirmed',
  c.full_name,
  c.email,
  c.phone,
  CASE WHEN random() > 0.85 THEN 'Birthday celebration'
       WHEN random() > 0.70 THEN 'Anniversary'
       ELSE NULL
  END,
  public.app_uuid(),
  c.marketing_opt_in,
  s.idem_key
FROM ordered_slots s
JOIN customers_list c
  ON s.rn = c.rn AND s.restaurant_id = c.restaurant_id
ON CONFLICT (restaurant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL
DO NOTHING;

-- Add some cancelled bookings for realism (stable selection)
WITH pick AS (
  SELECT id
  FROM public.bookings
  WHERE status = 'confirmed' AND booking_date < now()::date
  ORDER BY id
  LIMIT 40
)
UPDATE public.bookings b
SET status = 'cancelled'
FROM pick
WHERE b.id = pick.id;

-- ====================================================================
-- Reviews (idempotent)
-- ====================================================================
INSERT INTO public.reviews (restaurant_id, booking_id, rating, title, comment)
SELECT
  restaurant_id,
  id AS booking_id,
  3 + (get_byte(id::text::bytea, 1) % 3)::smallint, -- 3..5
  'A Wonderful Experience!',
  'The food was delicious and the service was impeccable. Highly recommended!'
FROM public.bookings
WHERE status = 'confirmed' AND booking_date < now()::date
  AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.booking_id = public.bookings.id)
  AND (get_byte(id::text::bytea, 2) % 3) = 0;

INSERT INTO public.reviews (restaurant_id, booking_id, rating, title, comment)
SELECT
  restaurant_id,
  id AS booking_id,
  1 + (get_byte(id::text::bytea, 3) % 2)::smallint, -- 1..2
  'Disappointing Visit',
  'Service was slow and the food missed expectations this time.'
FROM public.bookings
WHERE status = 'confirmed' AND booking_date < now()::date
  AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.booking_id = public.bookings.id)
  AND (get_byte(id::text::bytea, 4) % 10) = 0;

-- ====================================================================
-- Waiting List (idempotent)
-- ====================================================================
INSERT INTO public.waiting_list (restaurant_id, booking_date, desired_time, party_size, customer_name, customer_email, customer_phone, status)
SELECT
  id,
  (now() + interval '1 day')::date,
  '19:30:00'::time,
  2,
  'Alice Waiting',
  'alice.waiting@example.com',
  '+447800123456',
  'waiting'
FROM public.restaurants WHERE slug = 'the-corner-house-pub'
ON CONFLICT DO NOTHING;

INSERT INTO public.waiting_list (restaurant_id, booking_date, desired_time, party_size, customer_name, customer_email, customer_phone, status)
SELECT
  id,
  (now() + interval '2 day')::date,
  '20:00:00'::time,
  4,
  'Bob Hopeful',
  'bob.hopeful@example.com',
  '+447800654321',
  'waiting'
FROM public.restaurants WHERE slug = 'the-barley-mow-pub-hartford'
ON CONFLICT DO NOTHING;

-- ====================================================================
-- Loyalty Program + Points (idempotent)
-- ====================================================================
DO $blk$
DECLARE
  prog uuid;
  rid  uuid;
  rec  RECORD;
  bkg  RECORD;
  addp int;
BEGIN
  rid := (SELECT id FROM public.restaurants WHERE slug = 'the-corner-house-pub');

  -- Upsert program via (restaurant_id, slug)
  INSERT INTO public.loyalty_programs (id, restaurant_id, slug, name, is_active, pilot_only)
  VALUES (public.app_uuid(), rid, 'corner-house-rewards', 'Corner House Rewards', true, false)
  ON CONFLICT (restaurant_id, slug) DO UPDATE
    SET name = EXCLUDED.name, is_active = EXCLUDED.is_active, pilot_only = EXCLUDED.pilot_only
  RETURNING id INTO prog;

  -- Ensure accounts exist
  INSERT INTO public.loyalty_points (program_id, customer_id, restaurant_id, balance, lifetime_points)
  SELECT prog, c.id, rid, 0, 0
  FROM public.customers c
  WHERE c.restaurant_id = rid
  ON CONFLICT (program_id, customer_id) DO NOTHING;

  -- Award points for past confirmed bookings (skip if already done)
  FOR rec IN SELECT c.id AS customer_id FROM public.customers c WHERE c.restaurant_id = rid LOOP
    FOR bkg IN
      SELECT *
      FROM public.bookings
      WHERE customer_id = rec.customer_id AND status = 'confirmed' AND booking_date < now()::date
    LOOP
      addp := 10 + (bkg.party_size * 5);

      IF NOT EXISTS (
        SELECT 1 FROM public.loyalty_point_events e
        WHERE e.program_id = prog AND e.customer_id = rec.customer_id
          AND e.booking_id = bkg.id AND e.reason = 'Completed Booking Reward'
      ) THEN
        INSERT INTO public.loyalty_point_events (program_id, customer_id, booking_id, restaurant_id, points_delta, balance_after, reason)
        VALUES (
          prog, rec.customer_id, bkg.id, rid,
          addp,
          (SELECT balance FROM public.loyalty_points WHERE program_id = prog AND customer_id = rec.customer_id) + addp,
          'Completed Booking Reward'
        );

        UPDATE public.loyalty_points
        SET
          balance = balance + addp,
          lifetime_points = lifetime_points + addp,
          last_awarded_at = now()
        WHERE program_id = prog AND customer_id = rec.customer_id;
      END IF;
    END LOOP;
  END LOOP;
END
$blk$;

-- ====================================================================
-- OPTIONAL: Seed memberships for an admin (Option B)
-- Pass an existing auth user id via: SELECT set_config('app.seed_user_id','<uuid>',true);
-- ====================================================================
DO $blk$
DECLARE
  seed_user uuid;
  rid uuid;
BEGIN
  -- CORRECTED LINE:
  seed_user := NULLIF(coalesce(current_setting('app.seed_user_id', true), ''), '')::uuid;

  IF seed_user IS NOT NULL THEN
    FOR rid IN SELECT id FROM public.restaurants LOOP
      INSERT INTO public.restaurant_memberships (user_id, restaurant_id, role)
      VALUES (seed_user, rid, 'admin')
      ON CONFLICT (user_id, restaurant_id) DO UPDATE
        SET role = EXCLUDED.role;
    END LOOP;
  END IF;
END
$blk$;