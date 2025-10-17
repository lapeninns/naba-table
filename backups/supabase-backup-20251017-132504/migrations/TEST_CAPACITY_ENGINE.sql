-- =====================================================
-- Capacity Engine Migration Testing Script
-- =====================================================
-- Run this in Supabase Studio SQL Editor to test all migrations
-- DO NOT RUN IN PRODUCTION - For testing only!
-- =====================================================

-- =====================================================
-- STEP 1: Verify Tables Exist
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '=== STEP 1: Verifying Tables ===';
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'table_inventory') THEN
        RAISE NOTICE '✓ table_inventory exists';
    ELSE
        RAISE EXCEPTION '✗ table_inventory NOT FOUND';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_slots') THEN
        RAISE NOTICE '✓ booking_slots exists';
    ELSE
        RAISE EXCEPTION '✗ booking_slots NOT FOUND';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_table_assignments') THEN
        RAISE NOTICE '✓ booking_table_assignments exists';
    ELSE
        RAISE EXCEPTION '✗ booking_table_assignments NOT FOUND';
    END IF;
END $$;

-- =====================================================
-- STEP 2: Verify RPC Function Exists
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '=== STEP 2: Verifying RPC Function ===';
    
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'create_booking_with_capacity_check'
    ) THEN
        RAISE NOTICE '✓ create_booking_with_capacity_check() exists';
    ELSE
        RAISE EXCEPTION '✗ create_booking_with_capacity_check() NOT FOUND';
    END IF;
END $$;

-- =====================================================
-- STEP 3: Insert Test Data
-- =====================================================
-- Get a test restaurant (or create one)
WITH test_restaurant AS (
    SELECT id, slug, timezone
    FROM restaurants
    WHERE is_active = true
    LIMIT 1
)
-- Insert test tables
INSERT INTO table_inventory (
    restaurant_id,
    table_number,
    capacity,
    min_party_size,
    section,
    seating_type,
    status
)
SELECT 
    id,
    'TEST-T' || generate_series,
    CASE generate_series % 4
        WHEN 0 THEN 2
        WHEN 1 THEN 4
        WHEN 2 THEN 6
        ELSE 8
    END,
    1,
    'Test Section',
    CASE generate_series % 2
        WHEN 0 THEN 'indoor'::seating_type
        ELSE 'outdoor'::seating_type
    END,
    'available'::table_status
FROM test_restaurant, generate_series(1, 10)
ON CONFLICT (restaurant_id, table_number) DO NOTHING;

-- Insert test capacity rule (low capacity for easy testing)
WITH test_restaurant AS (
    SELECT id FROM restaurants WHERE is_active = true LIMIT 1
),
test_period AS (
    SELECT id FROM restaurant_service_periods 
    WHERE restaurant_id = (SELECT id FROM test_restaurant)
    LIMIT 1
)
INSERT INTO restaurant_capacity_rules (
    restaurant_id,
    service_period_id,
    max_covers,
    max_parties
)
SELECT 
    tr.id,
    tp.id,
    20,  -- Low capacity for testing
    10
FROM test_restaurant tr, test_period tp
ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 4: Test RPC Function - Success Case
-- =====================================================
DO $$
DECLARE
    v_result jsonb;
    v_restaurant_id uuid;
    v_customer_id uuid;
BEGIN
    RAISE NOTICE '=== STEP 4: Testing RPC - Success Case ===';
    
    -- Get test restaurant and customer
    SELECT id INTO v_restaurant_id FROM restaurants WHERE is_active = true LIMIT 1;
    SELECT id INTO v_customer_id FROM customers WHERE restaurant_id = v_restaurant_id LIMIT 1;
    
    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'No test customer found. Create one first.';
    END IF;
    
    -- Call RPC function
    SELECT create_booking_with_capacity_check(
        p_restaurant_id := v_restaurant_id,
        p_customer_id := v_customer_id,
        p_booking_date := CURRENT_DATE + 1,
        p_start_time := '19:00'::time,
        p_end_time := '21:00'::time,
        p_party_size := 4,
        p_booking_type := 'dinner',
        p_customer_name := 'Test Customer',
        p_customer_email := 'test@capacity.com',
        p_customer_phone := '+1999999999',
        p_seating_preference := 'any',
        p_notes := 'Test booking - capacity engine verification',
        p_marketing_opt_in := false,
        p_idempotency_key := 'test-capacity-' || gen_random_uuid()::text,
        p_source := 'test',
        p_auth_user_id := NULL,
        p_client_request_id := 'test-001',
        p_details := '{}'::jsonb,
        p_loyalty_points_awarded := 0
    ) INTO v_result;
    
    -- Verify success
    IF (v_result->>'success')::boolean = true THEN
        RAISE NOTICE '✓ Booking created successfully';
        RAISE NOTICE '  Reference: %', v_result->'booking'->>'reference';
        RAISE NOTICE '  Capacity: %', v_result->'capacity';
    ELSE
        RAISE EXCEPTION '✗ Booking creation failed: %', v_result->>'message';
    END IF;
