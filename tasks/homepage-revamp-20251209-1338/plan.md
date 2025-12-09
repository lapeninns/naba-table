---
task: homepage-revamp
timestamp_utc: 2025-12-09T13:38:00Z
owner: github:@factory-droid
reviewers:
  - github:@maintainers
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Homepage Revamp

## Objective

Deliver a marketing homepage that mirrors the provided design system atoms/molecules (tokens, NavBar-inspired hero, MetricTile, ProfileCard/DataTable mashups) while keeping the same routes/CTAs into bookings/auth flows.

## Success Criteria

- [ ] Hero, proof, walkthrough, and CTA sections use spacing/typography/radii defined in `DesignSystem.md` (no arbitrary colors outside token palette).
- [ ] Primary CTAs still link to `/restaurants`, `/auth/signin`, `/guest/bookings` with accessible buttons.
- [ ] Page renders responsively (mobile-first) and passes Chrome DevTools MCP checks (a11y/perf) with no console errors.

## Architecture & Components

- `src/components/landing/design-system/` (new directory) to host marketing-specific wrappers:
  - `HeroSection`: NavBar-inspired header with tagline, SearchBar-like form, and supporting imagery built from `ProfileCard`/`MetricTile` cues.
  - `MetricsStrip`: grid of `MetricTile` derivatives showing KPIs to build trust.
  - `ExperienceShowcase`: combination of `ProfileCard` + `DataTable` styling to highlight workflow clarity.
  - `FinalCTA`: large rounded panel referencing tokens for backgrounds/buttons.
- `src/app/(public)/page.tsx` becomes a thin composition layer importing these sections + metadata.

## Data Flow & API Contracts

- Static client-side components; no async data fetching required.
- Section props contain static content arrays (metrics, steps). Keep them in `page.tsx` or extracted constants near component definitions for clarity.

## UI/UX States

- Hero search CTA replicates SearchBar behavior (dummy form) with accessible labels.
- Metrics+steps use semantic headings (h2/h3) and list semantics for steps.
- CTA includes `aria-live` only if dynamic states introduced (not planned now).

## Edge Cases

- Small screens: ensure grids collapse to single column and maintain spacing tokens.
- Reduced motion: rely on token-defined transitions; no custom animations needed.
- Dark mode: marketing pages currently light-only via `MarketingLayout`; ensure colors still readable.

## Testing Strategy

- Manual QA via Chrome DevTools MCP on `/` for keyboard/focus/responsive/perf snapshot (attach artifacts in `verification.md`).
- `pnpm run lint` + `pnpm run test` to ensure no regressions.

## Rollout

- No feature flag; direct replacement on `Guest-Side-Frontend` branch.
- Monitor landing analytics (not part of code) once deployed; fallback is git revert if KPIs drop.
