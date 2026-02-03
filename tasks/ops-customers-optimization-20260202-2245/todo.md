---
task: ops-customers-optimization
timestamp_utc: 2026-02-02T22:45:00Z
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

- [x] Switch ops customers list to infinite query (pageSize=50) and remove pagination UI.
- [x] Virtualize customers list rendering and disable animations while scrolling.
- [x] Remove `page` query param usage.

## Tests

- [x] `pnpm run typecheck`.
- [ ] Chrome DevTools MCP trace + Lighthouse (blocked: missing env vars).
