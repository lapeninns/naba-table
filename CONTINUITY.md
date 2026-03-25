# Continuity Ledger

Last updated: 2026-03-25T09:40:27Z

## Goal (incl. success criteria)

- Implement feature `fix-live-guest-auth-surface-validation` for milestone `guest-discovery-and-auth`.
- Success means `/auth/signin` strips or replaces unsafe `redirectedFrom` values before render, the live guest magic-link form shows inline validation plus pending/success/cooldown feedback, and callback errors including the `authError` alias render guest-safe messaging.

## Constraints/Assumptions

- Work only in the isolated mission worktree and keep scope limited to live guest auth surface validation, callback error handling, and redirect sanitization.
- Reuse existing guest auth helpers/layout primitives rather than inventing a parallel auth shell.
- Required validation for handoff: baseline `npx vitest run --maxWorkers=9`, feature-targeted vitest + Playwright commands from the assigned feature, `pnpm typecheck`, `pnpm lint`, plus live browser checks on `http://localhost:3000/auth/signin`.
- Known pre-existing lint warnings in unrelated `lib/*` and `server/*` files should be noted, not fixed.

## Key decisions

- Follow the guest-routing single-source-of-truth approach: keep redirect sanitization and callback error translation centralized rather than scattering conditions.
- Existing auth page, API, component, and browser coverage appear already updated; verify whether the feature is already satisfied before making code changes.

## State

- Mission docs, services manifest, guest-route library notes, README, and package scripts have been reviewed.
- `.factory/init.sh` completed successfully.
- Style Principles skill is active for implementation.

## Done

- Invoked required startup and worker skills.
- Reviewed assigned validation assertions: `VAL-FOUNDATION-005`, `VAL-DISCOVERY-009`, and `VAL-DISCOVERY-011`.
- Confirmed service manifest commands and mission boundaries.

## Now

- Finalize verification and handoff for the authError alias + sanitized redirect follow-up.

## Next

- Clean test artifacts, commit the focused auth validation follow-up, and report the manual/browser findings.

## Open questions (UNCONFIRMED if needed)

- Whether the live dev runtime suppresses validation/success states when bot protection is active without a bypass fixture.

## Working set (files/ids/commands)

- `src/app/(public)/auth/signin/page.tsx`
- `components/auth/GuestSignInForm.tsx`
- `src/app/api/auth/signin/route.ts`
- `src/app/api/auth/callback/route.ts`
- `lib/auth/redirects.ts`
- `tests/components/auth/GuestSignInForm.test.tsx`
- `tests/server/auth/signin-route-magic-link-policy.test.ts`
- `tests/e2e/guest-auth-pages.spec.ts`
- `/tmp/b4ca38df70eb-signin.png`
- `/tmp/b4ca38df70eb-signin-success.png`
