---
task: remove-drink-bookings
timestamp_utc: 2026-01-22T10:37:47Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Remove Drink Bookings

## Requirements

- Functional:
  - Prevent new drink-only bookings from being created (guest + ops flows).
  - Remove drinks as a selectable booking type across UI, API, and scheduling logic.
  - Preserve behavior for existing non-drink bookings (lunch/dinner/breakfast) without regressions.
  - Confirm no existing drink bookings; no migration needed for historical data.
- Non-functional (a11y, perf, security, privacy, i18n):
  - A11y: No regressions in booking selection controls (labels, focus, keyboard).
  - Perf: Schedule calculations/slot rendering should not regress; avoid extra per-slot processing.
  - Security: No new exposure of booking data; API validation should reject drinks input.
  - Privacy: Any migration or cleanup must avoid leaking PII in logs.
  - i18n: Update labels/strings consistently where “Drinks” appears.

## Existing Patterns & Reuse

- Booking type constants and validation:
  - `lib/enums.ts` and `reserve/shared/config/booking.ts` define `BOOKING_TYPES` and `BOOKING_TYPES_UI` (includes `drinks`).
  - `reserve/shared/booking/types.ts` derives `BOOKING_OPTIONS` from UI list.
  - `reserve/entities/reservation/reservation.schema.ts` zod schema enumerates `drinks` in `bookingType`.
- Guest schedule/slots pipeline:
  - `reserve/shared/time/reservations.ts` defines `drinks` window and `inferBookingOption` fallback logic.
  - `server/restaurants/schedule.ts` emits `services.drinks` and `drinksOnly` labels + fallback to `drinks` as the default in `pickBookingOption`.
  - `reserve/features/reservations/wizard/services/useTimeSlots.ts` default booking option is `drinks`.
  - `reserve/features/reservations/wizard/services/timeSlots.ts` includes `drinksOnly` flags in availability metadata.
- Ops & capacity logic:
  - `server/capacity/policy.ts` defines service keys `lunch/dinner/drinks`.
  - `server/capacity/table-assignment/quote.ts` uses `drinks` to allow bar tables only for drink bookings.
  - `server/ops/table-timeline.ts` labels `drinks` in timeline service keys.
- UI/strings:
  - `reserve/shared/formatting/booking.ts` labels `drinks` as “Drinks & cocktails”.
  - `src/components/features/restaurant-settings/ServicePeriodsSection.tsx` and `src/components/features/restaurant-settings/servicePeriodsMapper.ts` treat drinks as a core service period.
  - `reserve/features/reservations/wizard/ui/steps/plan-step/*` uses `drinks` in stories and “Drinks only” label.
  - `src/components/features/onboarding/OnboardingWizard.tsx` includes `drinks` in defaults.
- API validation and normalization:
  - `src/app/api/bookings/route.ts` and `src/app/api/bookings/[id]/route.ts` normalize booking type with explicit `drinks` branches.
  - `src/app/api/ops/bookings/schema.ts` uses zod enum including `drinks`.
- Data model:
  - `types/supabase.ts` shows `bookings.booking_type` as text with FK to `booking_occasions.key`.
  - `booking_occasions` table contains `is_active`, `label`, `default_duration_minutes`, etc.

## External Resources

- N/A (internal policy; no external docs needed for Phase 1).

## Constraints & Risks

- **DB dependency**: `bookings.booking_type` is a FK to `booking_occasions.key`. Removing `drinks` from catalog without handling existing rows could break reads/writes. (Need to confirm if `drinks` exists in `booking_occasions` data and how it’s seeded.)
- **Ops/Capacity rules**: Business logic expects drinks as fallback and uses it to allow bar-table assignments. Removing drinks may require alternate logic for bar tables and schedule fallback.
- **Schedule defaults**: Multiple places default to `drinks` when schedule metadata is absent; removing without a replacement could change behavior or introduce nulls.
- **Existing bookings**: Confirmed none; no reclassification or migration needed.
- **Service periods UI**: Restaurant settings assume drinks always exists and follows opening hours; removal impacts settings UI and data mapping.
- **Tests**: Several API tests assert `drinks` in available booking options and schedules; these will fail and need updates.
- **Docs**: `docs/BUSINESS_LOGIC.md` includes a rule for bar tables (drinks-only) and must be updated.
- **Supabase migrations**: No migration in repo defines `booking_occasions` table; schema may be managed elsewhere. Risk of incomplete migration plan.

## Open Questions (owner, due)

- Should “drinks” be fully removed from `booking_occasions` or just set `is_active=false`? (Owner: DB, due: 2026-01-24)
- Is there any external integration or reporting pipeline that expects `drinks`? (Owner: Data/Analytics, due: 2026-01-24)

## Resolved Decisions

- Existing drink bookings: none; no migration required. (Confirmed 2026-01-22)
- Bar tables: allowed for lunch/dinner bookings after drinks removal. (Confirmed 2026-01-22)
- Copy: remove “Drinks”/“Happy hour” labels and keep lunch/dinner only. (Confirmed 2026-01-22)

## Recommended Direction (with rationale)

- **Prefer soft-deprecation first**: mark `drinks` inactive in `booking_occasions` (if present) and strip it from UI/API enums to block new creation, while allowing existing bookings to render safely. This reduces migration risk and preserves historical data integrity.
- **Define a replacement fallback** in scheduling (e.g., fallback to `lunch` or `dinner` based on time window) to avoid null/default to `drinks` logic.
- **Update bar table logic** to explicitly handle bar category without requiring a `drinks` booking type, or introduce a policy-based rule that does not depend on booking type if bar tables are still used.
- **Plan explicit data handling** for existing drink bookings (display-only vs. reclassification) to avoid FK or reporting inconsistencies.
