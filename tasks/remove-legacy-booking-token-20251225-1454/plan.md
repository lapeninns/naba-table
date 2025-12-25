---
task: remove-legacy-booking-token
timestamp_utc: 2025-12-25T14:54:29Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Remove legacy booking token usage

## Objective

We will require session recovery access tokens for guest booking access so that manage links use the secure `sr_access` cookie flow instead of legacy confirmation tokens.

## Success Criteria

- [ ] `?token=` is no longer accepted for booking detail access.
- [ ] Manage links and client fetches use session recovery access tokens and/or `sr_access` cookie.
- [ ] Legacy token usage returns a clear error response or redirect.

## Architecture & Components

- `src/app/(public)/bookings/[bookingId]/page.tsx`: remove legacy token parsing; rely on `sr_access` or auth.
- `src/components/features/booking/detail/ReservationDetailClient.tsx`: remove `token` prop usage.
- `reserve/features/reservations/wizard/api/useReservation.ts`: remove `token` query param support.
- `src/app/api/bookings/[id]/route.ts`: remove confirmation-token read path for `GET`.
- `server/emails/bookings.ts`: remove fallback to legacy token in manage links.

## Data Flow & API Contracts

- `GET /api/bookings/:id`
  - Accepts session recovery token via header/query/cookie (existing) or authenticated user.
  - Rejects legacy confirmation token usage (`?token=`) with explicit error.

## UI/UX States

- Booking detail page requires auth or `sr_access` cookie.
- If legacy `token` query is detected, redirect to a recover error page or show an explicit error response.

## Edge Cases

- Access token secret missing: manage links should not fall back to legacy tokens; surface configuration error.

## Testing Strategy

- Update existing booking route tests that cover token query behavior.
- Add/adjust tests for access-token-only flows and legacy token rejection.

## Rollout

- No feature flag requested; change is immediate. Monitor support for legacy links.

## DB Change Plan (if applicable)

- Not applicable.