END $$;

-- =====================================================
-- STEP 5: Test Idempotency
-- =====================================================
DO $$
DECLARE
    v_result1 jsonb;
    v_result2 jsonb;
    v_restaurant_id uuid;
    v_customer_id uuid;
    v_idempotency_key text;
BEGIN
    RAISE NOTICE '=== STEP 5: Testing Idempotency ===';
    
    -- Get test data
    SELECT id INTO v_restaurant_id FROM restaurants WHERE is_active = true LIMIT 1;
    SELECT id INTO v_customer_id FROM customers WHERE restaurant_id = v_restaurant_id LIMIT 1;
    v_idempotency_key := 'test-idempotency-' || gen_random_uuid()::text;
    
    -- First call
    SELECT create_booking_with_capacity_check(
        p_restaurant_id := v_restaurant_id,
        p_customer_id := v_customer_id,
        p_booking_date := CURRENT_DATE + 2,
        p_start_time := '18:00'::time,
        p_end_time := '20:00'::time,
        p_party_size := 2,
        p_booking_type := 'dinner',
        p_customer_name := 'Idempotency Test',
        p_customer_email := 'idempotent@test.com',
        p_customer_phone := '+1888888888',
        p_seating_preference := 'any',
        p_idempotency_key := v_idempotency_key
    ) INTO v_result1;
    
    -- Second call with SAME idempotency key
    SELECT create_booking_with_capacity_check(
        p_restaurant_id := v_restaurant_id,
        p_customer_id := v_customer_id,
        p_booking_date := CURRENT_DATE + 2,
        p_start_time := '18:00'::time,
        p_end_time := '20:00'::time,
        p_party_size := 2,
        p_booking_type := 'dinner',
        p_customer_name := 'Idempotency Test DUPLICATE',
        p_customer_email := 'idempotent@test.com',
        p_customer_phone := '+1888888888',
        p_seating_preference := 'any',
        p_idempotency_key := v_idempotency_key
    ) INTO v_result2;
    
    -- Verify duplicate flag
    IF (v_result2->>'duplicate')::boolean = true THEN
        RAISE NOTICE '✓ Idempotency works - duplicate detected';
        RAISE NOTICE '  First booking ID: %', v_result1->'booking'->>'id';
        RAISE NOTICE '  Second call returned same ID: %', v_result2->'booking'->>'id';
    ELSE
        RAISE EXCEPTION '✗ Idempotency FAILED - duplicate not detected';
    END IF;
END $$;

-- =====================================================
-- STEP 6: Test Capacity Exceeded
-- =====================================================
DO $$
DECLARE
    v_result jsonb;
    v_restaurant_id uuid;
    v_customer_id uuid;
BEGIN
    RAISE NOTICE '=== STEP 6: Testing Capacity Exceeded ===';
    
    -- Get test data
    SELECT id INTO v_restaurant_id FROM restaurants WHERE is_active = true LIMIT 1;
    SELECT id INTO v_customer_id FROM customers WHERE restaurant_id = v_restaurant_id LIMIT 1;
    
    -- Try to book MORE than max_covers (20 in our test rule)
    SELECT create_booking_with_capacity_check(
        p_restaurant_id := v_restaurant_id,
        p_customer_id := v_customer_id,
        p_booking_date := CURRENT_DATE + 3,
        p_start_time := '19:00'::time,
        p_end_time := '21:00'::time,
        p_party_size := 25,  -- Exceeds max_covers of 20
        p_booking_type := 'dinner',
        p_customer_name := 'Capacity Test',
        p_customer_email := 'capacity@test.com',
        p_customer_phone := '+1777777777',
        p_seating_preference := 'any',
        p_idempotency_key := 'test-capacity-exceeded-' || gen_random_uuid()::text
    ) INTO v_result;
    
    -- Verify rejection
    IF (v_result->>'success')::boolean = false AND v_result->>'error' = 'CAPACITY_EXCEEDED' THEN
        RAISE NOTICE '✓ Capacity exceeded detected correctly';
        RAISE NOTICE '  Error: %', v_result->>'message';
        RAISE NOTICE '  Details: %', v_result->'details';
    ELSE
        RAISE EXCEPTION '✗ Capacity check FAILED - booking should have been rejected';
    END IF;
