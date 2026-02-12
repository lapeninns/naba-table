---
task: booking-confirmation-pdf-template
timestamp_utc: 2026-02-12T18:31:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify booking + restaurant fields required for template.

## Core

- [x] Implement dynamic PDF template renderer in server layer.
- [x] Wire route payload data into renderer.
- [x] Keep auth/ownership checks intact.

## Tests

- [x] Run targeted lint and typecheck.
- [x] Run PDF smoke test and inspect extracted text content.

## Notes

- Assumptions: one-page PDF is sufficient for confirmation payload.
- Deviations: none.
