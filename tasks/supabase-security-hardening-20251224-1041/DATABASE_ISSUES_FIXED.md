# Database Issues Fixed - Session 2025-12-24

## Overview

This document records all database issues identified and fixed during the security hardening session on December 24, 2025.

**Session Start**: ~10:41 UTC  
**Backup Restored**: 05:25 UTC backup (restored at ~13:20 UTC)  
**Re-migrations Required**: Yes - all fixes need to be re-applied after restore

---

## Issue 1: Row Level Security (RLS) Disabled on Public Tables

### Severity: **ERROR** (Critical)

### Problem

7 tables in the `public` schema had RLS disabled, making them accessible via PostgREST API to anyone with the anon key.

### Affected Tables

| Table                         | Risk                                |
| ----------------------------- | ----------------------------------- |
| `_migrations`                 | Internal migration tracking exposed |
| `booking_assignment_attempts` | Booking attempt details exposed     |
| `booking_occasions_audit`     | Audit trail exposed                 |
| `booking_state_history`       | State change history exposed        |
| `manual_assignment_sessions`  | Manual assignments exposed          |
| `observability_events`        | Internal logs exposed               |
| `table_merge_graph`           | Table adjacency data exposed        |

### Fix Applied

```sql
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.<table_name>
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Script Location

`tasks/supabase-security-hardening-20251224-1041/artifacts/03_enable_rls_tables.sql`

---

## Issue 2: PostgreSQL Functions with Mutable Search Path

### Severity: **WARNING** (Security)

### Problem

34+ PostgreSQL functions in the `public` schema had no explicit `search_path`, making them vulnerable to search_path hijacking attacks.

### Risk

An attacker could create malicious tables/functions in a schema that appears earlier in the search_path, intercepting function calls.

### Fix Applied

```sql
ALTER FUNCTION public.<function_name>(...) SET search_path = public, extensions;
```

### Why `public, extensions`?

- `public` - Contains application tables
- `extensions` - Contains `pgcrypto` and other extensions (needed for `digest()` function)

### Script Location

`tasks/supabase-security-hardening-20251224-1041/artifacts/01_fix_function_search_paths.sql`

---

## Issue 3: Missing `audit_logs` Table

### Severity: **ERROR** (Application Breaking)

### Problem

The `confirm_hold_assignment_tx` RPC function tried to insert into `audit_logs` table, but the table didn't exist in the database.

### Symptom

```
ERROR: relation "audit_logs" does not exist
```

### Fix Applied

```sql
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    actor TEXT,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.audit_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Script Location

`tasks/supabase-security-hardening-20251224-1041/artifacts/04_create_audit_logs.sql`

---

## Issue 4: `pgcrypto` Extension Not in Search Path

### Severity: **WARNING** (Functional)

### Problem

After setting `search_path = public` (without `extensions`), the `digest()` function from `pgcrypto` couldn't be found.

### Symptom

```
WARNING: function digest(text, unknown) does not exist
```

### Root Cause

`pgcrypto` extension is installed in the `extensions` schema, but functions were only looking in `public`.

### Fix Applied

Changed function search paths from:

```sql
SET search_path = public
```

To:

```sql
SET search_path = public, extensions
```

Also updated database default:

```sql
ALTER DATABASE postgres SET search_path = public, extensions;
```

---

## Issue 5: RLS Policy Performance (auth_rls_initplan)

### Severity: **WARNING** (Performance)

### Problem

~30 RLS policies were using `auth.uid()` directly instead of `(SELECT auth.uid())`, causing the function to be re-evaluated for every row instead of once per query.

### Impact

- Slower query performance
- Increased database load
- Potential timeouts on large tables

### Fix Applied

```sql
-- Before (slow)
USING (user_id = auth.uid())

-- After (fast)
USING (user_id = (SELECT auth.uid()))
```

### Policies Updated

- `profile_update_requests` (uses `profile_id`, not `user_id`)
- `user_profiles`
- `profiles`
- `restaurants`
- `bookings` (delete policy)
- `customers` (delete policy)
- `waiting_list`
- `analytics_events`
- `restaurant_invites`

### Script Location

`tasks/supabase-security-hardening-20251224-1041/artifacts/05_fix_rls_performance.sql`

---

## Issue 6: Duplicate RLS Policies (multiple_permissive_policies)

### Severity: **WARNING** (Performance)

### Problem

~80+ instances of multiple permissive policies for the same role/action on tables. PostgreSQL evaluates all permissive policies and ORs them together, causing unnecessary overhead.

### Fix Applied

```sql
DROP POLICY IF EXISTS "Service role can manage analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Service role full access to analytics_events" ON public.analytics_events;
-- Keep only one consolidated policy
```

### Tables Cleaned

- `analytics_events`
- `booking_versions`
- `leads`
- `merge_rules`
- `profiles`
- `strategic_configs`
- `user_profiles`
- `waiting_list`
- `customer_profiles`
- `booking_slots`
- `table_inventory`
- `restaurant_memberships`

### Script Location

`tasks/supabase-security-hardening-20251224-1041/artifacts/06_remove_duplicate_policies.sql`

