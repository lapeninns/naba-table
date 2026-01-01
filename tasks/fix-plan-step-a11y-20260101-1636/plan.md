---
task: fix-plan-step-a11y
timestamp_utc: 2026-01-01T16:36:51Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix plan-step a11y regressions

## Objective

We will restore placeholder visibility and proper label association in the reservation plan step so that users can understand empty fields and screen readers announce labels correctly.

## Success Criteria

- [ ] Time select shows `--:--` placeholder when no value is set.
- [ ] Notes label focuses and announces the textarea.

## Architecture & Components

- `Calendar24Field`: adjust select value to allow placeholder.
- `NotesField`: restore `id`/`htmlFor` wiring.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- Empty state shows placeholder for time select.

## Edge Cases

- Empty `inputValue` while suggestions are shown still renders placeholder.

## Testing Strategy

- Manual QA in booking wizard plan step.
- Basic a11y validation for label association.

## Rollout

- No feature flag; small UI fix.

## DB Change Plan (if applicable)

- N/A
