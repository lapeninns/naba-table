# Database Migration Log

> **Purpose**: Track database schema changes made in staging that need to be applied to production.  
> **Rule**: Every database schema change must be logged here with SQL and verification status.  
> **Workflow**: Staging first → Verify → Apply to Production → Update status

---

## Migration Status Legend

| Status         | Meaning                           |
| -------------- | --------------------------------- |
| ✅ Applied     | Successfully applied and verified |
| ⏳ Pending     | Not yet applied                   |
| ❌ Failed      | Application failed, see notes     |
| 🔄 In Progress | Currently being applied           |

---

## Pending Migrations (Apply to Production)

| Date (UTC) | Description | Staging | Production | Priority |
| ---------- | ----------- | ------- | ---------- | -------- |

| 2026-02-03 | Add per-day reservation interval + fixed slots to operating hours | ⏳ | ⏳ | Medium |
| 2026-01-20 | Restore restaurant_capacity_rules (capacity enforcement) | N/A | ⏳ | High |
| 2026-01-18 | Lock down table_soft_holds access (RLS/GRANTS) | ✅ | ⏳ | High |
| 2026-01-18 | CASCADE delete on booking_table_assignments FKs | ✅ | ⏳ | High |
| 2026-01-17 | Add table_soft_holds for race condition prevention | ✅ | ⏳ | Medium |
| 2025-12-27 | Add FK: booking_table_assignments.booking_id → bookings.id | ✅ | ⏳ | High |

---

## Migration Details

### 2026-02-03: Add per-day reservation interval + fixed slots to operating hours

**Status**: ⏳ Staging | ⏳ Production  
**Priority**: Medium  
**Migration File**: `supabase/migrations/20260203_add_operating_hours_reservation_slots.sql`

#### Problem

Need per-day reservation interval overrides and fixed slot times for specific weekdays or dates.

#### SQL to Apply

Apply the full migration file: `supabase/migrations/20260203_add_operating_hours_reservation_slots.sql`

#### Verification

After applying:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'restaurant_operating_hours'
  AND column_name IN ('reservation_interval_minutes', 'reservation_slot_times')
ORDER BY column_name;
```

#### Rollback

```sql
ALTER TABLE public.restaurant_operating_hours
  DROP COLUMN IF EXISTS reservation_slot_times,
  DROP COLUMN IF EXISTS reservation_interval_minutes;
NOTIFY pgrst, 'reload schema';
```

### 2026-01-20: Restore restaurant_capacity_rules (capacity enforcement)

**Status**: N/A Staging | ⏳ Production  
**Priority**: High  
**Related Issue**: Booking RPC error `relation "restaurant_capacity_rules" does not exist`  
**Migration File**: `supabase/migrations/20260120_restore_capacity_rules.sql`

#### Problem

The capacity enforcement RPC `create_booking_with_capacity_check` fails in production because `public.restaurant_capacity_rules` is missing.

#### Root Cause

Capacity schema was removed or not applied in production, leaving RPC references to a missing table.

#### SQL to Apply

Apply the full migration file: `supabase/migrations/20260120_restore_capacity_rules.sql`

#### Verification

- Confirm table exists and RLS enabled
- Smoke-test `create_booking_with_capacity_check` in production

#### Rollback

```sql
DROP TABLE IF EXISTS public.restaurant_capacity_rules CASCADE;
DROP TYPE IF EXISTS public.capacity_override_type;
NOTIFY pgrst, 'reload schema';
```

### 2026-01-18: Lock down table_soft_holds access (RLS/GRANTS)

**Status**: ✅ Staging (2026-01-18) | ⏳ Production
**Priority**: High
**Related Issue**: Soft-holds table exposed session tokens via permissive RLS/GRANTS
**Migration File**: `supabase/migrations/20260118_lock_down_table_soft_holds_access.sql`

#### Problem

`public.table_soft_holds` was granted to `authenticated` with permissive RLS policies (`USING (true)` / `WITH CHECK (true)`). This allowed any authenticated user to:

- Read `session_token` values (breaking confidentiality)
- Delete or insert soft-hold rows (breaking integrity)

This can reintroduce the original race condition and enables low-effort denial-of-service by manipulating soft-holds.

#### Solution

- Remove direct table privileges for `authenticated` and `anon`
- Remove permissive authenticated RLS policies
- Keep soft-holds operations available via SECURITY DEFINER RPCs only

#### SQL to Apply

Apply the full migration file: `supabase/migrations/20260118_lock_down_table_soft_holds_access.sql`

#### Verification

After applying:

```sql
-- No authenticated grants
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'table_soft_holds'
  AND grantee = 'authenticated';

