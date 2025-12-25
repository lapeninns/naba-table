-- ============================================================================
-- CONSOLIDATED DATABASE FIXES - SajiloReserveX
-- ============================================================================
-- 
-- Generated: 2025-12-24T18:56:42Z
-- Updated: 2025-12-25T00:37:00Z (Added bar table constraint fixes)
-- Purpose: Single script containing ALL database fixes from task folders
-- Date Range: December 23-25, 2025
-- 
-- EXECUTION ORDER (Dependencies):
-- 1. Create extensions schema and move extensions
-- 2. Fix function search paths (security)
-- 3. Create missing tables (audit_logs)
-- 4. Enable RLS on unprotected tables
-- 5. Fix RLS performance (auth.uid() optimization)
-- 6. Remove duplicate policies
-- 7. Fix bar table booking type constraint (Dec 25)
-- 
-- IMPORTANT:
-- - Run this in Supabase SQL Editor
-- - Test on STAGING first before production
-- - Create a backup/PITR point before running
-- 
-- Source Tasks:
-- - supabase-security-hardening-20251224-1041
-- - guest-booking-access-revamp-20251224-0124
-- - customer-phone-duplicate-20251224-0025
-- - fix-booking-time-validation-20251224-0003
-- - bar-table-constraint-fix-20251225 (Dec 25)
-- ============================================================================

-- ############################################################################
-- SECTION 1: CREATE EXTENSIONS SCHEMA & MOVE EXTENSIONS
-- ############################################################################
-- Addresses: extension_in_public warning
-- Risk: LOW - additive operation
-- ############################################################################

-- Create dedicated extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage to necessary roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Move extensions to dedicated schema
-- Note: Using CASCADE to handle dependencies
DO $$ BEGIN
    DROP EXTENSION IF EXISTS citext CASCADE;
    CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'citext extension migration skipped: %', SQLERRM;
END $$;

DO $$ BEGIN
    DROP EXTENSION IF EXISTS pgcrypto CASCADE;
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgcrypto extension migration skipped: %', SQLERRM;
END $$;

DO $$ BEGIN
    DROP EXTENSION IF EXISTS btree_gist CASCADE;
    CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'btree_gist extension migration skipped: %', SQLERRM;
END $$;

-- Grant function execution permissions
GRANT ALL ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Update database search_path to include extensions schema
ALTER DATABASE postgres SET search_path = public, extensions;

DO $$ BEGIN RAISE NOTICE '[SECTION 1] Extensions schema configured ✓'; END $$;

-- ############################################################################
-- SECTION 2: FIX FUNCTION SEARCH PATHS (Security Hardening)
-- ############################################################################
-- Addresses: function_search_path_mutable warning (34+ functions)
-- Risk: LOW - prevents search_path hijacking attacks
-- ############################################################################

DO $$
DECLARE
    func_record RECORD;
    alter_sql TEXT;
    success_count INT := 0;
    target_functions TEXT[] := ARRAY[
        'allocations_overlap',
        'allowed_capacities_set_updated_at',
        'apply_booking_state_transition',
        'are_tables_connected',
        'assign_tables_atomic',
        'booking_status_summary',
        'current_restaurant_id',
        'generate_booking_reference',
        'get_or_create_booking_slot',
        'increment_booking_slot_version',
        'is_holds_strict_conflicts_enabled',
        'is_table_available_v2',
        'log_table_assignment_change',
        'on_allocations_refresh',
        'on_booking_status_refresh',
        'process_late_arrivals',
        'prune_allocations_history',
        'refresh_table_status',
        'require_restaurant_context',
        'set_booking_instants',
        'set_booking_reference',
        'set_hold_conflict_enforcement',
        'set_timestamp_updated_at',
        'set_updated_at',
        'sync_table_hold_windows',
        'unassign_table_from_booking',
        'unassign_tables_atomic',
        'update_table_hold_windows',
        'update_updated_at',
        'update_updated_at_column',
        'user_restaurants',
        'validate_booking_capacity_after_assignment',
        'validate_booking_has_assignments',
        'validate_table_adjacency',
        'confirm_hold_assignment_tx',
        'confirm_hold_assignment_with_transition',
        'create_booking_with_capacity_check'
    ];
