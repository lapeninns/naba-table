---
task: repo-cleanup
timestamp_utc: 2026-01-25T14:38:16Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Repo cleanup (artifacts + unused code)

## Objective

We will remove unwanted artifacts and verified-unused code from the repo so the working tree is clean and lean, while preserving all active sources and docs.

## Success Criteria

- [ ] All obvious artifact/dump files removed from git.
- [ ] Any removed code/components are verified unused (no imports/refs).
- [ ] .gitignore updated to prevent the same artifacts from returning.
- [ ] Lint/type/test commands still run (at least lint).

## Architecture & Components

- No architectural changes.
- Target areas: repo root artifacts, backup dumps, output files, and unused leaf components.

## Data Flow & API Contracts

- No changes.

## UI/UX States

- No UI changes expected.

## Edge Cases

- Files referenced only by scripts/docs (non-runtime) may still be required; confirm references before deletion.
- Alias paths in tsconfig allow both root and src directories; verify actual usage before removing any directory or component.

## Testing Strategy

- Run `pnpm run lint` after cleanup.
- Run `pnpm run typecheck` if feasible (optional, time permitting).

## Rollout

- Not applicable (no runtime change expected).

## DB Change Plan (if applicable)

- Not applicable.
