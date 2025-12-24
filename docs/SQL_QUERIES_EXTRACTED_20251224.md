# SQL Queries Extracted from Session History (Dec 23-24, 2025)

**Extracted**: 2025-12-24T19:11:10Z  
**Source**: Antigravity Session History + Task Artifacts  
**Date Range**: December 23-24, 2025

---

## Quick Reference

| Category                  | Scripts | Issue Count    |
| ------------------------- | ------- | -------------- |
| Fix Function Search Paths | 1       | 35+ functions  |
| Move Extensions           | 1       | 3 extensions   |
| Enable RLS on Tables      | 1       | 7 tables       |
| Create Missing Tables     | 1       | 1 table        |
| Fix RLS Performance       | 1       | ~30 policies   |
| Remove Duplicate Policies | 1       | ~80 duplicates |
| Diagnostic Queries        | 5       | Various        |

---

## 1. Fix Function Search Paths (Security Hardening)

**Issue**: 34+ PostgreSQL functions had no explicit `search_path`, vulnerable to hijacking attacks  
**Source**: `tasks/supabase-security-hardening-20251224-1041/artifacts/01_fix_function_search_paths.sql`

```sql
-- ============================================================================
-- Migration: Fix Function Search Path Mutable (Security Hardening)
-- ============================================================================

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
            RAISE NOTICE 'SUCCESS: %', alter_sql;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'FAILED: % - Error: %', alter_sql, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'SUMMARY: % functions updated', success_count;
    RAISE NOTICE '========================================';
END;
$$;
```

---

## 2. Move Extensions to Dedicated Schema

**Issue**: Extensions (`btree_gist`, `citext`, `pgcrypto`) in public schema = security risk  
**Source**: `tasks/supabase-security-hardening-20251224-1041/artifacts/02_move_extensions.sql`

```sql
-- ============================================================================
-- Migration: Move Extensions from Public to Extensions Schema
-- ============================================================================

BEGIN;

-- Create dedicated extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage to necessary roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Move citext extension
DROP EXTENSION IF EXISTS citext CASCADE;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

-- Grant function execution permissions
GRANT ALL ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Move pgcrypto extension
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Move btree_gist extension
DROP EXTENSION IF EXISTS btree_gist CASCADE;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- Update database search_path to include extensions schema
ALTER DATABASE postgres SET search_path = public, extensions;

COMMIT;
```

---

## 3. Enable RLS on Unprotected Tables

**Issue**: 7 tables had RLS disabled, accessible via PostgREST API to anyone with anon key  
**Source**: `tasks/supabase-security-hardening-20251224-1041/artifacts/03_enable_rls_tables.sql`

```sql
-- ============================================================================
-- Migration: Enable RLS on Public Tables (CRITICAL Security Fix)
-- ============================================================================

BEGIN;

-- Enable RLS on all affected tables
DO $$ BEGIN
    ALTER TABLE IF EXISTS public.booking_assignment_attempts ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS public.observability_events ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS public.table_merge_graph ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS public._migrations ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS public.manual_assignment_sessions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS public.booking_occasions_audit ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS public.booking_state_history ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

COMMIT;

-- Create RLS Policies for newly protected tables

-- booking_assignment_attempts
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.booking_assignment_attempts;
    CREATE POLICY "service_role_all" ON public.booking_assignment_attempts
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

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
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- observability_events (service role only)
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.observability_events;
    CREATE POLICY "service_role_all" ON public.observability_events
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- table_merge_graph
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.table_merge_graph;
    CREATE POLICY "service_role_all" ON public.table_merge_graph
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

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
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- _migrations (service role only)
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public._migrations;
    CREATE POLICY "service_role_all" ON public._migrations
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- manual_assignment_sessions
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.manual_assignment_sessions;
    CREATE POLICY "service_role_all" ON public.manual_assignment_sessions
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- booking_occasions_audit (service role only)
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.booking_occasions_audit;
    CREATE POLICY "service_role_all" ON public.booking_occasions_audit
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- booking_state_history
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.booking_state_history;
    CREATE POLICY "service_role_all" ON public.booking_state_history
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

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
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
```

---

## 4. Create Missing audit_logs Table

**Issue**: `confirm_hold_assignment_tx` RPC failed with "relation audit_logs does not exist"  
**Source**: `tasks/supabase-security-hardening-20251224-1041/artifacts/04_create_audit_logs.sql`

```sql
-- ============================================================================
-- Migration: Create Missing audit_logs Table
-- ============================================================================

-- Create the audit_logs table
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

-- Enable RLS (consistent with security hardening)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for service_role access
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.audit_logs;
    CREATE POLICY "service_role_all" ON public.audit_logs
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
```

---

## 5. Fix RLS Performance (auth_rls_initplan)

**Issue**: ~30 policies used `auth.uid()` directly instead of `(SELECT auth.uid())`, causing re-evaluation per row  
**Source**: `tasks/supabase-security-hardening-20251224-1041/artifacts/05_fix_rls_performance.sql`

```sql
-- ============================================================================
-- Migration: Fix RLS Policy Performance Issues
-- ============================================================================
-- Replace auth.uid() with (SELECT auth.uid()) for single evaluation per query
-- ============================================================================

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

-- profile_update_requests
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
```

---

## 6. Remove Duplicate Policies