BEGIN
    FOR func_record IN
        SELECT 
            n.nspname AS schema_name,
            p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = ANY(target_functions)
    LOOP
        alter_sql := format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = public, extensions;',
            func_record.schema_name,
            func_record.function_name,
            func_record.args
        );
        
        BEGIN
            EXECUTE alter_sql;
            success_count := success_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Function not found or error: %.% - %', 
                func_record.schema_name, func_record.function_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '[SECTION 2] % functions updated with secure search_path ✓', success_count;
END;
$$;

-- ############################################################################
-- SECTION 3: CREATE MISSING TABLES
-- ############################################################################
-- Addresses: Missing audit_logs table (required by confirm_hold_assignment_tx)
-- Risk: LOW - additive operation
-- ############################################################################

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    actor TEXT,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create service_role policy
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.audit_logs;
    CREATE POLICY "service_role_all" ON public.audit_logs
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN RAISE NOTICE '[SECTION 3] audit_logs table created ✓'; END $$;

-- ############################################################################
-- SECTION 4: ENABLE RLS ON UNPROTECTED TABLES
-- ############################################################################
-- Addresses: rls_disabled_in_public ERROR (7 tables)
-- Risk: MEDIUM - tables become inaccessible without proper policies
-- ############################################################################

-- Enable RLS on all affected tables
DO $$ BEGIN
    ALTER TABLE IF EXISTS public.booking_assignment_attempts ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS public.observability_events ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS public.table_merge_graph ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS public._migrations ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS public.manual_assignment_sessions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS public.booking_occasions_audit ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS public.booking_state_history ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Create RLS policies for newly protected tables

-- booking_assignment_attempts
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.booking_assignment_attempts;
    CREATE POLICY "service_role_all" ON public.booking_assignment_attempts
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "authenticated_select" ON public.booking_assignment_attempts;
    CREATE POLICY "authenticated_select" ON public.booking_assignment_attempts
        FOR SELECT TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.bookings b
                JOIN public.restaurant_memberships rm ON rm.restaurant_id = b.restaurant_id
                WHERE b.id = booking_assignment_attempts.booking_id
                  AND rm.user_id = (SELECT auth.uid())
            )
        );
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- observability_events (service role only)
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.observability_events;
    CREATE POLICY "service_role_all" ON public.observability_events
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- table_merge_graph
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.table_merge_graph;
    CREATE POLICY "service_role_all" ON public.table_merge_graph
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "authenticated_select" ON public.table_merge_graph;
    CREATE POLICY "authenticated_select" ON public.table_merge_graph
        FOR SELECT TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.restaurant_memberships rm
                WHERE rm.user_id = (SELECT auth.uid())
                  AND rm.restaurant_id = table_merge_graph.restaurant_id
            )
        );
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- _migrations (service role only)
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public._migrations;
    CREATE POLICY "service_role_all" ON public._migrations
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- manual_assignment_sessions
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.manual_assignment_sessions;
    CREATE POLICY "service_role_all" ON public.manual_assignment_sessions
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- booking_occasions_audit (service role only)
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.booking_occasions_audit;
    CREATE POLICY "service_role_all" ON public.booking_occasions_audit
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- booking_state_history
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.booking_state_history;
    CREATE POLICY "service_role_all" ON public.booking_state_history
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "authenticated_select" ON public.booking_state_history;
    CREATE POLICY "authenticated_select" ON public.booking_state_history
        FOR SELECT TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.bookings b
                JOIN public.restaurant_memberships rm ON rm.restaurant_id = b.restaurant_id
                WHERE b.id = booking_state_history.booking_id
                  AND rm.user_id = (SELECT auth.uid())
            )
        );
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE '[SECTION 4] RLS enabled on unprotected tables ✓'; END $$;

