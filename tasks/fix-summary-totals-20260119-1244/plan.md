---
task: fix-summary-totals
timestamp_utc: 2026-01-19T12:44:09Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Refresh ops summary totals after table unassign

## Objective

We will keep dashboard summary totals accurate after table unassignment changes a booking's status so that ops metrics are correct without realtime updates.

## Success Criteria

- [ ] Unassigning the last table updates summary totals (confirmed/pending) immediately.
- [ ] Non-realtime environments reflect totals without manual refresh.

## Architecture & Components

- `useOpsTableAssignmentActions`: update summary cache totals when status changes or selectively invalidate summary.

## Data Flow & API Contracts

- No API changes; uses existing `bookingService.unassignTable`.

## UI/UX States

- No UI changes.

## Edge Cases

- Unassigning tables when status does not change should not alter totals.
- Booking not present in cached summary should fall back to invalidation.

## Testing Strategy

- Add Vitest hook test covering summary totals update on unassign.
- Manual spot-check in development (if available).

## Rollout

- No feature flag change.

## DB Change Plan (if applicable)

- N/A
