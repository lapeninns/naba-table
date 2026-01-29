---
task: dev-tooling-tests
timestamp_utc: 2026-01-29T14:05:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Dev Tooling & Test Quality

## Objective

Ship missing drift-check tooling and add test quality guards for focused/skipped tests and naming conventions.

## Success Criteria

- [ ] `pnpm db:check-drift` runs via new `scripts/db/check-drift.ts`.
- [ ] `pnpm test:quality` runs `scripts/tests/check-test-quality.ts` and reports findings.
- [ ] Validators pass (`pnpm lint`, `pnpm typecheck`, `pnpm test`).

## Architecture & Components

- **DB Drift Script**: Supabase CLI dump to temp file, diff against `supabase/schema.sql`, exit non-zero on drift.
- **Test Quality Script**: Scan repo files for `.only`/`.skip` and ensure `.test/.spec/.bench` naming for test invocations.
- **Package Scripts**: Add `test:quality` entry for easy invocation.

## Data Flow & CLI Contract

- Inputs: repository files; remote database via `DRIFT_CHECK_DB_URL` or `SUPABASE_DB_URL`.
- Outputs: stdout report + non-zero exit code on findings (unless `--no-strict`).

## Edge Cases

- If `supabase/schema.sql` is missing, drift check should fail with guidance.
- Allow optional `--allow-skip` for legacy skipped tests.

## Testing Strategy

- Run `pnpm lint`, `pnpm typecheck`, `pnpm test` after changes.

## Rollout

- Tooling-only changes; no runtime impact.
