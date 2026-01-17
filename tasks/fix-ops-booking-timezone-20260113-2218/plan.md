---
task: fix-ops-booking-timezone
timestamp_utc: 2026-01-13T22:17:59Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers, github:@qa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Normalize ops booking date/time (timezone-safe)

## Objective

We will ensure ops booking times/dates are computed and displayed in the restaurant’s timezone so that operators see consistent booking details regardless of their device timezone.

## Success criteria

- [ ] Ops booking list cards and booking details dialog show the same start/end times on different devices.
- [x] Ops API returns `startIso`/`endIso` that represent the correct instant for `booking_date` + `start_time` in the restaurant timezone, even when `start_at` is null.
- [x] Tests cover the fallback-ISO conversion logic.

## Architecture & components

- **API**: `src/app/api/ops/bookings/route.ts`, `src/app/api/ops/bookings/[id]/route.ts`
  - Update fallback ISO generation to use Luxon with explicit restaurant timezone.
- **UI (ops)**: audit and replace any device-local date formatting in ops booking surfaces.
  - Primary surfaces: `components/dashboard/OpsBookingCard.tsx`, booking details dialog under `src/components/features/dashboard/booking-details/**`.
  - Secondary: legacy components if still used (`components/dashboard/BookingRow.tsx`).

## Data flow & contracts

- Preserve existing response shape (`startIso`/`endIso` remain strings).
- Derive:
  - Prefer DB `start_at`/`end_at` when present.
  - Else interpret `booking_date` + `start_time` as a local time in `restaurants.timezone`.
  - Convert to canonical ISO in UTC (e.g. `YYYY-MM-DDTHH:mm:ss.sssZ`).

## Edge cases

- Restaurant timezone missing → default to `UTC`.
- Daylight saving transitions (ambiguous/non-existent local times):
  - Prefer Luxon validation; if invalid, return empty string (current behavior) and rely on existing validation paths.

## Testing strategy

- Add/update route-handler tests to verify fallback conversion:
  - Given `booking_date`, `start_time`, and a restaurant timezone with a known offset, verify `startIso` output matches expected UTC.
  - Ensure both list route and detail route behave consistently.

## Verification

- Manual UI QA:
  - Open the same booking in ops on two machines with different device timezones; confirm displayed date/time matches.
  - Confirm “arrival countdown” uses restaurant timezone.

## Rollout

- No feature flag initially (bugfix). If risk deemed high, gate with a small flag in ops route handler.
