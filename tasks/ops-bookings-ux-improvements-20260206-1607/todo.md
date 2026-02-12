---
task: ops-bookings-ux-improvements
timestamp_utc: 2026-02-06T16:07:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

- [x] Add ops view segmented control (Recent/Upcoming/All/Past/Cancelled)
- [x] Add date picker + URL semantics (select clears filter; clear resets to default)
- [x] Add Reset (cancel debounced URL updates)
- [x] Fix empty-state CTAs with opsBasePath
- [x] Remove `page`/`pageSize` from `/app/bookings` UI layer
- [x] Ensure Upcoming includes PRIORITY_WAITLIST end-to-end
- [x] Add unit tests for filter builder (scope + view)
- [x] Typecheck + lint + vitest
- [x] DevTools MCP manual QA + artifacts
