---
task: fix-eslint-unused-floor-plan-helper
timestamp_utc: 2025-12-15T23:43:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix ESLint unused helper in floor-plan page

## Requirements

- Functional:
  - `husky`/`lint-staged` must pass `eslint --fix --max-warnings=0` for staged UI files.
  - Remove the warning: `@typescript-eslint/no-unused-vars` for `getTableStateAtTime` in `src/app/app/(app)/seating/floor-plan/page.tsx`.
- Non-functional:
  - No runtime behavior changes intended.
  - Keep change minimal and aligned with existing patterns.

## Existing Patterns & Reuse

- Timeline status lookup currently uses `getTableStateAtTimeFast(...)` and precomputed windows (`buildSegmentWindows(...)`).
- `getTableStateAtTime(...)` appears to be an older/slow path and is no longer referenced.

## Constraints & Risks

- This file is a UI route; policy requires manual UI QA via Chrome DevTools MCP for UI changes.
- We will keep the change to a safe deletion of a dead helper to avoid behavioral changes.

## Open Questions (owner, due)

- Q: Does any future work still intend to use the slower `getTableStateAtTime(...)` helper?
  - A: Not currently referenced anywhere; safe to remove for now. If needed later, reintroduce via a dedicated task.

## Recommended Direction (with rationale)

- Delete the unused helper function `getTableStateAtTime(...)` to eliminate the ESLint warning. This is the smallest change that unblocks commits without changing behavior.
