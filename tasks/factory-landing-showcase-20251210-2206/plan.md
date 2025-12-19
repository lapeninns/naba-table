---
task: factory-landing-showcase
timestamp_utc: 2025-12-10T22:06:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Factory landing reference & screenshot

## Objective

Ship a reference Factory landing page (matching the provided layout) as a `/dev/factory-landing` route, document the design strategy (A/B/C sections), and capture a screenshot artifact without impacting the live home page.

## Success Criteria

- [ ] Narrative doc includes the three provided sections (Visual & Aesthetic Strategy, Technical Architecture, UX).
- [ ] `/dev/factory-landing` renders the supplied layout with scoped Factory tokens and interactive live feed.
- [ ] Screenshot saved to `tasks/factory-landing-showcase-20251210-2206/artifacts/` showing the rendered page.
- [ ] Existing landing experience remains unchanged; lint passes.

## Architecture & Components

- Route: `src/app/dev/factory-landing/page.tsx` (client component entry) to render the Factory layout without touching production marketing components.
- Theme: Local `FACTORY_THEME` object applied via inline CSS variables on the page wrapper to scope tokens (no global overrides).
- Components: Recreate provided atoms/molecules (`Button`, `Badge`, `SearchBar`, `MetricTile`, `Modal`, `Toast`, `Icon`) within the page file for isolation; use existing typography utility classes and design tokens where feasible.
- Layout: Compose NavBar → Hero with floating SearchBar → Bento metrics grid (LiveFeed, MetricTile, stat banner) → Feature section → Footer.
- State: `useState`/`useEffect` animate live feed slot cycling every 3s; no external data fetching.

## Data Flow & API Contracts

- No network calls; static data arrays for metrics/live feed/testimonials.

## UI/UX States

- Responsive grid (single column on mobile, multi-column on md+).
- Live feed highlights active slot; search button wired to no-op callback placeholder.
- Respect `prefers-reduced-motion` and keyboard focus on buttons/inputs.

## Edge Cases

- Small screens: search bar stacks; Bento grid collapses to single column.
- Motion reduction: disable animations under `prefers-reduced-motion`.
- Ensure tokens scoped to wrapper to avoid bleeding into other routes.

## Testing Strategy

- Lint: `pnpm lint`.
- Manual QA: run dev server, load `/dev/factory-landing`, check responsive layout (mobile/desktop) and focusability; capture screenshot via Chrome DevTools/Playwright.

## Rollout

- No flags; dev-only reference page. No DB or Supabase changes.

## DB Change Plan

- Not applicable (no DB changes).
