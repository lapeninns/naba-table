# Wave 1: slot generation

## Key findings

- Guest schedule requests contain slug and date, but no party size or duration.
- Server slot generation uses candidate start times, service-period membership, and occasion state; it does not consume turn bands, default duration, party size, or last-seating buffer.
- Unified create is hard-enabled and can reject a displayed late slot after resolving duration.
- Overnight, UTC+14 weekday/month, and DST nonexistent-time handling introduce further Plan/Create divergence.

## Primary anchors

- `server/restaurants/schedule.ts:330-343,430-483,492-512,590-605,622-640`
- `reserve/features/reservations/wizard/services/useTimeSlots.ts:18-22,44-64`
- `reserve/features/reservations/wizard/services/schedule.ts:135-152`
- `server/booking/BookingValidationService.ts:449-465`

## EXPAND

- DEAD END: Production guest use of `/api/availability` for initial slot listing — exhaustive source search found no client caller; endpoint only checks a specific requested time.
- DEAD END: Alternative current slot generator based on static reservation config — `getSlotsByService` is test-only.
- DEAD END: Current last-seating booking-logic consumer — exhaustive exact-name search found only settings, transport metadata, normalization, and fixtures.
- LEAD: Unified-vs-legacy create semantics and precise duration resolution ownership — WHY: determines the exact confirmation error for every booking option/party size — ANGLE: owned by `/root/create_validation`.
- LEAD: Database/service-window and overnight invariant design — WHY: requires choosing an absolute service-date representation and preserving RPC safety — ANGLE: owned by `/root/database_capacity`.
- LEAD: End-to-end setting contract remediation — WHY: current UI copy and transport contract disagree with runtime behavior — ANGLE: owned by `/root/settings_contract`.
