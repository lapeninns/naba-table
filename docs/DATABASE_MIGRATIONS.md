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

| 2026-03-23 | Remove built-in lunch/dinner occasion time windows | ✅ | ✅ | High |
| 2026-03-23 | Set Old Crown interval to 30 minutes | ✅ | ✅ | Medium |
| 2026-02-03 | Add per-day reservation interval + fixed slots to operating hours | ⏳ | ⏳ | Medium |
| 2026-01-20 | Restore restaurant_capacity_rules (capacity enforcement) | N/A | ⏳ | High |
| 2026-01-18 | Lock down table_soft_holds access (RLS/GRANTS) | ✅ | ⏳ | High |
| 2026-01-18 | CASCADE delete on booking_table_assignments FKs | ✅ | ⏳ | High |
| 2026-01-17 | Add table_soft_holds for race condition prevention | ✅ | ⏳ | Medium |
| 2025-12-27 | Add FK: booking_table_assignments.booking_id → bookings.id | ✅ | ⏳ | High |

---

## Migration Details

### 2026-03-23: Remove built-in lunch/dinner occasion time windows

**Status**: ✅ Staging (2026-03-23) | ✅ Production (2026-03-23)  
**Priority**: High  
**Migration File**: `supabase/migrations/20260323132600_remove_builtin_occasion_time_windows.sql`

#### Problem

Built-in `lunch` and `dinner` occasion rows were imposing global time windows on top of restaurant service periods, which caused production slot generation to stop too early for venues like Old Crown.

#### SQL to Apply

Apply the full migration file: `supabase/migrations/20260323132600_remove_builtin_occasion_time_windows.sql`

#### Verification

After applying:

```sql
SELECT key, availability
FROM public.booking_occasions
WHERE key IN ('lunch', 'dinner')
  AND deleted_at IS NULL
ORDER BY key;
```

Expected: both rows return `[]` for `availability`.

#### Rollback

```sql
UPDATE public.booking_occasions
SET availability = CASE key
  WHEN 'lunch' THEN '[{"kind":"time_window","start":"11:30","end":"15:30"}]'::jsonb
  WHEN 'dinner' THEN '[{"kind":"time_window","start":"16:00","end":"23:00"}]'::jsonb
  ELSE availability
END,
updated_at = timezone('utc', now())
WHERE key IN ('lunch', 'dinner')
  AND deleted_at IS NULL;
```

### 2026-03-23: Set Old Crown interval to 30 minutes

**Status**: ✅ Staging (2026-03-23) | ✅ Production (2026-03-23)  
**Priority**: Medium  
**Migration File**: `supabase/migrations/20260323135000_set_old_crown_interval_30m.sql`

#### Problem

The Old Crown Girton production row was still pinned to `15` minute reservation intervals even after the slot logic and default config moved to `30` minute intervals.

#### SQL to Apply

Apply the full migration file: `supabase/migrations/20260323135000_set_old_crown_interval_30m.sql`

#### Verification

After applying:

```sql
SELECT slug, reservation_interval_minutes
FROM public.restaurants
WHERE slug = 'the-old-crown-girton';
```

Expected: `reservation_interval_minutes = 30`

#### Rollback

```sql
UPDATE public.restaurants
SET reservation_interval_minutes = 15,
    updated_at = timezone('utc', now())
WHERE slug = 'the-old-crown-girton';
```

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

---

## Promotion safety workflows (`scripts/db/safe-run.ts`)

Every remote database workflow runs through `pnpm db:<workflow>` and the safe runner in
`scripts/db/safe-run.ts`. `--dry-run` always means "print the exact plan and run nothing".
The workflows below were added for the release pipeline; the refusal model of the runner is
unchanged: an unknown workflow, an unsupported flag, a missing target or a failed guard exits
with status 2 before any child process starts.

| Command                                | Target                    | What it proves                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm db:link`                         | `staging` or `production` | Runs `supabase link --project-ref <expected ref for DB_TARGET_ENV>` (production requires `CONFIRM_PRODUCTION=true`) and refuses afterwards unless `supabase/.temp/project-ref` names that ref. The committed link state is staging, so `Protected delivery` runs it before `db:plan-remote` on both targets. |
| `pnpm db:plan-remote`                  | `staging` or `production` | Linked project ref, DB host/user and API URL match the target; migration versions are unique; recorded migrations are immutable; the remote ledger reconciles with local files; then `supabase db push --dry-run --linked`.                                                                                  |
| `pnpm db:sql-regression`               | `staging` only            | Runs the three SQL regression files with synthetic fixtures inside `BEGIN ... ROLLBACK`, verifies the rollback by row counts, and fails on any SQL error.                                                                                                                                                    |
| `pnpm db:check-migration-immutability` | local (target optional)   | Compares sha256 of every file in `supabase/migrations` with `config/db/migration-checksums.json`. `--record --reviewed` appends new files only.                                                                                                                                                              |
| `pnpm db:backup`                       | `staging` or `production` | Delegates to `scripts/db/backup/run.ts --target <env> --identity-env DB_BACKUP_ROLE_URL --bucket $DB_BACKUP_BUCKET` only under the dedicated read-only identity; service-role and deploy credentials are refused and scrubbed.                                                                               |
| `pnpm db:restore-verify`               | scratch project only      | Delegates to `scripts/db/restore/verify.ts --backup-id $RESTORE_VERIFY_BACKUP_ID --project-ref $RESTORE_VERIFY_PROJECT_REF --source <env>`; the staging and production refs are refused as the restore destination.                                                                                          |

### Target validation

All remote workflows added here (and a non-dry-run `migrate`/`push`) validate, before `pnpm validate:env` and before any child:

1. `supabase/.temp/project-ref` (from `SUPABASE_WORKDIR` or the repository) equals the expected
   ref for `DB_TARGET_ENV` (`ndxmivcrehsacuerwxtm` for staging, `vrdiqfudmwydclqpydee` for
   production).
2. `SUPABASE_DB_URL`/`DATABASE_URL`, when present, addresses the same project through
   `db.<ref>.supabase.co` or a `<role>.<ref>` pooler user. `sql-regression` requires it.
3. `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL`, when present, is `https://<ref>.supabase.co`.

