---
task: booking-edit-save-error
timestamp_utc: 2025-11-28T14:20:15Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking edit fails to save

## Objective

Restore booking edit so changes save successfully without runtime errors when the user edits bookings.

## Success Criteria

- [ ] Booking edit form saves without throwing “Cannot read properties of undefined (reading 'map')”.
- [ ] No regressions to booking availability/slot calculations.

## Architecture & Components

- Identify the booking edit page/component and API route used to persist edits.
- Confirm data flow: form state → `useUpdateBooking` mutation → optimistic cache patch for booking lists.

## Data Flow & API Contracts

- Endpoint: `/api/bookings/:id` (PUT) handled via `useUpdateBooking`.
- Update optimistic cache only for bookings list queries; guard when `items` is absent to avoid mapping undefined.
- Inline modification auto-assign should use a hold/table-set-scoped idempotency key to prevent `assign_tables_atomic_v2` idempotency mismatches when table selections change.

## UI/UX States

- Ensure error handling surfaces meaningful message and preserves form state.

## Edge Cases

- Missing/empty arrays when mapping over booking resources or slots.
- Bookings with no add-ons/guests/slots.
- Cache entries that are detail objects (no `items`) should be skipped during optimistic patch.
- Inline modification retries should not reuse stale idempotency keys across different table sets.

## Testing Strategy

- Reproduce error locally; ensure editing a booking no longer throws.
- Add/adjust unit or integration test covering the optimistic cache path when list data is absent.
- Exercise inline modification flow twice with different table selections to confirm no idempotency mismatch.
- Manual QA via Chrome DevTools per policy.

## Rollout

- Standard deployment; no feature flag expected.
