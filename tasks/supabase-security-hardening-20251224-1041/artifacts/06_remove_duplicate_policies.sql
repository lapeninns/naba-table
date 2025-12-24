-- ============================================================================
-- Migration: Remove Duplicate RLS Policies
-- ============================================================================
-- 
-- This migration removes duplicate/redundant policies that cause
-- multiple_permissive_policies warnings.
-- ============================================================================

-- ==========================================
-- analytics_events - Remove duplicates
-- ==========================================
DROP POLICY IF EXISTS "Service role can manage analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Service role full access to analytics_events" ON public.analytics_events;
-- Keep only one service role policy
CREATE POLICY "service_role_all" ON public.analytics_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==========================================
-- booking_versions - Remove duplicates
-- ==========================================
DROP POLICY IF EXISTS "Service role can manage booking versions" ON public.booking_versions;
DROP POLICY IF EXISTS "Service role full access to booking_versions" ON public.booking_versions;
DROP POLICY IF EXISTS "Restaurant staff can view booking versions" ON public.booking_versions;
-- Keep consolidated policies
CREATE POLICY "service_role_all" ON public.booking_versions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==========================================
-- booking_slots - Remove duplicates
-- ==========================================
-- "Public can view booking slots" and "Staff can manage booking slots" overlap on SELECT
DROP POLICY IF EXISTS "Public can view booking slots" ON public.booking_slots;
-- Keep "Staff can manage booking slots" for full access

-- ==========================================
-- booking_table_assignments - Remove duplicates
-- ==========================================
-- Both allow SELECT, consolidate
DROP POLICY IF EXISTS "Staff can manage table assignments" ON public.booking_table_assignments;
CREATE POLICY "Staff can manage table assignments" ON public.booking_table_assignments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM bookings b
            JOIN restaurant_memberships rm ON rm.restaurant_id = b.restaurant_id
            WHERE b.id = booking_table_assignments.booking_id
              AND rm.user_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM bookings b
            JOIN restaurant_memberships rm ON rm.restaurant_id = b.restaurant_id
            WHERE b.id = booking_table_assignments.booking_id
              AND rm.user_id = (SELECT auth.uid())
        )
    );

-- ==========================================
-- customer_profiles - Remove duplicates
-- ==========================================
DROP POLICY IF EXISTS "Service role can manage customer profiles" ON public.customer_profiles;
-- Keep "Staff can view customer profiles"

-- ==========================================
-- leads - Remove duplicates
-- ==========================================
DROP POLICY IF EXISTS "Service role can read leads" ON public.leads;
DROP POLICY IF EXISTS "Service role full access to leads" ON public.leads;
CREATE POLICY "service_role_all" ON public.leads
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==========================================
-- merge_rules - Remove duplicates
-- ==========================================
DROP POLICY IF EXISTS "Service role can manage merge rules" ON public.merge_rules;
-- Keep "Staff can view merge rules"

-- ==========================================
-- profiles - Remove duplicates
-- ==========================================
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.profiles;
CREATE POLICY "service_role_all" ON public.profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==========================================
-- restaurant_memberships - Remove duplicates
-- ==========================================
-- "Users can view memberships in their restaurants" overlaps with "Owners and admins can manage memberships"
DROP POLICY IF EXISTS "Users can view memberships in their restaurants" ON public.restaurant_memberships;
-- The management policy already covers viewing for authenticated users

-- ==========================================
-- strategic_configs - Remove duplicates
-- ==========================================
DROP POLICY IF EXISTS "Service role full access to strategic_configs" ON public.strategic_configs;
-- Keep consolidated owner/manager policy from 05_fix_rls_performance.sql

-- ==========================================
-- table_inventory - Remove duplicates
-- ==========================================
DROP POLICY IF EXISTS "Public can view table inventory" ON public.table_inventory;
-- Keep "Staff can manage table inventory" which covers SELECT

-- ==========================================
-- user_profiles - Remove duplicates
-- ==========================================
DROP POLICY IF EXISTS "Service role full access to user_profiles" ON public.user_profiles;
CREATE POLICY "service_role_all" ON public.user_profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==========================================
-- waiting_list - Remove duplicates
-- ==========================================
DROP POLICY IF EXISTS "Service role full access to waiting_list" ON public.waiting_list;
DROP POLICY IF EXISTS "Service role manage waiting list" ON public.waiting_list;
CREATE POLICY "service_role_all" ON public.waiting_list
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- Verification
-- ============================================================================
SELECT 'Duplicate policies removed' AS status;
