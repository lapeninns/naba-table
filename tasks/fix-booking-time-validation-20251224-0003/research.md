---
task: fix-booking-time-validation
timestamp_utc: 2025-12-24T00:15:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix booking time validation midnight handling

## Requirements

- Functional: Booking validation must accept midnight inputs that arrive as `24:xx:xx` by normalizing to the next day's `00:xx:xx` before timezone conversion; keep rejecting truly invalid times.
- Non-functional: Error logging remains clear; unit coverage added for the edge case.

## Existing Patterns & Reuse

- Booking past-time checks live in `server/bookings/pastTimeValidation.ts` and are reused by booking APIs; adjust the shared helper rather than duplicating logic.
- Timezone handling currently relies on `zonedDateTimeToUtc` built atop `Date` parsing of ISO-local strings; prefer enhancing this helper for the new case.
- `assertBookingNotInPast` validates `startTime` with a `^\d{2}:\d{2}(:\d{2})?$` regex, so inputs like `24:02:56` pass initial format checks before hitting `new Date()` and throwing.

## External Resources

- None yet.

## Constraints & Risks

- Must not regress existing validation for valid times, timezones, or grace-period overrides.
- Keep `PastBookingError` semantics and messaging stable.
- Normalize hour `24` inputs while ensuring other invalid formats still surface as errors.

## Open Questions (owner, due)

- Should all `24:xx:xx` inputs normalize to next-day midnight or only `24:00:00`? (owner: github:@assistant, resolved: normalize all `24:xx:xx` to next-day `00:xx:xx`)
- Are there other call sites constructing local times that could bypass this helper? (owner: github:@assistant)

## Recommended Direction (with rationale)

- Normalize hour `24` inputs to `00` of the following day before timezone conversion to avoid `Invalid date value for timezone conversion` while honoring intended booking time.
- Add unit coverage around `zonedDateTimeToUtc`/`assertBookingNotInPast` to guard the edge and prevent regression.
