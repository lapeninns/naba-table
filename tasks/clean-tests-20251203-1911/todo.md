---
task: clean-tests
timestamp_utc: 2025-12-03T19:11:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Enumerate first-party test directories (exclude `node_modules`).
- [x] Confirm inclusion of `src/app/api/test/*` test helper routes.

## Core

- [x] Remove first-party `__tests__` / `tests` directories.
- [x] Remove test helper API route folder `src/app/api/test`.
- [x] Clear generated test artifacts (e.g., `.next`, coverage/playwright reports if present).

## Verification

- [x] Run `find` excluding vendors to confirm no test directories remain.
- [x] Note that no automated tests are runnable post-removal.

## Notes

- Assumptions: user wants all first-party tests gone; dependencies left untouched.
- Deviations: will delete `.next` if present to remove embedded test output.
