---
task: clone-old-school-house-production
timestamp_utc: 2026-03-25T16:08:31Z
owner: github:@openai
reviewers: [github:@openai]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Read production-safe script patterns
- [x] Snapshot source restaurant in production
- [x] Create guarded clone script

## Core

- [x] Create target restaurant row
- [x] Copy weekly hours
- [x] Copy service periods
- [x] Copy zones
- [x] Copy tables
- [x] Copy adjacency graph
- [x] Copy memberships needed for access

## UI/UX

- [x] Not applicable

## Tests

- [x] Run guarded production script with explicit confirmation
- [x] Read back target restaurant and verify counts

## Notes

- Assumptions:
  - Dated one-off hour overrides from source should not be copied.
  - The source manager membership should be carried over so the target is operable.
- Deviations:
  - Relied on canonical DB adjacency triggers instead of manual adjacency inserts because the schema rebuilds adjacency automatically from table inventory.

## Batched Questions

- None.
