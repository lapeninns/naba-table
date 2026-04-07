---
task: restaurant-directory-upgrade
timestamp_utc: 2026-04-07T10:40:47Z
owner: github:@amankumarshresthaa
reviewers: [github:@amankumarshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Restaurant directory upgrade

## Requirements

- Functional:
  - Turn `/restaurants` into a true restaurant directory instead of a thin booking index.
  - Add richer venue descriptions, categories, and differentiators so diners can compare venues quickly.
  - Upgrade `/restaurants/[slug]` to feel editorial and discovery-led, while still keeping booking as the main action.
  - Support venue-specific curation for flagship pages like `the-old-crown-girton` without blocking the rest of the directory.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve keyboard-accessible discovery and filter controls.
  - Keep the canonical restaurant data path server-side and avoid introducing duplicate sources of truth for operational data.
  - Avoid database or migration work for this upgrade.
  - Keep the experience performant on public/mobile routes.

## Existing Patterns & Reuse

- The public routes live in `src/app/(public)/(marketing)/restaurants/page.tsx` and `src/app/(public)/(marketing)/restaurants/[slug]/page.tsx`.
- Shared restaurant marketing UI currently lives in `src/components/restaurants/PublicSections.tsx`.
- Canonical restaurant operational data comes from `server/restaurants/listRestaurants.ts` and `server/restaurants/getRestaurantBySlug.ts`.
- The repo already uses structured content objects for marketing surfaces in `src/data/homepage-content.json`; that pattern is a good fit for directory metadata.

## External Resources

- [Current Nab a Table restaurant detail page](https://www.nabatable.com/restaurants/the-old-crown-girton) — confirms the current live surface is still generic and light on venue discovery.
- [The Old Crown official profile](https://www.lapeninns.com/restaurants/the-old-crown) — provides venue-specific facts that can inform richer editorial metadata and categorisation.

## Constraints & Risks

- The user wants the pages to offer more than CAMRA-style pub facts, so the output should emphasize diner decision-making, not just pub registry data.
- Restaurant records in Supabase currently expose operational fields like name, address, contact info, capacity, and booking policy, but not editorial categories or descriptive copy.
- Hard-coding every venue entirely into the UI would create drift; the better approach is a small directory metadata layer merged onto canonical restaurant records.
- Because this is a public UI change, Chrome DevTools verification is mandatory after implementation.

## Open Questions (owner, due)

- Q: Should every venue receive handcrafted editorial metadata immediately?
  A: No. Start with structured fallbacks for all venues and add richer curated overrides for priority venues such as The Old Crown Girton.

## Recommended Direction (with rationale)

- Add a typed restaurant-directory metadata module that overlays curated descriptions, categories, features, and diner-friendly cues onto the existing restaurant records.
- Use that metadata to power:
  - richer, searchable/filterable listing cards on `/restaurants`
  - a more complete detail page with editorial copy, categories, highlights, and practical visit information
- Keep operational fields like contact details, booking CTA, map link, and capacity sourced from the existing server queries so the directory stays aligned with the booking system.
