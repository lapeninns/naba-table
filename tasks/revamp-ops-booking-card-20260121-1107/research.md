---
task: revamp-ops-booking-card
timestamp_utc: 2026-01-21T11:07:31Z
owner: github:@sisyphus
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Revamp OpsBookingCard

## Requirements

- **Functional**:
  - High-density dashboard tile for operational use.
  - "Status Rail" (border-l-4) with dynamic colors.
  - 4-column "InfoTile" grid.
  - Notes highlighting (amber tint).
  - Meatball menu for secondary actions.
  - Primary action button (Seat/Finish) in bottom right.
- **Non-functional**:
  - **A11y**: Keyboard nav, ARIA labels, focus management.
  - **Perf**: Memoized display logic, optimized re-renders.
  - **Security**: No PII in logs/attributes.
  - **Tech**: Native JS dates only (no luxon).

## Existing Patterns & Reuse

- **Shadcn UI**: `Avatar`, `Badge`, `Button`, `Card`, `DropdownMenu` are already used.
- **BookingRow**: Uses `deriveBookingDisplayState`. Need to check if I can reuse this logic or if it's too coupled to `luxon`.
- **OpsBookingCard**: Current implementation (revamped in previous turn) is the baseline.

## External Resources

- [WAI-ARIA APG: Menu Button](https://www.w3.org/WAI/ARIA/apg/patterns/menubutton/) - For the meatball menu.
- [Hospitality Dashboard UX Best Practices] - UNCONFIRMED.

## Constraints & Risks

- **Constraint**: Removal of `luxon` while maintaining timezone accuracy.
- **Risk**: "Fat-finger" actions in busy service (mitigated by meatball menu).
- **Risk**: Information overload if not balanced visually.

## Open Questions (owner, due)

- Q: Should we support table assignment directly from the card?
  A: Requirement says primary action is Seat/Finish, secondary actions in menu. Table assignment might be in "Details" or a separate modal.

## Recommended Direction (with rationale)

- Proceed with the current implementation but refine accessibility and visual polish.
- Strictly adhere to `AGENTS.md` verification steps (DevTools MCP).
