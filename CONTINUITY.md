# Continuity Ledger

Last updated: 2026-03-25T09:40:27Z

## Goal (incl. success criteria)

- Implement feature `guest-auth-entry-and-callback-errors` for milestone `guest-discovery-and-auth`.
- Success means `/auth` and `/auth/signin` are guest-owned, preserve only safe redirect intent, show passwordless email-first guest sign-in feedback/trust context, translate callback failures into guest-safe copy, and canonicalize authenticated `/auth` or root-host app-intent sign-ins to the correct destination.

## Constraints/Assumptions

- Work only in the isolated mission worktree and keep scope limited to guest auth entry, callback error handling, and related redirect canonicalization.
- Reuse existing guest auth helpers/layout primitives rather than inventing a parallel auth shell.
- Required validation for handoff: baseline `npx vitest run --maxWorkers=9`, feature-targeted vitest + Playwright commands from the assigned feature, `pnpm typecheck`, `pnpm lint`, plus live browser checks on `http://localhost:3000`.
- Known pre-existing lint warnings in unrelated `lib/*` and `server/*` files should be noted, not fixed.

## Key decisions

- Follow the guest-routing single-source-of-truth approach: keep redirect sanitization and host ownership logic centralized rather than scattering route conditions.
- Treat existing modified auth tests as the likely RED/implementation workspace first, then adjust source only if behavior is not already satisfied.

## State

- Mission docs, services manifest, guest-route library notes, README, and package scripts have been reviewed.
- `.factory/init.sh` completed successfully.
- Style Principles skill is active for implementation.

## Done

- Invoked required startup and worker skills.
- Reviewed assigned validation assertions: `VAL-FOUNDATION-003`, `VAL-FOUNDATION-005`, `VAL-DISCOVERY-007` through `VAL-DISCOVERY-011`, `VAL-CROSS-002`, `VAL-CROSS-007`, and `VAL-CROSS-008`.
- Confirmed service manifest commands and mission boundaries.

## Now

- Run baseline validation, inspect current auth-related implementation/tests, and determine whether source changes are needed beyond the existing modified tests.

## Next

- Implement/fix guest auth entry and callback error behavior as needed.
- Run targeted validators, live browser verification, and commit only feature-related changes.

## Open questions (UNCONFIRMED if needed)

- Whether the current product implementation already satisfies the feature contract and only needs validated coverage updates.

## Working set (files/ids/commands)

- `src/app/(public)/auth/**`
- `src/components/auth/**`
- `lib/**` auth/redirect helpers
- `src/proxy.ts`
- `tests/components/auth/GuestSignInForm.test.tsx`
- `tests/server/auth/signin-route-magic-link-policy.test.ts`
- `tests/e2e/guest-auth-pages.spec.ts`
