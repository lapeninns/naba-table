---
task: fix-booking-time-validation
timestamp_utc: 2025-12-24T00:15:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm reproduction path for `2025-12-24T24:02:56` input and current failing behavior.
- [x] Locate existing tests for booking time validation helpers.

## Core

- [x] Normalize hour `24` inputs to next-day `00:mm:ss` in `zonedDateTimeToUtc` (or equivalent helper).
- [x] Preserve existing error handling for invalid formats and timezones.
- [x] Ensure logging remains consistent for wrapped errors.

## UI/UX

- [ ] Not applicable (server-side change).

## Tests

- [x] Add unit tests for `24:xx:xx` normalization.
- [x] Add/confirm tests for invalid hour/minute rejection.
- [x] Run targeted test suite (bookings) or relevant subset.

## Notes

- Assumptions: Inputs arrive as ISO-local strings (YYYY-MM-DDThh:mm:ss) and timezone is a valid IANA identifier.
- Deviations: None yet.

## Batched Questions

- None currently.
