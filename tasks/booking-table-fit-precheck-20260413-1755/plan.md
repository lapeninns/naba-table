---
task: booking-table-fit-precheck
timestamp_utc: 2026-04-13T17:55:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [bookingValidationUnified]
related_tickets: []
---

# Implementation Plan: booking table-fit precheck

## Objective

Use the real table planner during guest availability pre-checks so a slot only passes when the party is actually seatable, then add a soft plan-step advisory for weekends and holiday/special-date overrides.

## Success Criteria

- [x] `checkSlotAvailability()` rejects requests that have aggregate cover capacity but no feasible table plan.
- [x] `findAlternativeSlots()` only returns replacement times that also pass the seatability check.
- [x] The guest plan step shows a non-destructive advisory for weekend and override dates.
- [x] Focused regression tests cover both the backend false-green-light case and the advisory copy logic.

## Architecture & Components

- `server/capacity/seatability.ts`: new request-based helper that reuses table-assignment loaders plus the selector planner to answer “can this request actually be seated?”
- `server/capacity/service.ts`: keep aggregate capacity as the first gate, then call the new seatability helper before reporting a slot as available or suggesting it as an alternative.
- `server/restaurants/calendarMask.ts` + `reserve/features/reservations/wizard/services/schedule.ts`: expose date overrides to the guest plan form.
- `reserve/features/reservations/wizard/hooks/usePlanStepForm.ts` + `PlanStepForm.tsx`: derive and render the advisory inline on step 1.

## Data Flow & API Contracts

- Availability request:
  - aggregate covers/parties check runs first
  - if aggregate check passes, request-based seatability check runs with `restaurantId`, `date`, `time`, `partySize`, and booking option context when available
  - response remains the same externally: `available`, `reason`, `metadata`
- Calendar mask response:
  - existing `closedDaysOfWeek` and `closedDates`
  - new optional `overrideDates` for guest advisory logic

## UI/UX States

- Closed/no-slot dates continue to use the existing warning alert.
- Weekend or override dates show a small `info` alert with confirmation copy.
- The advisory is non-blocking and can appear alongside the regular form state.

## Edge Cases

- No active tables configured: skip seatability enforcement and preserve aggregate-only behavior.
- Fixed 2-tops with enough total covers for 4 guests: must fail seatability when no valid merge exists.
- Override date on a weekday: advisory still appears even though the date is not a weekend.

## Testing Strategy

- Unit/regression: `tests/server/capacity/seatability.test.ts`
- Route regression: `tests/server/public-bookings-route.test.ts`
- UI advisory helper: `tests/reserve/plan-step-advisory.test.ts`
- Existing review-step capacity UI regression: `tests/reserve/review-step-capacity-error.test.tsx`
- Browser proof on dev harnesses via Chrome DevTools MCP

## Rollout

- No feature flag change required; this strengthens the existing canonical pre-check path.
- Validate locally with focused tests and browser harnesses before any deployment.
