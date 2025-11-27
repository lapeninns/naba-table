---
task: availability-metadata-fix
timestamp_utc: 2025-11-27T11:06:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix missing restaurant metadata for availability

## Requirements

- Editing bookings in ops dashboard should load availability without the destructive alert.
- Schedule picker needs a restaurant slug (and timezone) to fetch availability.
- Must preserve booking editing flows for guest/ops views.

## Findings

- The alert "Unable to load availability… missing the restaurant information" is shown in `components/dashboard/EditBookingDialog.tsx` when `effectiveRestaurantSlug` is falsy.
- Ops bookings list data comes from `/api/ops/bookings` and is mapped to `BookingDTO` in `OpsBookingsClient`. The API response currently **omits restaurant slug/timezone** (`restaurants` relation only selects name/reservation_interval_minutes). `OpsBookingListItem` type also lacks slug/timezone.
- `mapToBookingDTO` in `OpsBookingsClient` injects `restaurantSlug` from `activeMembership`, but when the membership lacks `restaurantSlug` (e.g., after switching away from default/fallback restaurant), the dialog disables availability loading.
- Patch responses from `/api/ops/bookings/[id]` also omit restaurant metadata, so cache refreshes keep losing the slug.

## Existing patterns & reuse

- Customer-facing bookings API (`/api/bookings`) already returns `restaurantSlug` and `restaurantTimezone`; we can mirror that shape for ops endpoints.
- `BookingDTO` type (hooks/useBookings.ts) already includes optional `restaurantSlug` and `restaurantTimezone` and is reused by ops flows.

## Constraints & risks

- Ops endpoints must remain backward compatible with existing consumers (ops table, lifecycle actions).
- Changing API shapes requires updating TS types and mappings to avoid runtime/compile errors.
- Need to ensure no PII or secrets in responses; slug/timezone are safe.

## Open questions

- None identified; slug/timezone are required for availability and present in `restaurants` table.

## Recommended direction

Return restaurant slug and timezone from ops booking APIs, propagate through types/services, and map them into the EditBookingDialog props (with membership fallback). This restores availability loading after removing the default restaurant assumption.
