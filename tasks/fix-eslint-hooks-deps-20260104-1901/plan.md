---
task: fix-eslint-hooks-deps
timestamp_utc: 2026-01-04T19:01:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix ESLint hook deps warnings

## Objective

We will address hook dependency warnings so lint passes without changing behavior.

## Success Criteria

- [ ] ESLint warnings resolved for listed files.
- [ ] Hook dependencies are stable and correct.

## Architecture & Components

- `BookingAssignmentTabContent.tsx`: update `useCallback` deps.
- `src/hooks/ops/*`: memoize `queryKey` with `useMemo`.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- No UI state changes expected.

## Edge Cases

- Avoid stale `date`/`restaurantId` in callbacks.
- Ensure query keys reflect inputs and remain stable.

## Testing Strategy

- Lint: `eslint --fix --max-warnings=0` on affected files.

## Rollout

- No flags.

## DB Change Plan (if applicable)

- N/A
