---
task: ops-dashboard-ux-perf
timestamp_utc: 2026-02-02T21:06:50Z
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

- [x] Combine guest stats + tab counts in one pass.
- [x] Stabilize `now` reference passed to booking cards.
- [x] Dynamic import `BookingDetailsDialogWrapper`.

## UI/UX

- [ ] Ensure dialogs still open/close smoothly.

## Tests

- [ ] Manual ops dashboard smoke.
- [ ] Chrome DevTools MCP trace + Lighthouse.
