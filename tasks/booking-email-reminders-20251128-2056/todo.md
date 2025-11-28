---
task: booking-email-reminders
timestamp_utc: 2025-11-28T20:56:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Locate existing email scheduling code and templates.
- [ ] Confirm environment variables for mail provider present in .env.

## Core

- [x] Fix/implement pre-booking reminder scheduling.
- [x] Fix/implement post-booking review scheduling.
- [ ] Prevent duplicates; handle canceled reservations.
- [x] Implement queue-disabled fallback so reminders/reviews still send.

## Tests

- [x] Add/adjust unit/integration tests for job selection and send triggers (queue on/off).

## Notes

- Assumptions: existing mail transport working; lead/lag durations configurable.
- Deviations: None yet.
