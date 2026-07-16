# Wave 1: create validation

## Key findings

- Public and ops creation resolve duration server-side from the selected option, restaurant turn bands, and party size.
- Unified validation enforces same-day end and `end <= operating close` before the capacity mutation.
- Create does not consume `lastSeatingBufferMinutes`.
- Service-period end currently controls eligible starts; booking end may extend beyond service-period end if it remains before operating close.
- The database RPC checks start within hours but does not independently enforce end within close.

## Primary anchors

- `server/bookings/create-precommit-context.ts:86-120`
- `server/bookings/duration.ts:37-82`
- `server/booking/BookingValidationService.ts:401-466`
- `supabase/migrations/20260124_fix_booking_rpc_day_of_week.sql:175-204`

## EXPAND

- LEAD: Share the close evaluator between guest projection and create validation — WHY: duplicated arithmetic can drift again — ANGLE: pure leaf decision module.
- LEAD: Consider database invariant parity — WHY: service-role or dormant paths can bypass TypeScript finish-by-close — ANGLE: RPC end check.
- DEAD END: Confirmation paths do not provide a second operating-close invariant.
