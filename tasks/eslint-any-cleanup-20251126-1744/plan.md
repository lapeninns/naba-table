---
task: eslint-any-cleanup
timestamp_utc: 2025-11-26T17:44:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: ESLint any cleanup in ops bookings cache test

## Objective

Eliminate explicit `any` usages in `tests/server/ops-bookings-cache.test.ts` so lint passes while preserving test intent.

## Success Criteria

- [ ] No `@typescript-eslint/no-explicit-any` warnings in the file.
- [ ] Tests compile and existing behavior unchanged.

## Architecture & Components

- Type definitions within the test file for mocked booking objects and cache rows.

## Data Flow & API Contracts

- Not applicable (test-only typing adjustments).

## UI/UX States

- N/A

## Edge Cases

- Ensure typed objects align with the functions under test to avoid type errors.

## Testing Strategy

- Run lint targeting the file or project to confirm zero warnings.
- Optionally run relevant test file if quick.

## Rollout

- No feature flag; commit directly after verification.

## DB Change Plan (if applicable)

- Not applicable.
