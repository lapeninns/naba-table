---
task: homepage-nav-spacing
timestamp_utc: 2025-12-11T14:17:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Homepage navigation & spacing refresh

## Objective

We will enable visitors to understand and navigate the homepage more clearly by reordering sections by importance and applying consistent spacing.

## Success Criteria

- [ ] Navbar reflects the homepage sections in priority order.
- [ ] Sections share consistent padding/margins across breakpoints.
- [ ] Layout remains accessible and responsive on mobile/tablet/desktop.

## Architecture & Components

- Page: `src/app/(public)/page.tsx` already renders `FactoryHomeClient` inside `MarketingLayout`; changes are isolated to `FactoryHomeClient`.
- Components touched: navbar + section constants + section composition inside `src/components/landing/FactoryHomeClient.tsx`.
- Spacing system: reuse shared `SECTION_SPACING` token and apply uniformly to all major sections (Hero, Metrics, How it works, Benefits, Testimonials, FAQ, CTA); keep ObjectionBand as a slim strip with smaller, but consistent, padding.
- Navigation: reorder `NAV_LINKS` to match section order; ensure `SECTION_IDS` and scroll‑spy still align; keep auth-aware CTAs intact.
- Accessibility: keep sticky header focus/aria, add consistent `scroll-mt` to sections to prevent anchor clipping under sticky nav.

## Data Flow & API Contracts

- N/A (layout/content only)

## UI/UX States

- Mostly static; ensure anchor navigation/focus remains usable; mobile menu open/close states unchanged.

## Edge Cases

- Sticky nav overlay on anchor jumps — mitigated with `scroll-mt`.
- Auth redirect stays unchanged (server-side).

## Testing Strategy

- Manual pass on homepage to verify nav links scroll to correct sections on desktop + mobile.
- Quick axe/keyboard sweep to ensure focus-visible and skip-by-anchor works.
- If time allows, run `pnpm run lint` (no codegen changes expected).

## Rollout

- Feature flag: not adding; small UX refinement.
- Exposure: ship directly after verification.
- Monitoring: Lighthouse budgets (unchanged).
- Kill-switch: revert `FactoryHomeClient` changes if regressions found.

## DB Change Plan (if applicable)

- N/A
