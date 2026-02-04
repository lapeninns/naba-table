---
task: fix-ops-booking-card-media-query
timestamp_utc: 2026-02-04T19:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix Ops Booking Card Media Query Hydration

## Requirements

- Functional:
- Avoid SSR hydration mismatch caused by media query evaluation during render.
- Preserve responsive mobile/desktop behavior for ops booking cards.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No behavior regressions; minimal layout shift during hydration.

## Existing Patterns & Reuse

- `src/components/features/dashboard/cards/OpsBookingCard.tsx` uses a local `useMediaQuery` hook.

## External Resources

- None.

## Constraints & Risks

- Must keep SSR markup stable between server and client.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Initialize media query state to a deterministic value on the server and update via `useEffect` on the client to avoid hydration mismatches.
