---
task: ops-dashboard-perf3
timestamp_utc: 2026-02-02T21:44:20Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm affected files and AGENTS scopes.

## Core

- [x] Add row height cache for virtualizer measurement.
- [x] Add search index map per booking.
- [x] Add DTO cache by booking id + update key.
- [x] Batch realtime update toasts.
- [x] Apply React Query `select` to reduce renders if safe.

## Tests

- [x] `pnpm run typecheck`.
- [ ] Chrome DevTools MCP trace + Lighthouse.
