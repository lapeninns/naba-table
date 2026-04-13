---
task: fix-phone-only-manage-link
timestamp_utc: 2026-04-13T11:59:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix Phone-Only Manage Link

## Objective

We will make guest manage links work for ops bookings that were created with only a phone number so that staff-created walk-ins can still be managed securely from SMS.

## Success Criteria

- [ ] `buildBookingManageUrl()` returns a recover URL for phone-only bookings instead of `/bookings/recover/error?code=MISSING_ACCESS_TOKEN`.
- [ ] Session-recovery token validation and booking ownership checks accept phone-only tokens and still enforce restaurant/contact ownership.
- [ ] Existing email+phone flows continue to pass.

## Architecture & Components

- `server/security/session-recovery-access-token.ts`: make token payload support one-or-both contact methods and expose a single booking-match helper.
- `server/bookings/manage-url.ts`: allow link creation when at least one contact method exists.
- Guest access route handlers:
  - `src/app/api/bookings/route.ts`
  - `src/app/api/bookings/[id]/route.ts`
  - `src/app/api/bookings/[id]/history/route.ts`
  - `src/app/api/reservations/[id]/confirmation/route.ts`
    Use the shared helper so all token-protected surfaces apply the same ownership rule.

## Data Flow & API Contracts

- Token creation input:
  - Required: `restaurantId`, `secret`
  - Contact: at least one of `email` or `phone`
- Token payload:
  - `restaurantId`
  - optional `email`
  - optional `phone`
- Booking access rule:
  - restaurant must match
  - every contact field present in the token must match the booking
  - token must contain at least one contact field

## UI/UX States

- Broken-link error route remains unchanged for genuinely missing contact data.
- Phone-only bookings now resolve to the normal `/bookings/recover?...` flow.

## Edge Cases

- Email-only bookings should remain valid if encountered elsewhere in the system.
- Tokens with neither contact method must be rejected.
- Bookings with blank email but present phone must still be accessible through token-authenticated GET/PUT/DELETE/history/confirmation paths.

## Testing Strategy

- Unit:
  - session-recovery token payload creation/validation
  - manage-link generation for phone-only vs no-contact bookings
- Integration:
  - route-level guest access check for phone-only token matching

## Rollout

- No feature flag; low-surface regression fix in the canonical path.
- Monitoring:
  - watch for `MISSING_ACCESS_TOKEN` and `INVALID_ACCESS_TOKEN` guest-link errors after deploy.
- Kill-switch:
  - revert the token contract/helper change if guest access mismatches appear.
