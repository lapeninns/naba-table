---
task: ops-dashboard-optimization
timestamp_utc: 2026-02-02T20:26:55Z
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

- [x] Add deferred search value and use in list filtering.
- [x] Reduce `now` dependency in filtering/sorting when not needed.
- [x] Memoize booking DTO mapping for paginated list.
- [x] Lazy-load heatmap data when calendar opens.
- [x] Use summary totals for header counts.
- [x] Memoize OpsBookingCard.

## UI/UX

- [ ] Ensure loading/empty/error states unchanged.
- [ ] Confirm keyboard navigation and focus states.

## Tests

- [ ] Manual ops dashboard smoke.
- [ ] Chrome DevTools MCP trace + Lighthouse.
- [x] Typecheck: `pnpm run typecheck`.

## Notes

- Assumptions: header counts can use summary totals.
- Deviations: none.
