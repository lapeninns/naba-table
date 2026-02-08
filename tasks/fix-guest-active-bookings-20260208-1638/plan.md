---
task: fix-guest-active-bookings
timestamp_utc: 2026-02-08T16:40:57Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Guest Active Bookings Filter

## Objective

Ensure the guest “active” bookings query excludes past bookings by applying a restaurant-local date filter.

## Success Criteria

- [ ] `/api/bookings?me=1&status=active` returns only bookings with `booking_date >= today` in the booking’s restaurant timezone.
- [ ] Pagination totals and `hasNext` match the filtered dataset.

## Architecture & Components

- Update `handleMyBookings` in `src/app/api/bookings/route.ts`.
- Use `getTodayInTimezone` from `lib/utils/datetime.ts`.

## Data Flow & API Contracts

- Input: existing query params (status, page, pageSize, etc.).
- Output: unchanged shape; filter applied server-side for `status=active`.

## UI/UX States

- N/A (API change only).

## Edge Cases

- Missing restaurant timezone → fallback to `UTC`.
- Mixed timezones in a guest’s bookings.

## Testing Strategy

- Targeted manual check: simulate `status=active` with past and future bookings.
- If automated coverage exists for guest bookings list, update accordingly.

## Rollout

- No flag change.
- Monitor for guest booking list regressions.
