# Continuity Ledger

Last updated: 2026-04-07T11:59:00Z

## Goal (incl. success criteria)

- Upgrade the public restaurant pages into a real discovery directory with strong descriptions, categories, and venue differentiation.
- Success: `/restaurants` helps diners compare venues using descriptive metadata, not only operational facts.
- Success: `/restaurants/the-old-crown-girton` reads like a rich directory profile with curated content plus booking actions.

## Constraints/Assumptions

- Follow root, `src/app/AGENTS.md`, and `src/components/AGENTS.md` rules, including task artifacts and Chrome DevTools verification for UI work.
- Keep canonical operational restaurant data sourced from the existing server queries.
- Avoid database/schema work; use a typed metadata overlay for editorial directory content.

## Key decisions

- Introduce a directory metadata layer keyed by restaurant slug rather than hard-coding copy directly inside route components.
- Use curated overrides for priority venues like The Old Crown Girton and generate sensible fallbacks for the rest of the directory.
- Keep the booking CTA, contact details, and map actions connected to existing restaurant data so the discovery layer stays aligned with live operations.

## State

- Implementation and verification complete for the restaurant directory upgrade.

## Done

- Audited the current live and repo-local restaurant list/detail pages.
- Identified the canonical public route and component files for the upgrade.
- Reviewed the Nabatable task harness, fullstack delivery, and UI proof skills.
- Created task artifacts under `tasks/restaurant-directory-upgrade-20260407-1040/`.
- Added a typed restaurant directory metadata layer with curated Old Crown content and generic fallbacks for the rest of the directory.
- Upgraded `/restaurants` with search and category filtering plus richer comparison cards.
- Upgraded `/restaurants/[slug]` with editorial story content, category blocks, practical visit cues, and stronger booking-side information.
- Added focused route tests and passed targeted Vitest, ESLint, and typecheck runs.
- Verified the updated UI via a dev-only harness route and captured desktop/mobile screenshots plus Lighthouse artifacts.

## Now

- Prepare the final summary and note the local-env verification fallback clearly.

## Next

- If the team wants broader venue coverage, add more curated metadata overrides on top of the shared directory model.

## Open questions (UNCONFIRMED if needed)

- How much handcrafted metadata the team wants to maintain per venue beyond the initial flagship entries. (UNCONFIRMED long-term content workflow)

## Working set (files/ids/commands)

- /Users/amankumarshrestha/.codex/worktrees/dc7f/nabatableLP/src/app/(public)/(marketing)/restaurants/page.tsx
- /Users/amankumarshrestha/.codex/worktrees/dc7f/nabatableLP/src/app/(public)/(marketing)/restaurants/[slug]/page.tsx
- /Users/amankumarshrestha/.codex/worktrees/dc7f/nabatableLP/src/components/restaurants/PublicSections.tsx
- /Users/amankumarshrestha/.codex/worktrees/dc7f/nabatableLP/lib/restaurants/types.ts
- /Users/amankumarshrestha/.codex/worktrees/dc7f/nabatableLP/server/restaurants/getRestaurantBySlug.ts
- /Users/amankumarshrestha/.codex/worktrees/dc7f/nabatableLP/src/data/restaurant-directory.ts
- /Users/amankumarshrestha/.codex/worktrees/dc7f/nabatableLP/src/components/restaurants/RestaurantsDirectoryClient.tsx
- /Users/amankumarshrestha/.codex/worktrees/dc7f/nabatableLP/src/app/(public)/dev/restaurants-directory/page.tsx
- /Users/amankumarshrestha/.codex/worktrees/dc7f/nabatableLP/src/app/(public)/dev/restaurants-directory/ui/RestaurantsDirectoryDevHarness.tsx
- /Users/amankumarshrestha/.codex/worktrees/dc7f/nabatableLP/tasks/restaurant-directory-upgrade-20260407-1040/
