---
task: update-manager-notification-phones
timestamp_utc: 2026-04-15T16:54:06Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm canonical storage field for manager SMS destination numbers.
- [x] Confirm production environment file and target venue slugs.

## Core

- [x] Read current production values for affected restaurants.
- [x] Normalize requested numbers to `E.164`.
- [x] Update the four production rows.
- [x] Re-read production rows and confirm the stored values.

## Tests

- [x] Record automated verification evidence in `verification.md`.

## Notes

- Assumptions:
  - User intends Corner House input `7476415818` as a GB mobile number.
- Deviations:
  - No codepath change is required; this is a scoped production data correction.

## Batched Questions

- None.
