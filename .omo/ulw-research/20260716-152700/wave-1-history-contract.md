# Wave 1: history and contract

## Key findings

- October 2025 introduced `close - max(buffer, duration)` as the original finish-by-close policy.
- March 2026 deliberately made configured starts authoritative and removed buffer/duration filtering.
- May and June 2026 restored finish-by-close only in hard-enabled unified create validation.
- Current operator copy still promises that last-seating buffer stops seating early enough for guests to finish.

## Primary anchors

- Commit `922dd6ce`
- Commit `ab301ac2`
- Commit `6abe47a6`
- Commit `d735f546`
- `components/ops/restaurants/restaurantDetailsFormModel.ts:90-96`
- `tests/server/bookings/timeValidation.test.ts:57-65`
- `tests/server/booking-validation-security.test.ts:149-160`

## EXPAND

- LEAD: Decide configured-start authority versus composed finish-by-close — WHY: history intentionally supports both; code alone cannot choose product intent — ANGLE: acceptance matrix and operational semantics.
- LEAD: Clarify whether buffer is independent or must cover duration — WHY: current UI wording and field validation disagree — ANGLE: formula and copy.
- DEAD END: No current end-to-end regression composes close, buffer, party duration, visible slot, and create result.
