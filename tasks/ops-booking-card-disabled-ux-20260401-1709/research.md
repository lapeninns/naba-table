---
task: ops-booking-card-disabled-ux
timestamp_utc: 2026-04-01T17:09:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops Booking Card Disabled UX Follow-up

## Requirements

- Functional:
  - Restore a clear locked-card interaction contract for ops booking cards while lifecycle mutations are pending.
  - Prevent users from interacting with the mobile collapse toggle, details button, and overflow trigger while a card is locked.
  - Preserve the existing behavior where done bookings can still expose disabled menu items for visibility.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Locked state must be expressed accessibly.
  - No change to booking mutation semantics or server behavior.
  - Keep the change scoped to the existing dashboard card stack.

## Existing Patterns & Reuse

- `buildOpsBookingCardViewModel` centralizes the action policy for details, menu items, and primary actions.
- `OpsBookingCard` already receives `disableActions` from the view model and is the right place to express a row-level locked state.
- An existing dev harness route at `src/app/(public)/dev/ops-bookings/ui/OpsBookingsDevHarness.tsx` provides a browser-verifiable surface for this UI.

## External Resources

- None needed; this is a local UX contract correction within the existing component architecture.

## Constraints & Risks

- The dev harness completes lifecycle mutations too quickly to hold a stable pending state for a browser screenshot.
- Current tests explicitly encoded the old “pending but still clickable” contract and needed to be updated together with the implementation.

## Open Questions (owner, due)

- Q: Should future non-pending external lock states keep the overflow menu visible-but-disabled or fully inert?
  A: This patch treats locked cards as fully inert. Owner: maintainers. Due: next dashboard UX review.

## Recommended Direction (with rationale)

- Make the row itself advertise and visually communicate a locked state via `aria-disabled` and inert pointer behavior.
- Disable the mobile collapse toggle explicitly so keyboard interaction matches the locked visual state.
- Disable the overflow trigger only when the entire action surface is locked, while preserving visible disabled menus for completed bookings.
- Keep this backed by focused component tests and browser proof on the existing ops harness.
