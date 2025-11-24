---
task: filter-active-tables-zones
timestamp_utc: 2025-11-24T17:07:01Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify table/zone list components and data fetch utilities.
- [x] Confirm data fields for active/disabled status.

## Core

- [x] Add filter control (toggle/dropdown) for Active vs All.
- [x] Apply filter to tables list.
- [x] Apply filter to zones list.
- [x] Ensure state sync if both lists on same page.

## UI/UX

- [x] Ensure keyboard focus and accessible labeling for filter control.
- [ ] Empty/Loading/Error states remain functional when filtered.

## Tests

- [x] Add/Update unit or component tests for filtered rendering.
- [ ] Run existing test suite.

## Notes

- Assumptions: client-side filtering acceptable unless API query param exists.
- Deviations: None yet.

## Batched Questions

- Should default view be Active-only or All? (Need confirmation from product/owner)
