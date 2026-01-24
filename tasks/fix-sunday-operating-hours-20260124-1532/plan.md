---
task: fix-sunday-operating-hours
timestamp_utc: 2026-01-24T15:32:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Sunday Operating Hours

## Objective

We will align booking RPC day-of-week logic with stored operating hours so Sunday bookings succeed when configured.

## Success Criteria

- [ ] `create_booking_with_capacity_check` accepts Sunday bookings when Sunday hours are configured.
- [ ] No regression for other days (Monday–Saturday).

## Architecture & Components

- DB function: `public.create_booking_with_capacity_check` in `supabase/migrations/20260120_fix_booking_rpc_type_casts.sql`.

## Data Flow & API Contracts

- RPC request/response unchanged; only internal day-of-week calculation.

## UI/UX States

- N/A (no UI change).

## Edge Cases

- Sunday with override closed should still be rejected.
- Timezone conversion should remain correct.

## Testing Strategy

- Add/update a unit/integration test (if existing harness) to assert Sunday booking passes with Sunday hours configured.
- Verify by calling RPC in staging after migration (per policy).

## Rollout

- No feature flag; safe schema/function fix.
- Monitoring: watch booking errors for `BOOKING_OUTSIDE_OPERATING_HOURS` in logs.

## DB Change Plan (if applicable)

- Target envs: staging → production (window: per maintainer).
- Backup reference: confirm snapshot/PITR prior to prod apply.
- Dry-run evidence: `artifacts/db-diff.txt`.
- Rollback plan: revert function to previous definition in a new migration.
