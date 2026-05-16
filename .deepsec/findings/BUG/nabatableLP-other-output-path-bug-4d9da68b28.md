# [BUG] Baseline report write can fail while the script exits successfully

**File:** [`scripts/db-perf-baseline.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/db-perf-baseline.ts#L401-L500) (lines 401, 404, 406, 500)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-output-path-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script writes to a hard-coded tasks/db-perf-optimization-20260106-1108/artifacts/baseline-results.json path without creating the directory. That artifacts directory is absent in this checkout. If writeFileSync throws, the outer catch logs Fatal error but does not set process.exitCode or rethrow, so automation can receive exit 0 even though no baseline artifact was produced. The same false-success behavior applies to other fatal errors caught by that block.

## Recommendation

Create the output directory before writing, make the output path configurable, and set process.exitCode = 1 or rethrow in the fatal catch block.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-06)
