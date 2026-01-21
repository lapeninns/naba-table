---
task: revamp-ops-booking-card
timestamp_utc: 2026-01-21T11:07:31Z
owner: github:@sisyphus
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Revamp OpsBookingCard

## Objective

We will enable restaurant hosts to scan and manage bookings efficiently during busy service by transforming the `OpsBookingCard` into a high-density, accessible dashboard tile.

## Success Criteria

- [ ] "Status Rail" border-l-4 with context-aware colors.
- [ ] 4-column responsive InfoTile grid for metadata.
- [ ] Accessibility: Keyboard navigation and ARIA labels verified (0 critical axe issues).
- [ ] Performance: Logic consolidated in memoized `meta` object.
- [ ] Technical: Zero `luxon` dependency in the component.

## Architecture & Components

- `OpsBookingCard`: Main container with `border-l-4` and hover shadows.
- `InfoTile`: Sub-component for structured metadata (Table, Contact, Booking, Notes).
- `StatusPill`: Visual indicator for booking status.
- `Avatar`: Guest identification.
- `DropdownMenu`: Meatball menu for secondary actions.

## Data Flow & API Contracts

- Props: `OpsBookingCardProps` (booking, timezone, handlers).
- State: Memoized `meta` object for all display logic.

## UI/UX States

- **Normal**: High-density grid with "Status Rail".
- **Loading**: `pendingAction` overlay with blur.
- **Urgency**: Badges for "Late", "Overdue", "Soon".
- **Empty/Done**: Muted styles (opacity-75, line-through).

## Edge Cases

- **Long Names/Notes**: Use `truncate` and `line-clamp`.
- **Missing Contact Info**: Fallback to "No contact" italic text.
- **Unassigned Table**: Amber alert highlighting in InfoTile.

## Testing Strategy

- **Manual QA**: Chrome DevTools MCP (A11y, Performance, Network).
- **Automated**: `lsp_diagnostics` to ensure type safety.

## Rollout

- Feature flag: N/A (Direct improvement of existing component).
- Monitoring: Console errors and performance metrics in DevTools.

## DB Change Plan (if applicable)

- N/A
