---
task: remove-drink-bookings
timestamp_utc: 2026-01-22T10:37:47Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm plan approvals and decisions (no existing drink bookings; bar tables allowed for lunch/dinner).
- [x] Update booking type constants and schemas to lunch/dinner only.

## Core

- [x] Remove drinks/happy hour from schedule generation + availability labels.
- [x] Update booking creation/edit routes to normalize only lunch/dinner.
- [x] Remove drinks-only constraint in capacity table assignment.
- [x] Update ops timeline service key mapping (remove drinks).

## UI/UX

- [x] Remove drinks/happy hour labels from time slot UI.
- [x] Update restaurant settings service periods to lunch/dinner only.
- [x] Update onboarding defaults to lunch/dinner only.

## Tests

- [x] Update schedule + booking API tests.
- [x] Update Storybook fixtures in plan-step stories.

## Notes

- Assumptions: no existing drink bookings; bar tables allowed for lunch/dinner.
- Deviations: DB-level bar-table drinks-only trigger not verified; check via Supabase MCP if assignments fail.

## Batched Questions

- None.
