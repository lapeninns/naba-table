---
task: ops-booking-card-view-model-boundaries
timestamp_utc: 2026-03-29T22:45:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Booking Card View-Model Boundaries

## Requirements

- Functional:
  - Rebuild `OpsBookingCard` boundaries around the canonical view-model contract.
  - Keep `OpsBookingCard` focused on orchestration only.
  - Make `OpsBookingCardHeader` render normalized header props.
  - Make `OpsBookingCardDetails` render normalized details props.
  - Keep details always visible on desktop and disclosure-driven on mobile.
  - Make `OpsBookingCardActions` consume a structured action policy while preserving the current surface callbacks.
  - Keep invalid actions visible but disabled.
  - Keep the plain `Details` action enabled during pending mutations.
  - Preserve no-show confirmation.
  - Prevent done bookings from exposing mutating actions as valid.
- Non-functional:
  - Preserve existing list/card rendering surface and action handlers.
  - Keep current accessibility semantics for disclosure and menu/dialog flows.

## Existing Patterns & Reuse

- `src/components/features/dashboard/cards/opsBookingCardUtils.ts` already acts as the canonical card view-model builder.
- `src/components/features/dashboard/cards/OpsBookingCard.tsx` currently decomposes the view model back into raw props, so boundaries are not fully normalized.
- `src/components/features/booking-state-machine/BookingActionButton.tsx` contains existing structured action validity concepts that can inform the card action policy.
- `src/components/features/bookings/opsBookingsSelectors.ts` and `src/components/features/dashboard/list/BookingsListVirtualized.tsx` already funnel booking rows through `buildOpsBookingCardViewModel`.

## Constraints & Risks

- The card is used by both ops dashboard and ops bookings list flows, so the external callback surface must remain stable.
- Pending lifecycle state currently disables the full action area; this must be narrowed so `Details` remains available while other action validity still reflects pending state.
- Disclosure behavior must stay stable on small screens while desktop stays expanded.
- Existing tests appear partially stale relative to current card props, so targeted test refresh is likely required.

## Open Questions

- None currently blocking. Use existing visible behavior as source of truth where tests are absent.

## Recommended Direction

- Extend the canonical card view model with normalized `header`, `details`, and `actions` slices and move action validity policy generation into `opsBookingCardUtils.ts`.
- Keep `OpsBookingCard` as the coordinator for disclosure state and callback wiring only.
- Preserve the external handler surface in `OpsBookingCard`, but have `OpsBookingCardActions` render from the normalized action policy instead of recomputing status rules locally.
