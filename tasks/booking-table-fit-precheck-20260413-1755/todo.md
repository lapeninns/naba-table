---
task: booking-table-fit-precheck
timestamp_utc: 2026-04-13T17:55:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [bookingValidationUnified]
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm current pre-check and planner integration points

## Core

- [x] Add a request-based seatability helper that reuses planner primitives without creating a draft booking
- [x] Invoke the helper from the shared availability service after aggregate capacity passes
- [x] Re-check candidate alternative slots with the same seatability helper
- [x] Thread booking-option context through the guest booking path where already available

## UI/UX

- [x] Expose override dates through the guest calendar-mask payload
- [x] Derive weekend/override advisory copy in the plan-step hook
- [x] Render the advisory as a small informational alert in the plan form
- [x] Add a dev-only alert harness for browser proof when the real public slug is unavailable locally

## Tests

- [x] Add backend seatability regression coverage
- [x] Add advisory helper regression coverage
- [x] Re-run focused guest booking route and review-step tests
- [x] Re-run typecheck

## Notes

- Assumptions:
  - `restaurant_operating_hours.effective_date` overrides are an acceptable proxy for holiday/special-date reminders in the guest plan step.
  - If a venue has no active table inventory, aggregate capacity remains the fallback source of truth.
- Deviations:
  - Local browser proof used dev-only harnesses on `localhost:3001` because `localhost:3000` was serving a different app and the local dataset did not contain the target public restaurant slug.
