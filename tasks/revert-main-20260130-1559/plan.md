---
task: revert-main
timestamp_utc: 2026-01-30T15:59:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Revert main to 6e3eb7b

## Objective

We will revert the repository to match commit `6e3eb7b` using a PR-based revert that respects branch protection.

## Success Criteria

- [ ] Working tree matches commit `6e3eb7b`.
- [ ] PR created with revert commit and passes checks.

## Architecture & Components

- Git history operations only; no runtime changes beyond reverting.

## Data Flow & API Contracts

- Not applicable.

## UI/UX States

- Not applicable.

## Edge Cases

- File deletions/renames after `6e3eb7b` may need resolution.

## Testing Strategy

- Rely on CI in PR.

## Rollout

- Merge PR to main and confirm state matches target commit.
