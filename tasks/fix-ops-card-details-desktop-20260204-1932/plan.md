---
task: fix-ops-card-details-desktop
timestamp_utc: 2026-02-04T19:32:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops Booking Card Details Desktop Visibility

## Objective

We will keep ops booking card details visible on desktop while preserving mobile collapse behavior and DOM stability.

## Success Criteria

- [ ] Desktop renders details section without toggling.
- [ ] Mobile collapse still hides/reveals details correctly.
- [ ] No hydration mismatch introduced.

## Architecture & Components

- `src/components/features/dashboard/cards/OpsBookingCardDetails.tsx`: restore `forceMount` on `CollapsibleContent`.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- Desktop: details always visible.
- Mobile: details hidden when collapsed, visible when expanded.

## Edge Cases

- Ensure `CollapsibleContent` remains mounted to prevent DOM swaps.

## Testing Strategy

- Manual QA (Chrome DevTools MCP) on ops bookings list.
- Optional: quick visual check on desktop + mobile breakpoints.

## Rollout

- No feature flags; refactor-only UI change.
- Monitor for layout regressions.

## DB Change Plan (if applicable)

- Not applicable.
