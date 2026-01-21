---
task: ops-booking-card-tile
timestamp_utc: 2026-01-21T01:43:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops Booking Card High-Density Tile

## Objective

We will enable restaurant hosts to scan and act on bookings quickly by converting OpsBookingCard into a dense operational tile with status rail, structured info tiles, and safer action placement.

## Success Criteria

- [ ] Status rail displays correct color for booking state (Confirmed, Seated, Late, Soon/Overdue, Finished).
- [ ] InfoTiles render in a responsive 4-column grid with notes highlighting when present.
- [ ] Header emphasizes guest name and shows party size/time clearly.
- [ ] Primary action anchored bottom-right; secondary actions in dropdown menu.
- [ ] No luxon usage in OpsBookingCard; native Date/Intl formatting only.

## Architecture & Components

- `OpsBookingCard`: update layout and derive `meta` with display strings and flags.
- `InfoTile` (local sub-component): label + icon + value with tinted background.
- `DropdownMenu` (shadcn): contains Edit/Cancel/Mark No Show actions.
- `OpsBookingCardSkeleton`: adjust structure to match new density layout.

## Data Flow & API Contracts

- No API changes. Uses existing booking DTO and action handlers.

## UI/UX States

- Loading state overlay remains for pending actions.
- Notes tile uses amber tint when notes present.

## Edge Cases

- Missing/invalid booking date should show fallback placeholders.
- No contact info or table assignment should show em dash or fallback.

## Testing Strategy

- Unit: not required unless logic changes are substantial.
- Manual: Chrome DevTools MCP QA for responsiveness/a11y.

## Rollout

- No feature flag; visual change only.
- Monitor for regressions in actions and status colors.

## DB Change Plan (if applicable)

- Not applicable.
