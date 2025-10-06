-- ============================================
-- SEED: 8 pubs, tables, customers, and 50 bookings each
-- Runs under the postgres/service role (bypasses RLS).
-- Safe to re-run after a full reset.
-- ============================================

-- ---------- pubs ----------
WITH pubs AS (
  INSERT INTO public.restaurants (name, slug, timezone, capacity)
  VALUES
    ('The Queen Elizabeth Pub', 'the-queen-elizabeth-pub', 'Europe/London', 120),
    ('Old Crown Pub',           'old-crown-pub',           'Europe/London', 100),
    ('White Horse Pub',         'white-horse-pub',         'Europe/London', 110),
    ('The Corner House Pub',    'the-corner-house-pub',    'Europe/London', 90),
    ('Prince of Wales Pub',     'prince-of-wales-pub',     'Europe/London', 130),
    ('The Bell Sawtry',         'the-bell-sawtry',         'Europe/London', 80),
    ('The Railway Pub',         'the-railway-pub',         'Europe/London', 95),
    ('The Barley Mow Pub',      'the-barley-mow-pub',      'Europe/London', 105)
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        timezone = EXCLUDED.timezone,
        capacity = EXCLUDED.capacity,
        updated_at = now()
  RETURNING id, slug, name
),
-- ---------- one owner membership per pub (dummy app user id) ----------
owners AS (
  -- fixed UUID so you can later sign your app user to this id if you want
  SELECT '00000000-0000-0000-0000-000000000001'::uuid AS user_id
),
pub_owners AS (
  INSERT INTO public.restaurant_memberships (user_id, restaurant_id, role)
  SELECT o.user_id, p.id, 'owner'
  FROM owners o CROSS JOIN pubs p
  ON CONFLICT (user_id, restaurant_id) DO NOTHING
  RETURNING restaurant_id
),
-- ---------- tables per pub ----------
tables AS (
  -- 12 tables per pub, different capacities/seating types
  INSERT INTO public.restaurant_tables (restaurant_id, label, capacity, seating_type, is_active, notes)
  SELECT p.id,
         'T' || gs::text,
         /* capacities cycle: 2,4,6,8, 2,4,6,8,... */
         CASE WHEN (gs % 4) = 1 THEN 2
              WHEN (gs % 4) = 2 THEN 4
              WHEN (gs % 4) = 3 THEN 6
              ELSE 8 END,
         /* seating type cycle */
         CASE (gs % 5)
              WHEN 1 THEN 'indoor'::seating_type
              WHEN 2 THEN 'outdoor'::seating_type
              WHEN 3 THEN 'bar'::seating_type
              WHEN 4 THEN 'patio'::seating_type
              ELSE 'private_room'::seating_type
         END,
         true,
         NULL
  FROM pubs p
  CROSS JOIN generate_series(1,12) AS gs
  ON CONFLICT (restaurant_id, label) DO NOTHING
  RETURNING id, restaurant_id, label, capacity
),
-- ---------- customers per pub ----------
customers AS (
  -- 80 customers per pub (more than enough to reference)
  INSERT INTO public.customers (restaurant_id, full_name, email, phone, marketing_opt_in, notes)
  SELECT p.id,
         'Customer ' || p.slug || ' #' || i AS full_name,
         -- unique per pub to satisfy (restaurant_id, email_normalized) unique
         lower('customer' || i || '@' || p.slug || '.demo') AS email,
         -- simple, normalized UK-ish numbers: +44700XXXXXX
         '+44700' || lpad((1000 + i)::text, 6, '0') AS phone,
         (i % 5 = 0), -- every 5th opted-in
         NULL
  FROM pubs p
  CROSS JOIN generate_series(1,80) AS i
  ON CONFLICT DO NOTHING
  RETURNING id, restaurant_id, full_name, email, phone
),
-- =========================================================
-- 50 BOOKINGS / PUB
--   - 15 in the past:  CURRENT_DATE - 15 .. -1  (1 per day)
--   - 5 today:         CURRENT_DATE (5 different times)
--   - 30 in future:    CURRENT_DATE + 1 .. +30  (1 per day)
-- Non-overlapping: each booking uses a time slot and cycles tables.
-- Start times rotate: 12:00, 13:30, 15:00, 17:30, 19:00, 20:30
-- Duration: 105 minutes (1h45)
-- =========================================================
series_past AS (
  SELECT gs AS idx, CURRENT_DATE - gs AS booking_date
  FROM generate_series(1,15) AS gs
),
series_today AS (
  SELECT gs AS idx, CURRENT_DATE AS booking_date
  FROM generate_series(0,4) AS gs  -- 5 today
),
series_future AS (
  SELECT gs AS idx, CURRENT_DATE + gs AS booking_date
  FROM generate_series(1,30) AS gs
),
all_series AS (
  SELECT 'past' AS bucket, idx, booking_date FROM series_past
  UNION ALL
  SELECT 'today', idx, booking_date FROM series_today
  UNION ALL
  SELECT 'future', idx, booking_date FROM series_future
),
-- helper to compute start/end times (rotating 90-min slots)
slots AS (
  SELECT idx,
         -- 12:00 + (idx % 6)*90 minutes
         (time '12:00' + make_interval(mins := ( (idx % 6) * 90 )))::time AS start_time,
         (time '12:00' + make_interval(mins := ( (idx % 6) * 90 + 105 )))::time AS end_time
  FROM (SELECT generate_series(0,1000) AS idx) s -- plenty
)
INSERT INTO public.bookings
  (restaurant_id, customer_id, table_id,
   booking_date, start_time, end_time,
   party_size, seating_preference, status,
   customer_name, customer_email, customer_phone,
   notes, source)
