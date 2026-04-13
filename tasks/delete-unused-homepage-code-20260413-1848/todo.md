---
task: delete-unused-homepage-code
timestamp_utc: 2026-04-13T18:48:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm the active homepage route and component tree.
- [x] Confirm candidate files are unreferenced in the repo dependency graph.
- [x] Record scope and constraints in task artifacts.

## Core

- [x] Delete orphaned alternate homepage implementations.
- [x] Delete unused legacy marketing and owner-marketing homepage trees.
- [x] Delete orphaned homepage data files.
- [x] Prune commented-out landing references and dead barrel exports.

## UI/UX

- [x] Preserve the current `/` homepage behavior and auth redirect behavior.

## Tests

- [x] Typecheck
- [x] Targeted lint
- [x] Chrome DevTools MCP homepage smoke proof

## Notes

- Assumptions:
  - Repo-wide `rg` import scans are sufficient to treat these homepage files as dead code for this cleanup.
- Deviations:
  - Verification-first dependency analysis is used here because the task is deletion-oriented rather than behavior-changing.
  - Browser proof used the already-running Nabatable dev server on `http://127.0.0.1:3001/` after `pnpm dev` surfaced an existing Next.js lock for this repo and port `3000` was confirmed to belong to a different app.

## Batched Questions

- None currently.
