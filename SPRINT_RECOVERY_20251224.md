# Sprint Recovery Plan - 2025-12-24

## Overview

This document captures all work done since commit `8a9353d4f6e459f1d1707a610af235c8d267ed43` and provides a sprint plan for database backup restore and re-applying security fixes.

---

## Commits Since Baseline

| Commit     | Message                                                      | Key Changes                     |
| ---------- | ------------------------------------------------------------ | ------------------------------- |
| `72f3ce0c` | fix: update booking API tests to use new access-token module | Test fixes for new token system |
| `9f5a45b3` | Show reservation history only for authenticated owners       | Auth guard for history          |
| `8807c433` | feat: implement HMAC-based booking access tokens             | New token generation system     |
| `f759ea5e` | Backfill missing booking tokens and improve token access     | Token migration                 |
| `2e7ca4b9` | Fix booking link 404 for token-based guest access            | Route fixes                     |
| `61d688ed` | Handle customer phone unique constraint conflicts            | DB constraint handling          |
| `b605749f` | Fix booking validation for midnight times                    | Validation fix                  |

---

## Database Changes Made (Will Be Reverted by Restore)

### 1. Row Level Security (RLS)

**Tables with RLS enabled:**

- `_migrations`
- `booking_assignment_attempts`
- `booking_occasions_audit`
- `booking_state_history`
- `manual_assignment_sessions`
- `observability_events`
- `table_merge_graph`
- `audit_logs` (also created)

**Policies created:**

- `service_role_all` - Full access for service role
- `authenticated_select` - Scoped read for authenticated users

### 2. Function Search Paths

34+ PostgreSQL functions updated:

- Changed from `search_path = ''` (empty) to `search_path = public, extensions`
- Fixes `pgcrypto` digest function access

### 3. RLS Performance Optimizations

- Replaced `auth.uid()` with `(SELECT auth.uid())` in policies
- Removed duplicate/redundant policies

### 4. Tables Created

- `audit_logs` - For audit event logging

---

## What Was Lost (Accidental Deletion)

**Incident**: At ~11:38 UTC on 2025-12-24, all booking data was accidentally deleted due to overly broad SQL `ILIKE` conditions.

**Impact**:

- All bookings for all restaurants deleted
- Includes White Horse Pub bookings (the ones we wanted to keep)

**Recovery Plan**: Restore from daily backup (before 11:38 UTC)

---

## Sprint Plan: Backup Restore & Recovery

### Phase 1: Backup Restore (5-10 minutes)

| Step | Action                                      | Owner  | Status |
| ---- | ------------------------------------------- | ------ | ------ |
| 1.1  | Go to Supabase Dashboard → Database Backups | User   | ⏳     |
| 1.2  | Select most recent backup BEFORE 11:38 UTC  | User   | ⏳     |
| 1.3  | Click Restore → Confirm                     | User   | ⏳     |
| 1.4  | Wait for restore to complete                | System | ⏳     |

### Phase 2: Re-apply Security Migrations (5 minutes)

| Step | Script                                           | Status |
| ---- | ------------------------------------------------ | ------ |
| 2.1  | `01_fix_function_search_paths.sql`               | ⏳     |
| 2.2  | `03_enable_rls_tables.sql`                       | ⏳     |
| 2.3  | `05_fix_rls_performance.sql` (corrected version) | ⏳     |
| 2.4  | `06_remove_duplicate_policies.sql`               | ⏳     |

### Phase 3: Verification (5 minutes)

| Step | Check                                   | Status |
| ---- | --------------------------------------- | ------ |
| 3.1  | Verify bookings exist in database       | ⏳     |
| 3.2  | Test booking flow on website            | ⏳     |
| 3.3  | Verify RLS is enabled (Database Linter) | ⏳     |
| 3.4  | Confirm no console errors               | ⏳     |

---

## SQL Scripts Location

All scripts saved in:

```
tasks/supabase-security-hardening-20251224-1041/artifacts/
├── 01_fix_function_search_paths.sql
├── 02_move_extensions.sql (optional - not applied)
├── 03_enable_rls_tables.sql
├── 04_create_audit_logs.sql
├── 05_fix_rls_performance.sql
└── 06_remove_duplicate_policies.sql
```

---

## Corrected RLS Performance Script

**IMPORTANT**: Use this version (with `profile_id` fix):

```sql
-- profile_update_requests uses profile_id, not user_id
DO $$ BEGIN
    DROP POLICY IF EXISTS "profile_update_requests_insert" ON public.profile_update_requests;
    CREATE POLICY "profile_update_requests_insert" ON public.profile_update_requests
        FOR INSERT WITH CHECK (profile_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped: %', SQLERRM;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "profile_update_requests_select" ON public.profile_update_requests;
    CREATE POLICY "profile_update_requests_select" ON public.profile_update_requests
        FOR SELECT USING (profile_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped: %', SQLERRM;
END $$;

-- (Full script in 05_fix_rls_performance.sql with all policies)
```

---

## Code Changes (Already Committed - Safe)

These changes are in Git and won't be affected by DB restore:

### 1. Access Token System (`server/bookings/access-token.ts`)

- HMAC-based token generation
- Token validation with expiry
- Legacy token fallback support

### 2. Booking API Route (`src/app/api/bookings/[id]/route.ts`)

- New access level determination
- Token and auth-based access
- Updated error responses

### 3. Test Updates (`src/app/api/bookings/[id]/route.test.ts`)

- New mocks for access-token module
- Updated test expectations

---

## Rollback Plan (If Something Goes Wrong)

### If REST API breaks after restore:

```sql
-- Re-run 01_fix_function_search_paths.sql
```

### If booking creation fails:

```sql
-- Ensure audit_logs table exists
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

### If RLS blocks queries:

```sql
-- Disable RLS temporarily
ALTER TABLE public.<table_name> DISABLE ROW LEVEL SECURITY;
```

---

## Timeline

| Time (UTC) | Event                                            |
| ---------- | ------------------------------------------------ |
| ~10:41     | Started security hardening session               |
| ~11:22     | RLS and search paths applied                     |
| ~11:37     | Attempted to delete specific restaurant bookings |
| ~11:38     | **Accidental deletion of ALL bookings**          |
| ~12:30     | Identified recovery path via Supabase backup     |
| ~13:10     | Completed test fixes, committed code             |
| ~13:14     | Created this recovery plan                       |
| ~13:XX     | **NEXT: Execute backup restore**                 |

---

## Success Criteria

- [ ] All bookings recovered (especially White Horse Pub)
- [ ] Booking creation works
- [ ] RLS enabled on critical tables
- [ ] No database linter errors
- [ ] Tests passing (222+)

---

## Notes

- Daily backups are taken once per day
- Pro plan now active with backup access
- Consider setting up spending alerts in Supabase billing

---

**Created**: 2025-12-24T13:15:00Z
**Author**: AI Assistant + @amankumarshrestha
