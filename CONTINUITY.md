# Continuity Ledger

Last updated: 2026-04-03T17:45:32Z

## Goal (incl. success criteria)

- Remove the floor-plan feature from the app surface entirely because the product direction no longer wants it.
- Success: the sidebar no longer exposes Floor Plan.
- Success: `/floor-plan` and seating aliases redirect to `/dashboard`.
- Success: the floor-plan feature tree, dev harnesses, and focused tests are removed cleanly.

## Constraints/Assumptions

- Follow existing AGENTS SDLC flow with task artifacts.
- Keep the change scoped to floor-plan removal only; do not disturb unrelated dashboard/bookings flows.
- No API, database, migration, or schema changes are allowed.
- Manual browser verification is required on the authenticated app route after removal.
- Repo-wide unrelated Vitest failures in email/auth suites are known pre-existing issues and out of scope.

## Key decisions

- Remove the floor-plan navigation item rather than hiding it behind a flag so the feature is visibly gone from the product.
- Keep legacy floor-plan route files only as server redirects to `/dashboard` so bookmarks still land somewhere useful.
- Delete the floor-plan component tree, harnesses, and focused tests instead of leaving dormant code behind.

## State

- The floor-plan feature has been removed from the app surface and old entry routes now redirect to dashboard.
- Scoped lint, typecheck, and browser redirect verification are complete for the removal task.

## Done

- Reviewed root `AGENTS.md`, mission-specific `AGENTS.md`, and closest nested `AGENTS.md` files for the touched floor-plan areas.
- Read the mission brief and relevant `.factory` materials earlier in the mission flow.
- Previously completed the read-only floor-plan mission and the authenticated reload-stability fix in their task folders.
- Created `tasks/remove-floor-plan-20260403-1641/` with `research.md`, `plan.md`, `todo.md`, and `verification.md`.
- Removed the `Floor Plan` item from `src/components/features/ops-shell/navigation.tsx`.
- Changed `src/app/app/(app)/floor-plan/page.tsx`, `src/app/app/(app)/seating/page.tsx`, and `src/app/app/(app)/seating/floor-plan/page.tsx` to redirect to `/dashboard`.
- Deleted the floor-plan feature tree under `src/components/features/seating/`, the floor-plan dev harness routes, and the focused floor-plan tests.
- Re-ran scoped validation successfully:
- `npx eslint src/components/features/ops-shell/navigation.tsx 'src/app/app/(app)/floor-plan/page.tsx' 'src/app/app/(app)/seating/page.tsx' 'src/app/app/(app)/seating/floor-plan/page.tsx'`
- `pnpm typecheck`
- `rg -n "floor-plan|FloorPlanPage|Floor Plan|ops-floor-plan" src tests`
- Verified in the browser that `/floor-plan` and `/seating` redirect to `/dashboard` and the authenticated sidebar no longer lists Floor Plan.

## Now

- Prepare the handoff for the floor-plan removal.

## Next

- If product ever wants to revisit a floor/table map, scope it as a fresh feature instead of restoring the removed implementation implicitly.

## Open questions (UNCONFIRMED if needed)

- None at the moment.

## Working set (files/ids/commands)

- `tasks/remove-floor-plan-20260403-1641/research.md`
- `tasks/remove-floor-plan-20260403-1641/plan.md`
- `tasks/remove-floor-plan-20260403-1641/todo.md`
- `tasks/remove-floor-plan-20260403-1641/verification.md`
- `CONTINUITY.md`
- `src/components/features/ops-shell/navigation.tsx`
- `src/app/app/(app)/floor-plan/page.tsx`
- `src/app/app/(app)/seating/page.tsx`
- `src/app/app/(app)/seating/floor-plan/page.tsx`
