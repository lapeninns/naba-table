# Wave 1: database and capacity

## Key findings

- Unified create resolves duration before mutation and rejects end-after-close; the SQL RPC does not independently enforce the end.
- Overnight schedule generation is not compatible with application or SQL create semantics.
- Alternative-slot duration is dropped from aggregate evaluation.
- Capacity preview and commit have additional status/counting differences; these remain adjacent risks rather than the requested close-rule fix.

## Primary anchors

- `server/bookings/create-precommit-context.ts:86-160`
- `server/booking/BookingValidationService.ts:401-466`
- `server/capacity/service.ts:195-240,398-465`
- `supabase/migrations/20260124_fix_booking_rpc_day_of_week.sql:116-388`

## EXPAND

- Resolve the product decision for configured late fixed slots: authoritative start slots versus strict end-before-close.
- Resolve whether capacity limits mean concurrent occupancy or total covers/parties per service period.
- Inspect live Supabase definitions for `create_booking_with_capacity_check`, booking idempotency indexes, capacity-rule uniqueness, and any non-repository constraints.
- Design a logical-service-date model before enabling overnight booking creation.
- Add paired contract tests that run the same slot through schedule projection and create validation.
- Add real database concurrency tests for matching-rule, missing-rule, and same-idempotency-key races.
