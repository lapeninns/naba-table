---
task: auto-assign-hold-permission
timestamp_utc: 2025-12-03T09:31:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm failing request path and reproduction steps.
- [x] Identify services/routes touching `table_holds`.

## Core

- [x] Fix permissions/policy or code path causing `permission denied for table table_holds`.
- [ ] Ensure strict conflict enforcement GUC is set/enforced for holds.

## Tests

- [ ] Add/adjust automated tests for auto-assign/holds if present.
- [ ] Manual verification of inline auto-assign flow.

## Notes

- Assumptions: none yet.
- Deviations: none yet.

## Batched Questions

- [ ] Which DB role executes holds operations in prod/staging?
