---
task: homepage-factory-revamp
timestamp_utc: 2025-12-10T22:22:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Homepage Factory-style revamp

## Objective

Bring the live homepage to parity with the Factory landing design (hero + floating search, live feed, bento metrics, receipts feature block) while keeping shared marketing chrome and auth-aware CTAs.

## Success Criteria

- [ ] Homepage renders Factory-styled hero, metrics, live feed, feature, and footer content.
- [ ] Auth-aware CTA remains (Sign In vs My Bookings) and Find a Table links to `/restaurants`.
- [ ] Scoped Factory tokens do not alter other routes; no new console errors or a11y regressions.
- [ ] Screenshots for desktop + mobile saved in task artifacts.

## Architecture & Components

- New client component `FactoryHomeClient` under `src/components/landing/` encapsulating hero/search, live feed carousel, bento metrics, feature block, and footer rows using scoped `FACTORY_THEME` CSS variables.
- `src/app/(public)/page.tsx` remains server-side for auth detection; renders `MarketingLayout` wrapping `FactoryHomeClient` with `isAuthenticated` prop.
- Reuse atoms (Icon, Button, Badge, SearchBar, MetricTile, Modal, Toast) from the reference implementation; ensure inputs have `id`/`name` for a11y.
- Keep shared `GuestBackground`/`ThemeProvider` via MarketingLayout; avoid modifying other layouts.

## Data Flow & State

- Static data arrays for feed/metrics; client state cycles live feed every ~3s.
- Auth flag passed from server to toggle CTA text/target.

## UI/UX States

- Responsive: single column on mobile; 3-col bento grid on md+.
- Motion: `prefers-reduced-motion` respected (animations disabled).
- A11y: labels for search inputs; focusable buttons; semantic headings.

## Testing Strategy

- `pnpm lint`.
- Manual QA via Chrome DevTools MCP: desktop + mobile viewport; check console/network; capture screenshots.

## Rollout

- No flags; single page revamp. No backend/DB changes.

## DB Change Plan

- Not applicable.
