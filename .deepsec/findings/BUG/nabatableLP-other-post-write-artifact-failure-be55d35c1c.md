# [BUG] Summary write can fail after database mutations complete

**File:** [`scripts/staging/seed-perf-dataset.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/seed-perf-dataset.ts#L803-L897) (lines 803, 804, 805, 897)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-post-write-artifact-failure`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script writes `tasks/staging-perf-dataset-20260207-1647/artifacts/seed-summary.json` but never creates the `tasks/.../artifacts` directory. Because `tasks/` is gitignored and absent in a normal checkout, an applied run can finish all database inserts and then throw at `fs.writeFileSync`, making the run appear failed after remote state has already changed.

## Recommendation

Create `artifactsDir` before starting the database write phase, or write the summary to a guaranteed existing gitignored location. Consider recording a preflight artifact path check before any remote mutations.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
