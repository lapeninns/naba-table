---
task: merge-main
timestamp_utc: 2025-12-02T07:38:00Z
owner: github:@assistant
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Merge main into fabeb9f baseline

## Requirements

- Functional: Bring the branch based on `fabeb9fa2db72317cd9332dbe7f6b40e2b1b1903` up to date with `main` (`dc5d78eb6fdb1c244a50923dbfd0a159280b1abf`) via a clean merge.
- Non-functional: Keep history intact (no reset); ensure post-merge code builds and tests at least at smoke level.

## Existing Patterns & Reuse

- Repo uses task-scoped branches (`task/<slug>-YYYYMMDD-HHMM`) and task folders under `tasks/` for traceability.
- Prior tasks follow minimal research/plan/verification structure; merges are performed with standard `git merge`.

## Constraints & Risks

- Potential merge conflicts across Next.js app and Supabase code; must avoid regressions.
- UI files may change via merge, which would require manual QA per AGENTS policy.
- Avoid altering secrets or Supabase migrations without explicit plan (not expected for this merge).

## Recommended Direction

- Work on branch `task/merge-main-20251202-0738` cut from `fabeb9f`.
- Merge `main` into it, resolve any conflicts conservatively (prefer `main` where safe while preserving fabeb9f intent if conflicts arise).
- Run at least a smoke test (`pnpm run test` or equivalent) and summarize results in verification.
