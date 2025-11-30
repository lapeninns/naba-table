---
task: capacity-simplification
timestamp_utc: 2025-11-30T12:46:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm flag inventory and remove unused env/schema entries.
- [ ] Note deviations/assumptions in this task if scope changes.

## Core

- [x] Hardcode allocator v2 path; remove shadow/forceLegacy branches.
- [x] Simplify auto-assign retry to single policy.
- [x] Replace strategic/scarcity config with constants; simplify selector scoring.
- [x] Remove adjacency mode/min-party flags; enforce connected adjacency only.
- [x] Simplify holds TTL and remove rate-limiting logic.
- [ ] Prune shadow/debug/unused flags from env/feature helpers and docs/examples as needed.

## Tests

- [ ] Run targeted tests/lint for modified capacity modules (selector/holds/auto-assign) or closest available suite.
- [ ] Update snapshots/fixtures if required.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

-
