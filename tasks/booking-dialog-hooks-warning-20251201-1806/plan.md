---
task: booking-dialog-hooks-warning
timestamp_utc: 2025-12-01T18:06:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix useMemo dependency warning in BookingDetailsDialogWrapper

## Objective

Ensure `BookingDetailsDialogWrapper` passes ESLint hooks rules by handling the missing dependency while keeping booking summary behavior unchanged.

## Success Criteria

- [ ] `eslint --max-warnings=0` passes with no warnings for the touched file.
- [ ] Booking summary still derives correct date/timezone data for the dialog.

## Architecture & Components

- Modify `src/components/features/bookings/BookingDetailsDialogWrapper.tsx` only; no new components.
- Introduce a derived `startIso` primitive and update the summary `useMemo` dependency array.

## Data Flow & API Contracts

- No API changes. Derived `summary` continues to include `date`, `timezone`, `restaurantId`, and totals placeholder.

## UI/UX States

- No UI changes expected; dialog rendering logic remains controlled by existing props.

## Edge Cases

- When `startIso` is absent, fallback to today’s date remains intact.
- Ensure additional dependency does not trigger unnecessary re-render loops.

## Testing Strategy

- Run targeted ESLint on the modified file.
- (UI unchanged) Manual UI QA not required; note in verification if omitted.

## Rollout

- No feature flags; direct commit once lint passes.
