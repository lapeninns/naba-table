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
| 2025-12-27 | Add FK: booking_table_assignments.booking_id → bookings.id | ✅      | ⏳         | High     |

---

## Migration Details

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