---

## Issue 7: Incorrect Column Reference in RLS Policy

### Severity: **ERROR** (Migration Failure)

### Problem

Initial RLS performance script referenced `user_id` column for `profile_update_requests` table, but the table uses `profile_id`.

### Symptom

```
ERROR: column "user_id" does not exist
```

### Fix Applied

Changed from:

```sql
WHERE user_id = (SELECT auth.uid())
```

To:

```sql
WHERE profile_id = (SELECT auth.uid())
```

---

## Issue 8: POST /api/bookings Returning 503 (INTERNAL_ERROR)

### Severity: **ERROR** (Application Breaking)

### Problem

The `POST /api/bookings` endpoint was returning a 503 Service Unavailable error with `code: "INTERNAL_ERROR"` when creating bookings for the White Horse pub.

### Symptom

```
POST /api/bookings 503 in 2.6s
Response: {"error":"An unexpected error occurred while creating the booking","code":"INTERNAL_ERROR"}
```

### Root Cause Investigation

1. **RPC Function**: The `create_booking_with_capacity_check` PostgreSQL function exists in Supabase
2. **Error Source**: The function's `WHEN OTHERS` exception handler was catching an unhandled error
3. **Error Details**: The actual error was in `sqlstate` and `sqlerrm` fields of the response

### PostgreSQL Function Location

The error handling in the RPC function:

```sql
WHEN OTHERS THEN
    RAISE WARNING 'Unexpected error in create_booking_with_capacity_check: % %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
        'success', false,
        'error', 'INTERNAL_ERROR',
        'message', 'An unexpected error occurred while creating the booking',
        'sqlstate', SQLSTATE,
        'sqlerrm', SQLERRM
    );
```

### Debug Logging Added

Temporary debug logging was added to `server/capacity/transaction.ts` to capture RPC responses:

```typescript
console.log('[DEBUG] Calling create_booking_with_capacity_check RPC...');
// After RPC call:
console.log('[DEBUG] RPC result - data:', JSON.stringify(data, null, 2));
console.log('[DEBUG] RPC result - error:', JSON.stringify(error, null, 2));
```

### Possible Root Causes

1. **Missing capacity rules** for the restaurant
2. **Missing operating hours** configuration
3. **Constraint violations** in the INSERT statement
4. **`generate_booking_reference()` function** failing

### Diagnostic Query

Run in Supabase SQL Editor to test directly:

```sql
DO $$
DECLARE
    result jsonb;
BEGIN
    SELECT create_booking_with_capacity_check(
        '486de541-a307-4414-b0b1-f774a0e4a9fa'::uuid,  -- White Horse
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

### Status

🔍 **Under Investigation** - Need to check Supabase logs for `sqlerrm` details

---

## Summary of Fixes

| Issue                                 | Severity | Status                     |
| ------------------------------------- | -------- | -------------------------- |
| RLS disabled on 7 tables              | ERROR    | ✅ Fixed (re-apply needed) |
| Mutable function search paths         | WARNING  | ✅ Fixed (re-apply needed) |
| Missing audit_logs table              | ERROR    | ✅ Fixed (re-apply needed) |
| pgcrypto not in search path           | WARNING  | ✅ Fixed (re-apply needed) |
| RLS auth.uid() performance            | WARNING  | ✅ Fixed (re-apply needed) |
| Duplicate RLS policies                | WARNING  | ✅ Fixed (re-apply needed) |
| Wrong column in policy                | ERROR    | ✅ Fixed in script         |
| 503 on booking creation (White Horse) | ERROR    | 🔍 Investigating           |

---

## Re-Application Order (After Backup Restore)

1. **01_fix_function_search_paths.sql** - Set search_path for all functions
2. **03_enable_rls_tables.sql** - Enable RLS on 7 tables
3. **04_create_audit_logs.sql** - Create missing table
4. **05_fix_rls_performance.sql** - Optimize auth.uid() policies (CORRECTED version)
5. **06_remove_duplicate_policies.sql** - Clean up duplicates

---

## Verification Commands

### Check RLS is enabled:

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Check function search paths:

```sql
SELECT n.nspname, p.proname, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proconfig IS NOT NULL
LIMIT 20;
```

### Check audit_logs exists:

```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'audit_logs';
```

---

## Accidental Data Deletion (Incident)

### What Happened

At ~11:38 UTC, a SQL script intended to delete bookings for specific restaurants accidentally deleted **all bookings** due to overly broad `ILIKE` conditions.

### Root Cause

```sql
-- Intended to match specific restaurants, but was too broad
WHERE name ILIKE '%old crown%' OR name ILIKE '%corner house%'
```

### Resolution

Restored from daily backup (24 Dec 2025 05:25:20 UTC) via Supabase Pro plan.

### Lesson Learned

- Always use `SELECT` first to verify what will be affected
- Use more specific conditions (exact match or include city/location)
- Test on staging first

---

**Document Created**: 2025-12-24T18:50:00Z  
**Last Updated**: 2025-12-24T18:51:00Z  
**Author**: AI Assistant + @amankumarshrestha
