---
task: fix-eslint-admin-any
timestamp_utc: 2025-11-25T23:30:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect `server/occasions/admin.ts` for the `any` usage and surrounding types.

## Core

- [x] Replace `any` with appropriate existing type, ensuring logic unchanged.

## Tests

- [x] Run ESLint (targeted) to confirm warning removed.

## Notes

- Assumptions: Existing types in repo are suitable; no API changes.
- Deviations: None yet.

## Batched Questions

- None.
