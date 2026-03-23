---
task: weekend-afternoon-booking-500
timestamp_utc: 2026-03-23T11:27:26Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify the public booking path and the weekend boundary mismatch risk

## Core

- [x] Preserve schedule-selected booking type in the reservation draft
- [x] Canonicalize booking type from the matched schedule slot in `POST /api/bookings`

## Tests

- [x] Add regression coverage for preserved booking type
- [x] Run focused tests and type/lint verification

## Notes

- Assumptions:
  - Weekend 15:00-17:00 failures are caused by service inference drift near lunch/dinner boundaries.
- Deviations:
  - No route-level unit test was added; the regression coverage focuses on the draft builder while the route change was verified with lint/typecheck.
