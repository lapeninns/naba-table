---
task: ops-bookings-ux-improvements
timestamp_utc: 2026-02-06T16:07:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Improve /app/bookings UX

This task implements the approved plan:

- Default view: Upcoming (when no `filter` and no `date`).
- Add "View" segmented control in sticky toolbar.
- Add date picker (All vs service date) with Today/Clear.
- Add Reset to clear filters/search/context (preserve `restaurantId`).
- Fix ops empty-state CTA routing for single-host vs app-subdomain.
- Remove dead pagination URL/state.

Notes:

- No DB changes.
- UI verification required via Chrome DevTools MCP.
