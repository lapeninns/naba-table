-- 🧹 Data Cleanup Script
-- This script provides options to remove "unused" rows or clear transactional data
-- while preserving your core configuration (Restaurants, Tables, Zones, Rules).

-- ⚠️ WARNING: Uncomment the sections you want to run.
-- Always backup your database before running bulk deletes!

-- ==============================================================================
-- 1. CLEAR TRANSACTIONAL DATA (Fresh Start)
--    Removes all activity (bookings, logs, history) but keeps the restaurant setup.
-- ==============================================================================

-- TRUNCATE TABLE public.bookings CASCADE;
-- TRUNCATE TABLE public.waiting_list CASCADE;
-- TRUNCATE TABLE public.allocations CASCADE;
-- TRUNCATE TABLE public.booking_table_assignments CASCADE;
-- TRUNCATE TABLE public.booking_assignment_attempts CASCADE;
-- TRUNCATE TABLE public.table_holds CASCADE;
-- TRUNCATE TABLE public.capacity_outbox CASCADE;

-- ==============================================================================
-- 2. CLEAR LOGS & HISTORY (Reduce Size)
--    Removes high-volume logging data.
-- ==============================================================================

-- TRUNCATE TABLE public.audit_logs CASCADE;
-- TRUNCATE TABLE public.analytics_events CASCADE;
-- TRUNCATE TABLE public.observability_events CASCADE;
-- TRUNCATE TABLE public.booking_state_history CASCADE;
-- TRUNCATE TABLE public.booking_versions CASCADE;

-- ==============================================================================
-- 3. REMOVE ORPHANED DATA (Tidy Up)
--    Removes records that are not linked to any active booking or restaurant.
-- ==============================================================================

-- Remove Customers who have NO bookings and are NOT on the waiting list
/*
DELETE FROM public.customers 
WHERE id NOT IN (SELECT DISTINCT customer_id FROM public.bookings)
  AND id NOT IN (SELECT DISTINCT customer_email FROM public.waiting_list); -- Note: waiting_list uses email/phone, not ID usually, check schema if needed
*/

-- Remove Profiles that are not linked to a valid User or Customer
/*
DELETE FROM public.customer_profiles
WHERE customer_id NOT IN (SELECT id FROM public.customers);
*/

-- ==============================================================================
-- 4. REMOVE OLD DATA (Retention Policy)
--    Keep recent data, delete old clutter.
-- ==============================================================================

-- DELETE FROM public.audit_logs WHERE created_at < NOW() - INTERVAL '30 days';
-- DELETE FROM public.analytics_events WHERE created_at < NOW() - INTERVAL '30 days';
-- DELETE FROM public.bookings WHERE booking_date < (NOW() - INTERVAL '1 year')::date;

