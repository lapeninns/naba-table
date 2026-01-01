---
task: fix-plan-step-a11y
timestamp_utc: 2026-01-01T16:36:51Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm current Calendar24Field select value handling.
- [x] Confirm NotesField label/textarea wiring.

## Core

- [x] Set select value to `undefined` when empty to show placeholder.
- [x] Restore `id`/`htmlFor` association for NotesField.

## UI/UX

- [ ] Confirm placeholder renders when empty.
- [ ] Confirm label click focuses textarea.

## Tests

- [ ] Manual wizard smoke check.
- [ ] A11y spot check for Notes label.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None.
