---
task: unify-max-width
timestamp_utc: 2025-11-26T16:49:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Update shared shells and page wrappers to `max-w-[80vw]`.
- [x] Ensure reservation wizard wrappers use `max-w-[80vw]`.
- [x] Remove residual 5xl/6xl container widths for page-level layouts.

## Tests/Verification

- [ ] Manual visual check (key pages) via DevTools MCP (to be done).

## Notes

- Assumptions: padding is sufficient on small screens.
- Deviations: None yet.
