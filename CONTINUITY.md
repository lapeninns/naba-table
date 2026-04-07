# Continuity Ledger

Last updated: 2026-04-07T10:42:00Z

## Goal (incl. success criteria)

- Hide Three Horseshoes from public production surfaces by enforcing the canonical restaurant activation state.
- Success: inactive restaurants no longer appear in public restaurant lists.
- Success: inactive restaurant slugs no longer resolve for detail or booking flows.
- Success: ops restaurant update contracts can persist `isActive`.

## Constraints/Assumptions

- Follow root, `src/app/AGENTS.md`, `server/AGENTS.md`, and `lib/AGENTS.md` rules.
- Treat `restaurants.is_active` as the likely source of truth unless deeper inspection reveals a first-class subscription system.
- Supabase is remote-only; any production row change must happen against the remote environment.

## Key decisions

- Target shared restaurant lookup/list code instead of hiding a single page route.
- Extend existing ops restaurant update contracts instead of adding a one-off hide endpoint.

## State

- Phase 4 complete for code and local browser proof; production data update has been applied.

## Done

- Confirmed the `restaurants` table already carries `is_active`.
- Confirmed public restaurant readers were ignoring `is_active`.
- Created task artifacts under `tasks/hide-three-horseshoes-20260407-1028/`.
- Patched shared public restaurant readers and public booking/availability resolution to require active restaurants.
- Added ops restaurant contract support for `isActive`.
- Added focused tests and passed typecheck.
- Set the production `three-horseshoes` row inactive in Supabase.

## Now

- Share the result: production data is inactive, code is ready, but the live site still needs deployment to stop serving the route.

## Next

- Deploy the patched build so production public routes start honoring `restaurants.is_active`.

## Open questions (UNCONFIRMED if needed)

- Whether the existing production deployment process can be triggered from this session. (UNCONFIRMED)
- Whether ops UX should surface inactive-state controls visually in restaurant settings. (UNCONFIRMED)

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/restaurants/getRestaurantBySlug.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/restaurants/listRestaurants.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/restaurants/update.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/api/ops/restaurants/schema.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/api/ops/restaurants/[id]/route.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tests/guest/public-restaurants-pages.test.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/hide-three-horseshoes-20260407-1028/
