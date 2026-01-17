---
task: fix-ops-booking-timezone
timestamp_utc: 2026-01-13T22:17:59Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers, github:@qa]
risk: medium
flags: []
related_tickets: []
---

# Research: Normalize ops booking date/time (timezone-safe)

## Problem statement

Some devices show different booking times in ops booking details. The UI should not depend on the viewer’s local device timezone.

## Requirements

- Functional:
  - Ops booking date/time displays consistently across devices.
  - Ops booking details/list show the time in the restaurant’s timezone (not the operator’s device timezone).
  - Derived values that depend on date boundaries ("today", "past") must use restaurant timezone.
- Non-functional:
  - No secrets in code.
  - Preserve existing API contracts (or version changes safely).
  - Add/adjust tests for the affected route handlers.

## Existing patterns & reuse

- Luxon is already used for timezone-safe parsing/formatting:
  - `components/dashboard/OpsBookingCard.tsx` uses `DateTime.fromISO(...).setZone(timezone)`.
  - `src/components/features/dashboard/booking-details/utils.ts` parses/prints using `DateTime.fromISO(..., { zone: timezone })`.
- There are still timezone-dependent code paths:
  - `src/app/api/ops/bookings/route.ts` fallback ISO uses `new Date(`${date}T${time}`)` (runtime-local timezone) then `toISOString()`.
  - `src/app/api/ops/bookings/[id]/route.ts` fallback uses `toIsoString(`${booking_date}T${start_time}`)` which also depends on runtime-local timezone.
  - Legacy dashboard components (e.g. `components/dashboard/BookingRow.tsx`) use `new Date(...).toDateString()` comparisons (viewer-local timezone).

## Likely root causes

1. **Fallback ISO generation is timezone-unsafe** when `start_at`/`end_at` are null.
   - `new Date('YYYY-MM-DDTHH:mm')` interprets the string as _local time in the runtime’s timezone_.
   - This can cause `startIso` to be off by the restaurant timezone offset.
   - Depending on whether the UI is rendering from list data vs. fetched detail (with `start_time`), users can observe different displayed times.

2. **Some UI formatting uses the browser’s local timezone** (though not necessarily in the new booking details dialog), which can surface as “different device shows different time”.

## Open questions

- Do we want this normalization **ops-only**, or should we also fix guest-facing date/time formatting (guest receipt/history currently uses device-local formatting in some spots)?

## Recommended direction

- Make ops API fallbacks timezone-aware:
  - When deriving `startIso`/`endIso` from `booking_date` + `start_time`/`end_time`, parse them in the restaurant timezone and convert to a canonical ISO (UTC).
- Sweep ops UI for device-local formatting and replace with timezone-explicit formatting.
- Add/update tests to lock behavior.
