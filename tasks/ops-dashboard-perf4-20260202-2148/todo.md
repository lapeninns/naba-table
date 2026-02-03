---
task: ops-dashboard-perf4
timestamp_utc: 2026-02-02T21:48:54Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm affected files and AGENTS scopes.

## Core

- [x] Invalidate row height cache on status changes.
- [x] Memoize booking action handlers in OpsDashboardClient.
- [x] Trigger virtualizer re-measure after cache invalidation.
- [x] Memoize remaining inline callbacks (prev/next date, search change, retry).

## Tests

- [x] `pnpm run typecheck`.
- [ ] Chrome DevTools MCP trace + Lighthouse (blocked: missing env vars).
