---
task: email-template-upgrades
timestamp_utc: 2026-04-02T14:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Update task artifacts and continuity for the new email-template scope.

## Core

- [x] Extend template variant domain model with `subject` and `preheader`.
- [x] Add token validation helpers and stronger variant guardrails.
- [x] Update booking email preview/send/render flows to use the richer model.
- [x] Enrich delivery metadata with variant-level analytics details.
- [x] Align auth magic-link email body styling with the shared base shell.

## UI/UX

- [x] Add subject/preheader fields and counters to the editor.
- [x] Add template-aware token guidance and warnings.
- [x] Expand preview to show delivery summary details and plain text.

## Tests

- [x] Unit/domain tests
- [x] Route tests
- [x] Component tests where needed
- [x] Typecheck / targeted Vitest

## Notes

- Assumptions:
  - Delivery metadata can hold variant analytics without a schema migration.
- Deviations:
  - No additional component test harness was required because the upgraded ops editor behavior is covered by targeted route/domain tests plus Chrome DevTools verification on the live dev harness.

## Batched Questions

- None.
