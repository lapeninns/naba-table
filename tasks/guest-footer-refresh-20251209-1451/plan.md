---
task: guest-footer-refresh
timestamp_utc: 2025-12-09T14:51:00Z
owner: github:@factory-droid
reviewers:
  - github:@maintainers
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Footer Refresh

## Objective

Deliver a cohesive, token-driven footer for guest-facing surfaces so visitors receive consistent navigation, trust, and support cues aligned with the new design system.

## Success Criteria

- [ ] `components/layout/Footer.tsx` matches the visual language (spacing, color, typography) defined in `DesignSystem.md`.
- [ ] All `(public)` marketing pages and guest shells render the refreshed footer without layout regressions across breakpoints (mobile/desktop) and states (light/dark theme).

## Architecture & Components

- **Footer component (`components/layout/Footer.tsx`)**: clientless functional component exporting semantic `<footer>` landmark, structured into stacked sections (CTA band, link grid, bottom bar).
  - **CTA band**: headline, subcopy, prominent primary button (reuse `Button` from `components/ui/button` or existing layout button), plus contact info.
  - **Link grid**: maps arrays for Explore / Company / Support into `<nav>` lists with `<a>` elements.
  - **Bottom bar**: copyright, location, and social icon buttons.
- **Integration**: ensure `components/layouts/MarketingLayout` (and any other consumers) continue importing `Footer` without API changes; update additional shells only if necessary.

## Data Flow & API Contracts

- Static data arrays defined within the component for now (links, contact info). No external data sources to keep rendering synchronous.
- If we later externalize, expose props for overriding link groups; not required for current scope.

## UI/UX States

- **Default**: multi-column grid at ≥768px, stacked sections on smaller screens using `flex`/`grid` responsive utilities.
- **Theme**: respects `[data-theme]` tokens; backgrounds use `var(--color-surface-muted)` or gradient derived from tokens.
- **Focus**: interactive elements show `focus-visible` ring defined in tokens.
- **Hover**: text links adjust color using semantic tokens.

## Edge Cases

- Very long link labels: ensure they wrap and maintain spacing.
- Narrow screens: verify column stacking order remains logical for screen readers.
- Users with prefers-reduced-motion: avoid non-token animations.

## Testing Strategy

- Smoke test all guest marketing routes (homepage, restaurants index/detail, booking flows) to confirm footer renders.
- Run `pnpm lint` and `pnpm test` (or targeted subset) to ensure no regressions.
- Manual QA with Chrome DevTools MCP on one representative route capturing console/a11y/perf.

## Rollout

- No feature flags; change is visual and globally applied.
- Monitor analytics dashboards for conversion drop on marketing pages; if issues arise, revert component via git.
