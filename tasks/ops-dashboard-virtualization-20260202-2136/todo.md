---
task: ops-dashboard-virtualization
timestamp_utc: 2026-02-02T21:36:52Z
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

- [x] Add `@tanstack/react-virtual` dependency.
- [x] Replace pagination with `useWindowVirtualizer` list.
- [x] Use variable row measurement.
- [x] Update visible booking IDs from virtual rows.
- [x] Disable row animations while scrolling.

## Tests

- [x] `pnpm run typecheck`.
- [ ] Chrome DevTools MCP trace + Lighthouse.
