---
task: revamp-restaurants-page
timestamp_utc: 2025-11-23T00:38:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Restaurants Page Revamp

## Objective

We will enable visitors to browse restaurants with a clearer, high-conversion layout so they can quickly compare options and start a reservation.

## Success Criteria

- [ ] Page passes a11y checks (keyboard, landmarks, labels) with 0 critical axe issues
- [ ] Above-the-fold LCP ≤ 2.5s on mobile throttling
- [ ] Key actions (view details / reserve CTA) are obvious and usable
- [ ] Layout responsive down to 360px and up to desktop widths

## Architecture & Components

- Keep existing navbar and footer components.
- Page shell: layered background with constrained content width (`max-w-6xl`), sticky sub-nav anchor linking to directory.
- Hero stack: headline, subcopy, stats/USPs row, CTA group with “Browse now” anchor + secondary booking history.
- Restaurant section: framed panel with new header bar (title + mini filter summary + support hint) wrapping existing `RestaurantBrowser`.
- Reuse shadcn primitives already present (Badge, buttonVariants) and Tailwind utilities; no new deps.

## Data Flow & API Contracts

- Uses existing data fetch from `listRestaurants()` and `RestaurantBrowser` query; no API contract changes.
- Cards continue to display name/timezone/capacity CTA; layout-only uplift, no data requirements.

## UI/UX States

- Loading/empty/error already handled inside `RestaurantBrowser`; keep but ensure headings/ARIA wiring and descriptive copy above.

## Edge Cases

- Missing visuals: component already text-only; ensure text wrapping in hero and stat pills.
- Long names/addresses wrap without breaking layout.
- No restaurants available → existing empty state; ensure top-level section still communicates support options.

## Testing Strategy

- Manual QA via browser (Chrome DevTools MCP) desktop + mobile emulation; verify keyboard focus order and anchors.
- Quick axe or equivalent a11y check if available; otherwise manual labels/roles review.
- Visual inspection for CLS and responsive behavior (360px, 768px, ≥1280px).

## Rollout

- No feature flag; page-level change only.
- Capture before/after screenshots in `artifacts/` for comparison.

## DB Change Plan (if applicable)

- None (UI-only)
