---
task: fix-replay-ops-card-hydration
timestamp_utc: 2026-02-04T19:07:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Replay Guard + Booking Card Hydration

## Objective

Ensure Replay is disabled on ops routes across client-side navigation, and eliminate SSR hydration mismatch in ops booking cards.

## Success Criteria

- [ ] Replay stops when navigating into `/app` routes; no Replay on ops pages.
- [ ] Booking card renders same DOM on server and initial client render (no hydration mismatch warnings).
- [ ] Existing behavior and a11y preserved.

## Architecture & Components

- `src/instrumentation-client.ts`: add Replay guard on route transitions.
- `src/components/features/dashboard/cards/OpsBookingCard.tsx`: avoid conditional wrapper swap.
- `src/components/features/dashboard/cards/OpsBookingCardDetails.tsx`: keep CollapsibleContent consistent.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- Booking card collapse behavior remains; desktop always shows details.

## Edge Cases

- Client-side navigation into `/app` after initial non-ops load.
- Mobile viewport hydration on first paint.

## Testing Strategy

- Manual QA via Chrome DevTools MCP for booking card on mobile/desktop.
- Verify Replay stopping logic with console checks (if feasible).

## Rollout

- No flags; refactor only.