SELECT
  p.id                                       AS restaurant_id,
  c.id                                       AS customer_id,
  t.id                                       AS table_id,
  s.booking_date,
  sl.start_time,
  sl.end_time,
  -- party size within table capacity, min 2:
  GREATEST(2, LEAST(t.capacity, 2 + ((s.idx % GREATEST(1,t.capacity-1))))) AS party_size,
  -- rotate preferences a bit
  CASE ((s.idx + 1) % 5)
    WHEN 1 THEN 'any'::seating_preference_type
    WHEN 2 THEN 'indoor'::seating_preference_type
    WHEN 3 THEN 'outdoor'::seating_preference_type
    WHEN 4 THEN 'bar'::seating_preference_type
    ELSE 'quiet'::seating_preference_type
  END AS seating_preference,
  -- status: past -> completed/no_show/cancelled; today -> confirmed/pending; future -> confirmed/pending
  CASE s.bucket
    WHEN 'past' THEN
      CASE (s.idx % 6)
        WHEN 0 THEN 'completed'::booking_status
        WHEN 1 THEN 'completed'::booking_status
        WHEN 2 THEN 'no_show'::booking_status
        WHEN 3 THEN 'completed'::booking_status
        WHEN 4 THEN 'cancelled'::booking_status
        ELSE 'completed'::booking_status
      END
    WHEN 'today' THEN CASE WHEN (s.idx % 2 = 0) THEN 'confirmed'::booking_status ELSE 'pending'::booking_status END
    ELSE                CASE WHEN (s.idx % 3 = 0) THEN 'pending'::booking_status   ELSE 'confirmed'::booking_status END
  END AS status,
  c.full_name AS customer_name,
  c.email     AS customer_email,
  c.phone     AS customer_phone,
  CASE s.bucket
    WHEN 'past'  THEN 'Seeded booking (past).'
    WHEN 'today' THEN 'Seeded booking (today).'
    ELSE             'Seeded booking (future).'
  END AS notes,
  'seed' AS source
FROM pubs p
JOIN all_series s ON TRUE
JOIN slots sl ON sl.idx = s.idx
-- pick a table by cycling label T1..T12; prevents overlaps because each idx uses a single slot and a specific table
JOIN tables t
  ON t.restaurant_id = p.id
 AND t.label = 'T' || (((s.idx % 12) + 1)::text)
-- pick a customer deterministically for reproducibility
JOIN customers c
  ON c.restaurant_id = p.id
 AND right(c.full_name, position('#' IN reverse(c.full_name)) - 1)::int = (((s.idx % 80) + 1))
;

-- End of seed
