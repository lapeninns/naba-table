---
task: dev-tooling-tests
timestamp_utc: 2026-01-29T14:05:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Dev Tooling & Test Quality

## Requirements

- Functional:
  - Implement missing `scripts/db/check-drift.ts` referenced by `pnpm db:check-drift`.
  - Add automated test quality checks for focused/skipped tests and naming conventions.
  - Wire a test-quality script into `package.json` for local/CI use.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No runtime impact on production; tooling-only scripts.
  - Avoid new dependencies; use existing Node + tsx tooling.

## Existing Patterns & Reuse

- `docs/security.md` documents `pnpm db:check-drift` using Supabase CLI output diffing.
- CI workflow runs `pnpm db:check-drift` in `db-drift-check` job.
- Existing script patterns in `scripts/check-large-files.cjs` and `scripts/feature-flags/audit.ts`.

## External Resources

- None required.

## Constraints & Risks

- Supabase access must be remote-only; require `DRIFT_CHECK_DB_URL` or `SUPABASE_DB_URL`.
- Test quality scan should avoid false positives (ignore non-test helper files).

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Implement `scripts/db/check-drift.ts` using Supabase CLI dump and diff against `supabase/schema.sql`.
- Add `scripts/tests/check-test-quality.ts` to detect `.only`/`.skip` and enforce `.test/.spec/.bench` naming when test invocations appear.
