# [BUG] Summary artifact write can fail after database mutations complete

**File:** [`scripts/staging/seed-perf-dataset.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/seed-perf-dataset.ts#L820-L913) (lines 820, 821, 822, 913)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-post-write-artifact-failure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script writes tasks/staging-perf-dataset-20260207-1647/artifacts/seed-summary.json after all remote mutations, but it never creates the artifacts directory. Because tasks/ is gitignored and may not exist in a normal checkout, a successful seed run can end with an ENOENT failure after data has already been written.

## Recommendation

Create artifactsDir during preflight before any database writes, or write the summary to a guaranteed existing gitignored directory.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
