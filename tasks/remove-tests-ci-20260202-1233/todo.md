---
task: remove-tests-ci
timestamp_utc: 2026-02-02T12:33:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inventory CI workflows and test configs.
- [x] Identify package scripts referencing tests/CI.

## Core

- [x] Remove CI workflows.
- [x] Remove test configs/suites (Vitest/Playwright/etc.).
- [x] Update scripts/docs to remove references.

## Verification

- [x] Run typecheck/build (if applicable) and document results.

## Notes

- Assumptions:
- Deviations:
