---
task: guest-facing-pages-directory
timestamp_utc: 2026-04-11T17:26:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Guest Facing Pages Directory

## Objective

We will create a public guest page directory so that diners and the team can see the full guest-facing surface area in one place and keep the XML sitemap aligned with the same source of truth.

## Success Criteria

- [ ] A new public page lists guest-facing routes grouped into clear categories.
- [ ] Route entries distinguish primary pages from dynamic patterns, aliases, and redirects.
- [ ] The XML sitemap reuses the same catalog and only emits indexable static routes.
- [ ] The public footer links to the new page.

## Architecture & Components

- `src/app/guest-facing-pages.ts`: canonical guest-facing route catalog and derived helpers.
- `src/app/(public)/(marketing)/site-map/page.tsx`: human-readable route directory page.
- `src/app/sitemap.ts`: filters the shared catalog into XML sitemap entries.
- Footer components: add discoverability link for the new page.

## Data Flow & API Contracts

- No external APIs.
- Route directory page reads the shared in-memory catalog and renders grouped sections.
- XML sitemap maps `seo === "indexed"` static routes into `MetadataRoute.Sitemap` entries.

## UI/UX States

- Success: grouped route cards with badges for access, route type, and indexing behavior.
- Empty/error states are not applicable because the page uses static in-repo data.

## Edge Cases

- Dynamic route patterns must be visible to humans but not linked if a concrete slug/id is required.
- Redirect and alias routes should be marked clearly to avoid implying they are primary landing pages.
- Auth-required and receipt-only pages should be visible on the directory page but excluded from SEO indexing.

## Testing Strategy

- Unit:
  - Verify the route catalog grouping and the derived XML sitemap list.
- Manual:
  - Open `/site-map` in Chrome DevTools MCP.
  - Check heading structure, visible badges, responsive layout, and footer navigation.

## Rollout

- Feature flag: none.
- Exposure: immediate; public route.
- Monitoring: browser QA plus existing Next.js route smoke coverage.
- Kill-switch: revert the route, footer link, and catalog entries together.

## DB Change Plan (if applicable)

- Not applicable.
