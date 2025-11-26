---
task: restaurant-settings-nav
timestamp_utc: 2025-11-26T11:51:47Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Restaurant Settings Navigation

## Requirements

- Functional: Add "Tables" to the Restaurant settings quick links list and order the items by importance. Add the same cards navigation to the Tables settings page for consistency.
- Non-functional: Maintain accessibility (keyboard focus, semantic structure); keep visual consistency with existing cards; follow existing design system.

## Existing Patterns & Reuse

- Restaurant settings cards are rendered in the Restaurant settings landing page within the app shell.
- Uses shared card components in `src/components/features/restaurant-settings`.

## External Resources

- N/A

## Constraints & Risks

- Must preserve responsive layout and focus order.
- Need to respect existing routing conventions for settings pages.

## Open Questions (owner, due)

- Definition of "importance" ordering? (Assume: Profile > Operating Hours > Booking occasions > Service Periods > Tables unless specified.)

## Recommended Direction (with rationale)

- Extend the quick link cards to include "Tables" pointing to the tables configuration page if available.
- Sort the list in a logical priority order based on overall settings flow (Profile first, core scheduling next, booking config, service windows, tables layout last).
