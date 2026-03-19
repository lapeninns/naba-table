---
task: backend-mutation-maintainability
timestamp_utc: 2026-03-19T11:21:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and task artifacts
- [x] Review root and route-level AGENTS scope for `src/app/api/**`

## Core

- [x] Extract shared lifecycle mutation route helper(s)
- [x] Update check-in/check-out/no-show/undo-no-show routes to use the shared helper(s)
- [x] Reuse shared transition persistence logic in the deprecated status route if it stays behaviorally identical
- [x] Keep route-specific side effects explicit in each handler

## Tests

- [x] Run focused regression checks
- [x] Run `pnpm typecheck`

## Notes

- Assumptions:
  - This pass is maintainability-focused and should not change route contracts.
- Deviations:
  - The shared helper centralizes auth, booking lookup, membership enforcement, lifecycle timing validation, and transition persistence, but route-specific side effects remain in the route files to keep control flow explicit.

## Batched Questions

- None at the moment.