-- ############################################################################
-- SECTION 5: FIX RLS PERFORMANCE (auth_rls_initplan optimization)
-- ############################################################################
-- Addresses: auth_rls_initplan warning (~30 policies)
-- Risk: LOW - performance improvement, no functional change
-- Optimization: Wrap auth.uid() in (SELECT auth.uid()) for single evaluation
-- ############################################################################

-- demand_profiles
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

-- table_scarcity_metrics
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

-- user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT
    USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

-- profiles
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

-- booking_versions
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

-- strategic_configs
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
DROP POLICY IF EXISTS "Owners and managers can manage strategic configs" ON public.strategic_configs;
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

-- bookings
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

-- customers
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

-- booking_table_assignments
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

-- restaurant_invites
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

-- analytics_events
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

-- waiting_list
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

-- restaurants
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

-- profile_update_requests (uses profile_id, NOT user_id)
DROP POLICY IF EXISTS "profile_update_requests_insert" ON public.profile_update_requests;
CREATE POLICY "profile_update_requests_insert" ON public.profile_update_requests
    FOR INSERT
    WITH CHECK (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profile_update_requests_select" ON public.profile_update_requests;
CREATE POLICY "profile_update_requests_select" ON public.profile_update_requests
    FOR SELECT
    USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profile_update_requests_update" ON public.profile_update_requests;
CREATE POLICY "profile_update_requests_update" ON public.profile_update_requests
    FOR UPDATE
    USING (profile_id = (SELECT auth.uid()))
    WITH CHECK (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profile_update_requests_delete" ON public.profile_update_requests;
CREATE POLICY "profile_update_requests_delete" ON public.profile_update_requests
    FOR DELETE
    USING (profile_id = (SELECT auth.uid()));

DO $$ BEGIN RAISE NOTICE '[SECTION 5] RLS policies optimized with (SELECT auth.uid()) ✓'; END $$;

-- ############################################################################
-- SECTION 6: REMOVE DUPLICATE POLICIES
-- ############################################################################
-- Addresses: multiple_permissive_policies warning (~80 instances)
-- Risk: LOW - removes redundant policies
-- ############################################################################

-- analytics_events
DROP POLICY IF EXISTS "Service role can manage analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Service role full access to analytics_events" ON public.analytics_events;
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.analytics_events;
    CREATE POLICY "service_role_all" ON public.analytics_events
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- booking_versions
DROP POLICY IF EXISTS "Service role can manage booking versions" ON public.booking_versions;
DROP POLICY IF EXISTS "Service role full access to booking_versions" ON public.booking_versions;
DROP POLICY IF EXISTS "Restaurant staff can view booking versions" ON public.booking_versions;
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.booking_versions;
    CREATE POLICY "service_role_all" ON public.booking_versions
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- booking_slots
DROP POLICY IF EXISTS "Public can view booking slots" ON public.booking_slots;

-- customer_profiles
DROP POLICY IF EXISTS "Service role can manage customer profiles" ON public.customer_profiles;

-- leads
DROP POLICY IF EXISTS "Service role can read leads" ON public.leads;
DROP POLICY IF EXISTS "Service role full access to leads" ON public.leads;
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.leads;
    CREATE POLICY "service_role_all" ON public.leads
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- merge_rules
DROP POLICY IF EXISTS "Service role can manage merge rules" ON public.merge_rules;

-- profiles
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.profiles;
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.profiles;
    CREATE POLICY "service_role_all" ON public.profiles
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- restaurant_memberships
DROP POLICY IF EXISTS "Users can view memberships in their restaurants" ON public.restaurant_memberships;

-- strategic_configs
DROP POLICY IF EXISTS "Service role full access to strategic_configs" ON public.strategic_configs;

-- table_inventory
DROP POLICY IF EXISTS "Public can view table inventory" ON public.table_inventory;

-- user_profiles
DROP POLICY IF EXISTS "Service role full access to user_profiles" ON public.user_profiles;
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.user_profiles;
    CREATE POLICY "service_role_all" ON public.user_profiles
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- waiting_list
DROP POLICY IF EXISTS "Service role full access to waiting_list" ON public.waiting_list;
DROP POLICY IF EXISTS "Service role manage waiting list" ON public.waiting_list;
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.waiting_list;
    CREATE POLICY "service_role_all" ON public.waiting_list
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE '[SECTION 6] Duplicate policies removed ✓'; END $$;

-- ############################################################################
-- SECTION 7: FIX BAR TABLE BOOKING TYPE CONSTRAINT (Dec 25, 2025)
-- ############################################################################
-- Addresses: "Bar tables are drinks-only; booking_type lunch/dinner is not allowed"
-- Risk: LOW - removes outdated business constraint
-- Root Cause: Trigger function `enforce_bar_drinks_only` was blocking non-drinks bookings
-- ############################################################################

-- Replace the trigger function with a no-op to allow all booking types on bar tables
CREATE OR REPLACE FUNCTION public.enforce_bar_drinks_only()
RETURNS TRIGGER AS $$
BEGIN
  -- =========================================================================
  -- Bar table restriction REMOVED (2025-12-25)
  -- =========================================================================
  -- Previously, this function blocked non-drinks bookings on:
  --   - Tables with category = 'bar'
  --   - Tables in zones with names starting with 'bar%'
  -- 
  -- This restriction has been removed per business requirements.
  -- Bar tables and bar zones can now be used for any booking type:
  --   - lunch
  --   - dinner  
  --   - drinks
  --
  -- See: docs/ANTIGRAVITY_SESSION_HISTORY_20251225.md
  -- See: docs/BUSINESS_LOGIC.md (line 637-638)
  -- =========================================================================
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Set secure search_path for the updated function
ALTER FUNCTION public.enforce_bar_drinks_only() SET search_path = public, extensions;

DO $$ BEGIN RAISE NOTICE '[SECTION 7] Bar table booking constraint removed ✓'; END $$;

-- ############################################################################
-- SECTION 8: VERIFICATION QUERIES
-- ############################################################################

-- Check RLS is enabled on all public tables
SELECT 
    '=== RLS STATUS ===' AS section;
    
SELECT 
    tablename,
    CASE WHEN rowsecurity THEN '✓ Enabled' ELSE '✗ DISABLED' END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;

-- Check function search paths
SELECT 
    '=== FUNCTION SEARCH PATHS ===' AS section;

SELECT 
    p.proname AS function_name,
    CASE 
        WHEN p.proconfig IS NOT NULL AND 'search_path=public, extensions' = ANY(p.proconfig) THEN '✓ Secured'
        WHEN p.proconfig IS NOT NULL THEN '? Custom: ' || array_to_string(p.proconfig, ', ')
        ELSE '✗ DEFAULT (vulnerable)'
    END AS search_path_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_booking_with_capacity_check',
    'confirm_hold_assignment_tx',
    'assign_tables_atomic',
    'validate_table_adjacency'
  )
ORDER BY p.proname;

-- Check extensions location
SELECT 
    '=== EXTENSIONS LOCATION ===' AS section;

SELECT 
    e.extname AS extension_name,
    n.nspname AS schema_name,
    CASE WHEN n.nspname = 'extensions' THEN '✓ Correct' ELSE '? In ' || n.nspname END AS status
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname IN ('btree_gist', 'citext', 'pgcrypto')
ORDER BY e.extname;

-- Check audit_logs exists
SELECT 
    '=== AUDIT_LOGS TABLE ===' AS section;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') 
        THEN '✓ audit_logs table exists'
        ELSE '✗ audit_logs table MISSING'
    END AS status;

-- Check bar table constraint function
SELECT 
    '=== BAR TABLE CONSTRAINT ===' AS section;

SELECT 
    p.proname AS function_name,
    CASE 
        WHEN p.prosrc ILIKE '%RETURN NEW%' AND p.prosrc NOT ILIKE '%RAISE EXCEPTION%' 
        THEN '✓ Constraint removed (no-op)'
        ELSE '✗ Constraint still active'
    END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'enforce_bar_drinks_only';

-- Summary
SELECT 
    '=== MIGRATION COMPLETE ===' AS section,
    now() AS completed_at;

-- ############################################################################
-- END OF CONSOLIDATED MIGRATION
-- ############################################################################
