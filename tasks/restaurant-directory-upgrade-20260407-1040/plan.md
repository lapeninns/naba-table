---
task: restaurant-directory-upgrade
timestamp_utc: 2026-04-07T10:40:47Z
owner: github:@amankumarshresthaa
reviewers: [github:@amankumarshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Restaurant directory upgrade

## Objective

We will upgrade the public restaurant listing and detail routes into a more useful discovery directory so diners can understand what makes each venue special before they book.

## Success Criteria

- [ ] `/restaurants` exposes richer descriptions and category-led comparison, not just name/address/capacity.
- [ ] `/restaurants/[slug]` presents venue-specific editorial content and practical visit cues alongside the booking CTA.
- [ ] The Old Crown Girton page includes meaningful curated metadata that differentiates it from a generic pub listing.
- [ ] Existing booking entry points continue to work unchanged.

## Architecture & Components

- `src/data/restaurant-directory.ts`:
  - typed metadata overrides keyed by restaurant slug
  - generic fallback builders for venues without curated copy
- `src/components/restaurants/PublicSections.tsx`:
  - richer public directory sections for hero, filters, cards, and detail storytelling
- `src/components/restaurants/RestaurantsDirectoryClient.tsx`:
  - client-side discovery controls for search and category filtering on the listing page
- `src/app/(public)/(marketing)/restaurants/page.tsx` and `[slug]/page.tsx`:
  - compose server-fetched restaurant data with directory metadata
- `lib/restaurants/types.ts` and `server/restaurants/getRestaurantBySlug.ts`:
  - expose any missing operational fields needed on the public detail page (for example review links)

## Data Flow & API Contracts

No external API contract changes.

Internal data flow:

- Server fetches canonical restaurant records from Supabase.
- Directory helper enriches each record with:
  - short description
  - long-form story blocks
  - categories
  - feature tags
  - ideal-for tags
  - practical visit notes
- Public UI renders the merged shape.

## UI/UX States

- Listing page:
  - Hero
  - Search and category filters
  - Rich comparison cards
  - Empty state when filters remove all results
- Detail page:
  - Hero with editorial positioning
  - Venue overview/story
  - Category and feature chips
  - Practical visit info
  - Sticky booking CTA and map/actions

## Edge Cases

- Restaurants without curated metadata should still render useful fallback copy.
- Restaurants without logos should keep the existing visual fallback.
- Restaurants without address, phone, or email should hide those specific cues without breaking the layout.
- Filtered listing states should remain accessible and understandable to keyboard and screen-reader users.

## Testing Strategy

- Add focused Vitest coverage for the public restaurant routes and the new directory content behavior.
- Verify the real public page locally with Chrome DevTools MCP.
- Run targeted route/component tests and typecheck.

## Rollout

- Feature flag: none
- Exposure: immediate on deploy
- Monitoring: route smoke checks and manual review of the updated public pages
- Kill-switch: revert the directory metadata and public section changes if unexpected content regressions appear

## DB Change Plan (if applicable)

- No database changes.
