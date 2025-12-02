---
task: plan-step-occasion-removal
timestamp_utc: 2025-12-02T02:00:26Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm applicable AGENTS.md (root only) and existing patterns.

## Core

- [x] Update plan form schema to make bookingType optional and adjust types.
- [x] Simplify PlanStepForm UI: remove OccasionPicker, adjust accordion copy, move NotesField outside accordion.
- [x] Update usePlanStepForm handlers/state to drop manual occasion handling while keeping inference.

## Tests

- [x] Review plan step unit tests (no assertions needed updating); attempted targeted vitest run, blocked by missing @/tests/fixtures/wizard alias resolution.

## Notes

- Assumptions: bookingType can be inferred automatically from time and does not require explicit user selection.
- Deviations: Vitest file-level run currently fails due to missing @/tests/fixtures/wizard path in this environment.
