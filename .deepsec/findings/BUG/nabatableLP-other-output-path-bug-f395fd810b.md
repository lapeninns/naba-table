# [BUG] Baseline artifact write fails when the hard-coded task directory is absent

**File:** [`scripts/db-perf-baseline.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/db-perf-baseline.ts#L400-L405) (lines 400, 401, 402, 403, 405)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-output-path-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

After running all database queries, the script writes to ../tasks/db-perf-optimization-20260106-1108/artifacts/baseline-results.json without creating the parent directory. The tasks directory is gitignored and was not present in the checked workspace, so a normal run can perform the expensive remote read work and then fail with ENOENT before saving the JSON artifact.

## Recommendation

Create the parent directory with fs.mkdirSync(path.dirname(outputPath), { recursive: true }) before writing, or accept an explicit output path and validate it.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-06)

**Verdict:** fixed

The baseline script now supports an explicit `DB_PERF_BASELINE_OUTPUT_PATH` and
creates the parent artifact directory before saving `baseline-results.json`.

Evidence:

- `tests/scripts/perf-script-safety.test.ts` verifies the configurable output
  path marker and directory creation before artifact writes.
- `pnpm exec vitest run tests/scripts/perf-script-safety.test.ts`
