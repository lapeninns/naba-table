---
task: fix-allowed-capacities
timestamp_utc: 2025-12-19T01:15:31Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm all AGENTS policies (root only for server/ops paths)

## Core

- [x] Remove `ensureAllowedCapacity` usage in create route
- [x] Remove `ensureAllowedCapacity` usage in update route
- [x] Remove unused helper(s) from `server/ops/tables.ts`
- [x] Remove legacy ops allowed capacities service (`src/services/ops/allowedCapacities.ts`)

## Tests

- [ ] Run targeted tests if available (or document not run)

## Notes

- Assumptions: Legacy allowed capacities ops service is unused and safe to delete.
- Deviations:

## Batched Questions

- Q: Should we fully delete legacy `src/services/ops/allowedCapacities.ts`? (currently unused)\n+ A: Yes, removed as part of cleanup.
