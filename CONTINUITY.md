# Continuity Ledger

Last updated: 2026-04-13T18:48:00Z

## Goal (incl. success criteria)

- Remove unused homepage code while preserving the canonical `/` landing experience.
- Success: only the active homepage path remains wired for `/`.
- Success: alternate homepage trees and orphaned support files are removed without runtime regressions.

## Constraints/Assumptions

- Follow root `AGENTS.md`, `src/components/AGENTS.md`, and `components/AGENTS.md`.
- Keep the cleanup focused on dead homepage code; avoid unrelated landing-page refactors.
- Chrome DevTools MCP proof is still required because the touched area is UI-adjacent.

## Key decisions

- Treat `src/app/(public)/page.tsx` and `src/components/landing/LandingPage.tsx` as the only canonical homepage path.
- Remove commented-out landing helpers if they are no longer part of the active render tree.
- Keep `src/components/landing/shared/*` helpers that are still used by the active `sections/*` components.

## State

- Task folder created at `tasks/delete-unused-homepage-code-20260413-1848/`.
- Repo-wide import scans confirmed these are unreferenced:
  - `src/components/landing/FactoryHomeClient.tsx`
  - `src/components/landing/HomeSections.tsx`
  - `src/components/landing/local-venues.json`
  - `src/data/homepage-content.json`
  - `components/owner-marketing/*`
  - `components/marketing/*`
  - `src/components/landing/analytics/ExitIntentPopup.tsx`
  - `src/components/landing/optimizations/StickyCTA.tsx`
- Active landing helpers such as `LiveFeedCard`, `MetricCard`, `Icons`, and `shared/localVenues.ts` are still in use and must stay.
- Cleanup is implemented:
  - deleted the confirmed dead homepage trees and data files
  - pruned the commented `ExitIntentPopup` / `StickyCTA` remnants from `LandingPage.tsx`
  - removed stale doc references to the deleted legacy marketing hero

## Done

- Created the task artifacts for this cleanup.
- Collected policy, dependency, and scope evidence before editing.
- Removed the unused homepage code and legacy marketing subtree.
- Passed `pnpm -s exec tsc --noEmit --pretty false`.
- Passed `pnpm -s exec eslint 'src/components/landing/LandingPage.tsx' 'src/components/landing/optimizations/index.ts'`.
- Captured Chrome DevTools proof on `http://127.0.0.1:3001/`, including screenshot, Lighthouse snapshot, and performance traces.

## Now

- Final review of the diff and task artifacts.

## Next

- Share the cleanup summary and residual risks with the user.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/delete-unused-homepage-code-20260413-1848/research.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/delete-unused-homepage-code-20260413-1848/plan.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/delete-unused-homepage-code-20260413-1848/todo.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/delete-unused-homepage-code-20260413-1848/verification.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/(public)/page.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/landing/LandingPage.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/landing
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/components/marketing
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/components/owner-marketing
