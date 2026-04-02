---
task: fix-mobile-booking-time-shift
timestamp_utc: 2026-04-02T12:40:07Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix mobile booking time shift

## Requirements

- Functional:
  - Guest-facing booking times must remain correct after ops/admin edits.
  - The mobile guest bookings list must show the venue-local time, not a shifted device/UTC interpretation.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep the change scoped to the existing guest booking list flow.
  - No new dependencies.
  - Preserve current keyboard/navigation behavior.

## Existing Patterns & Reuse

- `src/components/features/booking-state-machine/ScheduleAwareTimestampPicker.tsx` already treats booking edits as venue-timezone-aware and converts to UTC ISO with Luxon.
- `server/bookings/timezoneConversion.ts` correctly converts incoming ISO instants back to venue-local `booking_date` and `start_time`.
- `reserve/shared/formatting/booking.ts` provides timezone-aware formatting helpers, but `BookingListClient` was bypassing them and manually reading time text.

## External Resources

- None needed; existing repo timezone patterns were sufficient.

## Constraints & Risks

- Guest bookings list data can arrive in two shapes:
  - venue-local `YYYY-MM-DDTHH:mm`
  - explicit-offset ISO (`...Z` / `+00:00`)
- Mobile/browser timezone differences can change `new Date(...)` behavior for bare timestamps, so parsing must not depend on device locale.
- Guest surfaces were not normalized consistently:
  - `/api/bookings` returned naive local strings for list items.
  - reservation adapter fallback synthesized ISO strings with browser-local `Date`.
  - guest dashboard/list/receipt/detail surfaces parsed timestamps with inconsistent timezone assumptions.

## Open Questions (owner, due)

- Q: Did the user observe the issue specifically on `/guest/bookings` or another guest surface?
  A: UNCONFIRMED. The bookings list contains a concrete timezone bug matching the reported one-hour shift.

## Recommended Direction (with rationale)

- Add a shared booking datetime normalizer in `reserve/shared` so UI code and reservation adapters use the same timezone rules.
- Normalize guest booking list API responses to emit absolute ISO timestamps (`start_at` / `end_at` or timezone-aware fallback) instead of naive local strings.
- Switch guest list, guest dashboard, receipt, and reservation detail rendering onto the shared parser so all guest-visible surfaces use venue-local time consistently.
- Add regression tests around the helper, guest derivations, adapter fallback, and the original bookings list symptom.
