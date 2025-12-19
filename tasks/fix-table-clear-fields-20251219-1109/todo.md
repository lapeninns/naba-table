---
task: fix-table-clear-fields
timestamp_utc: 2025-12-19T11:10:33Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm all applicable AGENTS policies

## Core

- [x] Normalize `position` and `notes` to `null` in table update payload

## Tests

- [ ] Run targeted tests if available (or document not run)

## Notes

- Assumptions: `TableInventoryClient` is the only caller of table updates.
- Deviations: None.

## Batched Questions

- Q: Any external callers rely on omitting `position`/`notes` in updates?
  A: No other call sites found via search.
