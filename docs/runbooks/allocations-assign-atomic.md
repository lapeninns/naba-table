# Runbook: Allocations & Assign Atomic

## Overview

This runbook covers database migrations that enforce conflict-safe table allocations, the new `assign_tables_atomic` / `unassign_tables_atomic` RPCs, and the backfill required to hydrate the `allocations` table in shadow mode.

## Feature Flags

| Flag                             | Scope | Default | Notes                                                                                                                          |
| -------------------------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `FEATURE_ALLOCATIONS_DUAL_WRITE` | env   | `false` | Enables real-time writes to `public.allocations` (set `true` in staging for dual-write, keep `false` in prod until validated). |
| `FEATURE_RPC_ASSIGN_ATOMIC`      | env   | `false` | Switches server helpers to the atomic RPC.                                                                                     |
| `FEATURE_ASSIGN_ATOMIC`          | env   | `false` | Enables the ops manual assignment route to call the atomic RPC.                                                                |

All three flags must be enabled to move the ops workflow onto the atomic path.

## Deployment Steps

1. **Apply migration** `20251018154000_conflict_safe_allocations.sql` to Supabase.
2. **Verify RPC availability**:
   ```sql
   SELECT routine_name
   FROM information_schema.routines
   WHERE routine_schema = 'public'
     AND routine_name IN ('assign_tables_atomic', 'unassign_tables_atomic');
   ```
3. **Run SQL integration check**:
   ```bash
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/allocations_atomic.sql
   ```
   This script provisions ephemeral bookings and asserts overlap conflicts roll back cleanly.
4. **Execute shadow backfill** (optional but recommended before enabling conflicts in production):
   ```bash
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/utilities/backfill_allocations.sql
   ```
   Review the row count emitted by the script to confirm allocations were mirrored 1:1.
5. **Enable feature flags** incrementally:
   - Staging: set all three flags to `true` and restart the app.
   - Production: enable `FEATURE_ALLOCATIONS_DUAL_WRITE`, monitor overlap metrics, then enable `FEATURE_RPC_ASSIGN_ATOMIC` + `FEATURE_ASSIGN_ATOMIC` once confident.
6. **Monitor**:
   - Supabase logs for `allocations_resource_window_excl` violations.
   - API `409` responses from `/api/ops/bookings/:id/tables`.
   - Table assignment success telemetry (if available).

## Backfill Notes

- Backfill operates in _shadow_ mode; new rows are inserted with `shadow = true` so that previously scheduled conflicts are observable without blocking workflows.
- The atomic RPC always writes `shadow = false`; rollbacks caused by conflicts remove all allocations to prevent residue.

## Rollback

1. Disable feature flags (set all three flags `false`).
2. Drop atomic RPCs and restore legacy schema using the companion rollback script (create if needed) or manually:
   ```sql
   DROP FUNCTION IF EXISTS public.unassign_tables_atomic(uuid, uuid[], uuid);
   DROP FUNCTION IF EXISTS public.assign_tables_atomic(uuid, uuid[], tstzrange, uuid, text);
   -- Re-create legacy columns if required (see migration for details).
   ```
3. Remove allocations generated in dual-write testing if they should not persist:
   ```sql
   DELETE FROM public.allocations WHERE shadow = false;
   ```
4. Revert application changes (routes + services) if necessary.

## Related Artifacts

- Migration: `supabase/migrations/20251018154000_conflict_safe_allocations.sql`
- SQL backfill: `supabase/utilities/backfill_allocations.sql`
- SQL integration test: `supabase/tests/allocations_atomic.sql`
- Frontend flag behaviour: `src/components/features/dashboard/BookingDetailsDialog.tsx`
