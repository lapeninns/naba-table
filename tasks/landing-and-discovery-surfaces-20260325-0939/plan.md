---
task: landing-and-discovery-surfaces
timestamp_utc: 2026-03-25T09:39:00Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: landing-and-discovery-surfaces

## Objective

We will migrate the landing page and restaurant discovery surfaces onto the canonical guest system so guests are clearly oriented toward discovery and booking while authenticated guests entering `/` still go straight to `/guest/dashboard`.

## Success Criteria

- [ ] `/` shows a warm guest-first hierarchy with visible primary discovery/booking CTAs above the fold.
- [ ] Authenticated visits to `/` still redirect to `/guest/dashboard`.
- [ ] `/restaurants` and `/restaurants/[slug]` reuse the same guest shell and component language.
- [ ] Discovery list/detail views expose explicit “book” and “view details” actions plus deterministic empty-state messaging.

## Architecture & Components

- `src/app/(public)/page.tsx`: retain auth redirect, render updated guest-first landing experience.
- `src/components/landing/LandingPage.tsx`: replace legacy landing stack with canonical guest-shell sections.
- `src/components/restaurants/PublicSections.tsx`: migrate list/detail sections to guest primitives and explicit CTA treatment.
- `tests/guest/public-restaurants-pages.test.tsx`: assert hierarchy, CTA labeling, and empty states.
- `tests/e2e/guest-public-marketing.spec.ts` / `tests/e2e/guest-public-pages.spec.ts`: align browser expectations to current guest discovery routes.

## Data Flow & API Contracts

- No API changes; continue using existing server restaurant loaders and Supabase auth session lookup.

## UI/UX States

- Landing: warm hero, guided discovery, trust signals, primary CTA above fold.
- Restaurants list: discovery summary, explicit “Book now” and “View details” actions, calm empty state.
- Restaurant detail: aligned guest shell, experience summary, explicit booking/detail/trust CTAs.

## Edge Cases

- Empty restaurant list should render a calm empty state with a recovery CTA.
- Missing restaurant slug continues to use `notFound()`.
- Missing restaurant imagery should fall back to guest-system placeholders.

## Testing Strategy

- RED/GREEN targeted Vitest for public restaurants pages.
- Update targeted Playwright guest public specs for landing/discovery assertions.
- Final validation: `npx vitest run --maxWorkers=9`, `pnpm typecheck`, `pnpm lint`.

## Rollout

- No feature flag; route-level guest UI replacement only.
- Verify live browser on `http://localhost:3000` for `/`, `/restaurants`, and `/restaurants/[slug]`.
