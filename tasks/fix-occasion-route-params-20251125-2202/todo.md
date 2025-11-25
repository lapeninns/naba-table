---
task: fix-occasion-route-params
timestamp_utc: 2025-11-25T22:02:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify required typing change in `src/app/api/ops/occasions/[key]/route.ts`.

## Core

- [x] Update PATCH signature to use `params: Promise<{ key: string }>` and await it.
- [x] Update DELETE signature similarly.
- [x] Align Supabase occasion queries with missing typed columns using `returns`/generics.
- [x] Allow partial update input for occasion service to support status toggles.

## Tests

- [x] Run `pnpm run build` to ensure validator passes.

## Notes

- Assumptions: No API behaviour changes needed beyond typing alignment; Supabase schema includes `is_builtin`, `deleted_at`, audit table even though generated types are stale.
- Deviations: Broadened update input typing and Supabase type assertions to match runtime schema.
