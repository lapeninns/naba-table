---
task: restaurant-settings-nav
timestamp_utc: 2025-11-26T11:51:47Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify the source of the Restaurant settings card list.

## Core

- [x] Add "Tables" entry with correct route and description.
- [x] Reorder entries by importance.
- [x] Add card nav to Tables settings page.

## UI/UX

- [ ] Verify visual consistency and spacing on desktop and mobile.
- [ ] Check keyboard navigation order aligns with new order.

## Tests

- [ ] Not applicable (static render), but ensure lint/type checks if affected.

## Notes

- Assumptions: Importance order set as Profile > Operating Hours > Booking occasions > Service Periods > Tables.
- Deviations: None yet.
