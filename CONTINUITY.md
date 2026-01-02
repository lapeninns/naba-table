# Continuity Ledger

Last updated: 2026-01-02T21:56:50Z

## Goal (incl. success criteria)

- Replace the public landing page with the updated UK pubs client component content and styles.
- Success: `src/components/landing/FactoryHomeClient.tsx` matches the supplied layout (Problem section + UK copy) and renders on `src/app/(public)/page.tsx` with named + default export.

## Constraints/Assumptions

- Use Shadcn UI primitives for landing buttons/badges.
- Manual UI QA via Chrome DevTools MCP is required for UI changes.
- Run lint, typecheck, and tests; record outcomes even if pre-existing failures exist.

## Key decisions

- Use Shadcn `Button`/`Badge` and keep `FactoryHomeClient` named + default export for the public page import.
- Respect prefers-reduced-motion by disabling reveal observer and live feed auto-rotation.

## State

- Landing component updated with UK pubs copy and Problem section; tests re-run with same failures.

## Done

- Replaced `src/components/landing/FactoryHomeClient.tsx` with UK pubs layout using Shadcn primitives and reduced-motion handling.
- Kept named + default export for `src/app/(public)/page.tsx` import.
- Re-ran `pnpm run lint` (warnings), `pnpm run typecheck` (pass), `pnpm run test` (fails in API route suites).

## Now

- Await Chrome DevTools MCP QA and capture artifacts.

## Next

- Run Chrome DevTools MCP manual QA and capture artifacts.
- Decide whether to address existing API test failures or leave as known issues.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/(public)/page.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/landing/FactoryHomeClient.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/landing-page-replace-20260102-2136/{research,plan,todo,verification}.md
