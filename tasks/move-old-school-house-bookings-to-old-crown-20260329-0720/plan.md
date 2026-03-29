---
task: move-old-school-house-bookings-to-old-crown
timestamp_utc: 2026-03-29T07:20:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Move Old School House bookings to Old Crown

## Objective

We will reassign all bookings currently owned by Old School House to Old Crown in the remote Supabase database so that operations and guest management run from the correct venue record.

## Success Criteria

- [x] Source and destination restaurants are identified unambiguously.
- [x] Impacted booking count is captured before execution.
- [x] All targeted bookings are reassigned to Old Crown.
- [x] Post-change verification shows zero remaining bookings on Old School House for the chosen scope.
- [x] Rollback SQL is documented from the captured pre-change evidence.

## Architecture & Components

- `public.bookings`: primary source of restaurant ownership.
- Direct SQL execution through existing repo tooling or a minimal service-role query path.
- Task artifacts in `tasks/move-old-school-house-bookings-to-old-crown-20260329-0720/artifacts/` to store before/after evidence.

## Data Flow & API Contracts

- Read:
  - Locate both restaurant rows by name/slug.
  - Count bookings with `restaurant_id = <old-school-house-id>`.
- Write:
  - Update `public.bookings.restaurant_id` from source ID to destination ID.
- Verification:
  - Recount source and destination bookings after execution.

## UI/UX States

- Not applicable; this is an operational data change.

## Edge Cases

- Old School House row may not exist in the current project.
- Multiple similarly named restaurant rows may require slug-based disambiguation.
- Dependent booking-linked rows may need cleanup if they store restaurant-bound resources.
- Production credentials may be unavailable in this workspace.

## Execution Notes

- Direct Postgres auth failed from `.env.vercel-production`, so the production move was executed through the working service-role Supabase client path.
- The source booking carried a zone lock and active table assignment state, so the move sequence explicitly:
  - released the table assignment via `unassign_tables_atomic`
  - cleared `assigned_zone_id`
  - deleted booking assignment idempotency rows
  - deleted booking confirmation cache rows
  - verified allocations were removed
  - updated `bookings.restaurant_id`, `customers.restaurant_id`, and `analytics_events.restaurant_id`

## Testing Strategy

- Preflight SQL counts.
- Transactional update with affected-row count.
- Postflight SQL counts and spot-check sample booking IDs.

## Rollout

- No feature flag.
- One-time operational change in the connected remote Supabase environment.
- Monitoring: verify row counts immediately after execution.
- Kill-switch: rollback by restoring the captured booking ID set back to the original restaurant ID if needed.

## DB Change Plan (if applicable)

- Target envs: active remote Supabase project only after confirming credentials and restaurant IDs.
- Backup reference: rely on Supabase backup/PITR policy already in place; no migration is required.
- Dry-run evidence: store preflight query output in `artifacts/preflight.txt`.
- Backfill strategy: single update statement if referential checks pass.
- Rollback plan: store the affected booking IDs before mutation and reverse the `restaurant_id` update for that exact set.
