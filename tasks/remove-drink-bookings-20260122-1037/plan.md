---
task: remove-drink-bookings
timestamp_utc: 2026-01-22T10:37:47Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Remove Drink Bookings

## Objective

We will remove drinks (including happy hour) as a booking type so users can only book lunch or dinner, and no drinks-only time slots are offered.

## Success Criteria

- [ ] Guest booking flow shows only lunch/dinner options and no “Drinks” or “Happy hour” labels.
- [ ] API validation rejects `bookingType: "drinks"` for guest and ops routes.
- [ ] Schedule generation emits only lunch/dinner slots; no drinks-only coverage remains.
- [ ] Existing lunch/dinner bookings behave unchanged; no regressions in capacity or ops views.
- [ ] Tests updated and passing for schedule + booking routes.

## Architecture & Components

- **Booking type constants & validation**
  - Update `lib/enums.ts`, `reserve/shared/config/booking.ts`, `reserve/shared/booking/types.ts` to remove `drinks` from UI options.
  - Update `reserve/entities/reservation/reservation.schema.ts` and API schemas to allow only lunch/dinner.
- **Scheduling & availability**
  - Remove drinks/happy hour paths in `reserve/shared/time/reservations.ts` and adjust `inferBookingOption` to pick lunch/dinner only.
  - Update `server/restaurants/schedule.ts` to stop emitting `drinks` service keys and `drinksOnly` labels; remove drinks fallback behavior.
  - Update `reserve/features/reservations/wizard/services/useTimeSlots.ts` default booking option to lunch/dinner.
- **Ops + capacity logic**
  - Remove `drinks` from `server/capacity/policy.ts` service keys and any downstream consumers.
  - Update `server/capacity/table-assignment/quote.ts` to handle bar-table constraints without relying on `drinks` booking type (define new rule or allow bar tables for meal bookings if approved).
  - Update `server/ops/table-timeline.ts` to remove drinks service key and label.
- **UI and copy**
  - Remove drinks labels in `reserve/shared/formatting/booking.ts`.
  - Update booking wizard UI and stories in `reserve/features/reservations/wizard/ui/steps/plan-step/*`.
  - Update restaurant settings UI in `src/components/features/restaurant-settings/ServicePeriodsSection.tsx` and `servicePeriodsMapper.ts` to only manage lunch/dinner periods and remove drinks-specific hints.
  - Update onboarding defaults in `src/components/features/onboarding/OnboardingWizard.tsx`.
- **APIs**
  - Update guest booking routes `src/app/api/bookings/route.ts` and `src/app/api/bookings/[id]/route.ts` to normalize only lunch/dinner.
  - Update ops booking schema and route: `src/app/api/ops/bookings/schema.ts`, `src/app/api/ops/bookings/route.ts`.
- **Docs/tests**
  - Update `docs/BUSINESS_LOGIC.md` rules that reference drinks (bar-table rule, service periods summary).
  - Update tests under `src/app/api/*/*.test.ts` and storybook fixtures to reflect lunch/dinner only.

## Data Flow & API Contracts

- **Guest create booking**: `POST /api/bookings`
  - Request: `{ date, time, party, bookingType, seating, ... }` where `bookingType` ∈ {`lunch`,`dinner`}.
  - Response: unchanged shape; reject `drinks` with existing validation error format.
- **Guest edit booking**: `PATCH /api/bookings/[id]`
  - Same validation change: no `drinks` accepted.
- **Schedule endpoint**: `/api/restaurants/[slug]/schedule`
  - `availableBookingOptions` returns only lunch/dinner.
  - `slots[].availability.labels` no longer include `drinksOnly` or happy-hour labels.

## UI/UX States

- Booking type selector shows lunch/dinner only; no drinks toggle.
- Time slot grid shows meal labels only; no “Drinks only” label.
- If a restaurant has no lunch/dinner service configured, schedule returns no slots; UI shows empty state (existing pattern).

## Edge Cases

- Restaurants previously configured as drinks-only: after removal, these should show “no slots” until lunch/dinner is configured.
- Existing drink bookings: confirmed none exist; no migration needed.
- Bar tables: allow lunch/dinner bookings (remove drinks-only restriction).
- Availability logic fallback: ensure lunch/dinner are selected deterministically without drinks fallback.

## Testing Strategy

- Unit tests: schedule generation and booking option inference (no drinks/happy hour).
- API tests: booking routes reject `drinks` and schedule returns lunch/dinner only.
- UI smoke: booking wizard + restaurant settings flows for lunch/dinner.
- Manual QA: Chrome DevTools MCP for booking flow (mobile/tablet/desktop) and a11y checks.

## Rollout

- No new feature flag unless requested; deploy with direct removal.
- Monitor booking create errors (invalid bookingType) and ops schedule screens for empty-slot regressions.

## DB Change Plan (if applicable)

- Use Supabase MCP (remote only) to inspect `booking_occasions` and service period tables.
- Plan migration (staging first): set `booking_occasions.is_active = false` for `key = 'drinks'` (or remove row if safe) and ensure no service periods reference `drinks`.
- Attach dry-run diff to `artifacts/db-diff.txt` and document rollback (re-activate `drinks`).
