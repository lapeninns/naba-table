---
task: restaurant-settings-modularization
timestamp_utc: 2025-11-26T11:05:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add settings sub-layout + sub-nav component for restaurant settings modules.
- [x] Scaffold dedicated pages for profile, operating-hours, occasions, service-periods.

## Core

- [x] Move Tables page to `/settings/tables`; keep redirect from `/seating/tables`.
- [x] Update sidebar navigation items and active matchers for new routes.
- [x] Adjust static route references (e.g., screenshot list) to new paths.

## UI/UX

- [x] Ensure sub-nav is keyboard accessible and highlights active route.
- [ ] Verify each module retains loading/error states and spacing in the new layout. (Blocked by auth env — see verification.)

## Tests

- [ ] Manual QA via Chrome DevTools MCP: navigate new settings pages, redirect from old path, sidebar highlights, focus visibility. (Attempted; blocked at auth error.)

## Notes

- Assumptions: Tables should appear under Settings as its own entry; restaurant modules should be separate pages, not a single combined screen.
- Deviations: No feature flags or backend changes planned.

## Batched Questions

- ...
