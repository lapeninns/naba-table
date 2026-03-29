---
task: customers-rebuild
timestamp_utc: 2026-03-29T17:45:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Research and contracts

- [x] Trace the production customers page data path end to end
- [x] Confirm dev harness mocking is isolated from production behavior
- [x] Define canonical guest rollup semantics from bookings truth

## Server and API

- [x] Rebuild `server/ops/customers.ts` around live customer + booking rollups
- [x] Align `/api/ops/customers` DTO mapping with the rebuilt rollups
- [x] Align `/api/ops/customers/export` with the same rollup helper

## Client

- [x] Update client data hook/types only where required by the rebuilt contract
- [x] Keep search/filter/sort/focus/infinite-scroll behavior intact

## Tests

- [x] Add rollup/helper regression tests
- [x] Update any affected customers tests
- [x] Run targeted vitest
- [x] Run typecheck
- [x] Run targeted lint

## Manual verification

- [x] Verify the customers UI flow in Chrome DevTools MCP
- [x] Verify search/filter/focus/export behavior
- [x] Check console/runtime cleanliness

## Notes

- Assumptions:
  - Current `customer_profiles` fields are not reliable enough to remain the source of truth for guest history.
- Deviations:
  - The dev harness still uses in-memory guest fixtures for UI QA; production correctness is verified through the rebuilt shared rollup tests rather than the harness network path.
