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

| Date (UTC) | Description                                                | Staging | Production | Priority |
| ---------- | ---------------------------------------------------------- | ------- | ---------- | -------- |
| 2026-01-17 | Add table_soft_holds for race condition prevention         | ✅      | ⏳         | Medium   |
| 2025-12-27 | Add FK: booking_table_assignments.booking_id → bookings.id | ✅      | ⏳         | High     |

---

## Migration Details

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
