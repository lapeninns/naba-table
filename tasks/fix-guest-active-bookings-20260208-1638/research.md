---
task: fix-guest-active-bookings
timestamp_utc: 2026-02-08T16:40:57Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix Guest Active Bookings Filter

## Requirements

- Functional:
  - Active guest bookings (`/api/bookings?me=1&status=active`) must exclude bookings whose booking date is before the restaurant-local “today”.
  - Preserve pagination and sorting semantics.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No changes to auth boundaries or data exposure.
  - Keep performance acceptable for typical guest booking volumes.

## Existing Patterns & Reuse

- Guest bookings endpoint: `src/app/api/bookings/route.ts` (`handleMyBookings`).
- Date utilities: `lib/utils/datetime.ts` (`getTodayInTimezone`).
- Booking statuses for “active”: `BOOKING_BLOCKING_STATUSES` in `lib/enums.ts`.

## External Resources

- None.

## Constraints & Risks

- Bookings can span multiple restaurant timezones; filtering must be per-row timezone.
- Supabase/PostgREST cannot easily filter `booking_date` vs per-row timezone in a single query without an RPC/view.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Filter active bookings in the API layer using `getTodayInTimezone(restaurant.timezone ?? 'UTC')` and compare against `booking_date` string.
- For `status=active`, fetch candidate bookings, filter, then paginate in-memory so the list and total counts remain consistent with the filter.
