---
task: repo-cleanup
timestamp_utc: 2026-02-02T02:35:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Repository cleanup

## Objective

We will remove confirmed dead files and unused dependencies to keep the repo lean without changing runtime behavior.

## Success Criteria

- [ ] Dead files removed with no references remaining.
- [ ] High-confidence unused deps removed from `package.json` and lockfile.
- [ ] Lint/typecheck/test/build pass.

## Architecture & Components

- No runtime architecture changes; deletions only.

## Data Flow & API Contracts

- No changes.

## UI/UX States

- No UI changes expected.

## Edge Cases

- Ensure docs do not reference deleted files.

## Testing Strategy

- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Rollout

- No feature flags; changes are internal cleanup only.

## DB Change Plan (if applicable)

- None.
