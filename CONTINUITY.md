# Continuity Ledger

Last updated: 2026-01-30T14:38:40Z

## Goal (incl. success criteria)

- Fix failing CI checks in PR #31 and ensure required checks pass.
- Success: ZAP Baseline, Security Scans, DB Drift Check, Lighthouse, Accessibility, Preview Deploy checks either pass or skip safely when required secrets/tests are absent.

## Constraints/Assumptions

- Follow AGENTS.md SDLC phases; task folders required for code changes.
- Ask before any git push.
- No delete/move/overwrite without explicit user request; prefer non-destructive edits.
- Supabase is remote-only (no local migrations).
- Do not print or commit secrets.

## Key decisions

- Use workflow guards to skip checks when required secrets or test directories are missing.
- Update action/CLI versions instead of disabling checks.

## State

- Phase 3 (Implementation) complete for workflow updates; pending verification/push.

## Done

- Created task folder `tasks/fix-ci-checks-20260130-1436` with SDLC artifacts.
- Added ZAP job permissions to allow issue creation.
- Updated trufflehog action tag to `v3.92.5`.
- Added DB drift check guard for missing `DRIFT_CHECK_DB_URL`.
- Switched Lighthouse to `pnpm dlx @lhci/cli@0.15.1`.
- Skipped a11y tests when no test files exist.
- Added Vercel preview deploy guard and permissions.

## Now

- Review diffs and update verification note; prepare commit.

## Next

- Commit changes.
- Ask to push, then push and re-run PR checks.
- Update `verification.md` once CI results return.

## Open questions (UNCONFIRMED if needed)

- Whether Vercel check failure is due to missing secrets or other configuration. (UNCONFIRMED)

## Working set (files/ids/commands)

- `.github/workflows/ci.yml`
- `.github/workflows/dast.yml`
- `tasks/fix-ci-checks-20260130-1436/`
- `CONTINUITY.md`
