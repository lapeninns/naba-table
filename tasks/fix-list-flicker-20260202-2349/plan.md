---
task: fix-list-flicker
timestamp_utc: 2026-02-02T23:49:14Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix list flicker

## Objective

We will stabilize virtualized list rendering and animations so Ops Customers, Ops Bookings, and Ops Dashboard lists no longer flicker, especially for short lists, and fix `/app` redirects to the Ops sign-in page.

## Success Criteria

- [ ] No visible flicker on short lists during scroll or realtime refresh.
- [ ] Long lists retain smooth scroll performance.
- [ ] Focus/keyboard interactions remain intact.
- [ ] `/app` routes redirect to `/app/auth/signin` when unauthenticated.
- [ ] Scroll remains smooth on long lists (no animation jank).

## Architecture & Components

- `CustomersTable`: gate row animations, reduce re-measure triggers.
- `BookingsList`: gate row animations, reduce re-measure triggers on status updates.
- `BookingsTable`: gate row animations, reduce re-measure triggers on status updates.
- Use `motion/react` for list-row mount animations (opacity only).
- Use translate3d positioning for virtualized rows; container-level motion only.
- `src/app/app/(app)/layout.tsx` + related ops routes: standardize auth redirect target.

## Data Flow & API Contracts

- N/A.

## UI/UX States

- Loading / Empty / Success (no flicker on success state).

## Edge Cases

- Realtime updates with short lists.
- Switching between mobile/desktop (layout changes).

## Testing Strategy

- Manual QA in Chrome DevTools (required) on customers and bookings pages.
- Validate scroll + focus behavior.

## Rollout

- No feature flag; small UI behavior fix.

## DB Change Plan (if applicable)

- N/A.
