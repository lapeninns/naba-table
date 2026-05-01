---
name: unused-cleanup-plan
overview: Safely remove unused components and orphaned tests/stories/dev-only files using an aggressive pass with guardrails, then verify app behavior and CI checks before final deletion.
todos:
  - id: build-candidate-graph
    content: Generate unused candidate inventory and split into high-confidence vs risky buckets
    status: pending
  - id: apply-batch-1
    content: Delete first high-confidence batch and run lint/typecheck/targeted tests
    status: pending
  - id: iterate-batches
    content: Continue batch deletions with verification gates until high-confidence list is exhausted
    status: pending
  - id: review-risky-candidates
    content: Manually validate risky candidates (dynamic imports/barrels/route usage) before deletion
    status: pending
  - id: final-validate-report
    content: Run final checks and publish deletion + skip report
    status: pending
isProject: false
---

# Remove Unused Files (Aggressive, Safe Gates)

## Goal

Delete unused component files plus orphaned tests/stories/dev-only files, while preventing regressions in routes, dynamic imports, and shipped surfaces.

## Baseline and Candidate Inventory

- Build a full dependency graph for `*.ts,*.tsx,*.js,*.jsx` and mark files with zero inbound references.
- Seed candidates from:
  - custom components under [`/Users/amankumarshrestha/LapenInns Project/nabatableLP/components`]( /Users/amankumarshrestha/LapenInns Project/nabatableLP/components ) and [`/Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components`]( /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components )
  - tests/stories/dev-only locations (for example `tests/**`, `**/*.stories.*`, `**/__dev__/**`, `**/dev/**` where applicable)
- Produce two buckets:
  - **High-confidence delete**: no imports, no route/app entry usage, no dynamic load hints.
  - **Risky candidates**: no imports but referenced by conventions or dynamic patterns.

## Hard Exclusion Rules (Do Not Delete Automatically)

- Keep any route/page/layout/error/loading entrypoints in `src/app/**`.
- Keep files referenced by dynamic usage patterns: `import(`, `next/dynamic`, lazy loaders, registry maps, string-based lookups.
- Keep barrel-exported files still pulled by downstream imports.
- Keep infra/config and shared contract files (types/schemas/constants) even if inbound appears zero.

## Deletion Execution (Aggressive in Batches)

- Delete **high-confidence** files in small batches (10–25 files) to keep rollback/debug easy.
- After each batch, run verification gates before next batch.
- For **risky candidates**, only delete after explicit proof from code search + runtime spot-check.

## Verification Gates After Each Batch

- Run:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - targeted tests: `pnpm exec vitest ...` for affected domains
- Smoke-test shipped routes:
  - Ops surface (`src/app/app/**`), especially sidebar/nav/auth/dashboard paths
  - Guest/public surface (`src/app/(public)/**`, `src/app/guest/**`)
- If a failure occurs, restore only the last batch and split into smaller chunks.

## Final Validation and Deliverables

- Run full lint/typecheck and focused test sweep on touched areas.
- Produce a cleanup report with:
  - deleted file list
  - skipped/risky files with reason
  - follow-up candidates requiring manual review
- Optional follow-up: remove now-unused exports/imports left behind by deletions.

## Primary Files/Areas to touch

- [`/Users/amankumarshrestha/LapenInns Project/nabatableLP/components`]( /Users/amankumarshrestha/LapenInns Project/nabatableLP/components )
- [`/Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components`]( /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components )
- [`/Users/amankumarshrestha/LapenInns Project/nabatableLP/tests`]( /Users/amankumarshrestha/LapenInns Project/nabatableLP/tests )
- Story/dev-only directories discovered during inventory (`*.stories.*`, `__dev__`, `dev` paths)
