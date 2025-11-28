---
task: booking-edit-save-error
timestamp_utc: 2025-11-28T14:20:15Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking edit fails to save

## Requirements

- Functional: resolve the booking edit flow error that blocks saving changes and shows “Unable to save changes / Cannot read properties of undefined (reading 'map')”.
- Non-functional: avoid regressions in booking forms; maintain accessibility and existing UX patterns.

## Existing Patterns & Reuse

- Booking edit UI uses `EditBookingDialog` (components/dashboard/EditBookingDialog.tsx) which calls the `useUpdateBooking` hook.
- `useUpdateBooking` performs optimistic updates by mapping over cached booking list data; similar hooks (`useCancelBooking`, `useOpsCancelBooking`) already guard against missing `items` arrays before mapping.

## External Resources

- None yet (internal code investigation first).

## Constraints & Risks

- Potential data-shape mismatches between client and API responses.
- Hidden dependencies with booking availability/slots logic.
- React Query prefix `queryKeys.bookings.all` matches both list and detail queries; optimistic map assumes `items` exists and currently throws when detail data lacks `items`.

## Open Questions (owner, due)

- What specific booking payload triggers the undefined `map` access? (owner: agent, due: next step)
- Which component or API layer is responsible for mapping bookings? (owner: agent, due: next step)
  - Resolved: `useUpdateBooking` optimistic cache update maps over `data.items` from all `bookings` queries, including detail queries without `items`.

## Recommended Direction (with rationale)

- Limit optimistic updates to list-shaped cache entries and guard against missing `items` before mapping—mirror the defensive pattern in `useCancelBooking` to prevent runtime errors while still keeping list caches fresh.
