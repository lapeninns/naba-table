---
task: fix-eslint-unused-floor-plan-helper
timestamp_utc: 2025-12-15T23:43:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Remove unused `getTableStateAtTime(...)` helper from floor-plan page.
- [x] Confirm no references remain.

## Verification

- [x] Run `eslint --fix --max-warnings=0` for the affected file or staged set.
- [ ] Chrome DevTools MCP smoke check (no console errors on app load). (blocked; see `verification.md`)

## Notes

- Assumptions: `getTableStateAtTimeFast(...)` is the active code path and functionally equivalent for current usage.
