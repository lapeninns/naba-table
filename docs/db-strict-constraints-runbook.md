# DB Strict Constraints Runbook

This runbook describes how to safely roll out the 001-004 migrations, enable stricter DB constraints, and rollback if needed.

## Preconditions

- Confirm `SUPABASE_DB_URL` and credentials are configured via env/secret store.
- Ensure app builds green: `pnpm run build`.
- Coordinate a maintenance window (recommended 15-30 minutes for initial rollout).
- Ensure no other schema-changing deployments are in-flight.

## Migration Order

1. Apply `001_blockers.sql`.
2. Apply `002_integrity.sql`.
3. Apply `003_index_triggers.sql`.
4. Apply `004_backfill_staging.sql` (or environment-specific backfill).

Always target staging first, then production.

## Staging Dress Rehearsal

1. Take fresh anonymized snapshot from production into staging.
2. Run 001-004 in order.
3. Validate:
   - All migrations succeed.
   - No new `NOT NULL` or FK violations.
   - `SELECT` from `pg_constraint` and `pg_indexes` confirms:
     - `allocations_no_overlap`, `table_hold_windows_no_overlap` exist.
     - `table_inventory` composite FK exists (even if `NOT VALID`).
     - `booking_slots_available_idx` and other indexes exist.
   - App-level tests:
     - `pnpm run test`.
     - Critical booking flows (create/update/cancel, holds) pass.
4. Observe write contention behavior:
   - Parallel booking creations to the same table/time: one should fail with exclusion violation.
   - Capture error codes for app mapping.

## Production Cutover

1. Announce maintenance window.
2. Scale down workers / cron / background jobs that write bookings/holds.
3. Put API into read-only / degraded mode via feature flags if available.
4. Take backups:
   - Schema-only `pg_dump`.
   - Ensure latest automated base backup exists.
5. Apply migrations 001-004 in order.
6. Post-migration checks:
   - Validate key constraints and indexes exist.
   - Run lightweight integrity queries (no table rewrites).
7. Re-enable workers and normal write traffic.
8. Enable `db_strict_constraints` feature flag in application.

## Rollback Strategy

If a migration fails or causes unacceptable errors:

1. Immediately disable writes at the app layer.
2. Apply `rollback_001_003.sql` to drop added constraints/indexes/triggers.
3. If data is corrupted or behavior incorrect, restore from pre-migration backup following infra playbooks.
4. Keep detailed notes (queries, errors, timings) for root-cause.

## Monitoring & Alerts

- Track rate of:
  - `unique_violation` (23505)
  - `exclusion_violation` (23P01)
- Add alerts if these spike above baseline.
- Watch p95 latency for booking create/update/hold endpoints.

## Notes

- All scripts are designed to be idempotent and safe to rerun.
- Composite FKs use `NOT VALID` initially; run `VALIDATE CONSTRAINT` after data has been cleaned and confirmed.
- Prefer running heavy index builds during off-peak hours.
