-- ====================================================================
-- Booking Engine — Seed Data (idempotent)
-- Requires: schema already created and extensions available.
-- ====================================================================

DO $$
DECLARE
  -- Restaurants
  r1 uuid; r2 uuid;

  -- Areas (Cedar & Sage)
  r1_indoor uuid; r1_bar uuid; r1_terrace uuid;

  -- Tables (Cedar & Sage)
  r1_t1 uuid; r1_t2 uuid; r1_t3 uuid; r1_t4 uuid; r1_t5 uuid; r1_t6 uuid;

  -- Areas (Shoreline Kitchen)
  r2_indoor uuid; r2_window uuid;

  -- Tables (Shoreline Kitchen)
  r2_t1 uuid; r2_t2 uuid; r2_t3 uuid; r2_t4 uuid;

  -- Customers
  r1_cust1 uuid; r1_cust2 uuid; r1_cust3 uuid;
  r2_cust1 uuid; r2_cust2 uuid;

  -- Loyalty programs
  r1_prog uuid; r2_prog uuid;

  -- Bookings
  r1_bk1 uuid; r1_bk2 uuid; r1_bk3 uuid; r2_bk1 uuid;

  -- Waitlist
  r1_w1 uuid;

  -- Utility
  v_exists boolean;
BEGIN
  -- =========================
  -- Restaurants
  -- =========================
  SELECT id INTO r1 FROM public.restaurants WHERE slug = 'cedar-sage';
  IF r1 IS NULL THEN
    INSERT INTO public.restaurants (name, slug, timezone, capacity)
    VALUES ('Cedar & Sage', 'cedar-sage', 'Europe/London', 80)
    RETURNING id INTO r1;
  END IF;

  SELECT id INTO r2 FROM public.restaurants WHERE slug = 'shoreline-kitchen';
  IF r2 IS NULL THEN
    INSERT INTO public.restaurants (name, slug, timezone, capacity)
    VALUES ('Shoreline Kitchen', 'shoreline-kitchen', 'America/New_York', 60)
    RETURNING id INTO r2;
  END IF;

  -- =========================
  -- Areas & Tables (R1)
  -- =========================
  SELECT id INTO r1_indoor  FROM public.restaurant_areas WHERE restaurant_id = r1 AND name = 'Main Dining';
  IF r1_indoor IS NULL THEN
    INSERT INTO public.restaurant_areas (restaurant_id, name, seating_type)
    VALUES (r1, 'Main Dining', 'indoor') RETURNING id INTO r1_indoor;
  END IF;

  SELECT id INTO r1_bar FROM public.restaurant_areas WHERE restaurant_id = r1 AND name = 'Bar';
  IF r1_bar IS NULL THEN
    INSERT INTO public.restaurant_areas (restaurant_id, name, seating_type)
    VALUES (r1, 'Bar', 'bar') RETURNING id INTO r1_bar;
  END IF;

  SELECT id INTO r1_terrace FROM public.restaurant_areas WHERE restaurant_id = r1 AND name = 'Terrace';
  IF r1_terrace IS NULL THEN
    INSERT INTO public.restaurant_areas (restaurant_id, name, seating_type)
    VALUES (r1, 'Terrace', 'outdoor') RETURNING id INTO r1_terrace;
  END IF;

  -- Tables (labels are unique per restaurant via index)
  SELECT id INTO r1_t1 FROM public.restaurant_tables WHERE restaurant_id = r1 AND lower(label) = 't1';
  IF r1_t1 IS NULL THEN
    INSERT INTO public.restaurant_tables (restaurant_id, area_id, label, capacity, seating_type, features)
    VALUES (r1, r1_indoor, 'T1', 2, 'indoor', ARRAY['near-kitchen'])
    RETURNING id INTO r1_t1;
  END IF;

  SELECT id INTO r1_t2 FROM public.restaurant_tables WHERE restaurant_id = r1 AND lower(label) = 't2';
  IF r1_t2 IS NULL THEN
    INSERT INTO public.restaurant_tables (restaurant_id, area_id, label, capacity, seating_type, features)
    VALUES (r1, r1_indoor, 'T2', 4, 'indoor', ARRAY['accessible'])
    RETURNING id INTO r1_t2;
  END IF;

  SELECT id INTO r1_t3 FROM public.restaurant_tables WHERE restaurant_id = r1 AND lower(label) = 't3';
  IF r1_t3 IS NULL THEN
    INSERT INTO public.restaurant_tables (restaurant_id, area_id, label, capacity, seating_type, features)
    VALUES (r1, r1_indoor, 'T3', 4, 'indoor', ARRAY[]::text[])
    RETURNING id INTO r1_t3;
  END IF;

  SELECT id INTO r1_t4 FROM public.restaurant_tables WHERE restaurant_id = r1 AND lower(label) = 'b1';
  IF r1_t4 IS NULL THEN
    INSERT INTO public.restaurant_tables (restaurant_id, area_id, label, capacity, seating_type, features)
    VALUES (r1, r1_bar, 'B1', 2, 'bar', ARRAY['high-top'])
    RETURNING id INTO r1_t4;
  END IF;

  SELECT id INTO r1_t5 FROM public.restaurant_tables WHERE restaurant_id = r1 AND lower(label) = 'b2';
  IF r1_t5 IS NULL THEN
    INSERT INTO public.restaurant_tables (restaurant_id, area_id, label, capacity, seating_type, features)
    VALUES (r1, r1_bar, 'B2', 2, 'bar', ARRAY['high-top'])
    RETURNING id INTO r1_t5;
  END IF;

  SELECT id INTO r1_t6 FROM public.restaurant_tables WHERE restaurant_id = r1 AND lower(label) = 'o1';
  IF r1_t6 IS NULL THEN
    INSERT INTO public.restaurant_tables (restaurant_id, area_id, label, capacity, seating_type, features)
    VALUES (r1, r1_terrace, 'O1', 4, 'outdoor', ARRAY['shade','heater'])
    RETURNING id INTO r1_t6;
  END IF;

  -- =========================
  -- Areas & Tables (R2)
  -- =========================
  SELECT id INTO r2_indoor FROM public.restaurant_areas WHERE restaurant_id = r2 AND name = 'Dining Room';
  IF r2_indoor IS NULL THEN
    INSERT INTO public.restaurant_areas (restaurant_id, name, seating_type)
    VALUES (r2, 'Dining Room', 'indoor') RETURNING id INTO r2_indoor;
  END IF;

  SELECT id INTO r2_window FROM public.restaurant_areas WHERE restaurant_id = r2 AND name = 'Window Seats';
  IF r2_window IS NULL THEN
    INSERT INTO public.restaurant_areas (restaurant_id, name, seating_type)
    VALUES (r2, 'Window Seats', 'window') RETURNING id INTO r2_window;
  END IF;

  SELECT id INTO r2_t1 FROM public.restaurant_tables WHERE restaurant_id = r2 AND lower(label) = 'w1';
  IF r2_t1 IS NULL THEN
    INSERT INTO public.restaurant_tables (restaurant_id, area_id, label, capacity, seating_type, features)
    VALUES (r2, r2_window, 'W1', 2, 'window', ARRAY['great-view'])
    RETURNING id INTO r2_t1;
  END IF;

  SELECT id INTO r2_t2 FROM public.restaurant_tables WHERE restaurant_id = r2 AND lower(label) = 'w2';
  IF r2_t2 IS NULL THEN
    INSERT INTO public.restaurant_tables (restaurant_id, area_id, label, capacity, seating_type, features)
    VALUES (r2, r2_window, 'W2', 4, 'window', ARRAY[]::text[])
    RETURNING id INTO r2_t2;
  END IF;

  SELECT id INTO r2_t3 FROM public.restaurant_tables WHERE restaurant_id = r2 AND lower(label) = 'd1';
  IF r2_t3 IS NULL THEN
    INSERT INTO public.restaurant_tables (restaurant_id, area_id, label, capacity, seating_type, features)
    VALUES (r2, r2_indoor, 'D1', 4, 'indoor', ARRAY['booth'])
    RETURNING id INTO r2_t3;
  END IF;

  SELECT id INTO r2_t4 FROM public.restaurant_tables WHERE restaurant_id = r2 AND lower(label) = 'd2';
  IF r2_t4 IS NULL THEN
    INSERT INTO public.restaurant_tables (restaurant_id, area_id, label, capacity, seating_type, features)
    VALUES (r2, r2_indoor, 'D2', 6, 'indoor', ARRAY['accessible'])
    RETURNING id INTO r2_t4;
  END IF;

  -- =========================
  -- Availability rules (simple: dinner 17:00-22:00 every day)
  -- =========================
  FOR v_exists IN SELECT false LOOP
    PERFORM 1 FROM public.availability_rules
      WHERE restaurant_id = r1 AND day_of_week = 0 AND booking_type = 'dinner';
    IF NOT FOUND THEN
      INSERT INTO public.availability_rules (restaurant_id, day_of_week, booking_type, open_time, close_time, is_closed)
      SELECT r1, d, 'dinner', '17:00'::time, '22:00'::time, false FROM generate_series(0,6) d;
    END IF;

    PERFORM 1 FROM public.availability_rules
      WHERE restaurant_id = r2 AND day_of_week = 0 AND booking_type = 'dinner';
    IF NOT FOUND THEN
      INSERT INTO public.availability_rules (restaurant_id, day_of_week, booking_type, open_time, close_time, is_closed)
      SELECT r2, d, 'dinner', '17:00'::time, '22:00'::time, false FROM generate_series(0,6) d;
    END IF;
  END LOOP;

  -- =========================
  -- Customers + Profiles
  -- =========================
  -- R1 customers
  SELECT id INTO r1_cust1 FROM public.customers WHERE restaurant_id = r1 AND email = 'alice@example.com';
  IF r1_cust1 IS NULL THEN
    INSERT INTO public.customers (restaurant_id, email, phone, full_name, marketing_opt_in)
    VALUES
      (r1, 'alice@example.com', '+44 7700 900001', 'Alice Johnson', true)
    RETURNING id INTO r1_cust1;
  END IF;
  PERFORM 1 FROM public.customer_profiles WHERE customer_id = r1_cust1;
  IF NOT FOUND THEN
    INSERT INTO public.customer_profiles (customer_id, marketing_opt_in, preferences)
    VALUES (r1_cust1, true, '{"seating":"window","allergies":["nuts"]}');
  END IF;

  SELECT id INTO r1_cust2 FROM public.customers WHERE restaurant_id = r1 AND email = 'bob@example.com';
  IF r1_cust2 IS NULL THEN
    INSERT INTO public.customers (restaurant_id, email, phone, full_name)
    VALUES
      (r1, 'bob@example.com', '+44 7700 900002', 'Bob Smith')
    RETURNING id INTO r1_cust2;
  END IF;
  PERFORM 1 FROM public.customer_profiles WHERE customer_id = r1_cust2;
  IF NOT FOUND THEN
    INSERT INTO public.customer_profiles (customer_id, preferences)
    VALUES (r1_cust2, '{"seating":"any"}');
  END IF;

  SELECT id INTO r1_cust3 FROM public.customers WHERE restaurant_id = r1 AND email = 'carol@example.com';
  IF r1_cust3 IS NULL THEN
    INSERT INTO public.customers (restaurant_id, email, phone, full_name, marketing_opt_in)
    VALUES
      (r1, 'carol@example.com', '+44 7700 900003', 'Carol Nguyen', true)
    RETURNING id INTO r1_cust3;
  END IF;
  PERFORM 1 FROM public.customer_profiles WHERE customer_id = r1_cust3;
  IF NOT FOUND THEN
    INSERT INTO public.customer_profiles (customer_id, marketing_opt_in)
    VALUES (r1_cust3, true);
  END IF;

  -- R2 customers
  SELECT id INTO r2_cust1 FROM public.customers WHERE restaurant_id = r2 AND email = 'dana@example.com';
  IF r2_cust1 IS NULL THEN
    INSERT INTO public.customers (restaurant_id, email, phone, full_name)
    VALUES (r2, 'dana@example.com', '+1 (917) 555-0101', 'Dana Park')
    RETURNING id INTO r2_cust1;
  END IF;
  PERFORM 1 FROM public.customer_profiles WHERE customer_id = r2_cust1;
  IF NOT FOUND THEN
    INSERT INTO public.customer_profiles (customer_id) VALUES (r2_cust1);
  END IF;

  SELECT id INTO r2_cust2 FROM public.customers WHERE restaurant_id = r2 AND email = 'eric@example.com';
  IF r2_cust2 IS NULL THEN
    INSERT INTO public.customers (restaurant_id, email, phone, full_name)
    VALUES (r2, 'eric@example.com', '+1 (917) 555-0102', 'Eric Gomez')
    RETURNING id INTO r2_cust2;
  END IF;
  PERFORM 1 FROM public.customer_profiles WHERE customer_id = r2_cust2;
  IF NOT FOUND THEN
    INSERT INTO public.customer_profiles (customer_id) VALUES (r2_cust2);
  END IF;

  -- =========================
  -- Loyalty programs & points
  -- =========================
  SELECT id INTO r1_prog FROM public.loyalty_programs WHERE restaurant_id = r1 AND slug = 'standard';
  IF r1_prog IS NULL THEN
    INSERT INTO public.loyalty_programs (restaurant_id, slug, name, description, is_active, pilot_only)
    VALUES (r1, 'standard', 'Standard Rewards', 'Points per guest', true, false)
    RETURNING id INTO r1_prog;
  END IF;

  SELECT id INTO r2_prog FROM public.loyalty_programs WHERE restaurant_id = r2 AND slug = 'standard';
  IF r2_prog IS NULL THEN
    INSERT INTO public.loyalty_programs (restaurant_id, slug, name, description, is_active, pilot_only)
    VALUES (r2, 'standard', 'Standard Rewards', 'Points per guest', true, false)
    RETURNING id INTO r2_prog;
  END IF;

  -- Points rows (upsert-like)
  PERFORM 1 FROM public.loyalty_points WHERE program_id = r1_prog AND customer_id = r1_cust1;
  IF NOT FOUND THEN
    INSERT INTO public.loyalty_points (program_id, customer_id, balance, lifetime_points, tier)
    VALUES (r1_prog, r1_cust1, 50, 50, 'bronze');
  END IF;

  PERFORM 1 FROM public.loyalty_points WHERE program_id = r1_prog AND customer_id = r1_cust3;
  IF NOT FOUND THEN
    INSERT INTO public.loyalty_points (program_id, customer_id, balance, lifetime_points, tier)
    VALUES (r1_prog, r1_cust3, 120, 120, 'silver');
  END IF;

  -- =========================
  -- Bookings (dates relative to today; ensure uniqueness & no overlaps)
  -- =========================
  -- R1 Booking 1: today + 7 days, 19:00-21:00 at T2
  SELECT id INTO r1_bk1 FROM public.bookings
   WHERE restaurant_id = r1 AND customer_id = r1_cust1 AND booking_date = (current_date + 7)
     AND start_time = '19:00';
  IF r1_bk1 IS NULL THEN
    INSERT INTO public.bookings (
      restaurant_id, customer_id, table_id,
      booking_date, start_time, end_time,
      party_size, booking_type, seating_preference,
      status, customer_name, customer_email, customer_phone,
      notes, source, loyalty_points_awarded,
      client_request_id, idempotency_key, marketing_opt_in, details
    )
    VALUES (
      r1, r1_cust1, r1_t2,
      current_date + 7, '19:00', '21:00',
      2, 'dinner', 'window',
      'confirmed', 'Alice Johnson', 'alice@example.com', '+44 7700 900001',
      'Anniversary', 'web', 10,
      gen_random_uuid(), 'r1-alice-7d-1900', true, '{"occasion":"anniversary"}'
    )
    RETURNING id INTO r1_bk1;
  END IF;

  -- R1 Booking 2: today + 7 days, 19:15-20:45 (different table, no overlap conflict)
  SELECT id INTO r1_bk2 FROM public.bookings
   WHERE restaurant_id = r1 AND customer_id = r1_cust2 AND booking_date = (current_date + 7)
     AND start_time = '19:15';
  IF r1_bk2 IS NULL THEN
    INSERT INTO public.bookings (
      restaurant_id, customer_id, table_id,
      booking_date, start_time, end_time,
      party_size, booking_type, seating_preference,
      status, customer_name, customer_email, customer_phone,
      source, client_request_id, idempotency_key, details
    )
    VALUES (
      r1, r1_cust2, r1_t3,
      current_date + 7, '19:15', '20:45',
      3, 'dinner', 'any',
      'confirmed', 'Bob Smith', 'bob@example.com', '+44 7700 900002',
      'web', gen_random_uuid(), 'r1-bob-7d-1915', '{"notes":"birthday"}'
    )
    RETURNING id INTO r1_bk2;
  END IF;

  -- R1 Booking 3: pending allocation (no table yet)
  SELECT id INTO r1_bk3 FROM public.bookings
   WHERE restaurant_id = r1 AND customer_id = r1_cust3 AND booking_date = (current_date + 14)
     AND start_time = '20:00';
  IF r1_bk3 IS NULL THEN
    INSERT INTO public.bookings (
      restaurant_id, customer_id,
      booking_date, start_time, end_time,
      party_size, booking_type, seating_preference,
      status, customer_name, customer_email, customer_phone,
      source, client_request_id, idempotency_key, details
    )
    VALUES (
      r1, r1_cust3,
      current_date + 14, '20:00', '21:30',
      4, 'dinner', 'outdoor',
      'pending_allocation', 'Carol Nguyen', 'carol@example.com', '+44 7700 900003',
      'phone', gen_random_uuid(), 'r1-carol-14d-2000', '{"requested_area":"Terrace"}'
    )
    RETURNING id INTO r1_bk3;
  END IF;

  -- R2 Booking 1: tomorrow, 18:30-20:00 at W1 (NY timezone)
  SELECT id INTO r2_bk1 FROM public.bookings
   WHERE restaurant_id = r2 AND customer_id = r2_cust1 AND booking_date = (current_date + 1)
     AND start_time = '18:30';
  IF r2_bk1 IS NULL THEN
    INSERT INTO public.bookings (
      restaurant_id, customer_id, table_id,
      booking_date, start_time, end_time,
      party_size, booking_type, seating_preference,
      status, customer_name, customer_email, customer_phone,
      source, client_request_id, idempotency_key
    )
    VALUES (
      r2, r2_cust1, r2_t1,
      current_date + 1, '18:30', '20:00',
      2, 'dinner', 'window',
      'confirmed', 'Dana Park', 'dana@example.com', '+1 917 555 0101',
      'web', gen_random_uuid(), 'r2-dana-tom-1830'
    )
    RETURNING id INTO r2_bk1;
  END IF;

  -- =========================
  -- Reviews
  -- =========================
  PERFORM 1 FROM public.reviews WHERE booking_id = r1_bk1;
  IF NOT FOUND THEN
    INSERT INTO public.reviews (restaurant_id, booking_id, rating, title, comment)
    VALUES (r1, r1_bk1, 5, 'Wonderful evening', 'Great service and food!');
  END IF;

  PERFORM 1 FROM public.reviews WHERE booking_id = r2_bk1;
  IF NOT FOUND THEN
    INSERT INTO public.reviews (restaurant_id, booking_id, rating, title, comment)
    VALUES (r2, r2_bk1, 4, 'Nice view', 'Loved the window seat.');
  END IF;

  -- =========================
  -- Waiting list
  -- =========================
  SELECT id INTO r1_w1 FROM public.waiting_list
    WHERE restaurant_id = r1 AND booking_date = (current_date + 1)
      AND desired_time = '19:00' AND lower(customer_email::text) = 'walkin@example.com';
  IF r1_w1 IS NULL THEN
    INSERT INTO public.waiting_list (
      restaurant_id, booking_date, desired_time, party_size, seating_preference,
      customer_name, customer_email, customer_phone, notes, status
    )
    VALUES (
      r1, current_date + 1, '19:00', 2, 'any',
      'Walk-in Lead', 'walkin@example.com', '+44 7700 900099',
      'Will wait up to 30 mins', 'waiting'
    )
    RETURNING id INTO r1_w1;
  END IF;

  -- =========================
  -- Analytics events (schema-checked)
  -- =========================
  PERFORM 1 FROM public.analytics_events WHERE booking_id = r1_bk1 AND event_type = 'booking.created';
  IF NOT FOUND THEN
    INSERT INTO public.analytics_events (
      event_type, schema_version, restaurant_id, booking_id, customer_id, emitted_by, payload
    )
    VALUES (
      'booking.created', 1, r1, r1_bk1, r1_cust1, 'server',
      jsonb_build_object(
        'version', 1,
        'booking_id', r1_bk1::text,
        'restaurant_id', r1::text,
        'customer_id', r1_cust1::text,
        'status', 'confirmed',
        'party_size', 2,
        'booking_type', 'dinner',
        'seating_preference', 'window',
        'source', 'web',
        'waitlisted', false
      )
    );
  END IF;

  PERFORM 1 FROM public.analytics_events WHERE booking_id = r1_bk3 AND event_type = 'booking.waitlisted';
  IF NOT FOUND THEN
    INSERT INTO public.analytics_events (
      event_type, schema_version, restaurant_id, booking_id, customer_id, emitted_by, payload
    )
    VALUES (
      'booking.waitlisted', 1, r1, r1_bk3, r1_cust3, 'server',
      jsonb_build_object(
        'version', 1,
        'booking_id', r1_bk3::text,
        'restaurant_id', r1::text,
        'customer_id', r1_cust3::text,
        'waitlist_id', r1_w1::text,
        'position', 1
      )
    );
  END IF;

  -- =========================
  -- Loyalty point events (balance snapshots)
  -- =========================
  PERFORM 1 FROM public.loyalty_point_events WHERE booking_id = r1_bk1 AND reason = 'attendance';
  IF NOT FOUND THEN
    INSERT INTO public.loyalty_point_events (
      program_id, customer_id, booking_id, points_delta, balance_after, reason, metadata
    )
    VALUES (r1_prog, r1_cust1, r1_bk1, 10, 60, 'attendance', '{"awarded_by":"system"}');
    UPDATE public.loyalty_points
      SET balance = 60, lifetime_points = greatest(lifetime_points, 60), last_awarded_at = now()
      WHERE program_id = r1_prog AND customer_id = r1_cust1;
  END IF;

  -- =========================
  -- Leads, Drafts, Pending, Logs, Stripe/Observability
  -- =========================
  PERFORM 1 FROM public.leads WHERE email = 'newsletter@example.com';
  IF NOT FOUND THEN
    INSERT INTO public.leads (email) VALUES ('newsletter@example.com');
  END IF;

  PERFORM 1 FROM public.booking_drafts WHERE restaurant_id = r1 AND email_normalized = 'draft@example.com';
  IF NOT FOUND THEN
    INSERT INTO public.booking_drafts (restaurant_id, email_normalized, phone_normalized, payload, expires_at)
    VALUES (
      r1, 'draft@example.com', '447700900010',
      '{"party_size":2,"requested_time":"19:30"}',
      now() + interval '2 hours'
    );
  END IF;

  -- Pending booking with dynamic date (fixed)
  PERFORM 1 FROM public.pending_bookings WHERE email = 'pending@example.com';
  IF NOT FOUND THEN
    INSERT INTO public.pending_bookings (client_request_id, email, payload)
    VALUES (
      gen_random_uuid(),
      'pending@example.com',
      jsonb_build_object(
        'party_size', 4,
        'date', to_char(current_date + 3, 'YYYY-MM-DD')
      )
    );
  END IF;


  PERFORM 1 FROM public.audit_logs WHERE entity = 'restaurant' AND action = 'seeded' AND entity_id = r1;
  IF NOT FOUND THEN
    INSERT INTO public.audit_logs (actor, action, entity, entity_id, metadata)
    VALUES ('seed-script', 'seeded', 'restaurant', r1, jsonb_build_object('restaurant_id', r1::text, 'slug', 'cedar-sage'));
  END IF;

  PERFORM 1 FROM public.stripe_events WHERE event_id = 'evt_test_seed_1';
  IF NOT FOUND THEN
    INSERT INTO public.stripe_events (event_id, event_type, payload, status)
    VALUES ('evt_test_seed_1', 'customer.created', '{"id":"evt_test_seed_1"}', 'processed');
  END IF;

  PERFORM 1 FROM public.observability_events WHERE source = 'seed' AND event_type = 'seed.completed';
  IF NOT FOUND THEN
    INSERT INTO public.observability_events (event_type, source, severity, context)
    VALUES ('seed.completed', 'seed', 'info', '{"restaurants":2,"tables":10}');
  END IF;
END
$$;

-- ====================================================================
-- Quick sanity checks (optional)
-- ====================================================================
-- SELECT r.name, count(t.*) AS tables FROM public.restaurants r
-- JOIN public.restaurant_tables t ON t.restaurant_id = r.id
-- GROUP BY 1 ORDER BY 1;

-- SELECT booking_date, start_time, end_time, status, reference, table_id
-- FROM public.bookings ORDER BY booking_date, start_time;
