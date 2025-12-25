---
task: guest-booking-self-edit
timestamp_utc: 2025-12-25T23:28:37Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest self-edit bookings

## Objective

We will enable guests to edit their own bookings (date/time/party/notes) so they can manage changes without ops intervention.

## Success Criteria

- [ ] A logged-in guest can edit a booking that they own (email or auth_user_id match).
- [ ] A guest using a valid recovery link can edit their booking.
- [ ] Edits remain blocked for past bookings and pending-locked bookings.
- [ ] Unauthorized edits return 403 and do not modify data.

## Architecture & Components

- `ReservationDetailClient` (guest booking detail page) already renders `EditBookingDialog` and gates UI via `canManage`.
- `EditBookingDialog` uses `useUpdateBooking` -> PUT `/api/bookings/:id` with `dashboardUpdateSchema`.
- Update authorization in `src/app/api/bookings/[id]/route.ts` to allow guest ownership on dashboard updates:
  - Allow if recovery token is valid (current behavior).
  - Allow if authenticated user owns booking (email or auth_user_id match).
  - Keep ops membership checks as-is for staff updates.

## Data Flow & API Contracts

Endpoint: `PUT /api/bookings/:id`
Request (dashboard schema):
{
startIso: string (ISO w/ offset),
endIso?: string,
partySize: number,
notes?: string | null
}
Response: booking DTO (id, startIso, endIso, partySize, status, notes)
Errors: 401 UNAUTHENTICATED, 403 FORBIDDEN, 422 BOOKING*IN_PAST/PENDING_LOCKED, 400 INVALID*\*.

## UI/UX States

- Existing Edit dialog loading/error states remain.
- If unauthorized, show existing error message from `EditBookingDialog` (FORBIDDEN).

## Edge Cases

- Booking has no customer_email or auth_user_id -> deny guest edit.
- User email case sensitivity -> normalize before comparison.
- Playwright seeded bookings should remain special-cased only if already used elsewhere (do not expand scope).

## Testing Strategy

- Unit/integration: extend `src/app/api/bookings/[id]/route.test.ts` to cover:
  - Guest (authenticated) can update own booking by email.
  - Guest (authenticated) can update own booking by auth_user_id.
  - Guest (authenticated) cannot update someone else’s booking.
- UI: manual edit flow in guest booking detail page.
- Accessibility: verify dialog focus/keyboard interactions still correct.

## Rollout

- No feature flag; deploy directly.
- Monitoring: check booking update errors (403/401) and booking update events.
- Kill-switch: none (rollback via revert if needed).

## DB Change Plan (if applicable)

- No DB changes.
