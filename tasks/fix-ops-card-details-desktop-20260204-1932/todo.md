---
task: fix-ops-card-details-desktop
timestamp_utc: 2026-02-04T19:32:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify affected components and regression source.

## Core

- [x] Restore `forceMount` behavior for desktop details.

## UI/UX

- [x] Desktop details visible.
- [x] Mobile collapse unchanged.

## Tests

- [ ] Manual QA (Chrome DevTools MCP).

## Notes

- Assumptions:
  - Radix Collapsible hides children when closed unless `forceMount`.
- Deviations:
  - None.

## Batched Questions

- None.
