-- ============================================================================
-- Migration: Fix RLS Policy Performance Issues
-- ============================================================================
-- 
-- This migration fixes two types of performance warnings:
-- 1. auth_rls_initplan: Wrap auth.uid() in (select auth.uid())
-- 2. multiple_permissive_policies: Remove duplicate policies
-- ============================================================================

-- ============================================================================
-- PART 1: Fix auth_rls_initplan warnings
-- Replace auth.uid() with (select auth.uid()) in RLS policies
-- ============================================================================

-- Helper function to recreate policies with optimized auth calls
-- We need to drop and recreate each policy

-- ==========================================
-- demand_profiles
-- ==========================================
DROP POLICY IF EXISTS "Users can view demand profiles for their restaurants" ON public.demand_profiles;
CREATE POLICY "Users can view demand profiles for their restaurants" ON public.demand_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = demand_profiles.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "Owners and managers can manage demand profiles" ON public.demand_profiles;
CREATE POLICY "Owners and managers can manage demand profiles" ON public.demand_profiles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = demand_profiles.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
              AND rm.role IN ('owner', 'manager', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = demand_profiles.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
              AND rm.role IN ('owner', 'manager', 'admin')
        )
    );

-- ==========================================
-- table_scarcity_metrics
-- ==========================================
DROP POLICY IF EXISTS "Users can view scarcity metrics for their restaurants" ON public.table_scarcity_metrics;
CREATE POLICY "Users can view scarcity metrics for their restaurants" ON public.table_scarcity_metrics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = table_scarcity_metrics.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "Owners and managers can manage scarcity metrics" ON public.table_scarcity_metrics;
CREATE POLICY "Owners and managers can manage scarcity metrics" ON public.table_scarcity_metrics
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = table_scarcity_metrics.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
              AND rm.role IN ('owner', 'manager', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = table_scarcity_metrics.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
              AND rm.role IN ('owner', 'manager', 'admin')
        )
    );

-- ==========================================
-- user_profiles
-- ==========================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT
    USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

-- ==========================================
-- profiles
-- ==========================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT
    USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT
    WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

-- ==========================================
-- booking_versions
-- ==========================================
DROP POLICY IF EXISTS "Restaurant members can view booking versions" ON public.booking_versions;
CREATE POLICY "Restaurant members can view booking versions" ON public.booking_versions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = booking_versions.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "Restaurant staff can view booking versions" ON public.booking_versions;
-- Drop duplicate - will be handled by the above policy

-- ==========================================
-- strategic_configs
-- ==========================================
DROP POLICY IF EXISTS "Users can view strategic configs for their restaurants" ON public.strategic_configs;
CREATE POLICY "Users can view strategic configs for their restaurants" ON public.strategic_configs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = strategic_configs.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "Ops managers can manage strategic configs" ON public.strategic_configs;
DROP POLICY IF EXISTS "Restaurant owners can manage strategic configs" ON public.strategic_configs;
-- Consolidate into one policy
CREATE POLICY "Owners and managers can manage strategic configs" ON public.strategic_configs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = strategic_configs.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
              AND rm.role IN ('owner', 'manager', 'admin', 'ops_manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = strategic_configs.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
              AND rm.role IN ('owner', 'manager', 'admin', 'ops_manager')
        )
    );

-- ==========================================
-- bookings
-- ==========================================
DROP POLICY IF EXISTS "Admins and owners can delete bookings" ON public.bookings;
CREATE POLICY "Admins and owners can delete bookings" ON public.bookings
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = bookings.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
              AND rm.role IN ('owner', 'admin')
        )
    );

-- ==========================================
-- customers
-- ==========================================
DROP POLICY IF EXISTS "Admins and owners can delete customers" ON public.customers;
CREATE POLICY "Admins and owners can delete customers" ON public.customers
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = customers.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
              AND rm.role IN ('owner', 'admin')
        )
    );

-- ==========================================
-- booking_table_assignments
-- ==========================================
DROP POLICY IF EXISTS "Customers can view their table assignments" ON public.booking_table_assignments;
CREATE POLICY "Customers can view their table assignments" ON public.booking_table_assignments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.id = booking_table_assignments.booking_id
              AND b.auth_user_id = (SELECT auth.uid())
        )
    );

