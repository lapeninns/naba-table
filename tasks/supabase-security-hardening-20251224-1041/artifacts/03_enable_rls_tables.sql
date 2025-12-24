-- ============================================================================
-- Migration: Enable RLS on Public Tables (CRITICAL Security Fix)
-- ============================================================================
-- 
-- FIXED VERSION: Uses correct table names and column references
-- 
-- This migration addresses the "rls_disabled_in_public" ERROR-level warnings.
-- Tables in the public schema without RLS are accessible via PostgREST API!
--
-- AFFECTED TABLES (7):
-- - booking_assignment_attempts (has booking_id, joins to bookings for restaurant)
-- - observability_events (internal logging)
-- - table_merge_graph (has restaurant_id)
-- - _migrations (internal migration tracking)
-- - manual_assignment_sessions (unknown structure - may not exist)
-- - booking_occasions_audit (unknown structure)
-- - booking_state_history (has booking_id)
--
-- EXECUTION:
-- Run this script in Supabase SQL Editor (staging first, then production)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Enable RLS on all affected tables
-- (Using IF EXISTS to avoid errors if table doesn't exist)
-- ============================================================================

-- 1. booking_assignment_attempts
DO $$ BEGIN
    ALTER TABLE IF EXISTS public.booking_assignment_attempts ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 2. observability_events
DO $$ BEGIN
    ALTER TABLE IF EXISTS public.observability_events ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 3. table_merge_graph
DO $$ BEGIN
    ALTER TABLE IF EXISTS public.table_merge_graph ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 4. _migrations (internal migration tracking)
DO $$ BEGIN
    ALTER TABLE IF EXISTS public._migrations ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 5. manual_assignment_sessions
DO $$ BEGIN
    ALTER TABLE IF EXISTS public.manual_assignment_sessions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 6. booking_occasions_audit
DO $$ BEGIN
    ALTER TABLE IF EXISTS public.booking_occasions_audit ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 7. booking_state_history
DO $$ BEGIN
    ALTER TABLE IF EXISTS public.booking_state_history ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

COMMIT;

-- ============================================================================
-- STEP 2: Create RLS Policies
-- ============================================================================

-- ==========================================
-- booking_assignment_attempts
-- Has: booking_id (FK to bookings)
-- ==========================================

DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.booking_assignment_attempts;
    CREATE POLICY "service_role_all" ON public.booking_assignment_attempts
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Staff can read attempts for bookings in their restaurant
DO $$ BEGIN
    DROP POLICY IF EXISTS "authenticated_select" ON public.booking_assignment_attempts;
    CREATE POLICY "authenticated_select" ON public.booking_assignment_attempts
        FOR SELECT
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.bookings b
                JOIN public.restaurant_memberships rm ON rm.restaurant_id = b.restaurant_id
                WHERE b.id = booking_assignment_attempts.booking_id
                  AND rm.user_id = auth.uid()
            )
        );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ==========================================
-- observability_events
-- Internal logging - service role only
-- ==========================================

DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.observability_events;
    CREATE POLICY "service_role_all" ON public.observability_events
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- No authenticated or anon access - purely backend

-- ==========================================
-- table_merge_graph
-- Likely has: restaurant_id or table references
-- ==========================================

DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.table_merge_graph;
    CREATE POLICY "service_role_all" ON public.table_merge_graph
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Check if table_merge_graph has restaurant_id column
DO $$ 
DECLARE
    has_restaurant_id BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'table_merge_graph' 
          AND column_name = 'restaurant_id'
    ) INTO has_restaurant_id;
    
    IF has_restaurant_id THEN
        DROP POLICY IF EXISTS "authenticated_select" ON public.table_merge_graph;
        CREATE POLICY "authenticated_select" ON public.table_merge_graph
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.restaurant_memberships rm
                    WHERE rm.user_id = auth.uid()
                      AND rm.restaurant_id = table_merge_graph.restaurant_id
                )
            );
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ==========================================
-- _migrations
-- Internal migration tracking - service role only
-- ==========================================

DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public._migrations;
    CREATE POLICY "service_role_all" ON public._migrations
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ==========================================
-- manual_assignment_sessions
-- May have: user_id column
-- ==========================================

DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.manual_assignment_sessions;
    CREATE POLICY "service_role_all" ON public.manual_assignment_sessions
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Check if manual_assignment_sessions has user_id column
DO $$ 
DECLARE
    has_user_id BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'manual_assignment_sessions' 
          AND column_name = 'user_id'
    ) INTO has_user_id;
    
    IF has_user_id THEN
        DROP POLICY IF EXISTS "authenticated_own_sessions" ON public.manual_assignment_sessions;
        CREATE POLICY "authenticated_own_sessions" ON public.manual_assignment_sessions
            FOR ALL
            TO authenticated
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ==========================================
-- booking_occasions_audit
-- Unknown structure - service role only for safety
-- ==========================================

DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.booking_occasions_audit;
    CREATE POLICY "service_role_all" ON public.booking_occasions_audit
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ==========================================
-- booking_state_history
-- Has: booking_id (FK to bookings)
-- ==========================================

DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.booking_state_history;
    CREATE POLICY "service_role_all" ON public.booking_state_history
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Staff can read state history for bookings in their restaurant
DO $$ BEGIN
    DROP POLICY IF EXISTS "authenticated_select" ON public.booking_state_history;
    CREATE POLICY "authenticated_select" ON public.booking_state_history
        FOR SELECT
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.bookings b
                JOIN public.restaurant_memberships rm ON rm.restaurant_id = b.restaurant_id
                WHERE b.id = booking_state_history.booking_id
                  AND rm.user_id = auth.uid()
            )
        );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================================
-- VERIFICATION: Check RLS is enabled and policies exist
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) AS policy_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN (
    'booking_assignment_attempts',
    'observability_events',
    'table_merge_graph',
    '_migrations',
    'manual_assignment_sessions',
    'booking_occasions_audit',
    'booking_state_history'
  )
ORDER BY tablename;

-- ============================================================================
-- List all policies for these tables
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'booking_assignment_attempts',
    'observability_events',
    'table_merge_graph',
    '_migrations',
    'manual_assignment_sessions',
    'booking_occasions_audit',
    'booking_state_history'
  )
ORDER BY tablename, policyname;
