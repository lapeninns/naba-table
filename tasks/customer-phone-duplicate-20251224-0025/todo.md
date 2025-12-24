---
task: customer-phone-duplicate
timestamp_utc: 2025-12-24T00:24:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Add phone-based lookup on unique violation in `server/customers.ts`.
- [x] Preserve marketing opt-in and name update behavior.

## Tests

- [x] Add unit test for phone conflict reuse.
- [x] Run targeted Vitest for customers tests.

## Notes

- Assuming existing email should be preserved when phone conflicts; only phone is updated when normalized differs.
