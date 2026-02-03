---
task: party-duration-policy
timestamp_utc: 2026-02-03T13:41:10Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [feat.reservation.turn_bands]
related_tickets: []
---

# Research: Party-Size-Based Reservation Durations

## Requirements

- Functional:
  - Ops can set per-restaurant dining duration rules by party size for lunch/dinner.
  - Booking window and capacity logic must use those per-restaurant rules.
  - Safe defaults remain when per-restaurant rules are missing.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Ops UI follows existing accessibility patterns (labels, errors, focus).
  - Validate inputs at API boundary; fail fast with stable errors.
  - Keep policy evaluation deterministic and fast (used in hot paths).

## Existing Patterns & Reuse

- Party-size durations (turn bands) are hardcoded in `server/capacity/policy.ts` under `defaultVenuePolicy.services[service].turnBands`.
- Booking windows use `bandDuration()` + service buffers in `server/capacity/table-assignment/booking-window.ts` and other capacity paths.
- Ops already edits restaurant settings (interval, default duration, last seating buffer) via `components/ops/restaurants/RestaurantDetailsForm.tsx` and `src/components/features/restaurant-settings/RestaurantProfileSection.tsx`, backed by `src/app/api/ops/restaurants/[id]/route.ts`.
- Service periods per restaurant live in `restaurant_service_periods` (see `server/restaurants/servicePeriods.ts`), and are edited in `ServicePeriodsSection`.
- Schedule generation uses `reservation_default_duration_minutes` as a fallback because party size is unknown (`server/restaurants/schedule.ts`).
- `docs/BUSINESS_LOGIC.md` documents turn bands but currently diverges from code for dinner start time (docs show 17:00; code has 16:00).

## External Resources

- None required yet (user requested internal “recommended” default; no public vendor docs integrated).

## Constraints & Risks

- Must keep single source of truth for duration rules.
- Must not break capacity/availability flows that assume `getVenuePolicy()` is pure and fast.
- Supabase migrations are remote-only; schema change needs staging-first plan and rollback.
- Multiple modules call `getVenuePolicy()` without restaurant id; we must avoid inconsistent policy across paths.

## Open Questions (owner, due)

- Q: Store per-restaurant turn bands in new table vs JSON on restaurants?
  A: Pending (recommend normalized table for validation + ops editability).
- Q: Apply rules per booking option (lunch/dinner) or per service period?
  A: Pending (recommend per booking option, independent of daily periods).
- Q: Need caps/mins on duration values?
  A: Pending (recommend bounds similar to existing 15–300 min).

## Recommended Direction (with rationale)

- Add per-restaurant “turn bands” (party-size duration rules) for lunch/dinner, editable in ops.
- Keep the existing banded model (not linear per-head) to match current behavior and avoid surprises; ops can adjust bands to mirror restaurant research.
- Introduce a normalized table for turn bands (`restaurant_turn_bands`) keyed by restaurant + service key + max party size, with validation and sorting at read time.
- Keep schedule slot generation using default duration (party size unknown), but capacity/booking windows use the per-restaurant bands when available.
