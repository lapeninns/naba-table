-- ============================================================================
-- Today's Bookings Seed Generator for SajiloReserveX
-- ============================================================================
-- Purpose: Generate realistic bookings for TODAY to stress test the allocation algorithm
-- Features:
--   - 100 bookings distributed across all restaurants for today
--   - Realistic time distribution (lunch/dinner peaks)
--   - Varied party sizes matching table capacities
--   - All bookings in 'confirmed' status ready for allocation
-- ============================================================================

BEGIN;

SET LOCAL client_min_messages = warning;
SET LOCAL search_path = public;

DO $$
DECLARE
    v_target_bookings INT := 100;
    v_booking_id UUID;
    v_restaurant_id UUID;
    v_customer_id UUID;
    v_temp_time TIME;
    v_temp_start TIMESTAMPTZ;
    v_temp_end TIMESTAMPTZ;
    v_temp_party_size INT;
    v_booking_type TEXT;
    v_counter INT := 0;
    
BEGIN
    RAISE NOTICE '📅 Generating % bookings for TODAY (%)', v_target_bookings, CURRENT_DATE;
    
    -- Generate bookings distributed across all restaurants
    FOR v_counter IN 1..v_target_bookings LOOP
        
        -- Select a random restaurant
        SELECT id INTO v_restaurant_id
        FROM public.restaurants
        ORDER BY random()
        LIMIT 1;
        
        -- Select a random customer for this restaurant
        SELECT id INTO v_customer_id
        FROM public.customers
        WHERE restaurant_id = v_restaurant_id
        ORDER BY random()
        LIMIT 1;
        
        -- Generate realistic booking time with peaks at lunch and dinner
        v_temp_time := CASE floor(random() * 20)::INT
            -- Lunch period (11:45-14:30) - 30% of bookings
            WHEN 0 THEN '11:45'::TIME + (floor(random() * 165)::INT || ' minutes')::INTERVAL
            WHEN 1 THEN '11:45'::TIME + (floor(random() * 165)::INT || ' minutes')::INTERVAL
            WHEN 2 THEN '11:45'::TIME + (floor(random() * 165)::INT || ' minutes')::INTERVAL
            WHEN 3 THEN '11:45'::TIME + (floor(random() * 165)::INT || ' minutes')::INTERVAL
            WHEN 4 THEN '11:45'::TIME + (floor(random() * 165)::INT || ' minutes')::INTERVAL
            WHEN 5 THEN '11:45'::TIME + (floor(random() * 165)::INT || ' minutes')::INTERVAL
            -- Afternoon/drinks (15:00-17:00) - 10% of bookings
            WHEN 6 THEN '15:00'::TIME + (floor(random() * 120)::INT || ' minutes')::INTERVAL
            WHEN 7 THEN '15:00'::TIME + (floor(random() * 120)::INT || ' minutes')::INTERVAL
            -- Dinner period (18:00-21:00) - 60% of bookings
            ELSE '18:00'::TIME + (floor(random() * 180)::INT || ' minutes')::INTERVAL
        END;
        
        v_temp_start := CURRENT_DATE + v_temp_time;
        v_temp_end := v_temp_start + (90 + floor(random() * 60)::INT || ' minutes')::INTERVAL;
        
        -- Party size weighted towards common sizes (2, 4, 6)
        v_temp_party_size := CASE floor(random() * 20)::INT
            WHEN 0 THEN 2     -- 40% are 2-tops
            WHEN 1 THEN 2
            WHEN 2 THEN 2
            WHEN 3 THEN 2
            WHEN 4 THEN 2
            WHEN 5 THEN 2
            WHEN 6 THEN 2
            WHEN 7 THEN 2
            WHEN 8 THEN 4       -- 30% are 4-tops
            WHEN 9 THEN 4
            WHEN 10 THEN 4
            WHEN 11 THEN 4
            WHEN 12 THEN 4
            WHEN 13 THEN 4
            WHEN 14 THEN 6                 -- 15% are 6-tops
            WHEN 15 THEN 6
            WHEN 16 THEN 6
            WHEN 17 THEN 3                     -- 10% are 3-tops
            WHEN 18 THEN 3
            ELSE 8                                  -- 5% are larger parties
        END;
        
        -- Determine booking type based on time
        v_booking_type := CASE 
            WHEN v_temp_time >= '11:45'::TIME AND v_temp_time < '15:30'::TIME THEN 'lunch'
            WHEN v_temp_time >= '15:00'::TIME AND v_temp_time < '18:00'::TIME THEN 'drinks'
            ELSE 'dinner'
        END;
        
        v_booking_id := gen_random_uuid();
        
        -- Insert the booking
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
            status,
            booking_type,
            customer_name,
            customer_email,
            customer_phone,
            reference,
            notes,
            created_at
        )
        SELECT
            v_booking_id,
            v_restaurant_id,
            c.id,
            CURRENT_DATE,
            v_temp_time,
            (v_temp_start + (90 + floor(random() * 60)::INT || ' minutes')::INTERVAL)::TIME,
            v_temp_start,
            v_temp_end,
            v_temp_party_size,
            'confirmed'::booking_status,
            v_booking_type,
            c.full_name,
            c.email,
            c.phone,
            'REF-' || upper(substring(md5(v_booking_id::TEXT) from 1 for 8)),
            CASE 
                WHEN random() > 0.85 THEN 'Window seat preferred'
                WHEN random() > 0.90 THEN 'Birthday celebration'
                WHEN random() > 0.95 THEN 'Anniversary dinner'
                ELSE NULL
            END,
            NOW() - (floor(random() * 72)::INT || ' hours')::INTERVAL  -- Created 0-3 days ago
        FROM public.customers c
        WHERE c.id = v_customer_id;
        
    END LOOP;
    
    -- Summary
    RAISE NOTICE '';
    RAISE NOTICE '✅ TODAY''S BOOKINGS GENERATED';
    RAISE NOTICE '================================';
    RAISE NOTICE 'Total bookings: %', (SELECT COUNT(*) FROM public.bookings WHERE booking_date = CURRENT_DATE);
    RAISE NOTICE '';
    RAISE NOTICE '📊 Distribution by time:';
    RAISE NOTICE '   Lunch (11:45-15:30): %', 
        (SELECT COUNT(*) FROM public.bookings WHERE booking_date = CURRENT_DATE AND start_time >= '11:45' AND start_time < '15:30');
    RAISE NOTICE '   Drinks (15:00-18:00): %', 
        (SELECT COUNT(*) FROM public.bookings WHERE booking_date = CURRENT_DATE AND start_time >= '15:00' AND start_time < '18:00');
    RAISE NOTICE '   Dinner (18:00-23:00): %', 
        (SELECT COUNT(*) FROM public.bookings WHERE booking_date = CURRENT_DATE AND start_time >= '18:00' AND start_time < '23:00');
    RAISE NOTICE '';
    RAISE NOTICE '📊 Distribution by party size:';
    
    FOR v_temp_party_size IN (
        SELECT party_size 
        FROM public.bookings 
        WHERE booking_date = CURRENT_DATE 
        GROUP BY party_size 
        ORDER BY party_size
    ) LOOP
        RAISE NOTICE '   Party of %: %', 
            v_temp_party_size,
            (SELECT COUNT(*) FROM public.bookings WHERE booking_date = CURRENT_DATE AND party_size = v_temp_party_size);
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 Distribution by restaurant:';
    
    FOR v_restaurant_id IN (SELECT id FROM public.restaurants ORDER BY name) LOOP
        RAISE NOTICE '   %: %', 
            (SELECT name FROM public.restaurants WHERE id = v_restaurant_id),
            (SELECT COUNT(*) FROM public.bookings WHERE booking_date = CURRENT_DATE AND restaurant_id = v_restaurant_id);
    END LOOP;
    
    RAISE NOTICE '';
    
END $$;

COMMIT;
