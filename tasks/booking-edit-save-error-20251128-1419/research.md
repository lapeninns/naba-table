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
- Inline modification auto-assign reuses a constant idempotency key (`mod-inline-<bookingId>`); when the selected table set changes, `assign_tables_atomic_v2` rejects with idempotency mismatch (P0003), blocking save.
- Booking retains `assigned_zone_id` after clearing table assignments; `assign_tables_atomic_v2` raises “locked to zone” when inline auto-assign quotes a different zone.

## Open Questions (owner, due)

- What specific booking payload triggers the undefined `map` access? (owner: agent, due: next step)
- Which component or API layer is responsible for mapping bookings? (owner: agent, due: next step)
  - Resolved: `useUpdateBooking` optimistic cache update maps over `data.items` from all `bookings` queries, including detail queries without `items`.

## Recommended Direction (with rationale)

- Limit optimistic updates to list-shaped cache entries and guard against missing `items` before mapping—mirror the defensive pattern in `useCancelBooking` to prevent runtime errors while still keeping list caches fresh.
- Generate a hold-scoped idempotency key for inline modification auto-assign so each table set uses a unique key and avoids idempotency mismatch.
- When clearing assignments, also clear `assigned_zone_id` so reassignment can legally pick a new zone.
