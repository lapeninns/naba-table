# Continuity Ledger

Last updated: 2026-03-25T09:40:27Z

## Goal (incl. success criteria)

- Implement feature `landing-and-discovery-surfaces` for milestone `guest-discovery-and-auth`.
- Success means `/` presents a warm guest-first hierarchy with explicit discovery/booking entry points, authenticated visits to `/` still redirect to `/guest/dashboard`, and `/restaurants` plus `/restaurants/[slug]` share the canonical guest system with deterministic CTA and empty-state behavior.

## Constraints/Assumptions

- Work only in the isolated mission worktree and keep scope limited to landing and public restaurant discovery surfaces.
- Reuse canonical guest foundations (`MarketingLayout`, `GuestPrimitives`) rather than adding a competing shell.
- Required validation for handoff: `npx vitest run --maxWorkers=9`, `pnpm typecheck`, `pnpm lint`, plus manual browser checks on `http://localhost:3000`.
- Existing unrelated lint warnings in `lib/*` and `server/*` are pre-existing per mission AGENTS guidance.

## Key decisions

- Treat the current landing implementation as legacy/competing guest language and replace it with a guest-system-first hierarchy.
- Migrate `src/components/restaurants/PublicSections.tsx` onto canonical guest primitives so list/detail routes align with the shared shell.
- Update guest public tests first to capture the new landing/discovery expectations before implementation.

## State

- Mission docs, services manifest, guest-system library notes, README, and current landing/discovery source files have been reviewed.
- Baseline validation passed via `npx vitest run --maxWorkers=9`.
- Feature task artifacts were created at `tasks/landing-and-discovery-surfaces-20260325-0939/`.

## Done

- Invoked required startup and worker skills.
- Ran `.factory/init.sh` successfully.
- Reviewed assigned validation assertions: `VAL-DISCOVERY-001` through `VAL-DISCOVERY-005`.
- Captured research/plan/todo task artifacts for this feature.

## Now

- Update landing/discovery tests to RED, then implement canonical guest-shell landing and restaurant discovery surfaces.

## Next

- Run targeted tests, full validators, and live browser verification.
- Commit only feature-related changes before handoff.

## Open questions (UNCONFIRMED if needed)

- Whether any existing Playwright guest marketing assertions still target legacy localhost:5180 content and need route-specific updates for this feature.

## Working set (files/ids/commands)

- `src/app/(public)/page.tsx`
- `src/app/(public)/(marketing)/restaurants/page.tsx`
- `src/app/(public)/(marketing)/restaurants/[slug]/page.tsx`
- `src/components/landing/LandingPage.tsx`
- `src/components/restaurants/PublicSections.tsx`
- `tests/guest/public-restaurants-pages.test.tsx`
- `tests/e2e/guest-public-marketing.spec.ts`
- `tests/e2e/guest-public-pages.spec.ts`
- `tasks/landing-and-discovery-surfaces-20260325-0939/*`
