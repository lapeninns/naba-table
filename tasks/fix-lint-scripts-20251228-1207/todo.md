---
task: fix-lint-scripts
timestamp_utc: 2025-12-28T12:07:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Convert scripts to ESM TypeScript

## Core

- [x] Load env for Supabase client scripts
- [x] Load env for SQL execution script
- [x] Remove hard-coded secrets

## UI/UX

- [ ] N/A

## Tests

- [ ] Lint (manual or lint-staged)

## Notes

- Assumptions: Env vars available via `.env.local` or shell.
- Deviations: None.

## Batched Questions

- None
