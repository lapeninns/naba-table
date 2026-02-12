---
task: fix-ops-booking-card-media-query
timestamp_utc: 2026-02-04T19:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Ops Booking Card Media Query Hydration

## Objective

We will ensure `OpsBookingCard` renders consistent markup between SSR and client hydration to avoid mismatches on mobile.

## Success Criteria

- [ ] No hydration mismatch when loading `/app/dashboard` on mobile viewports.
- [ ] Mobile/desktop layouts still switch correctly after hydration.

## Architecture & Components

- `src/components/features/dashboard/cards/OpsBookingCard.tsx`: update local `useMediaQuery` hook.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- Initial render uses a deterministic non-mobile layout; transitions to mobile layout on client once media query is evaluated.

## Edge Cases

- Ensure hook unsubscribes correctly from `matchMedia` listeners.

## Testing Strategy

- Manual: load ops dashboard on mobile viewport and watch for hydration warnings.

## Rollout

- No feature flag; small refactor only.
