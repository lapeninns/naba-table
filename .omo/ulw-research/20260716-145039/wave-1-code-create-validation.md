# Wave 1: create validation

## Key findings

- Public create validates a start-only schedule slot, then resolves party/option duration, then unified validation rejects `end > operating close` before the atomic capacity mutation.
- Public and Ops request schemas do not accept a client duration.
- The SQL RPC validates only start time, making the TypeScript unified guard the current finish-by-close authority.
- Service-period end and last-seating buffer are not create constraints.

## Primary anchors

- `server/bookings/create-precommit-context.ts:86-160`
- `server/bookings/duration.ts:45-84`
- `server/booking/BookingValidationService.ts:401-466`
- `server/runtime-policy.ts:158-160`
- `supabase/migrations/20260124_fix_booking_rpc_day_of_week.sql:116-225`

## EXPAND

- DEAD END: Later replacement of `create_booking_with_capacity_check` — exhaustive migration search found none after 20260124; later migration only changes privileges.
- DEAD END: Additional production booking-create routes — only public POST and ops walk-in POST invoke unified creation; draft and scripts are non-shipped/direct-data utilities.
- LEAD: Verify the deployed staging RPC matches repository migration history — WHY: repository evidence cannot prove remote schema drift — ANGLE: staging-only `pnpm db:*` inspection under explicit deployment authority.
- LEAD: Decide the product-level meaning of “close”: operating close, service-period close, last-seating buffer, or a composed boundary — WHY: current subsystems implement all four differently — ANGLE: synthesize team findings into one eligibility rule and acceptance matrix.
