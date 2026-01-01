---
task: fix-inline-auto-assign-client
timestamp_utc: 2026-01-01T11:25:51Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Review inline auto-assign service and related helpers for client usage patterns.

## Core

- [x] Pass the provided Supabase client to `quoteTablesForBooking`.
- [x] Pass the provided Supabase client to `atomicConfirmAndTransition`.

## UI/UX

- [ ] N/A

## Tests

- [ ] Run targeted tests if available.

## Notes

- Assumptions: No UI or DB changes required.
- Deviations:

## Batched Questions

- None.
