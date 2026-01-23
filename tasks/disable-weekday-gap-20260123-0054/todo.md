---
task: disable-weekday-gap
timestamp_utc: 2026-01-23T00:55:24Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm deletion of “Drinks & Cocktails”.
- [x] Confirm no fallback if lunch/dinner periods missing.

## Core

- [x] Enforce service‑period coverage in schedule slot generation.
- [x] Ensure only lunch/dinner options are returned in schedule and booking validation.

## Data

- [x] Delete “Drinks & Cocktails” bookings (3 rows).
- [x] Delete drinks service periods (21 rows).
- [x] Delete “Drinks & Cocktails” from `booking_occasions`.

## UI/UX

- [ ] Verify booking UI shows lunch/dinner only; no drinks/cocktails label.

## Tests

- [ ] Manual QA via Chrome DevTools MCP.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None.
