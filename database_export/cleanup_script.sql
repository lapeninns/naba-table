-- ============================================================
-- DATABASE CLEANUP SCRIPT
-- Generated: 2025-12-02
-- Purpose: Remove test data, keep only production data
-- ============================================================

-- IMPORTANT: This script should be reviewed before execution
-- Execute in Supabase SQL Editor or via migrations

-- ============================================================
-- SECTION 1: IDENTIFY WHAT TO KEEP
-- ============================================================

-- Main Restaurant to KEEP:
-- ID: 486de541-a307-4414-b0b1-f774a0e4a9fa
-- Name: White Horse Pub
-- Slug: white-horse-pub-waterbeach

-- Main Profile to KEEP:
-- ID: 35a70a11-f097-4a61-af5e-e849a1a5dd21
-- Email: amanshresthaaaaa@gmail.com

-- ============================================================
-- SECTION 2: DELETE TEST RESTAURANTS AND RELATED DATA
-- ============================================================

-- Test restaurant IDs to delete:
-- ebe09237-ff0e-44e3-b400-e13500c50752 (White Horse Pub duplicate)
-- 466cfb38-ffd3-4307-b6b2-3c9889e207ca (Test Restaurant Python)
-- 39bc9baa-90c2-4217-8482-a7afe9992011 (Browser Test Cafe)
-- f8581f73-90e2-410b-8402-73349ccc05d5 (Browser Test Cafe duplicate)
-- 2df6265b-d635-4799-bc72-4b54296aa8cd (Test Bistro QA)

BEGIN;

-- Store the restaurant ID we want to keep
DO $$
DECLARE
    keep_restaurant_id UUID := '486de541-a307-4414-b0b1-f774a0e4a9fa';
    keep_profile_id UUID := '35a70a11-f097-4a61-af5e-e849a1a5dd21';
BEGIN
    RAISE NOTICE 'Keeping restaurant: %', keep_restaurant_id;
    RAISE NOTICE 'Keeping profile: %', keep_profile_id;
END $$;

-- 2.1 Delete zones for test restaurants
DELETE FROM zones 
WHERE restaurant_id NOT IN ('486de541-a307-4414-b0b1-f774a0e4a9fa');

-- 2.2 Delete table_inventory for test restaurants
DELETE FROM table_inventory 
WHERE restaurant_id NOT IN ('486de541-a307-4414-b0b1-f774a0e4a9fa');

-- 2.3 Delete table_adjacencies for tables not in main restaurant
DELETE FROM table_adjacencies 
WHERE table_a NOT IN (
    SELECT id FROM table_inventory 
    WHERE restaurant_id = '486de541-a307-4414-b0b1-f774a0e4a9fa'
);

-- 2.4 Delete restaurant_service_periods for test restaurants
DELETE FROM restaurant_service_periods 
WHERE restaurant_id NOT IN ('486de541-a307-4414-b0b1-f774a0e4a9fa');

-- 2.5 Delete restaurant_operating_hours for test restaurants
DELETE FROM restaurant_operating_hours 
WHERE restaurant_id NOT IN ('486de541-a307-4414-b0b1-f774a0e4a9fa');

-- 2.6 Delete booking_slots for test restaurants
DELETE FROM booking_slots 
WHERE restaurant_id NOT IN ('486de541-a307-4414-b0b1-f774a0e4a9fa');

-- 2.7 Delete allowed_capacities for test restaurants
DELETE FROM allowed_capacities 
WHERE restaurant_id NOT IN ('486de541-a307-4414-b0b1-f774a0e4a9fa');

-- 2.8 Delete restaurant_memberships for test restaurants
DELETE FROM restaurant_memberships 
WHERE restaurant_id NOT IN ('486de541-a307-4414-b0b1-f774a0e4a9fa');

-- 2.9 Delete customers for test restaurants
DELETE FROM customers 
WHERE restaurant_id NOT IN ('486de541-a307-4414-b0b1-f774a0e4a9fa');

-- 2.10 Delete capacity_outbox for test restaurants
DELETE FROM capacity_outbox 
WHERE restaurant_id NOT IN ('486de541-a307-4414-b0b1-f774a0e4a9fa');

-- 2.11 Finally delete test restaurants
DELETE FROM restaurants 
WHERE id NOT IN ('486de541-a307-4414-b0b1-f774a0e4a9fa');

-- ============================================================
-- SECTION 3: CLEAN UP LOG/EVENT TABLES
-- ============================================================

-- 3.1 Truncate observability_events (871 rows of logs)
TRUNCATE TABLE observability_events;

-- 3.2 Truncate audit_logs (428 rows) - OPTIONAL, keep if you want history
-- Uncomment to clear:
-- TRUNCATE TABLE audit_logs;

-- 3.3 Truncate capacity_outbox (already filtered by restaurant above)
-- This table can be truncated as it's for async processing
TRUNCATE TABLE capacity_outbox;

-- ============================================================
-- SECTION 4: CLEAN UP EMPTY/UNUSED TABLES (OPTIONAL)
-- ============================================================

-- These tables are already empty but listed for reference:
-- allocations, analytics_events, booking_assignment_idempotency,
-- booking_confirmation_results, booking_state_history, booking_table_assignments,
-- booking_versions, bookings, demand_profiles, feature_flag_overrides,
-- loyalty_point_events, loyalty_points, loyalty_programs, restaurant_capacity_rules,
-- restaurant_invites, service_policy, strategic_configs, table_hold_members,
-- table_hold_windows, table_holds, table_scarcity_metrics, user_profiles

-- ============================================================
-- SECTION 5: VERIFY CLEANUP
-- ============================================================

-- Count remaining rows in key tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 'restaurants' as tbl, count(*) as cnt FROM restaurants
        UNION ALL SELECT 'zones', count(*) FROM zones
        UNION ALL SELECT 'table_inventory', count(*) FROM table_inventory
        UNION ALL SELECT 'table_adjacencies', count(*) FROM table_adjacencies
        UNION ALL SELECT 'restaurant_memberships', count(*) FROM restaurant_memberships
        UNION ALL SELECT 'restaurant_operating_hours', count(*) FROM restaurant_operating_hours
        UNION ALL SELECT 'restaurant_service_periods', count(*) FROM restaurant_service_periods
        UNION ALL SELECT 'booking_slots', count(*) FROM booking_slots
        UNION ALL SELECT 'profiles', count(*) FROM profiles
        UNION ALL SELECT 'customers', count(*) FROM customers
    LOOP
        RAISE NOTICE '% : % rows', r.tbl, r.cnt;
    END LOOP;
END $$;

COMMIT;

-- ============================================================
-- EXPECTED RESULTS AFTER CLEANUP:
-- ============================================================
-- restaurants: 1 (White Horse Pub)
-- zones: 4 (Main Dining 1 Inside/Outside, Main Dining 2, Bar)
-- table_inventory: 26 (all tables for White Horse Pub)
-- table_adjacencies: ~76 (adjacencies for main restaurant tables)
-- restaurant_memberships: 2 (managers for main restaurant)
-- restaurant_operating_hours: 21 (7 days × 3 configs)
-- restaurant_service_periods: 31 (service periods for main restaurant)
-- booking_slots: ~42 (depends on date range)
-- profiles: 1 (Aman Shrestha)
-- customers: 1 (Aman Shrestha customer record)
-- observability_events: 0 (cleaned)
-- capacity_outbox: 0 (cleaned)
-- audit_logs: 428 (kept for history, or 0 if truncated)
