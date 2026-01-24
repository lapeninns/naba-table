---
task: fix-lunch-pass-availability
timestamp_utc: 2026-01-23T17:05:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Lunch pass availability within extended service period

## Requirements

- Functional:
  - Allow booking a lunch pass at 15:15 on Sunday when lunch service period is 12:00-17:00.
  - Keep existing closing-time/last-seating and duration constraints intact.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI regression; validation remains deterministic and consistent across client/server.

## Existing Patterns & Reuse

- `server/booking/BookingValidationService.ts` validates slot availability and operating window.
- `reserve/shared/schedule/availability.ts` contains client-side guards (past/closing).
- Service periods defined in `restaurant_service_periods` and read via `server/restaurants/servicePeriods.ts`.

## External Resources

- N/A

## Constraints & Risks

- Must follow existing schedule/slot generation rules and not expand availability outside configured service periods.
- Potential mismatch between slot generation, default duration, and last-seating buffer could still prevent 15:15.

## Open Questions (owner, due)

- What is the configured default duration and last-seating buffer for Sunday lunch? (owner: github:@amanshresthaa, due: 2026-01-23)
- Is the block happening in the guest reserve flow or an admin/pass purchase flow? (owner: github:@amanshresthaa, due: 2026-01-23)

## Recommended Direction (with rationale)

- Inspect schedule slot generation and validation for Sunday lunch to see why 15:15 is disabled; fix the boundary condition or buffer calculation that incorrectly disables mid-window slots.
