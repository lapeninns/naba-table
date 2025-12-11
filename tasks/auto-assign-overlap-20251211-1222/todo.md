---
task: auto-assign-overlap
timestamp_utc: 2025-12-11T12:22:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect inline auto-assign confirm error handling for `allocations_no_overlap`.
- [x] Identify logging/observability gaps.

## Core

- [x] Add handling/retry/fallback when confirm throws `allocations_no_overlap` (record result, schedule job).
- [x] Enrich logs with idempotency and hold info.

## UI/UX

- [ ] N/A (no UI changes).

## Tests

- [x] Add unit/integration test covering overlap error path.

## Notes

- Assumptions: capacity conflict indicates race; background job can find alternate slot.
- Deviations: None yet.

## Batched Questions

- None.
