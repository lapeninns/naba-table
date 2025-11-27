---
task: booking-recency-sort
timestamp_utc: 2025-11-27T15:04:25Z
owner: github:@assistant
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review existing booking list implementation and API sorting

## Core

- [x] Add server-side parsing for `sortBy` so created_at sorting works
- [x] Ensure backend API returns correct sort order (created_at desc for recent)

## UI/UX

- [ ] Confirm UI displays sorted results and handles empty/loading states (no changes expected)

## Tests

- [x] Unit / integration coverage for sorting

## Notes

- Assumptions:
- Deviations:

## Batched Questions

-