**Issue**: ~80+ duplicate permissive policies causing unnecessary overhead  
**Source**: `tasks/supabase-security-hardening-20251224-1041/artifacts/06_remove_duplicate_policies.sql`

```sql
-- ============================================================================
-- Migration: Remove Duplicate RLS Policies
-- ============================================================================

-- analytics_events
DROP POLICY IF EXISTS "Service role can manage analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Service role full access to analytics_events" ON public.analytics_events;
CREATE POLICY "service_role_all" ON public.analytics_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- booking_versions
DROP POLICY IF EXISTS "Service role can manage booking versions" ON public.booking_versions;
DROP POLICY IF EXISTS "Service role full access to booking_versions" ON public.booking_versions;
DROP POLICY IF EXISTS "Restaurant staff can view booking versions" ON public.booking_versions;
CREATE POLICY "service_role_all" ON public.booking_versions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- booking_slots
DROP POLICY IF EXISTS "Public can view booking slots" ON public.booking_slots;

-- customer_profiles
DROP POLICY IF EXISTS "Service role can manage customer profiles" ON public.customer_profiles;

-- leads
DROP POLICY IF EXISTS "Service role can read leads" ON public.leads;
DROP POLICY IF EXISTS "Service role full access to leads" ON public.leads;
CREATE POLICY "service_role_all" ON public.leads
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- merge_rules
DROP POLICY IF EXISTS "Service role can manage merge rules" ON public.merge_rules;

-- profiles
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.profiles;
CREATE POLICY "service_role_all" ON public.profiles
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- restaurant_memberships
DROP POLICY IF EXISTS "Users can view memberships in their restaurants" ON public.restaurant_memberships;

-- strategic_configs
DROP POLICY IF EXISTS "Service role full access to strategic_configs" ON public.strategic_configs;

-- table_inventory
DROP POLICY IF EXISTS "Public can view table inventory" ON public.table_inventory;

-- user_profiles
DROP POLICY IF EXISTS "Service role full access to user_profiles" ON public.user_profiles;
CREATE POLICY "service_role_all" ON public.user_profiles
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- waiting_list
DROP POLICY IF EXISTS "Service role full access to waiting_list" ON public.waiting_list;
DROP POLICY IF EXISTS "Service role manage waiting list" ON public.waiting_list;
CREATE POLICY "service_role_all" ON public.waiting_list
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## 7. Diagnostic Queries (From Session History)

### 7.1 Check RLS Status on All Tables

```sql
SELECT
    schemaname,
    tablename,
    CASE WHEN rowsecurity THEN '✓ Enabled' ELSE '✗ DISABLED' END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;
```

### 7.2 Check Function Search Paths

```sql
SELECT
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS args,
    p.proconfig AS config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proconfig IS NOT NULL
  AND 'search_path=public' = ANY(p.proconfig)
ORDER BY p.proname
LIMIT 20;
```

### 7.3 Check Extensions Location

```sql
SELECT
    e.extname AS extension_name,
    n.nspname AS schema_name
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname IN ('btree_gist', 'citext', 'pgcrypto')
ORDER BY e.extname;
```

### 7.4 Verify audit_logs Table Exists

```sql
SELECT
    schemaname,
    tablename,
    rowsecurity,
    (SELECT COUNT(*) FROM public.audit_logs) as row_count
FROM pg_tables
WHERE tablename = 'audit_logs';
```

### 7.5 Debug Booking RPC (from Debug Booking API 503 session)

```sql
DO $$
DECLARE
    result jsonb;
BEGIN
    SELECT create_booking_with_capacity_check(
        '486de541-a307-4414-b0b1-f774a0e4a9fa'::uuid,  -- Restaurant ID
        (SELECT id FROM customers LIMIT 1),
        '2025-12-27'::date,
        '18:00'::time,
        '20:00'::time,
        2, 'dinner', 'Test', 'test@example.com', '+447000000000',
        'indoor', NULL, false, 'test-' || now()::text,
        'api', NULL, NULL, '{}'::jsonb, 0
    ) INTO result;
    RAISE NOTICE 'Result: %', result;
END $$;
```

### 7.6 List All Policies for Specific Tables

```sql
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
```

---

## Summary Statistics

| Category                         | Count |
| -------------------------------- | ----- |
| Functions with search_path fixed | 35+   |
| Extensions moved                 | 3     |
| Tables with RLS enabled          | 7     |
| Tables created                   | 1     |
| Policies optimized               | ~30   |
| Duplicate policies removed       | ~80   |
| Diagnostic queries               | 6     |

---

## Execution Order

1. `01_fix_function_search_paths.sql` - Fix security vulnerability
2. `02_move_extensions.sql` - Schema isolation
3. `03_enable_rls_tables.sql` - Enable RLS + create policies
4. `04_create_audit_logs.sql` - Create missing table
5. `05_fix_rls_performance.sql` - Optimize auth.uid() calls
6. `06_remove_duplicate_policies.sql` - Clean up duplicates

**OR** use the consolidated script:

- `migrations/CONSOLIDATED_DATABASE_FIXES_20251224.sql`

---

**Extracted By**: Antigravity AI Assistant  
**Source**: Session History (Dec 23-24, 2025)  
**Timestamp**: 2025-12-24T19:11:10Z
