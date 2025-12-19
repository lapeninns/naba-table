---
task: lint-guest-view-models-any
timestamp_utc: 2025-12-05T15:38:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect `tests/server/guest/view-models.test.ts` for `any` usage and required types.

## Core

- [x] Replace `any` on the fake Supabase user with a properly typed `User` object.
- [x] Replace `any` on `supabasePromise` with a typed `SupabaseClient<Database>` placeholder.

## Tests

- [x] Run `pnpm eslint tests/server/guest/view-models.test.ts --max-warnings=0`.

## Notes

- Assumptions: Node 22.12.0 is acceptable for running lint despite engine warning.
- Deviations: None.
