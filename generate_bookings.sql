DO $$
DECLARE
    v_restaurant_id UUID := '486de541-a307-4414-b0b1-f774a0e4a9fa'; -- White Horse Pub
    v_table_record RECORD;
    v_customer_id UUID;
    v_booking_id UUID;
    v_booking_date DATE := '2025-12-28';
    v_start_time TIME;
    v_start_at TIMESTAMPTZ;
    v_end_at TIMESTAMPTZ;
    i INTEGER;
    v_guest_name TEXT;
    v_table_ids UUID[];
BEGIN
    -- 1. Verify Restaurant exists (optional but good for safety)
    IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id = v_restaurant_id) THEN
        RAISE EXCEPTION 'Restaurant with ID % not found', v_restaurant_id;
    END IF;

    -- 2. Get available tables for this restaurant
    SELECT ARRAY(SELECT id FROM table_inventory WHERE restaurant_id = v_restaurant_id AND active = true) INTO v_table_ids;
    
    IF array_length(v_table_ids, 1) < 1 THEN
        RAISE EXCEPTION 'No active tables found for this restaurant';
    END IF;

    -- 3. Loop to create 15 bookings
    FOR i IN 1..15 LOOP
        v_guest_name := 'Staging Guest ' || i || ' ' || (floor(random() * 900) + 100)::text;
        -- Spread bookings between 12:00 and 19:30
        v_start_time := (TIME '12:00:00' + (i * interval '30 minutes'));
        v_start_at := (v_booking_date + v_start_time) AT TIME ZONE 'UTC';
        v_end_at := v_start_at + interval '2 hours';

        -- Create a Customer
        INSERT INTO customers (
            restaurant_id, 
            full_name, 
            email, 
            phone,
            source
        ) VALUES (
            v_restaurant_id, 
            v_guest_name, 
            lower(replace(v_guest_name, ' ', '.')) || '@example.com',
            '+447000000' || LPAD(i::text, 2, '0'),
            'walk-in'
        ) RETURNING id INTO v_customer_id;

        -- Create the Booking
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
            reference,
            assignment_state,
            table_id -- Setting primary table_id for convenience in dashboard view
        ) VALUES (
            v_restaurant_id,
            v_customer_id,
            v_guest_name,
            lower(replace(v_guest_name, ' ', '.')) || '@example.com',
            '+447000000' || LPAD(i::text, 2, '0'),
            v_booking_date,
            v_start_time::text,
            (v_start_time + interval '2 hours')::text,
            v_start_at,
            v_end_at,
            (floor(random() * 4) + 2)::int, -- Random party size 2-6
            'confirmed',
            'walk-in',
            'STG-' || upper(substr(md5(random()::text), 1, 6)),
            'assigned',
            v_table_ids[(i % array_length(v_table_ids, 1)) + 1]
        ) RETURNING id INTO v_booking_id;

        -- Create the Table Assignment
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

    RAISE NOTICE 'Successfully created 15 bookings for White Horse Pub on %', v_booking_date;
END $$;
