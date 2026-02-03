---
task: ops-bookings-optimization
timestamp_utc: 2026-02-02T22:13:00Z
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

- [x] Memoize search input change handler.
- [x] Memoize status filter change handler.
- [x] Memoize retry handler for bookings query.
- [x] Switch ops bookings list to infinite query (pageSize=50) and remove pagination UI.
- [x] Virtualize bookings list rendering and disable animations while scrolling.
- [x] Memoize ops lifecycle handlers for bookings page.

## Tests

- [x] `pnpm run typecheck`.
- [ ] Chrome DevTools MCP trace + Lighthouse (blocked: missing env vars).
