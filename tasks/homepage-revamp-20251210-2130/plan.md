---
task: homepage-revamp
timestamp_utc: 2025-12-10T21:30:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Homepage Layout Revamp

## Objective

Elevate the marketing homepage so guests immediately see value and actions: visually rich hero with dual CTA, proof of speed/reliability, and a clearer journey + receipts story that feels premium while staying within the design system.

## Success Criteria

- [ ] Primary hero shows clear CTA to `/restaurants` and secondary to `/guest/bookings` with accessible focus order.
- [ ] Above-the-fold includes a visual rail (cards/illustration) that reduces perceived text density.
- [ ] Proof band combines metrics + live feed in a scannable grid without regressing Core Web Vitals.
- [ ] All sections responsive (mobile-first) with keyboard navigation and ARIA where needed.

## Architecture & Components

- Rework `HomeHeroSection` to a two-column grid: headline/benefits + action cluster; right rail with stacked cards (live pill, mini availability board, trust chips) using existing `Card`, `Badge`, `Button`.
- Merge `HomeMetricsSection` + parts of `HomeTrustedSection` into a **Proof/Trust band** with metrics, live feed, and partner highlights.
- Update `HomeJourneySection` to a **timeline/story grid** with numbered steps and reassurance sidebar.
- Keep `HomeReceiptsSection` but tighten copy and emphasize receipt preview card; align CTA band for final action.
- No new primitives; reuse tokens/utilities from design system + `GuestBackground` theme.

## Data Flow & API Contracts

- Static data arrays remain in `HomeSections.tsx`; no new API calls. Keep `isAuthenticated` from Supabase for CTA variant.

## UI/UX States

- Loading: N/A (static content).
- Empty/Error: N/A (static content).
- Success: page renders with enhanced layout; CTAs route correctly.

## Edge Cases

- Authenticated users still see "View my bookings" CTA and Sign in hidden.
- Mobile: ensure vertical stacking with sensible order; avoid overlapping gradients.
- Reduce motion respect `prefers-reduced-motion` (use existing classes).

## Testing Strategy

- Manual QA via Chrome DevTools MCP: mobile/tablet/desktop, focus order, Lighthouse/a11y quick check.
- Sanity click-through of CTAs to `/restaurants` and `/guest/bookings`.
- Visual scan for CLS-free layout; check keyboard tabbing across CTA cluster and cards.

## Rollout

- No feature flag; landing page swap is safe. If issues, revert the component file.

## DB Change Plan (if applicable)

- Not applicable (UI-only).
