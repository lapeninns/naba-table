-- Integration test: allocations overlap enforcement & atomic RPC behaviour
-- Execute with: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/allocations_atomic.sql

DO $$
DECLARE
  v_restaurant uuid;
  v_customer uuid;
  v_zone uuid;
  v_table uuid := gen_random_uuid();
  v_booking_a uuid := gen_random_uuid();
  v_booking_b uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_restaurant FROM public.restaurants WHERE is_active LIMIT 1;
  IF v_restaurant IS NULL THEN
    RAISE EXCEPTION 'No restaurant available for allocations test';
  END IF;

  SELECT id INTO v_customer FROM public.customers WHERE restaurant_id = v_restaurant LIMIT 1;
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'No customer available for allocations test';
  END IF;

  SELECT id INTO v_zone FROM public.zones WHERE restaurant_id = v_restaurant LIMIT 1;
  IF v_zone IS NULL THEN
    INSERT INTO public.zones (id, restaurant_id, name, sort_order, created_at, updated_at)
    VALUES (gen_random_uuid(), v_restaurant, 'Atomic Test Zone', 999, now(), now())
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_zone;

    IF v_zone IS NULL THEN
      SELECT id INTO v_zone FROM public.zones WHERE restaurant_id = v_restaurant LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.table_inventory (
    id,
    restaurant_id,
    table_number,
    capacity,
    min_party_size,
    max_party_size,
    section,
    seating_type,
    status,
    position,
    notes,
    category,
    mobility,
    zone_id,
    active,
    created_at,
    updated_at
  ) VALUES (
    v_table,
    v_restaurant,
    'ATOMIC-T1',
    4,
    1,
    NULL,
    'Atomic Test Section',
    'standard',
    'available',
    NULL,
    'Atomic allocations test table',
    'dining',
    'movable',
    v_zone,
    true,
    now(),
    now()
  );

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
    booking_type
  )
  SELECT
    v_booking_a,
    v_restaurant,
    v_customer,
    DATE '2099-01-01',
    '18:00',
    '20:00',
    TIMESTAMPTZ '2099-01-01 18:00:00+00',
    TIMESTAMPTZ '2099-01-01 20:00:00+00',
    2,
    'any',
    'confirmed',
    c.full_name,
    c.email,
    c.phone,
    'Atomic assignment booking A',
    'ATOMIC-A-' || substr(gen_random_uuid()::text, 1, 6),
    'ops',
    now(),
    now(),
    'dinner'
  FROM public.customers c
  WHERE c.id = v_customer;

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
    booking_type
  )
  SELECT
    v_booking_b,
    v_restaurant,
    v_customer,
    DATE '2099-01-01',
    '20:00',
    '22:00',
    TIMESTAMPTZ '2099-01-01 20:00:00+00',
    TIMESTAMPTZ '2099-01-01 22:00:00+00',
    2,
    'any',
    'confirmed',
    c.full_name,
    c.email,
    c.phone,
    'Atomic assignment booking B',
    'ATOMIC-B-' || substr(gen_random_uuid()::text, 1, 6),
    'ops',
    now(),
    now(),
    'dinner'
  FROM public.customers c
  WHERE c.id = v_customer;

  PERFORM public.assign_tables_atomic(
    v_booking_a,
    ARRAY[v_table],
    '[2099-01-01 18:00:00+00,2099-01-01 20:00:00+00)'
  );

  BEGIN
    PERFORM public.assign_tables_atomic(
      v_booking_b,
      ARRAY[v_table],
      '[2099-01-01 19:00:00+00,2099-01-01 21:00:00+00)'
    );
    RAISE EXCEPTION 'Conflict was expected but assignment succeeded';
  EXCEPTION
    WHEN others THEN
      IF EXISTS (SELECT 1 FROM public.allocations WHERE booking_id = v_booking_b) THEN
        RAISE EXCEPTION 'Conflict attempt left residual allocations';
      END IF;
  END;

  PERFORM public.assign_tables_atomic(
    v_booking_b,
    ARRAY[v_table],
    '[2099-01-01 20:00:00+00,2099-01-01 22:00:00+00)'
  );

  DELETE FROM public.allocations WHERE booking_id IN (v_booking_a, v_booking_b);
  DELETE FROM public.booking_table_assignments WHERE booking_id IN (v_booking_a, v_booking_b);
  DELETE FROM public.bookings WHERE id IN (v_booking_a, v_booking_b);
  DELETE FROM public.table_inventory WHERE id = v_table;
END $$;