-- Only service_role policy remains
SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'table_soft_holds';
```

#### Rollback

If required (production emergency only), re-add the prior policies/grants. Prefer rolling forward with a corrected policy rather than reopening direct table access.

---

### 2026-01-18: CASCADE delete on booking_table_assignments FKs

**Status**: ✅ Staging (2026-01-18) | ⏳ Production  
**Priority**: High  
**Related Issue**: [7b] Orphaned assignments when tables/bookings deleted  
**Migration File**: `supabase/migrations/20260118_cascade_delete_table_assignments.sql`

#### Problem

When a table from `table_inventory` or a booking is deleted, the referencing rows in `booking_table_assignments` become orphaned because the FK constraints use `ON DELETE RESTRICT`. This causes:

1. Deletion failures when trying to remove tables/bookings
2. Manual cleanup required to delete assignments first
3. Potential data integrity issues if cleanup is missed

#### Solution

Change both FK constraints to use `ON DELETE CASCADE` so that when a table or booking is deleted, the related assignments are automatically cleaned up.

#### SQL to Apply

```sql
-- Change table_id FK to CASCADE
ALTER TABLE public.booking_table_assignments
  DROP CONSTRAINT IF EXISTS booking_table_assignments_table_id_fkey;

ALTER TABLE public.booking_table_assignments
  ADD CONSTRAINT booking_table_assignments_table_id_fkey
    FOREIGN KEY (table_id)
    REFERENCES public.table_inventory(id)
    ON DELETE CASCADE;

-- Change booking_id FK to CASCADE (if not already)
ALTER TABLE public.booking_table_assignments
  DROP CONSTRAINT IF EXISTS booking_table_assignments_booking_id_fkey;

ALTER TABLE public.booking_table_assignments
  ADD CONSTRAINT booking_table_assignments_booking_id_fkey
    FOREIGN KEY (booking_id)
    REFERENCES public.bookings(id)
    ON DELETE CASCADE;

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
```

#### Pre-flight Checks

- [ ] Backup verified/available
- [ ] Verify no critical bookings in progress during window
- [ ] Check current constraint definitions:
  ```sql
  SELECT conname, confdeltype
  FROM pg_constraint
  WHERE conrelid = 'public.booking_table_assignments'::regclass
  AND contype = 'f';
  ```

#### Verification

After applying:

1. Verify CASCADE is set:

   ```sql
   SELECT conname, confdeltype
   FROM pg_constraint
   WHERE conrelid = 'public.booking_table_assignments'::regclass
   AND contype = 'f';
   -- confdeltype should be 'c' (cascade) for both FKs
   ```

2. Test cascade behavior (in staging only):
   ```sql
   -- Create test data, delete parent, verify child deleted
   ```

#### Rollback

```sql
-- Revert to RESTRICT
ALTER TABLE public.booking_table_assignments
  DROP CONSTRAINT IF EXISTS booking_table_assignments_table_id_fkey;

ALTER TABLE public.booking_table_assignments
  ADD CONSTRAINT booking_table_assignments_table_id_fkey
    FOREIGN KEY (table_id)
    REFERENCES public.table_inventory(id)
    ON DELETE RESTRICT;

ALTER TABLE public.booking_table_assignments
  DROP CONSTRAINT IF EXISTS booking_table_assignments_booking_id_fkey;

ALTER TABLE public.booking_table_assignments
  ADD CONSTRAINT booking_table_assignments_booking_id_fkey
    FOREIGN KEY (booking_id)
    REFERENCES public.bookings(id)
    ON DELETE RESTRICT;

