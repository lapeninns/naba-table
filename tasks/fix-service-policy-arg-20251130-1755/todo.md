---
task: fix-service-policy-arg
timestamp_utc: 2025-11-30T17:55:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify failing call to `loadServicePolicy` and confirm function signature.

## Core

- [x] Pass `client` argument to `loadServicePolicy` inside `computeSummary`.

## UI/UX

- N/A

## Tests

- [x] Run `pnpm run build` to confirm TypeScript passes.

## Notes

- Assumptions: No other call sites require changes.
- Deviations: None.

## Batched Questions

- None.
