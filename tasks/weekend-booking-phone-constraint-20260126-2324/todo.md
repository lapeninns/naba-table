---
task: weekend-booking-phone-constraint
timestamp_utc: 2026-01-26T23:24:27Z
owner: github:@copilot
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify canonical booking creation handler and upsert logic.
- [x] Locate and review `ensureFallbackContact` implementation.

## Core

- [x] Patch fallback phone generation to respect DB constraints.
- [x] Validate fallback phone length before calling `upsertCustomer`.
- [x] Keep single canonical path; avoid duplicate/shim logic.

## UI/UX

- [ ] N/A (server-side change)

## Tests

- [x] Add unit tests for fallback phone generation/validation.
- [x] Run relevant test suites.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None yet.
