---
task: ops-booking-card-view-model-policy
timestamp_utc: 2026-03-29T22:34:59Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Booking Card View-Model Policy

## Requirements

- Functional:
  - Expand the canonical Ops booking card builder to return grouped `header`, `details`, `actions`, `meta`, and `booking` submodels.
  - Normalize guest identity with a Walk-in Guest fallback and initials derived from the normalized label.
  - Produce canonical notes/contact/reference labels, canonical table state, urgency rules, footer completion label, and a structured action policy.
  - Keep selector input scope unchanged; selectors should only pass existing booking rows into the richer builder.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep the card components presentational and avoid duplicating policy logic.
  - Preserve existing action behavior and accessibility semantics.
  - Avoid widening fetches or introducing new API contracts.

## Existing Patterns & Reuse

- Canonical builder currently lives in `src/components/features/dashboard/cards/opsBookingCardUtils.ts`.
- Bookings list selector uses the builder in `src/components/features/bookings/opsBookingsSelectors.ts`.
- Dashboard virtualized list also uses the builder directly in `src/components/features/dashboard/list/BookingsListVirtualized.tsx`.
- Status rail styling already comes from canonical status config in `lib/ops/booking-status.ts`.
- Card subcomponents already map cleanly to grouped submodels:
  - `OpsBookingCardHeader`
  - `OpsBookingCardDetails`
  - `OpsBookingCardActions`

## External Resources

- None required; change is internal and contract-driven.

## Constraints & Risks

- Must use prompt constraints exactly:
  - Walk-in Guest fallback
  - initials from normalized label
  - no urgency for done or checked-in bookings
  - canonical `assigned` / `unassigned` / `not_applicable` table state
- `BookingsListVirtualized` must stay aligned with `opsBookingsSelectors` so the same booking produces the same card model in both flows.
- Existing tests include a partial future-facing expectation for action props, so consumer and test contracts may need coordinated updates.

## Open Questions (owner, due)

- Q: Should action policy include textual disabled reasons for the UI, or only booleans/visibility?
  A: UNCONFIRMED. Current scope can stay at structured booleans/labels unless existing consumers require reasons.

## Recommended Direction (with rationale)

- Make `opsBookingCardUtils.ts` the single source of truth for normalized identity, labels, table state, urgency, footer state, and action policy.
- Keep `booking` and `meta` submodels explicit for raw access and derived timeline/status state, while moving all card-facing strings and booleans into `header`, `details`, and `actions`.
- Update card components to consume only the grouped submodels so business rules stop leaking into the UI layer.
