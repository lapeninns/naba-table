# Continuity Ledger

Last updated: 2026-04-07T11:28:00Z

## Goal (incl. success criteria)

- Add a Google Business Profile integration to restaurant Ops settings so venues can connect their Google profile, sync available GBP data, and enrich the curated public restaurant landing page.
- Success: an Ops user can connect a restaurant to Google Business Profile from the canonical restaurant profile settings page.
- Success: Nab a Table can fetch and persist the supported GBP data for the linked location.
- Success: public restaurant pages can consume normalized imported GBP data without breaking the existing curated directory flow.

## Constraints/Assumptions

- Follow root, `src/app/AGENTS.md`, `src/components/AGENTS.md`, `src/services/ops/AGENTS.md`, and `server/AGENTS.md` rules, including task artifacts and Chrome DevTools verification for UI work.
- Keep the canonical implementation inside the existing restaurant profile settings flow and restaurant landing-page data pipeline.
- Supabase remains remote-only; local code can prepare migrations, but deployment depends on remote apply.
- OAuth credentials and refresh tokens must never be exposed to the client or stored in plaintext.

## Key decisions

- Use a dedicated restaurant-linked Google Business Profile integration record rather than spreading external-token state across the `restaurants` table.
- Store raw Google snapshots plus a normalized projection that can be merged into the existing curated landing-page overlay.
- Extend the canonical restaurant profile settings page with a Google Business Profile section instead of creating a parallel Ops tool.

## State

- Research and implementation planning complete; backend implementation is next.

## Done

- Reviewed the Nabatable task harness, fullstack delivery, and UI proof skills.
- Audited the canonical restaurant settings route, service, hook, API, and public landing-page enrichment flow.
- Confirmed the repo has no existing external OAuth integration pattern or token encryption helper to reuse.
- Created task artifacts under `tasks/google-business-profile-sync-20260407-1118/`.
- Identified the main integration points:
  - `src/components/features/restaurant-settings/RestaurantProfileSection.tsx`
  - `components/ops/restaurants/RestaurantDetailsForm.tsx`
  - `src/hooks/ops/useOpsRestaurantDetails.ts`
  - `src/services/ops/restaurants.ts`
  - `src/app/api/ops/restaurants/[id]/details/route.ts`
  - `server/restaurants/details.ts`
  - `src/data/restaurant-directory.ts`

## Now

- Implement the backend slice: env config, crypto/token helpers, integration persistence, Google sync server modules, and Ops API routes.

## Next

- Extend Ops settings hooks/UI and dev mocks once the backend contract is in place.
- Feed normalized GBP data into the public restaurant directory projection.
- Verify through tests and Chrome DevTools harness.

## Open questions (UNCONFIRMED if needed)

- Whether the public page should use imported GBP description/review/media content directly or only via a curated normalization layer. (UNCONFIRMED product choice; current default is normalized/curated merge)
- Which exact GBP endpoint families are enabled for the project credentials once env vars are configured. (UNCONFIRMED runtime configuration)

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/google-business-profile-sync-20260407-1118/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/restaurant-settings/RestaurantProfileSection.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/components/ops/restaurants/RestaurantDetailsForm.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/hooks/ops/useOpsRestaurantDetails.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/services/ops/restaurants.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/api/ops/restaurants/[id]/details/route.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/restaurants/details.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/restaurants/update.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/data/restaurant-directory.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/restaurants/getRestaurantBySlug.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/(public)/dev/ops-settings-restaurant/ui/OpsRestaurantSettingsDevHarness.tsx
