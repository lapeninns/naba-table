---
task: fix-turn-durations-lint
timestamp_utc: 2026-02-03T16:38:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Turn durations lint warning

## Objective

We will remove a lint warning in `TurnDurationsSection` so pre-commit passes without changing runtime behavior.

## Success Criteria

- [ ] ESLint no-unused-vars warning removed.
- [ ] Behavior of removing last row remains unchanged.

## Architecture & Components

- `TurnDurationsSection`: update `removeRow` state update to avoid unused binding.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- No UI state changes.

## Edge Cases

- Removing the last row should remove the option key from draft.

## Testing Strategy

- Lint pass (targeted).

## Rollout

- No feature flag; change is internal.

## DB Change Plan (if applicable)

- Not applicable.
