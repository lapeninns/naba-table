---
task: booking-manage-pdf-cancel-fixes
timestamp_utc: 2026-02-12T18:21:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking Manage/PDF/Cancel Consistency Fixes

## Objective

We will fix booking detail reliability so guests can download confirmation PDFs, avoid broken confirmation-step navigation, and see cancellation reflected instantly so cancelled bookings cannot be edited.

## Success Criteria

- [ ] PDF download works from booking detail for authenticated and session-recovery access.
- [ ] Confirmation step 4 no longer renders "Manage booking" CTA.
- [ ] Cancelling a booking immediately disables edit/cancel controls without reload.
- [ ] API returns stable error when trying to update a cancelled booking.

## Architecture & Components

- `reserve/features/reservations/wizard/hooks/useConfirmationStep.ts`: remove secondary manage action generation.
- `hooks/useCancelBooking.ts`: synchronize reservation detail query cache on cancel.
- `src/app/api/reservations/[id]/confirmation/route.ts`: allow session-recovery auth path.
- `src/app/api/bookings/[id]/route.ts`: fail fast on cancelled bookings for update handlers.

## Data Flow & API Contracts

Endpoint: `GET /api/reservations/:id/confirmation`

- Request auth: supabase user session OR valid session-recovery token.
- Response: PDF bytes.
- Errors: `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_ACCESS_TOKEN`, `ACCESS_TOKEN_EXPIRED`, `BOOKING_NOT_FOUND`.

Endpoint: `PUT /api/bookings/:id`

- New invariant: cancelled bookings return `409 BOOKING_CANCELLED`.

## UI/UX States

- Confirmation step action bar: only "Start a new booking".
- Booking detail after cancel: status updates to cancelled immediately; action buttons disabled.

## Edge Cases

- Expired/invalid recovery token for PDF route.
- Cancel mutation failure rollbacks reservation detail cache.

## Testing Strategy

- Unit/behavioral via existing test harness where available.
- Manual UI verification in browser + Chrome DevTools MCP checks for network/auth results.

## Rollout

- No feature flag; direct bug fix rollout.
- Monitor error codes for `BOOKING_CANCELLED` and confirmation PDF route 401/403 regression.

## DB Change Plan (if applicable)

- No DB schema change.
