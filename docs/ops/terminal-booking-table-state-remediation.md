# Terminal booking table-state remediation

This runbook repairs active table state retained by bookings in `cancelled`, `completed`, or
`no_show` without deleting booking history, audit logs, or archived allocations. It must be run
staging-first. Do not use guest names, contact details, booking references, or provider payloads in
queries, logs, tickets, or evidence.

## Preconditions

1. Review and deploy `20260808120000_release_terminal_booking_table_state.sql` to staging with
   `DB_TARGET_ENV=staging pnpm db:migrate`.
2. Run `tests/db/terminal-booking-table-release.sql` against staging and confirm the transaction
   rolls back successfully.
3. Confirm the migration is the only pending database change before production promotion with
   `DB_TARGET_ENV=production pnpm db:status`.
4. Record the target `restaurant_id`, affected date window, reviewer, and rollback owner. Do not
   record guest PII.

## Read-only audit

Run this query first for one restaurant. It reports aggregate state only.

```sql
SELECT
  booking.status,
  count(DISTINCT booking.id) AS stale_bookings,
  count(DISTINCT assignment.id) AS active_assignments,
  count(DISTINCT allocation.id) AS active_allocations
FROM public.bookings AS booking
LEFT JOIN public.booking_table_assignments AS assignment
  ON assignment.booking_id = booking.id
LEFT JOIN public.allocations AS allocation
  ON allocation.booking_id = booking.id
 AND allocation.restaurant_id = booking.restaurant_id
WHERE booking.restaurant_id = '<reviewed-restaurant-id>'::uuid
  AND booking.status IN ('cancelled', 'completed', 'no_show')
  AND (assignment.id IS NOT NULL OR allocation.id IS NOT NULL)
GROUP BY booking.status
ORDER BY booking.status;
```

Audit `checked_in` separately. Do not bulk-close checked-in bookings: they may represent current
physical occupancy. The migrated planner and assignment seam ignore/deactivate their reservation
allocation only when a later assignment for the same table and window is committed.

## Preferred repair through the normal workflow

For a confirmed booking that is missing an assignment because a terminal booking retained the
table, re-run the existing planner/assignment workflow after the migration. The atomic assignment
path will archive and release the terminal booking's active allocation, remove its operational
assignment, and commit exactly one assignment for the confirmed booking. Retry with the same
idempotency key; do not insert assignment rows manually.

Verify by IDs and `restaurant_id` only:

```sql
SELECT
  count(*) AS assignment_count
FROM public.booking_table_assignments AS assignment
JOIN public.bookings AS booking ON booking.id = assignment.booking_id
WHERE booking.id = '<confirmed-booking-id>'::uuid
  AND booking.restaurant_id = '<reviewed-restaurant-id>'::uuid;
```

The expected count is exactly `1` for a single-table plan. A retry must leave the same count.

## Batched cleanup when no replacement assignment exists

Use the idempotent database function, never raw deletes. Run at most 100 bookings per transaction,
scoped to one restaurant, and review the candidate IDs before `COMMIT`.

```sql
BEGIN;
SET LOCAL statement_timeout = '10s';

WITH candidates AS MATERIALIZED (
  SELECT booking.id, booking.restaurant_id
  FROM public.bookings AS booking
  WHERE booking.restaurant_id = '<reviewed-restaurant-id>'::uuid
    AND booking.status IN ('cancelled', 'completed', 'no_show')
    AND (
      EXISTS (
        SELECT 1
        FROM public.booking_table_assignments AS assignment
        WHERE assignment.booking_id = booking.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.allocations AS allocation
        WHERE allocation.booking_id = booking.id
          AND allocation.restaurant_id = booking.restaurant_id
      )
    )
  ORDER BY booking.id
  LIMIT 100
)
SELECT
  candidate.id,
  public.release_booking_table_state(candidate.id, candidate.restaurant_id) AS released_assignments
FROM candidates AS candidate;

-- Repeat the read-only audit in this transaction. COMMIT only when all active counts are zero and
-- matching rows exist in allocations_archive. Otherwise ROLLBACK and investigate.
ROLLBACK;
```

Replace `ROLLBACK` with `COMMIT` only after staging evidence and two-person production review. The
function preserves booking status history and audit logs, archives matching allocation rows before
deleting active allocations, and is safe to retry.

## Production promotion and rollback

1. Promote the reviewed migration with
   `DB_TARGET_ENV=production CONFIRM_PRODUCTION=true pnpm db:migrate`.
2. Run the aggregate audit, then repair one restaurant and one batch at a time.
3. Re-run the normal assignment workflow for confirmed bookings with zero assignments.
4. Verify terminal active counts are zero, allocation archive counts increased as expected, and each
   repaired confirmed booking has exactly one assignment.
5. If verification fails, stop new batches and roll back the current transaction. Do not restore
   archived rows into active tables while the migration is live; investigate the failing booking in
   staging first.
