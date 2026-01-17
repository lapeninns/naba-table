---
task: fix-ops-booking-timezone
timestamp_utc: 2026-01-13T22:17:59Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers, github:@qa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Requirements lock-in

- [x] Confirm scope: ops-only (guest normalization out of scope)

## API

- [x] Update `src/app/api/ops/bookings/route.ts` fallback ISO generation to be timezone-aware.
- [x] Update `src/app/api/ops/bookings/[id]/route.ts` fallback ISO generation to be timezone-aware.

## UI

- [x] Audit ops booking surfaces for device-local formatting and replace with timezone-explicit formatting (fixed `components/dashboard/BookingRow.tsx` + ops card state).

## Tests

- [x] Update/add tests for ops list route fallback ISO conversion.
- [x] Update/add tests for ops detail route fallback ISO conversion.

## Verification

- [x] Run relevant unit/integration tests (targeted vitest runs; see `artifacts/test-summary.txt`).
- [ ] Manual ops UI spot-check (different timezones).

## Notes

- Assumptions:
  - `booking_date` + `start_time` represent restaurant-local wall time.
- Deviations:
  - Full manual UI QA (Chrome DevTools MCP, multi-timezone devices) not executed in this environment; needs follow-up before PR merge.
