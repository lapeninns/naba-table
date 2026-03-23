---
task: old-crown-weekend-slot-alignment
timestamp_utc: 2026-03-23T12:33:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Old Crown Weekend Slot Alignment

## Objective

We will align Old Crown's live slot generation with the already-configured weekend lunch service periods so that weekend lunch uses 30-minute intervals through the intended afternoon window.

## Success Criteria

- [ ] Old Crown restaurant config uses `30` minute reservation intervals.
- [ ] Friday lunch remains `12:00-14:30` at 30-minute intervals.
- [ ] Saturday and Sunday lunch expose `15:00`, `15:30`, `16:00`, and `16:30`.
- [ ] Dinner still starts at `17:00`.

## Architecture & Components

- Live data update:
  - `restaurants.reservation_interval_minutes` for Old Crown
  - `booking_occasions.availability` for `lunch`
- Canonical record:
  - Supabase migration documenting the shared lunch availability correction

## Data Flow & API Contracts

- No API contract changes.
- Schedule reads continue through `getRestaurantSchedule`.

## UI/UX States

- No UI component changes.

## Edge Cases

- Other venues with explicit lunch service periods ending before `17:00` should remain constrained by service-period coverage.
- The schedule layer still does not enforce service-period-end buffering against the end of lunch; current verification is limited to visible slot generation.

## Testing Strategy

- Remote schedule snapshots for Old Crown on:
  - Friday `2026-03-27`
  - Saturday `2026-03-28`
  - Sunday `2026-03-29`
- Focus on visible slot values and disabled states around `14:30-17:00`.

## Rollout

- Apply live config correction directly to the remote environment in one pass.
- Verify immediately with schedule queries.
- Keep a canonical migration in repo for future environment alignment.

## DB Change Plan (if applicable)

- Target envs: current remote environment only for immediate correction.
- Backup reference: not captured in repo; keep change narrowly scoped to one restaurant row and one occasion row.
- Dry-run evidence: before/after snapshots recorded in task artifacts.
- Backfill strategy: none.
- Rollback plan:
  - Old Crown interval back to `15`
  - Lunch occasion availability back to `11:30-15:30`
