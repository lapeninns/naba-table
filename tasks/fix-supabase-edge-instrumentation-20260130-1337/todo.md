---
task: fix-supabase-edge-instrumentation
timestamp_utc: 2026-01-30T13:37:33Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm middleware uses `instrumentedSupabaseFetch` via `getMiddlewareSupabaseClient`.

## Core

- [x] Remove `node:crypto` import from `server/supabase-instrumentation.ts`.
- [x] Add Edge-safe hashing helper (deterministic, sync).
- [x] Ensure hashing remains best-effort and does not throw.

## UI/UX

- [ ] N/A

## Tests

- [x] Decide on unit test coverage for hash helper (no new tests added).

## Notes

- Assumptions: No external consumers depend on hash algorithm.
- Deviations: No new tests; change is internal instrumentation.

## Batched Questions

- None.
