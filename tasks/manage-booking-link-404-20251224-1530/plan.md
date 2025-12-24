---
task: manage-booking-link-404
timestamp_utc: 2025-12-24T15:30:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Manage booking link returns 404

## Objective

Enable guests to open manage links from emails ( `/bookings/{id}?token=...` ) and see their booking without 404s while preserving token-based access control.

## Success Criteria

- [ ] Opening `/bookings/{id}?token=valid` returns booking data (200) for matching id; page renders details.
- [ ] Invalid or mismatched tokens return structured errors (403/404/410) without leaking PII.
- [ ] Email manage links use the correct public base URL for the deployment environment.

## Architecture & Components

- API route: `src/app/api/bookings/[id]/route.ts` (GET token branch).
- Token logic: `server/bookings/confirmation-token.ts` and creation in `server/bookings.ts`.
- Email link builder: `server/emails/bookings.ts` uses `bookingSiteUrl` envs.
- Client page: `src/app/(public)/bookings/[bookingId]/page.tsx` and `ReservationDetailClient` fetch via `/api/bookings/{id}?token=...`.

## Data Flow & API Contracts

- Request: `GET /api/bookings/{id}?token=...`.
- Success response: `{ booking: { ...public fields..., restaurants: { name, slug, timezone } } }`.
- Error responses: 404 TOKEN_NOT_FOUND, 410 TOKEN_EXPIRED, 403 TOKEN_MISMATCH, 401 UNAUTHENTICATED when no token and not logged in.

## UI/UX States

- Page should render booking detail when token valid.
- On error, client currently shows error alert; ensure status codes map correctly.

## Edge Cases

- Missing token in email link (null confirmation_token).
- Token expired; token mismatched to booking id.
- Domain mismatch causing request to wrong environment.

## Testing Strategy

- Unit/API: exercise GET `/api/bookings/{id}` with valid token, invalid token, mismatched token, expired token (mock expiry), missing token -> unauthenticated.
- Integration/manual: use a real booking with token to load `/bookings/{id}?token=...` locally; verify email link generation host.

## Rollout

- No flags needed; small scoped fix. Validate in staging then production.

## DB Change Plan (if applicable)

- None (read-only checks).
