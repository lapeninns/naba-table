---
task: table-assignment-refactor
timestamp_utc: 2026-01-26T00:31:19Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Table Assignment Algorithm Refactor

## Objective

We will refactor the table assignment algorithm across selector, quote, and assignment layers to improve clarity and maintainability while preserving identical behavior.

## Success Criteria

- [ ] Current behavior preserved across selection, quote, and assignment flows.
- [ ] Algorithm is easier to understand and modify (smaller pure helpers, single source of truth).
- [ ] Tests cover key assignment scenarios and invariants.

## Architecture & Components

- `server/capacity/selector.ts`: core scoring + combination enumeration (refactor into pure helpers).
- `server/capacity/table-assignment/quote.ts`: planning pipeline uses selector.
- `server/capacity/table-assignment/assignment.ts`: assignment commit path.
- `server/capacity/table-assignment/direct-assignment.ts`: direct manual assignment validation.
- `server/capacity/v2/planner.ts`: planner wrapper around selector.

## Data Flow & API Contracts

- No external API contract changes expected. Preserve current function signatures.
- Ensure validation remains at IO boundaries; refactor internal helpers only.

## UI/UX States

- N/A (algorithm-only)

## Edge Cases

- Party size exceeds any single table (combinations required).
- Adjacency required vs optional.
- Capacity caps and allowCapacityOverflow fallback.
- Seed limiting and evaluation limits.
- Zone constraints and frontier adjacency pruning.

## Testing Strategy

- Unit: selector scoring/ordering, combination enumeration, adjacency handling.
- Integration: quote flow uses selector and returns same top candidates.
- Regression fixtures (if present) for real bookings/venues.

## Rollout

- Feature flag: N/A
- Exposure: N/A
- Monitoring: N/A
- Kill-switch: N/A

## DB Change Plan (if applicable)

- N/A
