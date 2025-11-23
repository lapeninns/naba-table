---
task: browse-partner-restaurants-revamp
timestamp_utc: 2025-11-23T01:06:47Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Read existing RestaurantBrowser + data fetching flow
- [x] Confirm available restaurant fields in Supabase schema

## Core

- [x] Extend RestaurantSummary type + listRestaurants API selection to include detail fields
- [x] Keep React Query/analytics wiring intact
- [x] Ensure API handler returns expanded fields without breaking callers

## UI/UX

- [x] Redesign RestaurantBrowser list layout with richer details + minimal styling
- [x] Update loading/empty/error states with accessible copy and aria-live
- [x] Validate CTA/focus order/keyboard navigation

## Tests

- [ ] Unit
- [ ] Integration
- [ ] E2E (critical flows)
- [ ] Axe/Accessibility checks

## Notes

- Assumptions:
- Deviations:

## Batched Questions

-
