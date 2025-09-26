BEGIN;

-- ==========================================
-- One-restaurant rich seed (valid UUIDs)
-- ==========================================

-- -------------------------
-- Restaurant (tenant)
-- -------------------------
INSERT INTO public.restaurants (id, name, slug, timezone, capacity)
VALUES
  ('f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','Borough Bistro','borough-bistro','Europe/London',90)
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Areas (3 distinct spaces)
-- -------------------------
INSERT INTO public.restaurant_areas (id, restaurant_id, name, seating_type)
VALUES
  ('a1a1a1a1-1111-1111-1111-111111111111','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','Main Dining','indoor'),
  ('a1a1a1a1-1111-1111-1111-222222222222','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','Street Terrace','outdoor'),
  ('a1a1a1a1-1111-1111-1111-333333333333','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','Chef''s Counter','bar')
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Tables (6 tables across areas)
-- -------------------------
INSERT INTO public.restaurant_tables (id, restaurant_id, area_id, label, capacity, seating_type, features)
VALUES
  ('aaaaaaaa-0001-0001-0001-000000000001','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','a1a1a1a1-1111-1111-1111-111111111111','Table 1',2,'indoor','{window}'),
  ('aaaaaaaa-0001-0001-0001-000000000002','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','a1a1a1a1-1111-1111-1111-111111111111','Table 6 (Booth)',4,'indoor','{booth,accessible}'),
  ('aaaaaaaa-0001-0001-0001-000000000003','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','a1a1a1a1-1111-1111-1111-111111111111','Table 12',6,'indoor','{}'),
  ('bbbbbbbb-0002-0002-0002-000000000001','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','a1a1a1a1-1111-1111-1111-222222222222','Terrace 3',4,'outdoor','{heater}'),
  ('bbbbbbbb-0002-0002-0002-000000000002','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','a1a1a1a1-1111-1111-1111-222222222222','Terrace 5',2,'outdoor','{}'),
  ('cccccccc-0003-0003-0003-000000000001','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','a1a1a1a1-1111-1111-1111-333333333333','Counter A',2,'bar','{}')
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Availability (full week; realistic hours)
-- day_of_week: 0=Sun ... 6=Sat
-- -------------------------
INSERT INTO public.availability_rules (id, restaurant_id, day_of_week, booking_type, open_time, close_time, is_closed, notes)
VALUES
  ('a0a0a0a0-0000-0000-0000-000000000000','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68',0,'dinner','12:00','21:00',false,'Sunday'),
  ('a0a0a0a1-0000-0000-0000-000000000000','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68',1,'dinner','12:00','22:00',false,'Weekday'),
  ('a0a0a0a2-0000-0000-0000-000000000000','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68',2,'dinner','12:00','22:00',false,'Weekday'),
  ('a0a0a0a3-0000-0000-0000-000000000000','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68',3,'dinner','12:00','22:00',false,'Weekday'),
  ('a0a0a0a4-0000-0000-0000-000000000000','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68',4,'dinner','12:00','22:00',false,'Weekday'),
  ('a0a0a0a5-0000-0000-0000-000000000000','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68',5,'dinner','12:00','23:00',false,'Friday late'),
  ('a0a0a0a6-0000-0000-0000-000000000000','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68',6,'dinner','12:00','23:00',false,'Saturday late')
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Customers (4 realistic patrons; emails lowercase for domain/CHECK)
-- -------------------------
INSERT INTO public.customers (id, restaurant_id, email, phone, full_name, marketing_opt_in)
VALUES
  ('dddddddd-1111-1111-1111-111111111111','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','alice.johnson@paperlane.co.uk','+44 20 7946 0018','Alice Johnson', true),
  ('dddddddd-1111-1111-1111-222222222222','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','bob.miller@inboxmail.co.uk','+44 7700 900123','Bob Miller', false),
  ('dddddddd-1111-1111-1111-333333333333','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','carol.nguyen@runcrafters.uk','+44 161 555 0101','Carol Nguyen', true),
  ('dddddddd-1111-1111-1111-444444444444','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','dan.owens@postbox.uk','+44 7300 111222','Dan Owens', false)
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Customer profiles
-- -------------------------
INSERT INTO public.customer_profiles (customer_id, total_bookings, total_cancellations, total_covers, marketing_opt_in, notes)
VALUES
  ('dddddddd-1111-1111-1111-111111111111',0,0,0,true,'Local food blogger'),
  ('dddddddd-1111-1111-1111-222222222222',0,0,0,false,NULL),
  ('dddddddd-1111-1111-1111-333333333333',0,0,0,true,NULL),
  ('dddddddd-1111-1111-1111-444444444444',0,0,0,false,'Allergies: peanuts')
