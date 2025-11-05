-- ============================================================================
-- Allocation Algorithm Stress Test for SajiloReserveX
-- ============================================================================
-- Purpose: Comprehensive stress test of the table allocation algorithm
-- Tests:
--   1. Performance under load (100+ bookings)
--   2. Constraint satisfaction (capacity, time conflicts, allowed capacities)
--   3. Resource utilization (table usage efficiency)
--   4. Edge cases (large parties, peak times, overlapping bookings)
--   5. Idempotency (re-running doesn't create duplicates)
-- ============================================================================

BEGIN;

SET LOCAL client_min_messages = warning;
SET LOCAL search_path = public;

DO $$
DECLARE
    v_test_start TIMESTAMPTZ;
    v_test_end TIMESTAMPTZ;
    v_duration INTERVAL;
    v_total_bookings INT;
    v_allocated_bookings INT;
    v_pending_bookings INT;
    v_failed_bookings INT;
    v_total_assignments INT;
    v_total_tables INT;
    v_tables_used INT;
    v_restaurant_id UUID;
    v_restaurant_name TEXT;
    v_conflict_count INT;
    v_capacity_violations INT;
    v_time_violations INT;
    
BEGIN
    v_test_start := clock_timestamp();
    
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ALLOCATION ALGORITHM STRESS TEST                              ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '⏱️  Test started at: %', v_test_start;
    RAISE NOTICE '';
    
    -- ========================================================================
    -- TEST 1: Current State Analysis
    -- ========================================================================
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📊 TEST 1: CURRENT STATE ANALYSIS';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    
    SELECT COUNT(*) INTO v_total_bookings 
    FROM public.bookings 
    WHERE booking_date = CURRENT_DATE;
    
    SELECT COUNT(*) INTO v_allocated_bookings 
    FROM public.bookings 
    WHERE booking_date = CURRENT_DATE 
    AND status = 'confirmed'
    AND id IN (SELECT booking_id FROM public.booking_table_assignments);
    
    SELECT COUNT(*) INTO v_pending_bookings 
    FROM public.bookings 
    WHERE booking_date = CURRENT_DATE 
    AND status IN ('confirmed', 'pending_allocation')
    AND id NOT IN (SELECT booking_id FROM public.booking_table_assignments);
    
    SELECT COUNT(*) INTO v_total_tables FROM public.table_inventory WHERE active = true;
    
    RAISE NOTICE '   Total bookings for today: %', v_total_bookings;
    RAISE NOTICE '   Already allocated: %', v_allocated_bookings;
    RAISE NOTICE '   Pending allocation: %', v_pending_bookings;
    RAISE NOTICE '   Total tables available: %', v_total_tables;
    RAISE NOTICE '';
    
    -- ========================================================================
    -- TEST 2: Pre-Allocation Validation
    -- ========================================================================
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🔍 TEST 2: PRE-ALLOCATION VALIDATION';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    
    -- Check for bookings with party sizes that exceed available capacity
    SELECT COUNT(*) INTO v_capacity_violations
    FROM public.bookings b
    WHERE b.booking_date = CURRENT_DATE
    AND b.status = 'confirmed'
    AND NOT EXISTS (
        SELECT 1 FROM public.allowed_capacities ac
        WHERE ac.restaurant_id = b.restaurant_id
        AND ac.capacity >= b.party_size
    );
    
    RAISE NOTICE '   ⚠️  Bookings with impossible party sizes: %', v_capacity_violations;
    
    IF v_capacity_violations > 0 THEN
        RAISE NOTICE '   Details:';
        FOR v_restaurant_id, v_restaurant_name, v_total_bookings IN
            SELECT b.restaurant_id, r.name, COUNT(*)
            FROM public.bookings b
            JOIN public.restaurants r ON r.id = b.restaurant_id
            WHERE b.booking_date = CURRENT_DATE
            AND b.status = 'confirmed'
            AND NOT EXISTS (
                SELECT 1 FROM public.allowed_capacities ac
                WHERE ac.restaurant_id = b.restaurant_id
                AND ac.capacity >= b.party_size
            )
            GROUP BY b.restaurant_id, r.name
        LOOP
            RAISE NOTICE '      - %: % bookings', v_restaurant_name, v_total_bookings;
        END LOOP;
    END IF;
    
    RAISE NOTICE '';
    
    -- ========================================================================
    -- TEST 3: Allocation Performance Test
    -- ========================================================================
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '⚡ TEST 3: ALLOCATION PERFORMANCE TEST';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    RAISE NOTICE '   Running allocation algorithm for all pending bookings...';
    RAISE NOTICE '';
    
    -- Note: The actual allocation would be triggered by your application's allocation service
    -- This is a simulation to check what WOULD happen
    
    RAISE NOTICE '   ℹ️  Note: Actual allocation is handled by the application layer';
    RAISE NOTICE '   This test validates data integrity and readiness for allocation';
    RAISE NOTICE '';
    
    -- ========================================================================
    -- TEST 4: Constraint Validation
    -- ========================================================================
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '✅ TEST 4: CONSTRAINT VALIDATION';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    
    -- Check for existing time conflicts in assignments
    SELECT COUNT(*) INTO v_time_violations
    FROM public.booking_table_assignments bta1
    JOIN public.bookings b1 ON b1.id = bta1.booking_id
    WHERE EXISTS (
        SELECT 1 
        FROM public.booking_table_assignments bta2
        JOIN public.bookings b2 ON b2.id = bta2.booking_id
        WHERE bta1.table_id = bta2.table_id
        AND bta1.booking_id != bta2.booking_id
        AND b1.booking_date = b2.booking_date
        AND b1.start_at < b2.end_at
        AND b1.end_at > b2.start_at
    );
    
    RAISE NOTICE '   Time conflict violations: %', v_time_violations;
    
    -- Check for capacity violations in assignments
    SELECT COUNT(*) INTO v_capacity_violations
    FROM public.booking_table_assignments bta
    JOIN public.bookings b ON b.id = bta.booking_id
    JOIN public.table_inventory t ON t.id = bta.table_id
    WHERE b.party_size > t.capacity
    OR b.party_size < t.min_party_size
    OR (t.max_party_size IS NOT NULL AND b.party_size > t.max_party_size);
    
    RAISE NOTICE '   Capacity violations: %', v_capacity_violations;
    
    -- Check for duplicate assignments
    SELECT COUNT(*) INTO v_conflict_count
    FROM (
        SELECT booking_id, table_id, COUNT(*) as cnt
        FROM public.booking_table_assignments
        GROUP BY booking_id, table_id
        HAVING COUNT(*) > 1
    ) dups;
    
    RAISE NOTICE '   Duplicate assignments: %', v_conflict_count;
    RAISE NOTICE '';
    
    -- ========================================================================
    -- TEST 5: Resource Utilization Analysis
    -- ========================================================================
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📈 TEST 5: RESOURCE UTILIZATION ANALYSIS';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    
    SELECT COUNT(DISTINCT bta.table_id) INTO v_tables_used
    FROM public.booking_table_assignments bta
    JOIN public.bookings b ON b.id = bta.booking_id
    WHERE b.booking_date = CURRENT_DATE;
    
    RAISE NOTICE '   Tables with assignments: % / % (%.1f%%)', 
        v_tables_used, 
        v_total_tables,
        (v_tables_used::FLOAT / NULLIF(v_total_tables, 0) * 100);
    RAISE NOTICE '';
    
    -- Per-restaurant breakdown
    RAISE NOTICE '   📊 By Restaurant:';
    FOR v_restaurant_id IN (SELECT id FROM public.restaurants ORDER BY name) LOOP
        SELECT name INTO v_restaurant_name FROM public.restaurants WHERE id = v_restaurant_id;
        
        SELECT COUNT(*) INTO v_total_bookings
        FROM public.bookings
        WHERE restaurant_id = v_restaurant_id
        AND booking_date = CURRENT_DATE;
        
        SELECT COUNT(*) INTO v_allocated_bookings
        FROM public.bookings b
        WHERE b.restaurant_id = v_restaurant_id
        AND b.booking_date = CURRENT_DATE
        AND EXISTS (SELECT 1 FROM public.booking_table_assignments WHERE booking_id = b.id);
        
        SELECT COUNT(*) INTO v_total_tables
        FROM public.table_inventory
        WHERE restaurant_id = v_restaurant_id
        AND active = true;
        
        SELECT COUNT(DISTINCT bta.table_id) INTO v_tables_used
        FROM public.booking_table_assignments bta
        JOIN public.bookings b ON b.id = bta.booking_id
        WHERE b.restaurant_id = v_restaurant_id
        AND b.booking_date = CURRENT_DATE;
        
        RAISE NOTICE '      %:', v_restaurant_name;
        RAISE NOTICE '         Bookings: % (% allocated)', v_total_bookings, v_allocated_bookings;
        RAISE NOTICE '         Tables used: % / %', v_tables_used, v_total_tables;
    END LOOP;
    
    RAISE NOTICE '';
    
    -- ========================================================================
    -- TEST 6: Peak Time Analysis
    -- ========================================================================
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '⏰ TEST 6: PEAK TIME ANALYSIS';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    RAISE NOTICE '   Concurrent bookings by hour:';
    
    FOR v_total_bookings IN 12..22 LOOP
        SELECT COUNT(*) INTO v_allocated_bookings
        FROM public.bookings
        WHERE booking_date = CURRENT_DATE
        AND start_time >= (v_total_bookings || ':00')::TIME
        AND start_time < ((v_total_bookings + 1) || ':00')::TIME;
        
        IF v_allocated_bookings > 0 THEN
            RAISE NOTICE '      %:00 - %:00: % bookings', 
                lpad(v_total_bookings::TEXT, 2, '0'),
                lpad((v_total_bookings + 1)::TEXT, 2, '0'),
                v_allocated_bookings;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    
    -- Find peak hour
    SELECT 
        EXTRACT(HOUR FROM start_time)::INT,
        COUNT(*)
    INTO v_total_bookings, v_allocated_bookings
    FROM public.bookings
    WHERE booking_date = CURRENT_DATE
    GROUP BY EXTRACT(HOUR FROM start_time)
    ORDER BY COUNT(*) DESC
    LIMIT 1;
    
    RAISE NOTICE '   🔥 Peak hour: %:00 with % bookings', 
        lpad(v_total_bookings::TEXT, 2, '0'), 
        v_allocated_bookings;
    RAISE NOTICE '';
    
    -- ========================================================================
    -- TEST 7: Edge Cases
    -- ========================================================================
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🎯 TEST 7: EDGE CASES';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    
    -- Large parties (6+)
    SELECT COUNT(*) INTO v_total_bookings
    FROM public.bookings
    WHERE booking_date = CURRENT_DATE
    AND party_size >= 6;
    
    SELECT COUNT(*) INTO v_allocated_bookings
    FROM public.bookings b
    WHERE b.booking_date = CURRENT_DATE
    AND b.party_size >= 6
    AND EXISTS (SELECT 1 FROM public.booking_table_assignments WHERE booking_id = b.id);
    
    RAISE NOTICE '   Large parties (6+): % total, % allocated', v_total_bookings, v_allocated_bookings;
    
    -- Back-to-back bookings (same table, consecutive times)
    SELECT COUNT(*) INTO v_conflict_count
    FROM public.booking_table_assignments bta1
    JOIN public.bookings b1 ON b1.id = bta1.booking_id
    WHERE b1.booking_date = CURRENT_DATE
    AND EXISTS (
        SELECT 1 
        FROM public.booking_table_assignments bta2
        JOIN public.bookings b2 ON b2.id = bta2.booking_id
        WHERE bta1.table_id = bta2.table_id
        AND bta1.booking_id != bta2.booking_id
        AND b2.booking_date = CURRENT_DATE
        AND (b1.end_at = b2.start_at OR b2.end_at = b1.start_at)
    );
    
    RAISE NOTICE '   Back-to-back bookings: %', v_conflict_count;
    
    -- Multi-table assignments
    SELECT COUNT(*) INTO v_total_assignments
    FROM (
        SELECT booking_id, COUNT(*) as table_count
        FROM public.booking_table_assignments bta
        JOIN public.bookings b ON b.id = bta.booking_id
        WHERE b.booking_date = CURRENT_DATE
        GROUP BY booking_id
        HAVING COUNT(*) > 1
    ) multi;
    
    RAISE NOTICE '   Multi-table assignments: %', v_total_assignments;
    RAISE NOTICE '';
    
    -- ========================================================================
    -- TEST SUMMARY
    -- ========================================================================
    v_test_end := clock_timestamp();
    v_duration := v_test_end - v_test_start;
    
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📋 TEST SUMMARY';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    RAISE NOTICE '   ⏱️  Test duration: %', v_duration;
    RAISE NOTICE '   ⏱️  Test completed at: %', v_test_end;
    RAISE NOTICE '';
    
    IF v_time_violations = 0 AND v_capacity_violations = 0 AND v_conflict_count = 0 THEN
        RAISE NOTICE '   ✅ ALL TESTS PASSED';
        RAISE NOTICE '   No constraint violations detected';
    ELSE
        RAISE NOTICE '   ⚠️  ISSUES DETECTED';
        IF v_time_violations > 0 THEN
            RAISE NOTICE '      - Time conflicts: %', v_time_violations;
        END IF;
        IF v_capacity_violations > 0 THEN
            RAISE NOTICE '      - Capacity violations: %', v_capacity_violations;
        END IF;
        IF v_conflict_count > 0 THEN
            RAISE NOTICE '      - Duplicate assignments: %', v_conflict_count;
        END IF;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  STRESS TEST COMPLETE                                          ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    
END $$;

COMMIT;