END $$;

-- =====================================================
-- STEP 7: Test Helper Functions
-- =====================================================
DO $$
DECLARE
    v_restaurant_id uuid;
    v_booking_id uuid;
    v_table_id uuid;
    v_assignment_id uuid;
BEGIN
    RAISE NOTICE '=== STEP 7: Testing Helper Functions ===';
    
    -- Get test data
    SELECT id INTO v_restaurant_id FROM restaurants WHERE is_active = true LIMIT 1;
    SELECT id INTO v_booking_id FROM bookings 
    WHERE restaurant_id = v_restaurant_id 
        AND booking_date >= CURRENT_DATE
    ORDER BY created_at DESC LIMIT 1;
    
    SELECT id INTO v_table_id FROM table_inventory 
    WHERE restaurant_id = v_restaurant_id 
        AND status = 'available'::table_status
    LIMIT 1;
    
    IF v_booking_id IS NULL THEN
        RAISE EXCEPTION 'No test booking found';
    END IF;
    
    IF v_table_id IS NULL THEN
        RAISE EXCEPTION 'No available table found';
    END IF;
    
    -- Test assign_table_to_booking
    SELECT assign_table_to_booking(
        p_booking_id := v_booking_id,
        p_table_id := v_table_id,
        p_notes := 'Test assignment'
    ) INTO v_assignment_id;
    
    IF v_assignment_id IS NOT NULL THEN
        RAISE NOTICE '✓ assign_table_to_booking works';
        RAISE NOTICE '  Assignment ID: %', v_assignment_id;
    ELSE
        RAISE EXCEPTION '✗ assign_table_to_booking FAILED';
    END IF;
    
    -- Verify table status updated
    IF EXISTS (
        SELECT 1 FROM table_inventory 
        WHERE id = v_table_id AND status = 'reserved'::table_status
    ) THEN
        RAISE NOTICE '✓ Table status updated to reserved';
    ELSE
        RAISE EXCEPTION '✗ Table status NOT updated';
    END IF;
    
    -- Test unassign_table_from_booking
    IF unassign_table_from_booking(v_booking_id, v_table_id) THEN
        RAISE NOTICE '✓ unassign_table_from_booking works';
    ELSE
        RAISE EXCEPTION '✗ unassign_table_from_booking FAILED';
    END IF;
END $$;

-- =====================================================
-- STEP 8: Verify Indexes
-- =====================================================
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('table_inventory', 'booking_slots', 'booking_table_assignments')
ORDER BY tablename, indexname;

-- =====================================================
-- STEP 9: Verify RLS Policies
-- =====================================================
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('table_inventory', 'booking_slots', 'booking_table_assignments')
ORDER BY tablename, policyname;

-- =====================================================
-- STEP 10: Summary
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '=== TEST SUMMARY ===';
    RAISE NOTICE '✓ All capacity engine migrations verified';
    RAISE NOTICE '✓ All tests passed';
    RAISE NOTICE '✓ Ready for TypeScript integration';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Regenerate TypeScript types: pnpm db:types';
    RAISE NOTICE '  2. Begin Story 2: Build CapacityService';
    RAISE NOTICE '  3. Create integration tests';
END $$;

-- =====================================================
-- CLEANUP (Optional - uncomment to remove test data)
-- =====================================================
-- DELETE FROM booking_table_assignments WHERE notes LIKE '%Test%';
-- DELETE FROM bookings WHERE customer_email LIKE '%@test.com' OR notes LIKE '%Test%';
-- DELETE FROM table_inventory WHERE table_number LIKE 'TEST-%';
-- DELETE FROM restaurant_capacity_rules WHERE max_covers = 20;
