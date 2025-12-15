---
task: fix-eslint-unused-floor-plan-helper
timestamp_utc: 2025-12-15T23:43:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix ESLint unused helper in floor-plan page

## Objective

Unblock `husky` pre-commit by removing an unused helper function in the floor-plan UI route so `eslint --max-warnings=0` passes.

## Success Criteria

- [ ] `eslint --fix --max-warnings=0` passes for `src/app/app/(app)/seating/floor-plan/page.tsx`.
- [ ] No runtime behavior changes in floor-plan timeline rendering.
- [ ] Manual UI smoke check recorded in `verification.md`.

## Change Summary

- Remove `getTableStateAtTime(...)` from `src/app/app/(app)/seating/floor-plan/page.tsx`.
  - Current code uses `getTableStateAtTimeFast(...)`, so this deletion is safe.

## Testing Strategy

- Run targeted ESLint for the file (or rerun `lint-staged`) to ensure warnings are gone.

## Rollout

- No feature flag; no rollout needed (dev-only lint fix).
