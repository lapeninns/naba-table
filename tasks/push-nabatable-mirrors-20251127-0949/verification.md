---
task: push-nabatable-mirrors
timestamp_utc: 2025-11-27T09:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@lapeninns]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — N/A (git push only)

## Results

- Auth checks: ok for both remotes via `git ls-remote` (HTTPS tokens through gh).
- Pushes: completed via fresh mirror clone (`--all` + `--tags`) to `amanshresthaa/nabatable` and `lapeninns/nabatable`; PR refs intentionally skipped (GitHub rejects `refs/pull/*`).
- Remote ref validation: `refs/heads/main` = `91b672b23c091e5c5f59f7f9669c1c1edd441132` on both remotes.

## Artifacts

- None required beyond git output; capture logs in task notes if needed.

## Known Issues

- Local working tree still has uncommitted changes; they were not part of the pushes.

## Sign-off

- [ ] Engineering
