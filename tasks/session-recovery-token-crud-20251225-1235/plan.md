---
task: session-recovery-token-crud
timestamp_utc: 2025-12-25T12:46:33Z
owner: github:@maintainers
reviewers: [github:@web-core]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Guest Booking CRUD via Session Recovery Access Token

## Objective

Enable a guest who receives a booking confirmation email to **manage (view/edit/cancel)** their booking using the new HMAC session recovery access token, without requiring an authenticated account session.

## Success Criteria

- [ ] Email “Manage booking” links use the session recovery access token (when configured).
- [ ] Guest can view booking detail without login after clicking the link.
- [ ] Guest can edit/cancel booking from the booking detail page using the same token.
- [ ] Existing authenticated flows and ops flows remain unchanged.
- [ ] Tests cover token auth paths for GET/PUT/DELETE.

## Architecture & Components

- Token generation: `server/emails/bookings.ts`
  - Create access token from booking record using `createSessionRecoveryAccessToken`.
  - Prefer token-based manage link; fall back to confirmation token when token secret missing.
- Token capture: `GET /bookings/recover` (route handler)
  - Validates access token and sets `sr_access` httpOnly cookie.
  - Redirects to `next` path (default: `/bookings/<id>`).
- Booking detail UI: `src/app/(public)/bookings/[bookingId]/page.tsx`
  - Allows access when authenticated OR `sr_access` cookie present OR legacy `token` query present.
  - Enables manage UI actions when authenticated OR `sr_access` cookie present.
- API authorization:
  - `GET /api/bookings` reads access token from cookie (enables token mode without query/header).
  - `GET/PUT/DELETE /api/bookings/[id]` accept access token from cookie/header/query and authorize booking ownership.

## Data Flow & Contracts

- Cookie:
  - Name: `sr_access`
  - Value: session recovery access token (HMAC signed)
  - Properties: `httpOnly`, `secure`, `sameSite=lax`, `path=/`, `maxAge` derived from token expiry.
- API token sources (priority):
  1. `x-session-recovery-token` header
  2. Query `access_token` / `accessToken`
  3. Cookie `sr_access`

## UI/UX States

- If access token missing/invalid/expired:
  - Booking page should redirect to sign-in or show an “access expired” error (server APIs return 401/410 with codes).
- While editing/cancelling:
  - Existing dialogs handle loading/errors; ensure errors are user-friendly.

## Edge Cases

- Token secret not configured:
  - Email should fall back to legacy confirmation token manage link.
  - Token capture route returns 503 with a stable code.
- Token valid but booking does not match token identity:
  - Return 403 and do not leak booking details.
- Booking pending/self-serve locked or in past:
  - Preserve existing logic and user-facing messaging.

## Testing Strategy

- Unit/integration via Vitest:
  - `src/app/api/bookings/[id]/route.test.ts`:
    - GET works with `sr_access` cookie when unauthenticated.
    - PUT works with `sr_access` cookie without `requireSession`.
    - DELETE works with `sr_access` cookie without auth.
  - Optional: lightweight unit test around email manage URL generation (ensures link format + fallback).

## Rollout

- Required env:
  - `SESSION_RECOVERY_ACCESS_TOKEN_SECRET` (must be set to enable token links)
  - `SESSION_RECOVERY_ACCESS_TOKEN_TTL_SECONDS` (configure to match desired email validity window)
- Recommended rollout:
  - Deploy with secret configured in staging.
  - Validate token flows, then enable in production.

## Security Notes

- Treat access tokens as secrets; never log them.
- Keep error responses generic (no PII), but include stable `code` fields.
