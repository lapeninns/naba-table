---
task: booking-details-dialog-revamp
timestamp_utc: 2025-12-28T14:19:53Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Booking Details Lint Fixes

## Objective

We will clear lint errors in booking-details so pre-commit passes without changing behavior.

## Success Criteria

- [ ] ESLint passes with `--max-warnings=0` for the touched files.
- [ ] No UI behavior change observed in a booking details dialog spot check.

## Architecture & Components

- `src/components/features/dashboard/booking-details/BookingDialog.tsx`: adjust import grouping.
- `src/components/features/dashboard/booking-details/utils.ts`: move type imports to top and order them.
- `src/components/features/dashboard/booking-details/hooks/useTableAssignment.ts`: update useMemo dependencies to include `context`.

## Data Flow & API Contracts

- No changes.

## UI/UX States

- No changes.

## Edge Cases

- Ensure memoized capacity calculations recompute when assignment context changes.

## Testing Strategy

- Lint the changed files or run the full lint task.
- Manual UI QA via Chrome DevTools MCP if required by policy.

## Rollout

- No feature flags or staged rollout.

## DB Change Plan (if applicable)

- Not applicable.
