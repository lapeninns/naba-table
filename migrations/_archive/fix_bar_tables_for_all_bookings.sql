-- ============================================================================
-- FIX: Allow Bar Tables for Lunch/Dinner Bookings
-- ============================================================================
-- This script addresses the constraint that prevents bar tables from being
-- used for lunch and dinner bookings (only allowing drinks).
--
-- The error was: "Bar tables are drinks-only; booking_type dinner is not allowed"
--
-- Solution: Update all bar tables to 'dining' category so they can be used
-- for any booking type (lunch, dinner, drinks).
-- ============================================================================

-- Step 1: View current bar tables BEFORE update
-- Run this first to see what will be changed
SELECT 
    t.id,
    t.table_number,
    t.category,
    t.capacity,
    t.status,
    z.name as zone_name,
    r.name as restaurant_name
FROM public.table_inventory t
JOIN public.zones z ON t.zone_id = z.id
JOIN public.restaurants r ON t.restaurant_id = r.id
WHERE t.category = 'bar'
ORDER BY r.name, z.name, t.table_number;

-- Step 2: Update all bar tables to dining category
-- This makes them available for lunch/dinner bookings
UPDATE public.table_inventory
SET 
    category = 'dining',
    updated_at = now()
WHERE category = 'bar';

-- Step 3: Verify the update
SELECT 
    category,
    COUNT(*) as table_count
FROM public.table_inventory
GROUP BY category
ORDER BY category;

-- ============================================================================
-- ALTERNATIVE: If you want to keep bar category but remove the constraint
-- ============================================================================
-- Check for any triggers that enforce the bar=drinks-only rule
-- SELECT 
--     trigger_name,
--     event_manipulation,
--     action_statement
-- FROM information_schema.triggers
-- WHERE event_object_table IN ('booking_table_assignments', 'allocations', 'table_inventory')
--   AND action_statement ILIKE '%bar%';

-- Check for any check constraints
-- SELECT 
--     tc.constraint_name,
--     tc.table_name,
--     cc.check_clause
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.check_constraints cc 
--     ON tc.constraint_name = cc.constraint_name
-- WHERE tc.constraint_type = 'CHECK'
--   AND cc.check_clause ILIKE '%bar%' OR cc.check_clause ILIKE '%booking_type%';

-- ============================================================================
-- ROLLBACK (if needed): Revert dining back to bar
-- ============================================================================
-- If you need to rollback, you would need to know which tables were originally bar:
-- We don't have that info after the update, so be careful!
-- 
-- To set specific tables back to bar:
-- UPDATE public.table_inventory
-- SET category = 'bar', updated_at = now()
-- WHERE table_number IN ('Bar1', 'Bar2', 'Bar3'); -- specify actual table numbers
