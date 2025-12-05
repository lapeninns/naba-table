---
task: lint-cleanup
timestamp_utc: 2025-12-05T23:44:49Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Lint warnings cleanup

## Objective

Ensure the booking schedule picker file has zero ESLint warnings so pre-commit passes.

## Success Criteria

- `eslint --max-warnings=0 src/components/features/booking-state-machine/ScheduleAwareTimestampPicker.tsx` exits 0 with no warnings.
- No behavioral changes introduced.

## Architecture & Components

- Modify `ScheduleAwareTimestampPicker.tsx` in-place: drop unused imports and derived variables.

## Data Flow & API Contracts

- Not applicable; no data contract changes.

## UI/UX States

- No UI changes expected.

## Edge Cases

- None; purely lint-focused cleanup.

## Testing Strategy

- Run targeted ESLint command above.

## Rollout

- No feature flags; commit directly after verification.