`plan-remote` and `sql-regression` then copy `supabase/` (migrations, link state, config) into a
fresh `mkdtemp` directory and hand it to the Supabase CLI with `--workdir`; the same directory
reaches `scripts/db/check-drift.ts` through `DB_ISOLATED_WORKDIR`. Nothing edited mid-run can
change what the CLI sees, and CLI scratch files never land in the repository.

### Refused everywhere

`repair`, `reset`, `wipe`, `squash`, `revert`, `--force`, `--db-url`, `--include-roles`,
`--include-seed`, `--status` and `--version` are refused wherever they appear on the safe-run
command line. `--include-all` is only accepted by `migrate`/`push` under the existing
`CONFIRM_PRODUCTION_INCLUDE_ALL=20260811160000` exception.

### SQL regression pack

Files: `tests/db/terminal-booking-table-release.sql`,
`supabase/tests/mobile_sms_attempt_finalization.sql`,
`supabase/tests/whatsapp_review_notification_ledger.sql`.

- Each file starts with `BEGIN;` (after its header comments), ends with `ROLLBACK;`, carries the marker
  `-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql` and references the
  deterministic fixture identifiers from `scripts/db/migrations/fixtures.ts`. No file selects an
  arbitrary existing record (`LIMIT 1` selection is refused by
  `tests/scripts/db-sql-regression.test.ts`).
- Assertion failures raise `SQLSTATE 'NB001'`. Every negative-test handler lists
  `WHEN SQLSTATE 'NB001' THEN RAISE;` first, so a test can never swallow its own assertion.
  The outer block re-raises any error after a `RAISE NOTICE`, so a failing file always ends
  by raising.
- The runner (`scripts/db/migrations/sql-regression.ts`) owns the transaction: it strips the
  file's wrapper, runs `BEGIN`, the fixtures, the body and `ROLLBACK`, then compares row counts
  of the tracked tables and checks that the fixture restaurants are gone. A difference is an
  unverified rollback and stops the pack.
- **Transactional rollback does not undo external messages.** Rolling back removes ledger
  rows, but an SMS, WhatsApp or email that was actually handed to a provider cannot be
  recalled. Fixtures therefore only create rows that dispatch workers never read (the
  transaction is never committed) and must never call a provider, enqueue a queue message or
  trigger a webhook.

### Backup and restore-verify identity guards

- `DB_BACKUP_ROLE_URL` must use a dedicated role whose name contains `backup`; `postgres`,
  `service_role`, `supabase_admin`, `authenticator`, `anon`, `authenticated` and similar roles
  are refused, as is any URL or password that matches `SUPABASE_DB_URL`, `DATABASE_URL` or
  `SUPABASE_DB_PASSWORD`. The delegate never receives `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_DB_URL`, `DATABASE_URL`, `SUPABASE_DB_PASSWORD` or `SUPABASE_ACCESS_TOKEN`.
- `RESTORE_VERIFY_PROJECT_REF` must be a 20-character project ref that is neither the staging
  nor the production ref; `RESTORE_VERIFY_DB_URL` (the delegate's own variable), when present, must
  address that ref. `RESTORE_VERIFY_BACKUP_ID` names the backup to restore and must be a plain
  identifier. `DB_TARGET_ENV` names the backup **source** (`staging` or `production`) and is
  passed through as `--source`; the destination is always the scratch project, so a production
  source never writes to production.
- `DB_BACKUP_BUCKET` and `RESTORE_VERIFY_BACKUP_ID` reach the delegate command line and are
  therefore restricted to plain identifiers; `REPLACE_ME*` placeholders are treated as
  unconfigured and refused.

### Tests

- `tests/scripts/db-safe-run.test.ts` drives the CLI with fake `pnpm`/`supabase` binaries and a
  private linked workdir: target validation refusals, the refusal list, the `plan-remote` command
  shape (including the isolated workdir and ledger reconciliation), immutability recording and
  detection of a changed applied migration, the backup identity guard with credential scrubbing,
  and `restore-verify` refusing the staging and production refs.
- `tests/scripts/db-promotion-safety.test.ts` unit-tests the helper modules under
  `scripts/db/migrations/**`, the extended drift inventory, and asserts that
  `config/db/migration-checksums.json` still matches the working tree.
- `tests/scripts/db-sql-regression.test.ts` parses the three SQL files (no `LIMIT 1` or
  `gen_random_uuid()` selection, fixture identifiers referenced, `NB001` re-raised ahead of every
  negative-test handler, final re-raise) and runs the regression runner against a fake database
  to prove rollback verification and the any-SQL-error-fails rule.

### Extended drift inspection

`pnpm db:check-drift` now runs `scripts/db/check-drift.ts` inside an isolated workdir with
`DB_DRIFT_SCOPE=extended` by default. After the public schema diff it inventories functions,
grants, RLS policies, constraints, table RLS flags, role settings and default privileges through
the validated `SUPABASE_DB_URL` and compares them with `config/db/schema-inventory.json`. A
missing baseline fails closed; record it from staging with `DB_DRIFT_RECORD_INVENTORY=true` and
commit it. `DB_DRIFT_SCOPE=public` restores the diff-only behaviour.
