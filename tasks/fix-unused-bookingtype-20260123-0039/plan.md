---
task: fix-unused-bookingtype
timestamp_utc: 2026-01-23T00:39:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Remove unused BookingType import

## Objective

We will remove the unused `BookingType` import in the booking route handler so lint passes without altering behavior.

## Success Criteria

- [ ] `src/app/api/bookings/[id]/route.ts` has no unused `BookingType` import.
- [ ] Lint warning for `@typescript-eslint/no-unused-vars` is resolved.

## Architecture & Components

- No architecture changes.

## Data Flow & API Contracts

- No changes.

## UI/UX States

- N/A.

## Edge Cases

- None.

## Testing Strategy

- Lint (existing pre-commit) should pass.

## Rollout

- No feature flags or rollout needed.

## DB Change Plan (if applicable)

- Not applicable.
