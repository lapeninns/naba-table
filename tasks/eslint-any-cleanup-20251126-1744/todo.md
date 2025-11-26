---
task: eslint-any-cleanup
timestamp_utc: 2025-11-26T17:44:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect `tests/server/ops-bookings-cache.test.ts` to locate `any` usages.

## Core

- [x] Replace `any` types with typed interfaces or inline types reflecting expected shape.
- [x] Ensure mocks stay aligned with helpers and functions under test.

## UI/UX

- N/A

## Tests

- [x] Run eslint on the project/file to confirm warnings resolved (including server/ops/bookings.ts and tests/server/ops-bookings-cache.test.ts).
- [ ] (Optional) Run the specific test file if needed.

## Notes

- Assumptions: Only typings needed; no runtime changes.
- Deviations: None.

## Batched Questions

- None.
