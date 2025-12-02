---
task: modal-close-padding
timestamp_utc: 2025-12-01T23:23:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Increase close button safe area on booking modal

## Objective

Ensure the booking detail modal close (X) has sufficient padding so clicks cannot hit underlying UI, improving safety and a11y hit target.

## Success Criteria

- [ ] Close button hit area ≥44px and separated from modal edge/background interactions.
- [ ] Visual layout remains aligned with existing header/cards; no overflow or clipping.
- [ ] Keyboard and screen reader operation unchanged.

## Architecture & Components

- Update the booking modal container/header component under `src/components/features/bookings/**` (used by Manage bookings view).
- Adjust padding/margin on header and/or close icon container; no new components.

## Data Flow & API Contracts

- No data/API changes.

## UI/UX States

- Applies to modal header in all states (loading/success tabs). No new states introduced.

## Edge Cases

- Small viewports: ensure padding doesn’t cause horizontal scroll.
- High zoom: maintain sufficient spacing.

## Testing Strategy

- Manual UI check in browser: verify close icon spacing and hit area.
- Spot-check keyboard navigation to close button (Tab/Shift+Tab/Enter/Space).

## Rollout

- No flags; direct change.
- Monitor for layout regressions in modal header.

## DB Change Plan (if applicable)

- N/A.
