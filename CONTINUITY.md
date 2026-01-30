# Continuity Ledger

Last updated: 2026-01-30T15:33:30Z

## Goal (incl. success criteria)

- Fix failing CI checks in PR #31 and ensure required checks pass.
- Success: ZAP Baseline, Security Scans, DB Drift Check, Lighthouse, Accessibility, Preview Deploy, and Vercel checks pass or skip safely when prerequisites are missing.
- Address GitHub Actions/Dependabot failure notifications by stabilizing workflows and reviewing dependabot config.

## Constraints/Assumptions

- Follow AGENTS.md SDLC phases; task folders required for code changes.
- Ask before any git push.
- No delete/move/overwrite without explicit user request; prefer non-destructive edits.
- Supabase is remote-only (no local migrations).
- Do not print or commit secrets.

## Key decisions

- Use workflow guards to skip checks when required secrets or test directories are missing.
- Update action/CLI versions instead of disabling checks.
- Force Webpack for production builds (`next build --webpack`) to restore middleware NFT artifacts for Vercel.
- Fix CSS Modules print selectors by adding a body class and scoping global rules.

## State

- Phase 4 (Verification) blocked by Next.js build type error; fix applied, pending push.

## Done

- Fixed `src/app/guest/bookings/[bookingId]/page.tsx` wrapper to use valid `{ params, searchParams }` props only.
- Updated task docs to reflect new Vercel failure and fix.

## Now

- Commit latest fix and request push approval.

## Next

- Push updates and monitor Vercel/CI checks.
- Update `verification.md` with outcomes.
- Merge PR when required checks pass.

## Open questions (UNCONFIRMED if needed)

- Dependabot failure cause (permissions, config, or failing CI). (UNCONFIRMED)

## Working set (files/ids/commands)

- `src/app/guest/bookings/[bookingId]/page.tsx`
- `tasks/fix-ci-checks-20260130-1436/verification.md`
- `CONTINUITY.md`
