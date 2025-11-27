---
task: push-nabatable-mirrors
timestamp_utc: 2025-11-27T09:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@lapeninns]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Push nabatable mirrors

## Objective

Push the current SajiloReserveX git history to the `nabatable` repositories under both `amanshresthaa` and `lapeninns` without altering the working tree.

## Success Criteria

- [ ] Authentication to both remotes confirmed.
- [ ] `main` (and tags) pushed to `amanshresthaa/nabatable`.
- [ ] `main` (and tags) pushed to `lapeninns/nabatable`.

## Architecture & Components

- Git remotes: `amans-nabatable` (https), `lapeninns` (ssh), `origin`.

## Data Flow & Commands

- Auth check: `git ls-remote <remote>`.
- Push branch: `git push <remote> main`.
- Push tags: `git push <remote> --tags`.

## Edge Cases

- Auth failure → capture error; no retries with secrets in logs.
- Diverged histories → use `--force-with-lease` only if already matching; prefer fast-forward.

## Testing Strategy

- Verify remote refs list after push.

## Rollout

- Immediate; no feature flags.
