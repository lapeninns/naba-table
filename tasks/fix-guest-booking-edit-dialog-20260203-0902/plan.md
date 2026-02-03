---
task: fix-guest-booking-edit-dialog
timestamp_utc: 2026-02-03T09:02:53Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix guest booking edit dialog for email link access

## Objective

Enable guests opening booking links from email (new device) to edit/cancel reservations without ops provider errors, while keeping ops edit flows intact.

## Success Criteria

- [ ] Public booking detail page no longer throws `useOpsServices must be used within an OpsServicesProvider`.
- [ ] Guest edit uses `/api/bookings/:id` update as before.
- [ ] Ops edit still uses ops booking service updates.

## Architecture & Components

- `components/dashboard/EditBookingDialog.tsx`
  - Extract shared UI into a base component that accepts a mutation interface.
  - `EditBookingDialog` now dispatches to guest/ops subcomponents based on `mode`.
  - No call site changes required; existing `mode="ops"` continues to route to ops logic.

## Data Flow & API Contracts

- Guest: `useUpdateBooking` → `PUT /api/bookings/:id`
- Ops: `useOpsUpdateBooking` → ops booking service update

## UI/UX States

- No visible changes; dialog behavior should remain the same.

## Edge Cases

- Public route without ops provider must not invoke ops hooks.
- Ops routes must remain wrapped in `OpsServicesProvider`.

## Testing Strategy

- Manual: open booking detail link as guest; open edit dialog; ensure no errors in console.
- Ops: open ops bookings and edit dialog; ensure update flow still works.
- Accessibility: confirm dialog focus/keyboard behaviors unchanged (DevTools).

## Rollout

- No flag required; change is internal wiring only.

## DB Change Plan (if applicable)

- Not applicable.
