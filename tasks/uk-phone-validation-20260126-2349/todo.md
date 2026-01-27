---
task: uk-phone-validation
timestamp_utc: 2026-01-26T23:49:11Z
owner: github:@copilot
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify canonical phone validation and usages.
- [x] Choose a production-grade validation approach.

## Core

- [x] Update canonical UK phone validation to support more number types.
- [x] Ensure storage normalization remains DB-constraint safe.
- [x] Update user-facing validation copy where it is now too narrow.

## Tests

- [x] Add shared validation tests for UK numbers.
- [x] Run relevant test suites.

## Notes

- Assumptions:
- Use `libphonenumber-js` for GB validation.

## Batched Questions

- None yet.
