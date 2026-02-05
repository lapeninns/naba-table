DO $$
DECLARE
    v_restaurant_id UUID;
    v_table_ids UUID[];
    v_customer_id UUID;
    v_booking_id UUID;
    v_booking_date DATE := '2026-02-05';
    v_start_time TIME;
    v_start_at TIMESTAMPTZ;
    v_end_at TIMESTAMPTZ;
    v_guest_name TEXT;
    v_reference TEXT;
    v_slot_index INTEGER;
    v_slots INTEGER := 16; -- 17:00 to 20:45 inclusive (15-min intervals)
    v_slot_interval INTERVAL := interval '15 minutes';
    i INTEGER;
BEGIN
    SELECT id
      INTO v_restaurant_id
      FROM restaurants
     WHERE lower(name) LIKE '%old crown%'
       AND lower(name) LIKE '%girton%'
     LIMIT 1;

    IF v_restaurant_id IS NULL THEN
        RAISE EXCEPTION 'Restaurant "Old Crown Girton" not found';
    END IF;

    SELECT ARRAY(
        SELECT id
          FROM table_inventory
         WHERE restaurant_id = v_restaurant_id
           AND active = true
    ) INTO v_table_ids;

    IF array_length(v_table_ids, 1) < 1 THEN
        RAISE EXCEPTION 'No active tables found for restaurant %', v_restaurant_id;
    END IF;

    FOR i IN 1..50 LOOP
        v_guest_name := 'Staging OCG Guest ' || i || ' ' || (floor(random() * 900) + 100)::text;
        v_slot_index := (i - 1) % v_slots;
        v_start_time := (TIME '17:00:00' + (v_slot_index * v_slot_interval));
        v_start_at := (v_booking_date + v_start_time) AT TIME ZONE 'UTC';
        v_end_at := v_start_at + interval '2 hours';

        -- Create customer
        INSERT INTO customers (
            restaurant_id,
            full_name,
            email,
            phone
        ) VALUES (
            v_restaurant_id,
            v_guest_name,
            'ocg-seed-20260205-' || i || '@example.com',
            '+447700205' || LPAD(i::text, 2, '0')
        ) RETURNING id INTO v_customer_id;

        v_reference := 'STG-OCG-' || upper(substr(md5(random()::text), 1, 8));

        -- Create booking
        INSERT INTO bookings (
            restaurant_id,
            customer_id,
            customer_name,
            customer_email,
            customer_phone,
            booking_date,
            start_time,
            end_time,
            start_at,
            end_at,
            party_size,
            status,
            source,
            reference
        ) VALUES (
            v_restaurant_id,
            v_customer_id,
            v_guest_name,
            'ocg-seed-20260205-' || i || '@example.com',
            '+447700205' || LPAD(i::text, 2, '0'),
            v_booking_date,
            v_start_time,
            (v_start_time + interval '2 hours'),
            v_start_at,
            v_end_at,
            (floor(random() * 4) + 2)::int,
            'confirmed',
            'walk-in',
            v_reference
        ) RETURNING id INTO v_booking_id;

        -- Create table assignment
        INSERT INTO booking_table_assignments (
            booking_id,
            table_id,
            start_at,
            end_at,
            assigned_at
        ) VALUES (
            v_booking_id,
            v_table_ids[(i % array_length(v_table_ids, 1)) + 1],
            v_start_at,
            v_end_at,
            now()
        );
    END LOOP;

    RAISE NOTICE 'Created 50 bookings for Old Crown Girton on %', v_booking_date;
END $$;