NOTIFY pgrst, 'reload schema';
```

---

### 2026-01-17: Add table_soft_holds for race condition prevention

**Status**: ✅ Staging (2026-01-17) | ⏳ Production  
**Priority**: Medium  
**Related Issue**: Race condition when two operators select the same table simultaneously  
**Migration File**: `supabase/migrations/20260117_add_soft_holds.sql`

#### Problem

When two operators select the same table at nearly the same time, both see it as "available" during the evaluation phase. One succeeds in creating the hold, while the other gets a confusing database constraint error.

#### Solution

Add a soft-hold layer that acquires temporary 10-second locks on tables during evaluation. This provides early conflict detection with clear user feedback ("This table is being held by another operator").

#### SQL to Apply

Apply the full migration file: `supabase/migrations/20260117_add_soft_holds.sql`

Key components:

- `table_soft_holds` table with exclusion constraint for overlap detection
- `acquire_soft_holds_atomic()` - Atomic acquisition with rollback
- `release_soft_holds()` - Release by session token
- `cleanup_expired_soft_holds()` - Cron-compatible cleanup
- `check_soft_hold_ownership()` - Verify session owns tables

#### Pre-flight Checks

- [ ] Backup verified/available
- [ ] Extension `btree_gist` is enabled (required for exclusion constraint)

#### Verification

After applying:

1. Verify table exists:

   ```sql
   SELECT * FROM public.table_soft_holds LIMIT 1;
   ```

2. Verify RPCs exist:

   ```sql
   SELECT routine_name FROM information_schema.routines
   WHERE routine_name LIKE '%soft_hold%';
   ```

3. Test via UI: Open two browser tabs, select same table simultaneously

#### Rollback

```sql
DROP FUNCTION IF EXISTS check_soft_hold_ownership(uuid, uuid[]);
DROP FUNCTION IF EXISTS cleanup_expired_soft_holds();
DROP FUNCTION IF EXISTS release_soft_holds(uuid);
DROP FUNCTION IF EXISTS acquire_soft_holds_atomic(uuid[], uuid, integer);
DROP TABLE IF EXISTS public.table_soft_holds;

NOTIFY pgrst, 'reload schema';
```

---

### 2025-12-27: Add foreign key constraint for booking_table_assignments

**Status**: ✅ Staging | ⏳ Production  
**Priority**: High  
**Related Issue**: Dashboard API failing with PGRST200 error

#### Problem

Dashboard API at `/api/dashboard/summary` was failing with error:

```
PGRST200: Could not find a relationship between 'bookings' and 'booking_table_assignments'
```

#### Root Cause

The foreign key constraint from `booking_table_assignments.booking_id` to `bookings.id` was missing. This was likely due to the constraint not being included in the database backup/restore process.

#### SQL to Apply

```sql
-- 1. First, clean up any orphaned records (if any exist)
-- This prevents FK constraint violation during creation
DELETE FROM public.booking_table_assignments
WHERE booking_id NOT IN (SELECT id FROM public.bookings);

-- 2. Add the foreign key constraint
ALTER TABLE public.booking_table_assignments
ADD CONSTRAINT booking_table_assignments_booking_id_fkey
FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

-- 3. Notify PostgREST to reload schema cache (required for Supabase)
NOTIFY pgrst, 'reload schema';
```

#### Pre-flight Checks (Production)

- [ ] Backup verified/available
- [ ] Maintenance window scheduled (if needed)
- [ ] Check for orphaned records count first:
  ```sql
  SELECT COUNT(*) FROM public.booking_table_assignments
  WHERE booking_id NOT IN (SELECT id FROM public.bookings);
  ```

#### Verification

After applying, verify:

1. `/api/dashboard/summary` returns 200 (not 500)
2. Query loads dashboard data correctly:
   ```sql
   SELECT b.*, bta.*
   FROM bookings b
   LEFT JOIN booking_table_assignments bta ON b.id = bta.booking_id
   LIMIT 5;
   ```

#### Rollback (if needed)

```sql
ALTER TABLE public.booking_table_assignments
DROP CONSTRAINT IF EXISTS booking_table_assignments_booking_id_fkey;

NOTIFY pgrst, 'reload schema';
```

---

## Completed Migrations

_No completed migrations yet. Move entries here after applying to production._

<!--
Template for new entries:

### YYYY-MM-DD: Description

**Status**: ✅ Staging | ⏳ Production
**Priority**: Low/Medium/High
**Related Issue**: Description or ticket link

#### Problem
What was broken or needed?

#### Root Cause
Why did this happen?

#### SQL to Apply
```sql
-- Your SQL here
```

#### Verification
How to verify it worked

#### Rollback
```sql
-- Rollback SQL if needed
```
-->
