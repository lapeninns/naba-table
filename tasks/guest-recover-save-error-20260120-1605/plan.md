---
task: guest-recover-save-error
timestamp_utc: 2026-01-20T16:05:16Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest booking recovery save error

## Objective

We will enable guests using recovery links to save booking updates without errors so they can manage bookings reliably.

## Success Criteria

- [ ] Booking updates succeed from recovery-link sessions without redirecting to error pages.
- [ ] API responses for recovery flow return expected success/error payloads.

## Architecture & Components

- Route handler: `src/app/(public)/bookings/recover/route.ts`
- Booking page: `src/app/(public)/bookings/booking-page.tsx`
- Booking update API: `src/app/api/bookings/[id]/route.ts`
  - Adjust cookie domain handling in recover route to avoid invalid `domain` on non-root hosts.

## Data Flow & API Contracts

- PUT/PATCH to `/api/bookings/[id]` must accept session recovery token (cookie or header) and return success JSON.
- Errors should use existing `{ error, code }` shape.

## UI/UX States

- Loading / Error / Success handled by existing booking detail client.

## Edge Cases

- Expired or invalid recovery token should surface a recoverable message, not a global error.
- Root domain env includes `www.` or does not match preview/custom host.

## Testing Strategy

- Unit: consider adding focused test for session recovery token handling (if test infra exists).
- Manual: reproduce recovery flow and update booking.

## Rollout

- No new flags; deploy with existing behavior.

## DB Change Plan (if applicable)

- N/A
