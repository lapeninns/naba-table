---
task: slot-logic-production-rollout
timestamp_utc: 2026-03-23T13:45:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Slot Logic Production Rollout

## Objective

We will align production booking-slot behavior with the config-driven logic already merged on `main` so that built-in occasion windows no longer override restaurant timing and Old Crown uses 30-minute slots.

## Success Criteria

- [ ] Production built-in `lunch` and `dinner` occasion availability are empty.
- [ ] Production Old Crown interval is `30`.
- [ ] Repo contains canonical migrations for both data changes.
- [ ] Push to `origin/main` completed with rollout notes captured.

## Architecture & Components

- App code: already merged on `main`; no new runtime code changes planned in this rollout.
- Data change 1: `supabase/migrations/20260323132600_remove_builtin_occasion_time_windows.sql`
- Data change 2: `supabase/migrations/20260323135000_set_old_crown_interval_30m.sql`
- Verification: production snapshots stored in task artifacts.

## Data Flow & API Contracts

- No API contract changes in this rollout.

## UI/UX States

- Not applicable; no UI changes.

## Edge Cases

- Restaurants without explicit service periods may expose missing timing gaps once the built-in occasion windows are removed.
- Old Crown Sunday dinner remains capped by its configured `17:00-21:00` service period after rollout.

## Testing Strategy

- Verify existing local automated coverage remains green for slot logic.
- Verify production data state before and after rollout.

## Rollout

- No feature flag.
- Sequence:
  1. Add canonical migration for Old Crown interval.
  2. Push repo changes to `origin/main`.
  3. Apply production data updates to the confirmed production Supabase project.
  4. Record verification artifacts and update migration log.
- Kill-switch:
  - Restore built-in occasion availability windows.
  - Restore Old Crown interval to `15` if emergency rollback is required.

## DB Change Plan

- Target envs: staging already aligned manually; production apply in this task.
- Backup reference: Supabase-managed production project; no destructive schema change.
- Dry-run evidence: production before-state snapshot in task artifacts.
- Backfill strategy: not applicable; row-level updates only.
- Rollback plan:
  - Reset `booking_occasions.availability` for `lunch` and `dinner` to the prior production windows.
  - Reset Old Crown `reservation_interval_minutes` to `15`.
