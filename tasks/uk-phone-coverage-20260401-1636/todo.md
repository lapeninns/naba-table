---
task: uk-phone-coverage
timestamp_utc: 2026-04-01T16:36:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Audit the shared UK phone helper and current route/schema usage.
- [x] Probe representative UK numbering-plan examples against the installed phone library.

## Core

- [x] Broaden the shared UK phone helper to accept the supported UK numbering-plan countries.
- [x] Apply shared phone validation to public booking create/list routes.
- [x] Apply shared phone validation to guest self-serve booking update routes.

## Tests

- [x] Add focused accepted/rejected UK phone validation tests.
- [x] Run targeted Vitest coverage.
- [x] Run typecheck.

## Notes

- Assumptions: Treat `GB`, `IM`, `GG`, and `JE` as in-scope for “UK phone” support in the product.
- Deviations: None.
