---
task: guest-pages-revamp
timestamp_utc: 2025-12-09T13:50:00Z
owner: github:@factory-droid
reviewers:
  - github:@maintainers
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Public Guest Routes Revamp

## Objective

Rebuild every public guest-facing page so they strictly follow `DesignSystem.md`, starting with restaurant discovery & marketing routes before moving to booking confirmation/detail flows.

## Success Criteria

- [ ] `/restaurants` list page uses design-system hero, search/filter components, and showcases cards built with tokens.
- [ ] `/restaurants/[slug]` + `/restaurants/[slug]/book` surfaces reuse shared components, remain accessible, and keep data intact.
- [ ] Thank-you and booking detail pages continue to support deep links with refreshed layout.
- [ ] All updated pages pass lint/tests + Chrome DevTools MCP audits with artifacts.

## Architecture & Components

- Create `src/components/design-system/public/` directory with:
  - `RestaurantsHero`, `RestaurantsFilters`, `RestaurantsGrid` — powering `/restaurants`.
  - `RestaurantOverview`, `ExperienceTimeline`, `MenuHighlights`, `BookingCTA` — detail page sections.
  - Reusable CTA/metrics modules referencing tokens.
- Introduce supporting data arrays/constants near components (e.g., sample tags, selling points) while preserving actual fetched data via props when available.
- Update each route file to be a composition layer similar to the new homepage.

## Data Flow & API Contracts

- For static marketing sections, use inline stub data.
- For actual restaurant data (if these pages currently fetch from APIs), wrap the new components around existing `fetch` logic—do not change API contracts without coordination.
- Continue using Next.js `generateMetadata`/`metadata` or dynamic data declarations currently in place.

## UI/UX States

- Provide explicit loading/empty states for listings (skeleton tile or message) using tokens.
- Maintain accessible headings hierarchy across sections.
- Buttons/links should use `Button`/`Link` combos to inherit focus rings.

## Edge Cases

- Slug pages may 404; ensure `notFound()` behavior still works.
- Booking forms should continue to respect locale/timezone formatting.
- Thank-you routes must retain shareable link/resend actions.

## Testing Strategy

- For each batch of page updates: `pnpm run lint`, `pnpm run test`.
- Chrome DevTools MCP per route (mobile+desktop), capturing Lighthouse + HAR once surfaces stabilize.

## Rollout

- Work in batches: (1) `/restaurants` & supporting shared components, (2) detail & booking routes, (3) rest of guest pages.
- Document verification artifacts per batch in this task folder.
