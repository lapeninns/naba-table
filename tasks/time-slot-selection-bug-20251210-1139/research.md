---
task: time-slot-selection-bug
timestamp_utc: 2025-12-10T11:39:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Time slot selection shows "Selected time is no longer available" when adjusting time

## Requirements

- Functional: Users selecting a date and then changing time should not get a stale slot error if slot is available; booking form should update available times correctly.
- Non-functional (a11y, perf, security, privacy, i18n): Preserve keyboard selection, loading feedback; no performance regressions in times fetch; no sensitive data exposed; messages i18n consistent.

## Existing Patterns & Reuse

- Booking edit flow uses `components/dashboard/EditBookingDialog.tsx` with `ScheduleAwareTimestampPicker` to drive date/time selection.
- Timestamp picker relies on `fetchReservationSchedule` + `Calendar24Date/Time` primitives from Reserve UI; reuse those rather than new widgets.

## External Resources

- TODO: add if any APIs/specs referenced.

## Constraints & Risks

- Potential caching or state desync between date/time pickers and availability API.
- Risk of modifying booking logic affecting other flows (reschedule/new booking).
- Schedule API currently returns only rows present in `booking_slots`; windows may be sparse or missing, so UI must tolerate incomplete slot lists.

## Open Questions (owner, due)

- What API returns slot availability and how is it invalidated? (owner: assistant, due: before implementation)
- Does issue occur for all services or specific provider? (owner: assistant)
- Should edits allow override times that aren’t in the returned slot list? (owner: assistant)

## Recommended Direction (with rationale)

- Detect when schedule data is sparse (selected/draft time missing from returned slots) and fall back to free-entry/override mode instead of blocking with “Selected time is no longer available”.
- Allow manual time entry/override while keeping suggestions when they match, so edit flows don’t lose times absent from `booking_slots`.
- Keep validation for malformed times; treat missing slot as warning (override copy) rather than hard error.
