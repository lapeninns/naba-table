---
task: ops-booking-card-tile
timestamp_utc: 2026-01-21T01:43:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops Booking Card High-Density Tile

## Requirements

- Functional:
  - Revamp `OpsBookingCard` into a high-density, dashboard-style operational tile.
  - Add status rail (left 4px border) with state-based color mapping.
  - Use 4-column responsive InfoTiles for Table, Contact, Booking Ref, Notes.
  - Notes tile shows amber tint when notes exist.
  - Header: avatar + guest name + party size/time; guest name is primary anchor.
  - Primary action in bottom-right; secondary actions in dropdown menu.
  - Remove luxon usage; use native Date/Intl formatting.
  - Consolidate display logic into memoized meta object.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keyboard access for dropdown menu and primary button; maintain focus visibility.
  - Avoid regressions in existing booking lifecycle actions.
  - No new PII exposure; keep display data consistent with existing card.
  - Performance: avoid extra renders; memoize derived fields.

## Existing Patterns & Reuse

- `components/dashboard/OpsBookingCard.tsx` current layout and actions.
- `components/ui` shadcn primitives: `Card`, `Button`, `DropdownMenu` (to verify).
- `components/dashboard/OpsBookingCardSkeleton.tsx` should align with new layout.

## External Resources

- None required (no external specs referenced).

## Constraints & Risks

- Must follow AGENTS SDLC phases and maintain task artifacts.
- Manual UI QA via Chrome DevTools MCP required for UI changes.
- No luxon dependencies in component (native Date/Intl only).
- Legacy `components/` directory: keep changes minimal and avoid new primitives.

## Open Questions (owner, due)

- Q: Should the dropdown include any destructive confirmation UI changes?
  A: Keep existing handlers and behavior; only relocate into dropdown. (owner: github:@amanshresthaa)

## Recommended Direction (with rationale)

- Update `OpsBookingCard` layout and create a local `InfoTile` sub-component for consistent labels.
- Replace luxon formatting with `Intl.DateTimeFormat` and native Date calculations.
- Keep action wiring as-is, only reflow UI to reduce accidental taps.
