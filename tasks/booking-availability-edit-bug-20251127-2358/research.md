---
task: booking-availability-edit-bug
timestamp_utc: 2025-11-27T23:58:37Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking availability editing bug

## Requirements

- Functional:
  - Guest/customer should be able to open “Edit booking” on `/bookings/[id]` and see available times for the restaurant/date.
  - Availability should load without the “Unable to load availability” destructive alert when restaurant info exists.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing modal accessibility; no regression to ops dashboard flow.
  - Avoid exposing secrets; rely on existing APIs.

## Existing Patterns & Reuse

- EditBookingDialog disables availability when `restaurantSlug` is falsy (`missingScheduleMetadata`), showing the exact error seen in the screenshot.
- ScheduleAwareTimestampPicker requires a non-empty `restaurantSlug` to fetch `/restaurants/{slug}/schedule`.
- ReservationDetailClient (guest view) builds `bookingDto` via `buildBookingDto`, sourcing `restaurantSlug` from reservation data → venue.slug → DEFAULT_VENUE.slug.
- `DEFAULT_VENUE.slug` comes from env (`RESERVE_DEFAULT_RESTAURANT_SLUG`) and defaults to an empty string.
- `GET /api/bookings/[id]` (authenticated path) currently returns only the booking row (no restaurants join), so `reservationAdapter` yields `restaurantSlug = null` for signed-in users; token path does include restaurants.slug.

## External Resources

- None yet; all context is within repo.

## Constraints & Risks

- Schedule API only accepts restaurant slug; missing slug blocks availability fetch.
- DEFAULT_VENUE slug may be empty if env not set, so fallback is ineffective.
- Changing API response shape requires updating route tests and mocks.

## Open Questions (owner, due)

- Q: Do any environments lack restaurant.slug values in the DB? (Would still fail even after API join.) — Owner: TBD, Due: after fix rollout.

## Recommended Direction (with rationale)

- Ensure `GET /api/bookings/[id]` always returns restaurant metadata (name, slug, timezone) for authenticated requests, matching token path shape.
- Propagate restaurant slug (and timezone if available) through `reservationAdapter` → `buildBookingDto` so EditBookingDialog always receives `restaurantSlug`.
- Add test coverage for the authenticated GET path to assert restaurant info is included, preventing regressions.
