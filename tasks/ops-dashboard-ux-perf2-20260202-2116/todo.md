---
task: ops-dashboard-ux-perf2
timestamp_utc: 2026-02-02T21:16:20Z
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

- [x] Remove summary refetch from realtime hook; consume cached summary.
- [x] Pause clock updates when tab hidden.
- [x] Add content-visibility for booking list container.
- [x] Reuse date/time formatters in OpsBookingCard.

## UI/UX

- [ ] Verify list still renders correctly.

## Tests

- [ ] Manual ops dashboard smoke.
- [ ] Chrome DevTools MCP trace + Lighthouse.
- [x] Typecheck: `pnpm run typecheck`.
