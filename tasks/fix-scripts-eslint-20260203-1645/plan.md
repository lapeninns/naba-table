---
task: fix-scripts-eslint
timestamp_utc: 2026-02-03T16:45:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Scripts eslint warnings

## Objective

We will resolve eslint warnings in scripts so pre-commit passes without changing runtime behavior.

## Success Criteria

- [ ] ESLint warnings removed for the specified scripts.
- [ ] Script behavior unchanged.

## Architecture & Components

- `scripts/seed-railway-from-cornerhouse.ts`: adjust unused symbols.
- `scripts/update-railway-details.ts`: adjust unused symbol.

## Data Flow & API Contracts

- No changes.

## UI/UX States

- Not applicable.

## Edge Cases

- Ensure type definitions remain accurate.

## Testing Strategy

- Lint the scripts glob or specific files.

## Rollout

- No feature flag; internal maintenance.

## DB Change Plan (if applicable)

- Not applicable.
