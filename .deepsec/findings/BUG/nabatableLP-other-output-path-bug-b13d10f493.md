# [BUG] Baseline output directory is not created and fatal errors exit successfully

**File:** [`scripts/db-perf-baseline.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/db-perf-baseline.ts#L401-L501) (lines 401, 403, 405, 494, 501)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-output-path-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script writes to a hardcoded ignored task artifact path but never creates the `tasks/.../artifacts` directory. In a fresh checkout this write fails after all database queries have run. The outer catch only logs `Fatal error` and does not set a non-zero exit code, so automation can treat the failed baseline as successful.

## Recommendation

Create the artifact directory with `fs.mkdirSync(path.dirname(outputPath), { recursive: true })` before writing, and set `process.exitCode = 1` or rethrow on fatal errors.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-06)
