---
task: dead-links
timestamp_utc: 2025-12-04T13:45:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inventory existing routes/pages and shared link constants.

## Core

- [x] Identify links/CTAs pointing to 404 or missing routes.
- [x] Remove or repoint dead links/CTAs.
- [ ] Clean up unused pages/assets tied to dead CTAs.

## UI/UX

- [ ] Verify layouts remain intact after removals.
- [ ] Ensure keyboard navigation/focus order unaffected.

## Tests

- [ ] Run relevant tests (lint/unit if available).
- [ ] Manual QA with Chrome DevTools MCP (console/network/a11y/perf).

## Notes

- Assumptions: TBD
- Deviations: TBD
