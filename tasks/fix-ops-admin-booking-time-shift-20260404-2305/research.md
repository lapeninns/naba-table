---
task: fix-ops-admin-booking-time-shift
timestamp_utc: 2026-04-04T23:05:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix Ops Admin Booking Time Shift

## Requirements

- Functional:
  - Editing a booking from ops admin must preserve the venue-local time selected in the UI.
  - Non-time edits such as notes or party size must not rewrite `start_time` / `end_time` one hour earlier.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep the fix on the canonical ops update route under `src/app/api/ops/bookings/[id]/route.ts`.
  - Preserve existing auth, membership checks, and validation behavior.
  - Use the restaurant timezone rather than runtime-local `Date` accessors.

## Existing Patterns & Reuse

- `src/app/api/bookings/[id]/route.ts` already converts dashboard edit payloads with `convertIsoToVenueDateTime(...)` and `convertOptionalIsoToVenueDateTime(...)`.
- `server/bookings/timezoneConversion.ts` centralizes ISO-to-venue-local conversion with Luxon.
- `reserve/shared/formatting/bookingDateTime.ts` already proves the UTC-to-venue-local expectation for London DST cases.

## External Resources

- None needed beyond the existing repo timezone helpers and Luxon usage.

## Constraints & Risks

- The failing path is the ops-admin PATCH route, not the guest booking update route.
- The bug affects both explicit time edits and note-only edits because `end_time` is also derived with runtime-local `Date#getHours()`.
- The route has two validation paths (legacy and unified); the fix must feed correct venue-local `booking_date`, `start_time`, and `end_time` into both.

## Open Questions (owner, due)

- None. The failure mode is reproducible from code inspection and earlier verified DST examples.

## Recommended Direction (with rationale)

- Replace runtime-local `Date` clock extraction in `src/app/api/ops/bookings/[id]/route.ts` with the existing venue-local Luxon conversion helpers.
- Add a focused route regression test that proves a `2026-07-01T18:30:00.000Z` payload for `Europe/London` stores `19:30`, and that note-only edits preserve the existing end time in venue-local clock time.
