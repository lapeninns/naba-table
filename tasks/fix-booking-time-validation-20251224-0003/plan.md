---
task: fix-booking-time-validation
timestamp_utc: 2025-12-24T00:15:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix booking time validation midnight handling

## Objective

Allow booking validation to correctly handle midnight inputs provided as `24:xx:xx` by normalizing to the next day while preserving existing validation semantics.

## Success Criteria

- `zonedDateTimeToUtc` handles `2025-12-24T24:02:56` without throwing and returns the intended instant (next-day `00:02:56` in the provided timezone).
- Other invalid times (e.g., `25:00:00`, malformed strings) still throw clear errors.
- Unit coverage added for the `24:xx:xx` normalization and invalid cases; existing tests remain green.

## Architecture & Components

- Touch `server/bookings/pastTimeValidation.ts`, specifically the timezone conversion helper that parses ISO-local strings.
- Reuse existing date/time formatting utilities; avoid introducing new dependencies.

## Data Flow & API Contracts

- Booking API continues to call `assertBookingNotInPast` which delegates to `zonedDateTimeToUtc`; adjust only the conversion logic, keeping the outward contract unchanged.
- Errors remain wrapped as `PastBookingError` where applicable.

## UI/UX States

- Not applicable (server-side validation change only).

## Edge Cases

- Inputs with hour `24` and valid minutes/seconds should normalize to the next day at `00:mm:ss`.
- Inputs with hour greater than `24` or invalid minute/second values should continue to throw.
- Preserve behavior for leap seconds and daylight-saving transitions (no special handling beyond current logic).

## Testing Strategy

- Add targeted unit tests for `zonedDateTimeToUtc` and/or `assertBookingNotInPast` covering `24:xx:xx` normalization and invalid-hour rejection.
- Run existing test suite relevant to bookings if present.

## Rollout

- No feature flags; ship as a small, scoped fix.
- Monitor booking validation logs after deploy for unexpected errors.

## DB Change Plan (if applicable)

- Not applicable (no DB changes).
