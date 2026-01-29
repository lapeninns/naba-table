---
task: dast-scanning
timestamp_utc: 2026-01-29T13:07:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create DAST workflow with OWASP ZAP baseline scan.

## Core

- [x] Build and start app in workflow.
- [x] Run ZAP baseline against local app.
- [x] Publish ZAP report artifact.

## Tests

- [x] Run validators: `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Notes

- Assumptions: scheduled/manual workflow is acceptable for initial DAST coverage.
- Deviations: none.