ON CONFLICT (customer_id) DO NOTHING;

-- -------------------------
-- Bookings (6 records; includes new optional fields where useful)
-- -------------------------
INSERT INTO public.bookings
  (id, restaurant_id, customer_id, table_id, booking_date, start_time, end_time, party_size,
   booking_type, seating_preference, status, customer_name, customer_email, customer_phone,
   reference, marketing_opt_in, pending_ref, idempotency_key, details)
VALUES
  -- Tonight 19:00–21:00 (confirmed, indoor booth)
  ('eeeeeeee-1111-1111-1111-111111111111','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','dddddddd-1111-1111-1111-111111111111','aaaaaaaa-0001-0001-0001-000000000002',
   CURRENT_DATE, '19:00','21:00',2,'dinner','any','confirmed','Alice Johnson','alice.johnson@paperlane.co.uk','+44 20 7946 0018','BB1900A1Z9',true,
   public.app_uuid(),
   'idem-1111','{"occasion":"anniversary"}'),

  -- Tomorrow 18:00–19:30 (cancelled, window request)
  ('eeeeeeee-1111-1111-1111-222222222222','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','dddddddd-1111-1111-1111-222222222222','aaaaaaaa-0001-0001-0001-000000000001',
   CURRENT_DATE + INTERVAL '1 day','18:00','19:30',2,'dinner','window','cancelled','Bob Miller','bob.miller@inboxmail.co.uk','+44 7700 900123','BBTMRW6PM2',false,
   public.app_uuid(),
   'idem-2222',NULL),

  -- Tonight 20:00–22:00 (confirmed, terrace)
  ('eeeeeeee-1111-1111-1111-333333333333','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','dddddddd-1111-1111-1111-333333333333','bbbbbbbb-0002-0002-0002-000000000001',
   CURRENT_DATE, '20:00','22:00',4,'dinner','outdoor','confirmed','Carol Nguyen','carol.nguyen@runcrafters.uk','+44 161 555 0101','BB2000T3C4',true,
   public.app_uuid(),
   'idem-3333', '{"note":"bring blanket"}'),

  -- Tonight 18:30–19:30 (pending_allocation, no table yet)
  ('eeeeeeee-1111-1111-1111-444444444444','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','dddddddd-1111-1111-1111-444444444444',NULL,
   CURRENT_DATE, '18:30','19:30',2,'drinks','bar','pending_allocation','Dan Owens','dan.owens@postbox.uk','+44 7300 111222','BB1830DZ12',false,
   public.app_uuid(),
   'idem-4444',NULL),

  -- Next week 19:30–21:30 (pending)
  ('eeeeeeee-1111-1111-1111-555555555555','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','dddddddd-1111-1111-1111-111111111111','aaaaaaaa-0001-0001-0001-000000000003',
   CURRENT_DATE + INTERVAL '7 day', '19:30','21:30',5,'dinner','any','pending','Alice Johnson','alice.johnson@paperlane.co.uk','+44 20 7946 0018','BBNWK19A50',true,
   public.app_uuid(),
   'idem-5555',NULL),

  -- Lunch test today 13:00–14:30 (confirmed, counter)
  ('eeeeeeee-1111-1111-1111-666666666666','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','dddddddd-1111-1111-1111-222222222222','cccccccc-0003-0003-0003-000000000001',
   CURRENT_DATE, '13:00','14:30',1,'lunch','bar','confirmed','Bob Miller','bob.miller@inboxmail.co.uk','+44 7700 900123','BB1300LC01',false,
   public.app_uuid(),
   'idem-6666',NULL)
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Reviews (for an existing booking)
-- -------------------------
INSERT INTO public.reviews (id, restaurant_id, booking_id, rating, title, comment)
VALUES
  ('ffffffff-1111-1111-1111-111111111111','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','eeeeeeee-1111-1111-1111-111111111111',5,'Outstanding service','Attentive staff, perfectly cooked mains, and great wine pairing.')
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Waiting list (3 varied statuses) — FIXED 3rd ROW
-- -------------------------
INSERT INTO public.waiting_list (id, restaurant_id, booking_date, desired_time, party_size, seating_preference, customer_name, customer_email, customer_phone, notes, status)
VALUES
  ('abababab-1111-1111-1111-111111111111','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68', CURRENT_DATE, '19:30', 2, 'any', 'Ethan Price', 'ethan.price@example.co.uk', '+44 7300 000001', 'happy to split tables', 'waiting'),
  ('abababab-1111-1111-1111-222222222222','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68', CURRENT_DATE, '20:00', 4, 'indoor', 'Maya Singh', 'maya.singh@example.co.uk', '+44 7300 000002', 'prefers booth', 'notified'),
  ('abababab-1111-1111-1111-333333333333','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68', CURRENT_DATE, '21:00', 2, 'any', 'Leo Turner', 'leo.turner@example.co.uk', '+44 7300 000003', NULL, 'expired')
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Loyalty program + points
-- -------------------------
INSERT INTO public.loyalty_programs (id, restaurant_id, slug, name, description, is_active, pilot_only)
VALUES
  ('acacacac-1111-1111-1111-111111111111','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','classic','Classic Rewards','Earn points per cover.',true,false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.loyalty_points (id, program_id, customer_id, balance, lifetime_points, tier, last_awarded_at)
VALUES
  ('adadadad-1111-1111-1111-111111111111','acacacac-1111-1111-1111-111111111111','dddddddd-1111-1111-1111-111111111111', 24, 24, 'bronze', now()),
  ('adadadad-1111-1111-1111-222222222222','acacacac-1111-1111-1111-111111111111','dddddddd-1111-1111-1111-333333333333', 12, 12, 'bronze', now())
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Loyalty point events (booking-linked; balances match)
-- -------------------------
INSERT INTO public.loyalty_point_events
  (id, program_id, customer_id, booking_id, points_delta, balance_after, reason, metadata, occurred_at)
VALUES
  ('aeaeaeae-1111-1111-1111-111111111111','acacacac-1111-1111-1111-111111111111','dddddddd-1111-1111-1111-111111111111','eeeeeeee-1111-1111-1111-111111111111', +24, 24, 'booking_points', '{"covers":2,"base":10,"ppg":5}'::jsonb, now()),
  ('aeaeaeae-1111-1111-1111-222222222222','acacacac-1111-1111-1111-111111111111','dddddddd-1111-1111-1111-333333333333','eeeeeeee-1111-1111-1111-333333333333', +12, 12, 'booking_points', '{"covers":4,"base":10,"ppg":5}'::jsonb, now())
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Analytics events (satisfy payload shape + cross-field checks)
-- -------------------------

-- booking.created for Alice (confirmed)
INSERT INTO public.analytics_events
  (id, event_type, schema_version, restaurant_id, booking_id, customer_id, emitted_by, payload, occurred_at)
VALUES
  ('b0b0b0b0-1111-1111-1111-111111111111','booking.created',1,
   'f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','eeeeeeee-1111-1111-1111-111111111111','dddddddd-1111-1111-1111-111111111111','server',
   jsonb_build_object(
     'version',1,
     'booking_id','eeeeeeee-1111-1111-1111-111111111111',
     'restaurant_id','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68',
     'customer_id','dddddddd-1111-1111-1111-111111111111',
     'status','confirmed',
     'party_size',2,
     'booking_type','dinner',
     'seating_preference','any',
     'source','web',
     'waitlisted',false
   ), now()
  )
ON CONFLICT (id) DO NOTHING;

-- booking.cancelled for Bob
INSERT INTO public.analytics_events
  (id, event_type, schema_version, restaurant_id, booking_id, customer_id, emitted_by, payload, occurred_at)
VALUES
  ('b0b0b0b0-1111-1111-1111-222222222222','booking.cancelled',1,
   'f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','eeeeeeee-1111-1111-1111-222222222222','dddddddd-1111-1111-1111-222222222222','server',
   jsonb_build_object(
     'version',1,
     'booking_id','eeeeeeee-1111-1111-1111-222222222222',
     'restaurant_id','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68',
     'customer_id','dddddddd-1111-1111-1111-222222222222',
     'previous_status','confirmed',
     'cancelled_by','customer'
   ), now()
  )
ON CONFLICT (id) DO NOTHING;

-- booking.allocated for Alice -> Table 6 (Booth)
INSERT INTO public.analytics_events
  (id, event_type, schema_version, restaurant_id, booking_id, customer_id, emitted_by, payload, occurred_at)
VALUES
  ('b0b0b0b0-1111-1111-1111-333333333333','booking.allocated',1,
   'f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','eeeeeeee-1111-1111-1111-111111111111','dddddddd-1111-1111-1111-111111111111','server',
   jsonb_build_object(
     'version',1,
     'booking_id','eeeeeeee-1111-1111-1111-111111111111',
     'restaurant_id','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68',
     'customer_id','dddddddd-1111-1111-1111-111111111111',
     'table_id','aaaaaaaa-0001-0001-0001-000000000002',
     'allocation_status','allocated'
   ), now()
  )
ON CONFLICT (id) DO NOTHING;

-- booking.waitlisted tying to Dan's pending booking and WL row
INSERT INTO public.analytics_events
  (id, event_type, schema_version, restaurant_id, booking_id, customer_id, emitted_by, payload, occurred_at)
VALUES
  ('b0b0b0b0-1111-1111-1111-444444444444','booking.waitlisted',1,
   'f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','eeeeeeee-1111-1111-1111-444444444444','dddddddd-1111-1111-1111-444444444444','server',
   jsonb_build_object(
     'version',1,
     'booking_id','eeeeeeee-1111-1111-1111-444444444444',
     'restaurant_id','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68',
     'customer_id','dddddddd-1111-1111-1111-444444444444',
     'waitlist_id','abababab-1111-1111-1111-111111111111',
     'position',1
   ), now()
  )
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Booking Drafts (new table)
-- -------------------------
INSERT INTO public.booking_drafts
  (id, restaurant_id, email_normalized, phone_normalized, payload, expires_at)
VALUES
  ('d0d0d0d0-aaaa-bbbb-cccc-000000000001','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','alice.johnson@paperlane.co.uk','442079460018',
   '{"party_size":2,"desired_time":"19:30","notes":"anniversary"}'::jsonb, now() + interval '45 minutes'),
  ('d0d0d0d0-aaaa-bbbb-cccc-000000000002','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','walkin@example.co.uk',NULL,
   '{"party_size":4,"desired_time":"20:00"}'::jsonb, now() + interval '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Pending Bookings (new table)
-- -------------------------
INSERT INTO public.pending_bookings
  (nonce, client_request_id, email, payload, created_at, expires_at)
VALUES
  ('11111111-2222-3333-4444-555555555555','aaaaaaaa-bbbb-cccc-dddd-000000000001','queue.alice@paperlane.co.uk',
   jsonb_build_object('booking_date', current_date::text, 'start_time','19:30', 'party_size', 2),
   now(), now() + interval '30 minutes'),
  ('11111111-2222-3333-4444-555555555556','aaaaaaaa-bbbb-cccc-dddd-000000000002','queue.bob@inboxmail.co.uk',
   jsonb_build_object('booking_date', (current_date + 1)::text, 'start_time','18:00', 'party_size', 2),
   now(), now() + interval '30 minutes')
ON CONFLICT (nonce) DO NOTHING;

-- -------------------------
-- Leads (new table)
-- -------------------------
INSERT INTO public.leads (id, email, created_at)
VALUES
  ('feedfeed-1111-2222-3333-444444444444','hello@borough-bistro.example', timezone('utc', now()))
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Audit logs (include restaurant_id for RLS tests)
-- -------------------------
INSERT INTO public.audit_logs (id, actor, action, entity, entity_id, metadata, created_at)
VALUES
  (1,'system','seed.insert','restaurant','f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68','{"restaurant_id":"f6c2f62d-0b6c-4dfd-b0ec-2d1c7a509a68"}'::jsonb,now())
ON CONFLICT (id) DO NOTHING;

-- align sequence to max(id) to avoid future nextval collisions
SELECT setval(
  'public.audit_logs_id_seq',
  GREATEST(
    COALESCE((SELECT MAX(id) FROM public.audit_logs), 0),
    COALESCE((SELECT last_value FROM public.audit_logs_id_seq), 0)
  ),
  true
);

-- -------------------------
-- Stripe / Observability (simple markers)
-- -------------------------
INSERT INTO public.stripe_events (id, event_id, event_type, payload, received_at, processed_at, status)
VALUES
  ('bbbbbbbb-1111-1111-1111-111111111111','evt_1PXSEEDTest','payment_intent.succeeded','{"amount":8200,"currency":"gbp"}'::jsonb, now(), now(), 'processed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.observability_events (id, event_type, source, severity, context, created_at)
VALUES
  ('c0c0c0c0-1111-1111-1111-111111111111','seed.completed','db:seed','info','{"environment":"local","restaurant":"borough-bistro"}'::jsonb, now())
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Optional: Profiles (only if an auth user exists)
-- -------------------------
DO $blk$
DECLARE
  u uuid;
BEGIN
  SELECT id INTO u FROM auth.users LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.profiles (id, name, email, has_access)
    VALUES (u, 'Seed User', 'seed.user@example.com', true)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          email = EXCLUDED.email,
          has_access = EXCLUDED.has_access;
  END IF;
END
$blk$;

COMMIT;
