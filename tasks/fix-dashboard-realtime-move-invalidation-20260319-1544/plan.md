---
task: fix-dashboard-realtime-move-invalidation
timestamp_utc: 2026-03-19T15:44:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix dashboard realtime move invalidation

## Objective

We will make dashboard realtime invalidation fire when a booking update matches either the old or new booking identity so that moved bookings disappear from and appear on the correct ops dashboard immediately.

## Success Criteria

- [ ] Booking moves off the current date still invalidate the source dashboard.
- [ ] Booking moves into the current date still invalidate the destination dashboard.
- [ ] Same-date updates continue to invalidate normally.
- [ ] Focused automated coverage exists for the payload-matching rule.

## Architecture & Components

- `src/hooks/ops/useOpsTodaySummary.ts`: keep the subscription ownership here.
- Optional small pure helper alongside the hook or in `src/utils/ops/` if needed for direct tests.
- Add a focused regression test in `tests/utils/` or `tests/hooks/` depending on the final helper shape.

## Data Flow & API Contracts

- No external contract changes.
- Internal realtime matching should consider both `payload.old` and `payload.new` identities.

## Edge Cases

- Update keeps the same restaurant/date.
- Update changes date only.
- Update changes restaurant only.
- Insert/delete payloads where only one side exists.

## Testing Strategy

- Add focused regression coverage for the move case.
- Run the focused test file plus `pnpm typecheck`.

## Rollout

- No rollout change; bugfix only.

## DB Change Plan (if applicable)

- None.
