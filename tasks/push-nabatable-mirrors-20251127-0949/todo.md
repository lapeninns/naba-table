---
task: push-nabatable-mirrors
timestamp_utc: 2025-11-27T09:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@lapeninns]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm worktree state noted (uncommitted changes remain local).

## Core

- [x] Verify auth to `amans-nabatable` via `git ls-remote`.
- [x] Verify auth to `lapeninns` via `git ls-remote`.
- [x] Push `main` to `amans-nabatable`.
- [x] Push tags to `amans-nabatable`.
- [x] Push `main` to `lapeninns`.
- [x] Push tags to `lapeninns`.

## Verification

- [x] Confirm remote heads after pushes.

## Notes

- Assumptions: Remotes already created and accepting pushes; fast-forward expected.
- Deviations: `amanshresthaa/nabatable` and `lapeninns/nabatable` were created; pushed via a fresh mirror clone to avoid local uncommitted changes. Pull request refs were skipped (GitHub rejects `refs/pull/*`).
