---
task: realtime-hardening
timestamp_utc: 2026-01-25T12:12:46Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN]
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Audit realtime subscriptions and query keys
- [x] Identify list update gap(s)
- [x] Set production env var via Vercel CLI

## Core

- [x] Add bookings-table realtime invalidation for list queries
- [x] Gate polling by realtime health and visibility
- [x] Debounce invalidations
- [x] Enable realtime by default (env default + helper)

## UI/UX

- [ ] No UI changes planned

## Tests

- [ ] Manual QA (DevTools MCP) for ops list + summary
- [ ] Realtime on/off fallback check
- [x] Unit test for realtime default helper

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None
