---
task: fix-lunch-pass-availability
timestamp_utc: 2026-01-23T17:05:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Lunch pass availability within extended service period

## Objective

We will allow guests to book lunch passes at valid times (e.g., 15:15) when Sunday lunch is configured for 12:00-17:00 so that extended service periods are honored.

## Success Criteria

- [ ] 15:15 appears as a valid lunch slot on Sundays with lunch period 12:00-17:00.
- [ ] Server-side validation accepts 15:15 with standard lunch duration and buffer rules.
- [ ] No lunch slots outside the configured period become available.

## Architecture & Components

- `server/booking/BookingValidationService.ts`: server validation for slots and operating window.
- `server/bookings/timeValidation.ts`: schedule window bounds and slot checks.
- `reserve/shared/schedule/availability.ts`: client-side past/closing guard.
- `reserve/features/reservations/wizard/services/timeSlots.ts`: slot descriptors and disabled flags.

## Data Flow & API Contracts

- Existing booking schedule API provides slots with disabled flags and window opens/closes.
- No contract changes expected.

## UI/UX States

- Loading / Error / Available slots with disabled states.

## Edge Cases

- Last seating buffer or duration pushes latest start before 17:00 (e.g., 90-minute default duration).
- Timezone boundary on Sundays.

## Testing Strategy

- Unit: validate schedule slot disabling logic and server-side time validation.
- Integration: booking validation for lunch pass 15:15 on Sunday.
- E2E/UI: reserve flow slot selection.

## Rollout

- No feature flag; small bug fix.
- Verify in staging then production.

## DB Change Plan (if applicable)

- N/A
