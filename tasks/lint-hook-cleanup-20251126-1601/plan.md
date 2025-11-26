---
task: lint-hook-cleanup
timestamp_utc: 2025-11-26T16:01:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Lint hook and type fixes

## Objective

Clear eslint errors/warnings so pre-commit passes without changing runtime behavior.

## Success Criteria

- [ ] `pnpm lint` (or pre-commit eslint) reports zero errors/warnings for touched files.
- [ ] No functional changes to booking or restaurant settings flows.

## Architecture & Components

- `StepPrefetchBoundary.tsx`: remove unused variable.
- `OperatingHoursSection.tsx` and `ServicePeriodsSection.tsx`: relocate `useGlobalShortcuts` call to unconditional position within component.
- `debounceThrottle.ts`: add generics/typed signatures for debounce/throttle helpers.

## Data Flow & API Contracts

- No API changes; utility functions keep same call signatures aside from stronger typing.

## UI/UX States

- No UI changes expected.

## Edge Cases

- Ensure shortcut registration still respects `enabled` guard, but hook call order remains stable.

## Testing Strategy

- Run eslint for touched files.
- Spot-check typecheck if needed (tsc or lint covers types).

## Rollout

- No flags; direct fix.

## DB Change Plan

- Not applicable.
