---
task: fix-reservation-token
timestamp_utc: 2025-12-11T09:48:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Preserve confirmation token in guest close path

## Objective

Ensure guest users who finish a booking and click close are redirected to a thank-you/receipt URL that includes their confirmation token so they can view/manage the booking without logging in.

## Success Criteria

- [ ] safeReturnPath includes confirmation token when available after booking completion.
- [ ] Guest close action reaches receipt/management page without auth prompt.
- [ ] Authenticated flow remains unchanged.

## Architecture & Components

- `reserve/features/reservations/wizard/hooks/useReservationWizard.ts`: adjust safeReturnPath computation.
- Any helper util constructing thank-you/receipt URLs (TBD).

## Data Flow & API Contracts

- Booking completion returns booking `id` and `confirmationToken` (existing); close action uses safeReturnPath to redirect.

## UI/UX States

- Close action after success should route to thank-you/receipt view with token; fallback to previous public thank-you page if token missing.

## Edge Cases

- Booking without token returned.
- Authenticated user closing flow should still work.
- Initial details already contained token.

## Testing Strategy

- Unit/logic: adjust existing tests for `useReservationWizard` if present or add new one.
- Manual sanity via app routing if time.

## Rollout

- No feature flag; localized change.
- Monitor for regressions in booking close path.

## DB Change Plan (if applicable)

- N/A.