-- ==========================================
-- restaurant_invites
-- ==========================================
DROP POLICY IF EXISTS "Owners and managers manage invites" ON public.restaurant_invites;
CREATE POLICY "Owners and managers manage invites" ON public.restaurant_invites
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = restaurant_invites.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
              AND rm.role IN ('owner', 'manager', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = restaurant_invites.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
              AND rm.role IN ('owner', 'manager', 'admin')
        )
    );

-- ==========================================
-- analytics_events
-- ==========================================
DROP POLICY IF EXISTS "Restaurant staff can view analytics" ON public.analytics_events;
CREATE POLICY "Restaurant staff can view analytics" ON public.analytics_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = analytics_events.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
        )
    );

-- ==========================================
-- waiting_list
-- ==========================================
DROP POLICY IF EXISTS "Restaurant members can manage waiting list" ON public.waiting_list;
CREATE POLICY "Restaurant members can manage waiting list" ON public.waiting_list
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = waiting_list.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = waiting_list.restaurant_id
              AND rm.user_id = (SELECT auth.uid())
        )
    );

-- ==========================================
-- restaurants
-- ==========================================
DROP POLICY IF EXISTS "authenticated_can_create" ON public.restaurants;
CREATE POLICY "authenticated_can_create" ON public.restaurants
    FOR INSERT
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "owners_admins_can_update" ON public.restaurants;
CREATE POLICY "owners_admins_can_update" ON public.restaurants
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = restaurants.id
              AND rm.user_id = (SELECT auth.uid())
              AND rm.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = restaurants.id
              AND rm.user_id = (SELECT auth.uid())
              AND rm.role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "owners_can_delete" ON public.restaurants;
CREATE POLICY "owners_can_delete" ON public.restaurants
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.restaurant_id = restaurants.id
              AND rm.user_id = (SELECT auth.uid())
              AND rm.role = 'owner'
        )
    );

-- ==========================================
-- profile_update_requests
-- ==========================================
DROP POLICY IF EXISTS "profile_update_requests_insert" ON public.profile_update_requests;
CREATE POLICY "profile_update_requests_insert" ON public.profile_update_requests
    FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profile_update_requests_select" ON public.profile_update_requests;
CREATE POLICY "profile_update_requests_select" ON public.profile_update_requests
    FOR SELECT
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profile_update_requests_update" ON public.profile_update_requests;
CREATE POLICY "profile_update_requests_update" ON public.profile_update_requests
    FOR UPDATE
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profile_update_requests_delete" ON public.profile_update_requests;
CREATE POLICY "profile_update_requests_delete" ON public.profile_update_requests
    FOR DELETE
    USING (user_id = (SELECT auth.uid()));

-- ==========================================
-- booking_assignment_attempts (from our earlier migration)
-- ==========================================
DROP POLICY IF EXISTS "authenticated_select" ON public.booking_assignment_attempts;
CREATE POLICY "authenticated_select" ON public.booking_assignment_attempts
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM bookings b
            JOIN restaurant_memberships rm ON rm.restaurant_id = b.restaurant_id
            WHERE b.id = booking_assignment_attempts.booking_id
              AND rm.user_id = (SELECT auth.uid())
        )
    );

-- ==========================================
-- table_merge_graph (from our earlier migration)
-- ==========================================
DROP POLICY IF EXISTS "authenticated_select" ON public.table_merge_graph;
CREATE POLICY "authenticated_select" ON public.table_merge_graph
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_memberships rm
            WHERE rm.user_id = (SELECT auth.uid())
              AND rm.restaurant_id = table_merge_graph.restaurant_id
        )
    );

-- ==========================================
-- booking_state_history (from our earlier migration)
-- ==========================================
DROP POLICY IF EXISTS "authenticated_select" ON public.booking_state_history;
CREATE POLICY "authenticated_select" ON public.booking_state_history
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM bookings b
            JOIN restaurant_memberships rm ON rm.restaurant_id = b.restaurant_id
            WHERE b.id = booking_state_history.booking_id
              AND rm.user_id = (SELECT auth.uid())
        )
    );

-- ============================================================================
-- Verification
-- ============================================================================
SELECT 'RLS policies updated with (SELECT auth.uid()) optimization' AS status;
